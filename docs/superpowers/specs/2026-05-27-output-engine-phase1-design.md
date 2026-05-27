# SAS Dashboard — Output Engine (Phase 1) Design

**Date:** 2026-05-27
**Status:** Draft — pending user review
**Project:** SAS Dashboard (Reglow / Amura / Purela analytics)

## Background

The dashboard currently consolidates per-brand marketing data from manual CSV uploads. After production hardening in May 2026, the system is solid technically — but the team uses verbal weekly meetings, not the dashboard, as their primary reporting channel. The dashboard is under-adopted as a daily ops tool.

Strategic insight: rather than fight the team's verbal-meeting habit, the dashboard should **produce outputs that feed both the existing weekly meeting and a future investor narrative**. The AHA: "Dashboard gak perlu dibuka untuk dipakai — dashboard cuma harus produktif saat tim tidur."

This spec covers Phase 1 of a 3-phase roadmap (Output → Source of Truth → Intelligence). Phase 2 (auto-ingest from ad platform APIs) and Phase 3 (anomaly detection + push intelligence) follow in subsequent specs.

## Goals

Phase 1 delivers three artefacts:

1. **Weekly Digest** — auto-generated per-brand WhatsApp-ready text every Monday morning. Tim copy-paste ke group chat, agenda for the verbal weekly meeting comes pre-loaded.
2. **Investor Packet** — on-demand quarterly PDF, investor-grade. Headline metrics, channel breakdown, brand-level performance, customer cohort analysis, narrative sections.
3. **Snapshot via PDF artifact** — the generated investor packet PDF is stored in Supabase Storage and serves as the immutable historical record. No separate snapshot table required for MVP.

## Non-Goals (Phase 1)

- WhatsApp API integration. Tim copy-paste from dashboard manually.
- Auto-ingest from Meta Ads / TikTok Shop / Shopee APIs. CSV upload remains the input mechanism (Phase 2 work).
- Anomaly detection or push notifications (Phase 3 work).
- Real-time alerts on KPI thresholds.
- Multi-tenant / multi-organization support.

## Component 1: Weekly Digest

### Behavior

- Runs once per brand per week (3 digests total: Reglow, Amura, Purela).
- Scheduled cron fires every Monday 09:00 WIB. Computes digest for the *previous* Mon-Sun week.
- Output is rendered text + one chart image, displayed on a dashboard page (`/digest/[brand]`).
- Tim opens the page, clicks "Copy to clipboard", pastes into WhatsApp group.
- Manual "Generate Now" button recomputes the digest for the latest completed Mon-Sun week (same period as the cron). Useful if upstream data was corrected after the Monday auto-run.

### KPI shortlist (final)

1. **Revenue** — sum of `sales.revenue` + `crm.revenue` for the period, filtered by brand
2. **Orders** — count of distinct sales transactions
3. **Blended ROAS** — total revenue / total ad spend across `google_ads`, `meta_ads`, `tiktok_shop`, `shopee` for the period
4. **New customers** — distinct `(customer_name, phone)` first appearing in `sales` or `crm` during the period
5. **Champions segment count** — from RFM analysis at the end of the period (`rfm.calcRFM` filtered to `segment === 'Champions'`)

Each metric includes a WoW (week-over-week) delta with arrow indicator (✅ up, ⚠️ down).

### Top mover

Single highlighted callout per digest. Logic:

- Compute ROAS per ad channel for the period AND for the previous week
- Identify the channel with the largest absolute change in revenue (positive or negative)
- If positive: "TOP MOVER: {channel} +Rp X revenue WoW"
- If negative: "WATCH OUT: {channel} -Rp X revenue WoW"

### Text template

```
📊 {Brand} Weekly Digest — Week {N} ({date range})

Revenue: Rp {value} ({delta} WoW) {emoji}
ROAS: {value}x ({delta} WoW) {emoji}
Orders: {value} ({delta} WoW) {emoji}
New Customers: {value} ({delta} WoW) {emoji}
Champions: {value} ({delta} WoW) {emoji}

{TOP MOVER section}

Full detail: {dashboard URL}/digest/{brand}
```

