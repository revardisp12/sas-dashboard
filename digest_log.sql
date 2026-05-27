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
  v_row digest_log;
BEGIN
  -- Allow either an authenticated user (admin/manager doing a manual regenerate)
  -- or the service_role key (cron). Both are required: authenticated users via
  -- auth.uid() check, service_role via JWT role claim.
  IF auth.uid() IS NULL
     AND coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  IF p_brand NOT IN ('reglow', 'amura', 'purela') THEN
    RAISE EXCEPTION 'Invalid brand: %', p_brand USING ERRCODE = '22023';
  END IF;

  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'p_payload must be a JSON object' USING ERRCODE = '22023';
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
