# KOL Metrics Go-Live Runbook

## Status (2026-07-09): Instagram + TikTok implemented, YouTube still manual-only
`src/lib/kol/metrics/rapidApiProvider.ts` implements two platforms behind one `RAPIDAPI_KEY`:

- **Instagram** — "Instagram Statistics API" (`instagram-statistics-api.p.rapidapi.com`),
  `GET /posts/one?postUrl=<url>`. Confirmed live in the RapidAPI playground: this API is
  Instagram-only in practice — a TikTok URL gets `{meta:{code:400,message:"Bad request. Use
  for Instagram only."}}` — despite the marketplace listing's description mentioning other
  platforms (that coverage evidently applies to its profile/audience-stats endpoints, not the
  per-post one this feature needs). Its response never includes `saved`/`shares` (Instagram
  doesn't expose those to this kind of API) — the provider OMITS those keys entirely rather
  than reporting 0, so callers know to leave any existing manual value alone.
- **TikTok** — "TikTok API" (RapidAPI-verified listing, `tiktok-api23.p.rapidapi.com`),
  `GET /api/post/detail?videoId=<id>`. Unlike Instagram's, this DOES return `shares`
  (`shareCount`) and saves (`collectCount`, a string in the response, parsed with `Number()`).
  Success is `statusCode === 0`, a different envelope convention than Instagram's `meta.code`.
  The endpoint needs a numeric video ID, not a URL — `extractTikTokVideoId()` pulls it from a
  canonical `tiktok.com/.../video/<id>` (or `/photo/<id>`) URL directly, or resolves a short
  `vt.tiktok.com`/`vm.tiktok.com` link via a plain HTTP redirect-follow first (no RapidAPI call
  needed for that step).

Both providers return `null` (falls back to manual entry, same as `ManualProvider`) only for a
platform neither one handles (YouTube) — never as a way of hiding a real failure. A malformed
URL, an API rejection, or an HTTP error all throw instead, so `pullMetrics()` in `KontenTab.tsx`
can tell a genuine failure apart from "nothing to pull" and show the right message.

**To add YouTube coverage**: YouTube has a free, official, no-OAuth option (`YouTube Data
API v3`'s `videos.list` — works for any public video by ID) that's worth using directly
instead of another paid RapidAPI scraper subscription.

## Go-live checklist
1. ~~Implement `rapidApiProvider.ts`~~ — done (Instagram + TikTok, see above).
2. Set Vercel env (all envs): `RAPIDAPI_KEY`, `KOL_METRICS_ENABLED=live`.
3. Deploy to dev; add an Instagram or TikTok content with a real public URL → metrics
   auto-fill (`metrics_source=api`).
4. Confirm the kol-metrics-refresh cron (Mon/Thu 03:00 UTC) updates active-campaign content. Merge dev→main.
Plan ≥ 1000 req/mo (~800 content × 2 refresh/wk) per platform subscribed — check the actual
plan's request/day vs request/month caps against real usage once live, not just the marketing
page (the Instagram plan and the TikTok plan are separate subscriptions with their own limits).

## Mock-phase rollout (before RapidAPI)
1. Run `kol_management.sql` in Supabase.
2. Assign a kol_specialist user a `brand` in `user_profiles` (or via Settings → Users as super_admin).
3. Vercel env: `KOL_METRICS_ENABLED=manual` (cron is a NO-OP in manual mode). Metrics entered by hand.
4. Push feature → dev → verify preview (`npx next start` after build; NOT `next dev`) → merge main.