Approximately 9 lines including the URL. Scannable in 10 seconds.

### Tech sketch

- **Cron:** Vercel Cron (`vercel.json` with `0 2 * * 1` = Monday 09:00 WIB / 02:00 UTC)
- **Endpoint:** `GET /api/cron/weekly-digest` with `CRON_SECRET` env var verification
- **Per-brand fan-out:** the cron endpoint loops `['reglow', 'amura', 'purela']` and computes each independently
- **Persistence:** digest_log table to record the date a digest was generated for each (brand, week). On click of "Generate Now", check this table to know whether to overwrite or warn.
- **Display:** `/digest/[brand]` page renders the latest digest + a "Copy to clipboard" button. Uses `navigator.clipboard.writeText()`.
- **Compute logic:** new module `src/lib/digest/compute.ts` exports `computeWeeklyDigest(brand, weekStart, weekEnd): DigestPayload`. Uses existing `getSales`, `getCRM`, `getGoogleAds` etc from `db.ts`.
- **Text template:** `src/lib/digest/format.ts` exports `formatDigestText(payload): string`. Pure function, no IO.

### Schema additions

```sql
CREATE TABLE IF NOT EXISTS digest_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand         TEXT NOT NULL CHECK (brand IN ('reglow','amura','purela')),
  week_start    DATE NOT NULL,
  week_end      DATE NOT NULL,
  generated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload       JSONB NOT NULL,
  UNIQUE (brand, week_start)
);

ALTER TABLE digest_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "digest_log_select" ON digest_log FOR SELECT
  USING (get_my_role() = 'super_admin' OR brand = get_my_brand());
-- No INSERT/UPDATE/DELETE policy; only the SECURITY DEFINER RPC writes.

CREATE OR REPLACE FUNCTION upsert_digest(
  p_brand       TEXT,
  p_week_start  DATE,
  p_week_end    DATE,
  p_payload     JSONB
) RETURNS digest_log
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_row digest_log;
BEGIN
  IF auth.uid() IS NULL AND current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  INSERT INTO digest_log (brand, week_start, week_end, payload)
  VALUES (p_brand, p_week_start, p_week_end, p_payload)
  ON CONFLICT (brand, week_start) DO UPDATE
    SET week_end = EXCLUDED.week_end,
        payload = EXCLUDED.payload,
        generated_at = now()
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;
REVOKE ALL ON FUNCTION upsert_digest(TEXT, DATE, DATE, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION upsert_digest(TEXT, DATE, DATE, JSONB) TO authenticated, service_role;
```

The cron job runs as `service_role` (via the CRON_SECRET-bearing API route), which the RPC accepts via the role claim check.

## Component 2: Investor Packet

### Behavior

- On-demand generation via dashboard page `/packet`.
- User selects `Brand` (one or all-3 combined) and `Period` (Q1/Q2/Q3/Q4 + Year).
- Clicks "Generate" → server renders PDF → returns download link + saves to Supabase Storage at `packets/{period}-{brand}.pdf` (or `packets/{period}-combined.pdf` for all-3 view).
- Re-generating overwrites the stored PDF (with audit log entry).

### Sections

1. **Cover** — Period, Brand(s), Generated date, generated-by user
2. **TL;DR** — 1-paragraph auto-generated narrative + editable text override (markdown supported)
3. **Headline Metrics** — Total Revenue (+ QoQ growth %), Orders, AOV, Blended ROAS, New customers, Repeat customer %, Gross margin %
4. **Channel Performance** — table per channel (Meta, Google, TikTok Shop, Shopee, Instagram organic, TikTok organic, Facebook organic) showing Revenue, Spend, ROAS where applicable. Plus a Channel Mix pie chart.
5. **Brand Performance Breakdown** — for combined packets, per-brand revenue + growth table + bar chart. For single-brand packets, this section is omitted.
6. **Customer Cohort** — first-purchase cohort analysis. For each month in the quarter, group new customers by first-purchase month and track their revenue contribution in subsequent months. Output: cohort retention table (months 0..3) + LTV per cohort chart.
7. **Top Performers** — top 5 products by revenue (with units sold, gross margin); top 3 campaigns across Meta + Google + TikTok.
8. **Manual Narrative** — three editable text blocks: "Wins this quarter", "Lessons / What we learned", "What's next". User edits inline before generating.

