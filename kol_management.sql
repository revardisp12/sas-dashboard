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
  funnel_objective TEXT NOT NULL DEFAULT 'awareness' CHECK (funnel_objective IN ('awareness','consideration','action')),
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

-- ── allow the new kol_specialist role on user_profiles ──
ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;
ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_role_check
  CHECK (role IN ('super_admin','admin','manager','cs','crm','kol_specialist'));

-- updated allowlist to include kol_specialist
CREATE OR REPLACE FUNCTION public.admin_update_user_profile(
  target_id      UUID,
  new_role       TEXT,
  new_brand      TEXT,
  new_full_name  TEXT
)
RETURNS public.user_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id    UUID := auth.uid();
  v_caller_role  TEXT;
  v_caller_brand TEXT;
  v_target       user_profiles;
  v_updated      user_profiles;
  v_final_brand  TEXT;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  IF v_caller_id = target_id THEN
    RAISE EXCEPTION 'Cannot edit own profile via admin RPC' USING ERRCODE = '42501';
  END IF;

  SELECT role, brand INTO v_caller_role, v_caller_brand
  FROM user_profiles WHERE id = v_caller_id;

  IF v_caller_role IS NULL OR v_caller_role NOT IN ('super_admin', 'admin') THEN
    RAISE EXCEPTION 'Forbidden: admin role required' USING ERRCODE = '42501';
  END IF;

  IF new_role NOT IN ('super_admin', 'admin', 'manager', 'cs', 'crm', 'kol_specialist') THEN
    RAISE EXCEPTION 'Invalid role: %', new_role USING ERRCODE = '22023';
  END IF;

  IF new_brand IS NOT NULL AND new_brand NOT IN ('reglow', 'amura', 'purela') THEN
    RAISE EXCEPTION 'Invalid brand: %', new_brand USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_target FROM user_profiles WHERE id = target_id;
  IF v_target.id IS NULL THEN
    RAISE EXCEPTION 'Target user not found' USING ERRCODE = '42704';
  END IF;

  -- Admin-specific restrictions (super_admin bypass all of these)
  IF v_caller_role = 'admin' THEN
    IF v_target.role IN ('super_admin', 'admin') THEN
      RAISE EXCEPTION 'Forbidden: cannot edit admin or super_admin users' USING ERRCODE = '42501';
    END IF;
    IF new_role IN ('super_admin', 'admin') THEN
      RAISE EXCEPTION 'Forbidden: cannot promote to admin or super_admin' USING ERRCODE = '42501';
    END IF;
    IF v_target.brand IS DISTINCT FROM v_caller_brand THEN
      RAISE EXCEPTION 'Forbidden: cannot edit users outside your brand' USING ERRCODE = '42501';
    END IF;
    IF new_brand IS DISTINCT FROM v_caller_brand THEN
      RAISE EXCEPTION 'Forbidden: cannot move user to a different brand' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Force brand=NULL when role becomes super_admin (data invariant)
  v_final_brand := CASE WHEN new_role = 'super_admin' THEN NULL ELSE new_brand END;

  UPDATE user_profiles
  SET role      = new_role,
      brand     = v_final_brand,
      full_name = NULLIF(trim(coalesce(new_full_name, '')), '')
  WHERE id = target_id
  RETURNING * INTO v_updated;

  IF v_updated.id IS NULL THEN
    RAISE EXCEPTION 'Target deleted concurrently' USING ERRCODE = '42704';
  END IF;

  RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_user_profile(UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_user_profile(UUID, TEXT, TEXT, TEXT) TO authenticated;
