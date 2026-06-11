-- kol_management.sql — run in Supabase SQL editor (production) AFTER review.
-- 4 brand-scoped KOL tables + RLS. Access: super_admin (all brands),
-- admin & kol_specialist (own brand only). Other roles: no access.

CREATE TABLE IF NOT EXISTS kol_influencers (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand      TEXT NOT NULL CHECK (brand IN ('reglow','amura','purela')),
  name       TEXT NOT NULL,
  username   TEXT,
  platform   TEXT,
  followers  INTEGER NOT NULL DEFAULT 0,
  niche      TEXT,
  contact    TEXT,
  notes      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kol_budgets (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand      TEXT NOT NULL CHECK (brand IN ('reglow','amura','purela')),
  name       TEXT NOT NULL,
  nominal    NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kol_campaigns (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand        TEXT NOT NULL CHECK (brand IN ('reglow','amura','purela')),
  name         TEXT NOT NULL,
  budget_id    UUID REFERENCES kol_budgets(id) ON DELETE SET NULL,
  period_start DATE,
  period_end   DATE,
  description  TEXT,
  status       TEXT NOT NULL DEFAULT 'active',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kol_contents (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand            TEXT NOT NULL CHECK (brand IN ('reglow','amura','purela')),
  campaign_id      UUID REFERENCES kol_campaigns(id) ON DELETE CASCADE,
  influencer_id    UUID REFERENCES kol_influencers(id) ON DELETE SET NULL,
  platform         TEXT,
  product          TEXT,
  task             TEXT,
  funnel_objective TEXT NOT NULL DEFAULT 'awareness',
  content_url      TEXT,
  status           TEXT NOT NULL DEFAULT 'pending',
  fee              NUMERIC NOT NULL DEFAULT 0,
  likes            INTEGER NOT NULL DEFAULT 0,
  comments         INTEGER NOT NULL DEFAULT 0,
  saved            INTEGER NOT NULL DEFAULT 0,
  shares           INTEGER NOT NULL DEFAULT 0,
  video_views      INTEGER NOT NULL DEFAULT 0,
  metrics_source   TEXT NOT NULL DEFAULT 'manual',
  metrics_fetched_at TIMESTAMPTZ,
  posted_at        DATE,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['kol_influencers','kol_budgets','kol_campaigns','kol_contents'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t||'_select', t);
    EXECUTE format($f$CREATE POLICY %I ON public.%I FOR SELECT TO authenticated
      USING (get_my_role() = 'super_admin'
             OR (get_my_role() IN ('admin','kol_specialist') AND brand = get_my_brand()))$f$, t||'_select', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t||'_write', t);
    EXECUTE format($f$CREATE POLICY %I ON public.%I FOR ALL TO authenticated
      USING (get_my_role() = 'super_admin'
             OR (get_my_role() IN ('admin','kol_specialist') AND brand = get_my_brand()))
      WITH CHECK (get_my_role() = 'super_admin'
             OR (get_my_role() IN ('admin','kol_specialist') AND brand = get_my_brand()))$f$, t||'_write', t);
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON kol_influencers, kol_budgets, kol_campaigns, kol_contents TO authenticated;