### Cohort analysis logic

```
For each customer c in CRM ∪ Sales for period [Q-start, Q-end]:
  first_purchase_date(c) = MIN(date across sales + crm rows for c)
  cohort_month(c) = floor(first_purchase_date(c) to month)
  if cohort_month(c) within Q-start..Q-end:
    track c's purchases in cohort_month + 0, +1, +2, +3 months
    (capped at current date)

Output: matrix [cohort_month × period_offset] of (count_customers, sum_revenue)
LTV proxy = sum_revenue / count_customers per cohort up to month +3
```

Customer identity = `(customer_name || phone)` lower-cased and trimmed. Imperfect but matches existing RFM logic in `src/lib/rfm.ts`.

### Tech sketch

- **PDF rendering:** Puppeteer + `@sparticuz/chromium-min` for Vercel serverless. Node runtime API route. Renders an HTML template, prints to PDF, returns buffer.
- **Endpoint:** `POST /api/packet/generate` accepting `{ brand: Brand | 'all', period: { year: number, quarter: 1|2|3|4 }, narrative: { wins, lessons, nextSteps } }`.
- **HTML template:** `src/components/packet/PacketTemplate.tsx` — React component server-rendered to HTML. Uses Recharts for charts (renders inline SVG, captured by Puppeteer in the screenshot). Branded header per brand.
- **Compute logic:** `src/lib/packet/compute.ts` exports per-section functions: `computeHeadline()`, `computeChannelPerformance()`, `computeBrandBreakdown()`, `computeCohort()`, `computeTopPerformers()`.
- **Storage:** `packets` bucket in Supabase Storage. Path: `{period}-{brand}.pdf`. Server uploads via service_role key. Public URL signed for 7 days when user clicks "Get share link".
- **Generation history:** table `packet_log` records `(period, brand, generated_at, generated_by, narrative_json, storage_path)`. Allows audit "what did we send investor on date X".

### Schema additions

```sql
CREATE TABLE IF NOT EXISTS packet_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand           TEXT NOT NULL CHECK (brand IN ('reglow','amura','purela','all')),
  period_year     INTEGER NOT NULL,
  period_quarter  INTEGER NOT NULL CHECK (period_quarter BETWEEN 1 AND 4),
  generated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  generated_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  narrative       JSONB NOT NULL DEFAULT '{}',
  storage_path    TEXT NOT NULL,
  UNIQUE (brand, period_year, period_quarter)
);

ALTER TABLE packet_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "packet_log_select" ON packet_log FOR SELECT
  USING (get_my_role() IN ('super_admin','admin','manager')
         AND (get_my_role() = 'super_admin' OR brand = get_my_brand() OR brand = 'all'));

CREATE OR REPLACE FUNCTION upsert_packet_log(
  p_brand           TEXT,
  p_period_year     INTEGER,
  p_period_quarter  INTEGER,
  p_narrative       JSONB,
  p_storage_path    TEXT
) RETURNS packet_log
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_caller_id   UUID := auth.uid();
  v_caller_role TEXT;
  v_row         packet_log;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  SELECT role INTO v_caller_role FROM user_profiles WHERE id = v_caller_id;
  IF v_caller_role NOT IN ('super_admin', 'admin', 'manager') THEN
    RAISE EXCEPTION 'Forbidden: role required' USING ERRCODE = '42501';
  END IF;
  INSERT INTO packet_log (brand, period_year, period_quarter, generated_by, narrative, storage_path)
  VALUES (p_brand, p_period_year, p_period_quarter, v_caller_id, p_narrative, p_storage_path)
  ON CONFLICT (brand, period_year, period_quarter) DO UPDATE
    SET generated_at = now(),
        generated_by = v_caller_id,
        narrative = EXCLUDED.narrative,
        storage_path = EXCLUDED.storage_path
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;
REVOKE ALL ON FUNCTION upsert_packet_log(TEXT, INTEGER, INTEGER, JSONB, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION upsert_packet_log(TEXT, INTEGER, INTEGER, JSONB, TEXT) TO authenticated;
```

