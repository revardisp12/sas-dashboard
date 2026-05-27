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

DROP POLICY IF EXISTS "digest_log_select" ON digest_log;
CREATE POLICY "digest_log_select" ON digest_log FOR SELECT
  USING (get_my_role() = 'super_admin' OR brand = get_my_brand());
-- No INSERT/UPDATE/DELETE policy: writes go through upsert_digest() RPC.

CREATE OR REPLACE FUNCTION upsert_digest(
  p_brand       TEXT,
  p_week_start  DATE,
  p_week_end    DATE,
  p_payload     JSONB
) RETURNS digest_log
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row          digest_log;
  v_caller_id    UUID := auth.uid();
  v_caller_role  TEXT;
  v_caller_brand TEXT;
BEGIN
  -- Allow either an authenticated user (admin/manager doing a manual regenerate)
  -- or the service_role key (cron). auth.role() returns the current JWT role
  -- claim — 'service_role' for cron, 'authenticated' for logged-in users,
  -- 'anon' for unauthenticated. (Previously used request.jwt.claim.role GUC
  -- which isn't set under this Supabase config.)
  IF v_caller_id IS NULL AND coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  IF p_brand NOT IN ('reglow', 'amura', 'purela') THEN
    RAISE EXCEPTION 'Invalid brand: %', p_brand USING ERRCODE = '22023';
  END IF;

  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'p_payload must be a JSON object' USING ERRCODE = '22023';
  END IF;

  -- Brand isolation: when called by an authenticated user (not service_role),
  -- enforce caller's profile.brand matches p_brand. Without this, any logged-in
  -- user could overwrite another brand's digest_log row (SECURITY DEFINER
  -- bypasses RLS). Mirrors the pattern in replace_brand_table.
  IF v_caller_id IS NOT NULL THEN
    SELECT role, brand INTO v_caller_role, v_caller_brand
    FROM user_profiles WHERE id = v_caller_id;

    IF v_caller_role NOT IN ('super_admin', 'admin', 'manager') THEN
      RAISE EXCEPTION 'Forbidden: role % cannot regenerate digest', v_caller_role
        USING ERRCODE = '42501';
    END IF;

    IF v_caller_role <> 'super_admin'
       AND v_caller_brand IS DISTINCT FROM p_brand THEN
      RAISE EXCEPTION 'Forbidden: cannot write digest for brand %', p_brand
        USING ERRCODE = '42501';
    END IF;
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

-- Table-level grants for digest_log. Required because GRANT ALL ON ALL TABLES
-- in schema.sql only applies to tables existing at that time; new tables
-- created later (like this one) don't inherit. PostgREST returns 403 instead
-- of empty result when the role lacks the SELECT privilege.
GRANT SELECT ON public.digest_log TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.digest_log TO service_role;
