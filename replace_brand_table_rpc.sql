-- Atomic per-brand table replace (audit Critical #4)
-- Apply via Supabase Studio SQL Editor.

CREATE OR REPLACE FUNCTION replace_brand_table(
  p_table TEXT,
  p_brand TEXT,
  p_rows  JSONB
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id    UUID := auth.uid();
  v_caller_role  TEXT;
  v_caller_brand TEXT;
  v_allowed      TEXT;
  v_inserted     INTEGER := 0;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT role, brand INTO v_caller_role, v_caller_brand
  FROM user_profiles WHERE id = v_caller_id;

  IF v_caller_role IS NULL THEN
    RAISE EXCEPTION 'No profile for caller' USING ERRCODE = '42501';
  END IF;

  v_allowed := CASE p_table
    WHEN 'sales'            THEN 'super_admin,admin,manager,cs'
    WHEN 'crm'              THEN 'super_admin,admin,manager,crm'
    WHEN 'google_ads'       THEN 'super_admin,admin,manager'
    WHEN 'meta_ads'         THEN 'super_admin,admin,manager'
    WHEN 'tiktok_shop'      THEN 'super_admin,admin,manager'
    WHEN 'shopee'           THEN 'super_admin,admin,manager'
    WHEN 'instagram'        THEN 'super_admin,admin,manager'
    WHEN 'tiktok_organic'   THEN 'super_admin,admin,manager'
    WHEN 'facebook_organic' THEN 'super_admin,admin,manager'
    ELSE NULL
  END;

  IF v_allowed IS NULL THEN
    RAISE EXCEPTION 'Invalid table: %', p_table USING ERRCODE = '22023';
  END IF;

  IF NOT (v_caller_role = ANY(string_to_array(v_allowed, ','))) THEN
    RAISE EXCEPTION 'Forbidden: role % cannot write to %', v_caller_role, p_table USING ERRCODE = '42501';
  END IF;

  IF p_brand NOT IN ('reglow', 'amura', 'purela') THEN
    RAISE EXCEPTION 'Invalid brand: %', p_brand USING ERRCODE = '22023';
  END IF;

  IF v_caller_role <> 'super_admin' AND v_caller_brand IS DISTINCT FROM p_brand THEN
    RAISE EXCEPTION 'Forbidden: cannot write to brand %', p_brand USING ERRCODE = '42501';
  END IF;

  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'p_rows must be a JSON array' USING ERRCODE = '22023';
  END IF;

  EXECUTE format('DELETE FROM %I WHERE brand = %L', p_table, p_brand);

  IF jsonb_array_length(p_rows) > 0 THEN
    EXECUTE format(
      'INSERT INTO %I SELECT * FROM jsonb_populate_recordset(NULL::%I, $1)',
      p_table, p_table
    ) USING p_rows;
    GET DIAGNOSTICS v_inserted = ROW_COUNT;
  END IF;

  RETURN v_inserted;
END;
$$;

REVOKE ALL ON FUNCTION replace_brand_table(TEXT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION replace_brand_table(TEXT, TEXT, JSONB) TO authenticated;