Supabase Storage bucket `packets` configured with:
- Public access **disabled**
- Service role can read/write
- Signed URLs issued by the dashboard backend (7-day expiry)

### Notes on cohort + LTV scope

True LTV/CAC requires more rigorous attribution than the data currently supports (e.g., ad-source-to-first-purchase linking is incomplete in `crm` rows). For Phase 1 the packet shows **first-purchase cohort retention and average revenue per cohort over 3 months** — close enough to LTV proxy for early investor conversations. A note in the packet acknowledges the methodology limit.

## Component 3: Snapshot via PDF Artifact

### Behavior

- The investor packet PDF stored in Supabase Storage IS the snapshot.
- Once generated, the PDF is immutable in storage (overwrite policy: new generation overwrites in place, but `packet_log` retains the audit trail of every (period, brand) generation event).
- For "historical view" use cases (e.g., compare Q1 vs Q2 packets side-by-side), users download the older PDF from `packet_log`'s storage_path. No in-dashboard side-by-side view in Phase 1.

### Rationale

User explicitly chose PDF-only over a materialized snapshot table. Trade-off acknowledged: cannot re-render past period with new layout. If that becomes a need (Phase 2 / Phase 3), a `snapshot_metrics` JSONB table can be added on top of the existing logs.

## Architecture diagram

```
+----------------------------------+
|        Next.js App (Vercel)      |
|                                  |
|  +---------+    +------------+   |
|  | /digest |    | /packet    |   |
|  | UI page |    | UI page    |   |
|  +----+----+    +-----+------+   |
|       |              |           |
|       v              v           |
|  +----+----+    +----+--------+  |
|  | digest  |    | packet      |  |
|  | API     |    | API         |  |
|  +----+----+    +----+--------+  |
|       |              |           |
|       v              v           |
|  +----+--------------+--------+  |
|  |   src/lib/digest          |  |
|  |   src/lib/packet          |  |
|  |   src/lib/cohort          |  |
|  +----+----------------+------+  |
|       |                |         |
+-------|----------------|---------+
        |                |
        v                v
+-------+----------------+---------+
|        Supabase Postgres        |
|                                  |
|  digest_log  packet_log  ...     |
|  (existing tables: sales, crm,   |
|  google_ads, meta_ads, etc)      |
+----------------------------------+
              |
              v
+----------------------------------+
|     Supabase Storage             |
|     bucket: packets              |
|     packets/{period}-{brand}.pdf |
+----------------------------------+

Vercel Cron (Monday 09:00 WIB)
   --> POST /api/cron/weekly-digest
        Loops 3 brands, computes, calls upsert_digest RPC.
```

## Data flow

### Weekly digest (cron path)

1. Vercel Cron triggers `POST /api/cron/weekly-digest` at Monday 02:00 UTC.
2. API route verifies `Authorization: Bearer ${CRON_SECRET}` header.
3. Computes Mon-Sun range of the previous week.
4. For each brand in `['reglow', 'amura', 'purela']`:
   - Calls `computeWeeklyDigest(brand, weekStart, weekEnd)` → produces `DigestPayload` (typed object with KPIs + deltas + top mover).
   - Calls `supabase.rpc('upsert_digest', {brand, weekStart, weekEnd, payload})`.
