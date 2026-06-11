# KOL Metrics Go-Live Runbook
When RapidAPI is subscribed:
1. Implement `src/lib/kol/metrics/rapidApiProvider.ts` — call RapidAPI "Instagram Statistics API"
   by content URL, map response → FetchedMetrics (IG/TikTok/YouTube). Contract: `src/lib/kol/metrics/types.ts`.
2. Set Vercel env (all envs): `RAPIDAPI_KEY`, `KOL_METRICS_ENABLED=live`.
3. Deploy to dev; add a content with a real public URL → metrics auto-fill (`metrics_source=api`).
4. Confirm the kol-metrics-refresh cron (Mon/Thu 03:00 UTC) updates active-campaign content. Merge dev→main.
Plan ≥ 1000 req/mo (~800 content × 2 refresh/wk).

## Mock-phase rollout (before RapidAPI)
1. Run `kol_management.sql` in Supabase.
2. Assign a kol_specialist user a `brand` in `user_profiles` (or via Settings → Users as super_admin).
3. Vercel env: `KOL_METRICS_ENABLED=manual` (cron is a NO-OP in manual mode). Metrics entered by hand.
4. Push feature → dev → verify preview (`npx next start` after build; NOT `next dev`) → merge main.
