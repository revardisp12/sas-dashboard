# PRD — KOL Management (SAS Dashboard)

**Date:** 2026-06-09
**Status:** Approved (brainstorming) — pending implementation plan
**Owner:** Revardi
**Surface:** New module inside the existing SAS Dashboard (Next.js 16 + Supabase)

---

## 1. Overview & Goal

A single place for the marketing team to manage influencer (KOL) campaigns end-to-end —
from influencer master data, budgets, published content, to performance — with content
metrics that **update automatically from a pasted video link**.

Today KOL tracking is ad-hoc (spreadsheets, manual metric copying). The goal is to make
KOL campaign performance **visible and low-effort to maintain**: an admin pastes a content
URL and the system pulls likes/comments/views; campaign KPIs and a KOL leaderboard fall out
automatically.

**Primary value:** less manual data entry, comparable per-KOL efficiency (CPV/CPE), and a
clear view of which influencers and campaigns perform.

## 2. Users & Personas

| Role | Need | Access |
|------|------|--------|
| **`kol_specialist`** (new role) | Manage day-to-day KOL ops for their brand | KOL Management module only, **brand-scoped** (CRUD their brand's KOL data) |
| **`admin`** | Oversee KOL performance for their brand | Full KOL access within their brand |
| **`super_admin`** | Cross-brand oversight | Full KOL access, all brands |

Other existing roles (`manager`, `cs`, `crm`) do **not** see KOL Management.

## 3. Scope

In scope: four modules inside the dashboard, under a new sidebar section **"KOL Management"**:

1. **Database KOL** — influencer master data
2. **Budget** — budget pools + utilization
3. **Campaign** — campaign hub with KPIs + leaderboard
4. **Konten KOL** — published content with auto-pulled metrics

Brands: `reglow`, `amura`, `purela` (brand-scoped, consistent with the rest of the dashboard).
Platforms tracked: **Instagram, TikTok, YouTube**.

## 4. How the modules connect

```
Database KOL ──(influencer)──┐
                             ▼
Budget ──(allocation)──▶ Campaign ──(contains)──▶ Konten KOL
   ▲                        │                        │
   └──(progress: Σ fees)────┘   (paste URL → auto-pull metrics → likes/views/…)
```

## 5. Functional Requirements

### 5.1 Database KOL (influencer master)
- CRUD influencers: name, username, platform, followers, niche, contact, notes — per brand.
- Used as the dropdown source when adding content.
- Search/filter by name/username/platform.
- CSV bulk import + template (consistent with other dashboard masters).

### 5.2 Budget
- CRUD budget pools per brand: name, nominal (IDR).
- A campaign links to one budget.
- **Utilization** shown as a progress bar: `Σ(content fees in campaigns on this budget) / nominal`,
  with remaining amount. Computed, not stored.
- Warn when utilization > 100%.

### 5.3 Campaign
- CRUD campaigns: name, brand, linked budget, period_start, period_end, description, status
  (`active` / `ended`).
- Campaign detail view shows:
  - **Funnel-tier signal cards (core):** engagement is NOT shown as a single total. It is split
    by funnel tier (see §5.5) so content with different objectives is compared fairly. One card
    per tier (Awareness / Consideration / Action), each showing the tier's total signals + how
    many content target that tier.
  - **Efficiency cards:** Total Views/Reach, Total Fee, **CPV** = total fee ÷ views.
  - **Trend chart:** Awareness vs Consideration signals over time (by content posted_at).
  - **KOL Leaderboard:** each content ranked by its signal **within its own objective tier** (an
    awareness-objective content is judged on awareness signals), with a tier badge per row.
  - **Content list:** all `kol_contents` in the campaign, each tagged with its objective tier.
- A single blended "engagement rate / total engagement" is intentionally **dropped** in favor of
  per-tier signals — different tiers optimize different metrics.
- ROI/sales attribution is explicitly **out of MVP** (Phase 3).

### 5.4 Konten KOL
- CRUD content rows: campaign, influencer (from Database KOL), platform, product, task,
  **funnel objective** (`awareness` / `consideration` / `action` — the content's intended
  funnel tier, chosen at input), `content_url`, status (`uploaded` / `broken` / `pending`),
  fee, posted_at, and metrics (likes, comments, saved, shares, video_views).
- **Auto-pull metrics from URL** — see §6. On save with a valid URL, the system attempts to
  fetch metrics; on success it fills them and tags `metrics_source='api'`. Manual entry is
  always allowed and overrides.
- Table view: all content per campaign/influencer with an **Objective** badge, a **tier-signal**
  column (the content's performance on its objective tier — see §5.5), metrics, an origin
  indicator (`api` vs `manual`) and `metrics_fetched_at`.
- **Bulk upload** (two modes): (a) CSV import with template, and (b) **paste many video links at
  once** (one per line). Either way, each row runs the auto-pull (§6) per content URL on submit —
  so a batch of links is enriched with metrics in one action.

### 5.5 Funnel-tier engagement model (Marcomm framework)
Engagement is analyzed per funnel tier instead of as one lumped number, because different
content serves different funnel stages. Each content carries an **objective** (its intended tier);
metrics roll up into tier "signals":

| Tier | Objective | Signals (metrics) |
|------|-----------|-------------------|
| **Awareness** | reach & visibility | Views + Likes |
| **Consideration** | interest & intent | Comments + Saves + Shares |
| **Action** | conversion (Phase 3) | Link clicks + Promo redemptions |

This lets the team check, per tier, which content actually performs for the stage it was made for
(e.g., an awareness-objective Reel judged on Awareness signals). The metric→tier mapping above is
the agreed default; it lives in one config constant so it can be tuned later without code changes
elsewhere.

## 6. Metrics Auto-Pull — Adapter Seam

Mirrors the WMS integration pattern: build the pipeline behind a provider interface so the
feature works **manually now** and gains auto-pull the moment an API key is configured —
no pipeline changes at switch-over.

```
KolMetricsProvider (interface)
  fetchMetrics(url, platform) → { likes, comments, saved, shares, views }
        │ implements
   ┌────┴──────────────┐
ManualProvider      RapidApiProvider   ← uses RAPIDAPI_KEY (Instagram Statistics API)
(no-op fallback)    (live, lookup by content URL; covers IG/TikTok/YouTube)
```

- **Switch:** env `KOL_METRICS_ENABLED` = `manual` (default now) | `live` (when key is set).
  Factory `getKolMetricsProvider()` is the only place that picks the implementation.
- **Three ingestion paths, all through the same provider:**
  1. **On save** — admin pastes `content_url` → `fetchMetrics()` → fill metrics,
     `metrics_source='api'`, `metrics_fetched_at=now`. On failure → keep manual, flag status.
  2. **Cron refresh** — `/api/cron/kol-metrics-refresh` (≈2×/week) re-pulls metrics for content
     whose campaign is still `active`. Estimated ~800–1000 req/month → RapidAPI plan ≥1000 req.
  3. **Manual override** — metrics are always hand-editable (unsupported platform, private post,
     API error). Manual edits set `metrics_source='manual'`.
- **Caching/guard:** do not re-fetch content fresher than the refresh window; respect RapidAPI
  rate limits; on provider error, fail soft (keep prior values, surface a non-blocking notice).
- **Provider:** RapidAPI "Instagram Statistics API" (covers IG + TikTok + YouTube + Twitter per
  prior research). Exact endpoint/field mapping is finalized when the key + docs are in hand
  (the `RapidApiProvider` is the only file that needs the real mapping).

## 7. Data Model (Supabase, brand-scoped + RLS)

```
kol_influencers   id, brand, name, username, platform, followers, niche, contact, notes, created_at
kol_budgets       id, brand, name, nominal, created_at
kol_campaigns     id, brand, name, budget_id → kol_budgets, period_start, period_end,
                  description, status ('active'|'ended'), created_at
kol_contents      id, brand, campaign_id → kol_campaigns, influencer_id → kol_influencers,
                  platform, product, task, funnel_objective ('awareness'|'consideration'|'action'),
                  content_url, status ('uploaded'|'broken'|'pending'),
                  fee, likes, comments, saved, shares, video_views,
                  metrics_source ('api'|'manual'), metrics_fetched_at, posted_at, created_at
```

- All four tables: RLS enabled, brand-scoped via the existing `get_my_role()` / `get_my_brand()`
  pattern. `kol_specialist` reads/writes only its brand; `super_admin` all brands.
- Apply the **GRANT + ALTER DEFAULT PRIVILEGES** lesson so new tables don't 403 (already in place
  project-wide).
- Derived metrics (per-tier signals, CPV, leaderboard rank, budget utilization) are **computed in
  the app**, not stored. The tier→metric mapping (§5.5) lives in one config constant.

## 8. Roles & Access

- Add `kol_specialist` to the role enum / `user_profiles.role`.
- `canAccess` / sidebar gating: KOL Management section visible to `kol_specialist`,
  `admin`, `super_admin` only.
- Brand enforcement identical to existing modules (a `kol_specialist` bound to `reglow`
  never sees `amura` data).

## 9. Success Metrics

- **Adoption:** kol_specialists log campaigns + content regularly (active campaigns with ≥1 content).
- **Automation rate:** % of content rows with `metrics_source='api'` (Phase 2+).
- **Effort reduction:** content metrics maintained by pasting a link instead of typing numbers.

## 10. Phasing

| Phase | Contents | External dependency |
|-------|----------|---------------------|
| **1 — MVP** | 4 modules CRUD, `kol_specialist` role + RLS, sidebar section, computed KPIs (ER/CPV/CPE) + leaderboard + budget utilization, metrics via `ManualProvider`, adapter seam in place | **None** |
| **2 — Auto-pull** | Flip `RapidApiProvider` to `live` (subscribe RapidAPI ≥1000 req/mo + set `RAPIDAPI_KEY`), on-save auto-pull, `/api/cron/kol-metrics-refresh` 2×/week | RapidAPI key |
| **3 — Attribution** | ROI via per-KOL promo codes / tracked links tied to sales | Sales attribution data |

## 11. Out of Scope

- ROI / sales attribution (Phase 3).
- Influencer outreach / CRM / contracts / payments / invoicing.
- Auto-discovery of new influencers.
- Non-IG/TikTok/YouTube platforms (Twitter/X possible later — provider already supports it).

## 12. Open Questions

- Exact RapidAPI plan + per-call field mapping (resolved when the key + docs are available; isolated
  to `RapidApiProvider`).
- Funnel-tier metric mapping (§5.5) is the agreed Marcomm default (Awareness=Views+Likes,
  Consideration=Comments+Saves+Shares, Action=clicks/promo). Tunable later via the config constant.
- Whether budget pools are per-campaign or shared across campaigns within a brand (MVP assumes a
  pool can back multiple campaigns; utilization sums across them).