5. Returns 200 with `{ digestsGenerated: 3, perBrand: [{brand, ok: boolean, error?}] }` if all three succeed. If any individual brand fails, returns 207 Multi-Status with the same `perBrand` array — Vercel Cron treats 207 as success and does not retry (per-brand failure is acceptable; we don't want a single bad brand to cause two re-runs of the other two).

### Weekly digest (UI render path)

1. User navigates to `/digest/[brand]`.
2. Page server-component fetches latest row from `digest_log` for brand.
3. Renders the formatted text via `formatDigestText(payload)` (client component for "Copy to clipboard" interactivity).
4. Renders chart image alongside (Recharts component reading from `payload.chartData`).
5. "Generate Now" button calls `POST /api/digest/[brand]/regenerate` which recomputes and upserts.

### Investor packet generation

1. User opens `/packet`, selects brand + period + edits narrative blocks.
2. Clicks "Generate" → `POST /api/packet/generate` with body `{ brand, period, narrative }`.
3. Server:
   - Computes all section data via `src/lib/packet/compute.ts`.
   - Renders `<PacketTemplate data={...} />` to HTML string.
   - Launches headless Chrome (Puppeteer + @sparticuz/chromium-min), opens HTML, prints to PDF buffer.
   - Uploads buffer to Supabase Storage at `packets/{period}-{brand}.pdf`.
   - Inserts into `packet_log` via RPC.
   - Returns `{ downloadUrl: signedUrl, packetId: uuid }`.
4. User clicks the download link → browser downloads PDF.

## Error handling

- **Cron failure:** if `upsert_digest` rejects for one brand, log the error and continue with the remaining two brands. Return 207 Multi-Status (Vercel Cron treats this as success — see Data flow note above). If ALL three fail, return 500 — Vercel Cron will retry once.
- **PDF render failure:** Puppeteer chromium can OOM on Vercel free tier. The route handler enforces a 60s timeout (Vercel max for Pro is 300s). On failure, return 500 with the error message displayed to the user; the failed `packet_log` insert is rolled back (transaction). User can retry.
- **Storage upload failure:** retry once with exponential backoff. On second failure, surface the error and do not record `packet_log`.
- **Empty period (no data):** compute functions return zero-filled metrics. The packet renders normally with zero values and a top-of-page banner: "Insufficient data for this period."
- **Invalid period (future):** API returns 400 if period_quarter end-date is after `current_date`.

## Testing approach

This repo has no test infra yet (per existing CLAUDE.md). The implementation plan will add lightweight unit tests for the pure compute functions:

- `src/lib/digest/compute.test.ts` — KPI calculations, WoW delta, top mover selection
- `src/lib/packet/compute.test.ts` — section computations
- `src/lib/cohort.test.ts` — cohort matrix, LTV proxy

Use Vitest (lightweight, no Jest baggage). Tests run against synthetic fixture data, no Supabase dependency in tests.

For PDF rendering: manual smoke test only. Generate a packet, open the PDF, verify visually. Document the smoke test steps in the implementation plan.

For cron: trigger manually via curl with the `CRON_SECRET` to verify it produces 3 digest_log rows for a known week. Then wait for one real Monday cycle to confirm Vercel cron is triggering correctly.

## Open Questions

None — all design decisions confirmed by user.

## Implementation order (preview, expanded in writing-plans skill)

1. SQL migrations: `digest_log` + `upsert_digest` RPC, `packet_log` + `upsert_packet_log` RPC, `packets` Supabase Storage bucket
2. `src/lib/digest/compute.ts` + tests
3. `src/lib/digest/format.ts` + tests
4. `/api/cron/weekly-digest` route + `vercel.json` cron config
5. `/digest/[brand]` page + "Copy to clipboard" UI
6. `src/lib/cohort.ts` + tests
7. `src/lib/packet/compute.ts` + tests
8. `src/components/packet/PacketTemplate.tsx` (HTML template for Puppeteer)
9. `/api/packet/generate` route (Puppeteer + storage upload)
10. `/packet` page (form + generate button + download link)
11. Smoke tests + manual verification

Estimated effort: 1.5-2 weeks of focused work.
