# KOL Metrics Go-Live Runbook

## Status (2026-07-09): Instagram implemented, TikTok/YouTube still manual-only
`src/lib/kol/metrics/rapidApiProvider.ts` is implemented against RapidAPI's "Instagram
Statistics API" (`instagram-statistics-api.p.rapidapi.com`), specifically its `GET /posts/one
?postUrl=<url>` endpoint. Confirmed live in the RapidAPI playground: this API is
**Instagram-only** — a TikTok URL gets `{meta:{code:400,message:"Bad request. Use for
Instagram only."}}`. The marketplace listing's description mentions other platforms, but that
evidently applies to its profile/audience-stats endpoints, not the per-post one this feature
needs. The provider intentionally returns `null` (falls back to manual entry, same as
`ManualProvider`) for any platform other than `'Instagram'`, without spending an API call on a
request that's guaranteed to be rejected.

The response never includes `saved`/`shares` (Instagram doesn't expose those figures to this
kind of API) — both are hardcoded to `0` by the provider; a user can still fill them in by hand.

**To add TikTok/YouTube coverage**: this needs a *separate* API subscription and provider
implementation — no single API found so far covers per-post stats across all three platforms
despite marketing claims to the contrary. YouTube specifically has an official, free, no-OAuth
option (`YouTube Data API v3`'s `videos.list` — works for any public video by ID) that's worth
using directly instead of a paid scraper. TikTok would need its own RapidAPI (or similar)
subscription, evaluated the same way this one was: check the *specific endpoint* actually works
for TikTok before subscribing to a plan, not just the listing's marketing description.

## Go-live checklist
1. ~~Implement `rapidApiProvider.ts`~~ — done (Instagram only, see above).
2. Set Vercel env (all envs): `RAPIDAPI_KEY`, `KOL_METRICS_ENABLED=live`.
3. Deploy to dev; add an Instagram content with a real public URL → metrics auto-fill (`metrics_source=api`).
4. Confirm the kol-metrics-refresh cron (Mon/Thu 03:00 UTC) updates active-campaign content. Merge dev→main.
Plan ≥ 1000 req/mo (~800 content × 2 refresh/wk) — the subscribed Pro-tier plan's exact request/day
vs request/month caps should be checked against actual usage once live, not just assumed from the
marketing page.

## Mock-phase rollout (before RapidAPI)
1. Run `kol_management.sql` in Supabase.
2. Assign a kol_specialist user a `brand` in `user_profiles` (or via Settings → Users as super_admin).
3. Vercel env: `KOL_METRICS_ENABLED=manual` (cron is a NO-OP in manual mode). Metrics entered by hand.
4. Push feature → dev → verify preview (`npx next start` after build; NOT `next dev`) → merge main.

> **Note — bulk-link import partial-failure risk:** The bulk-link import currently uses `Promise.all` for per-link metric pulls — if one pull rejects in live mode the whole batch aborts (no partial save). Before heavy live use, consider inserting rows first (`metrics_source='manual'`) and letting the refresh cron backfill.
