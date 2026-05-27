-- Lock down user_profiles role/brand mutation (audit Critical #2 + scope expansion)
-- Apply via Supabase Studio SQL Editor.
--
-- Fixes:
--   Vuln A: any user (cs/crm/manager) self-promote via direct UPDATE
--   Vuln B: admin edit super_admin/admin rows
--   Vuln C: admin promote target to super_admin/admin
--
-- After this migration, role/brand can ONLY be mutated via admin_update_user_profile().

-- 1. Drop the overly-permissive UPDATE policy.
--    No replacement policy = direct UPDATE on user_profiles is denied by default.
DROP POLICY IF EXISTS "user_profiles_update" ON user_profiles;

-- 2. SECURITY DEFINER RPC that enforces row + column + value rules.
CREATE OR REPLACE FUNCTION admin_update_user_profile(
  target_id      UUID,
  new_role       TEXT,
  new_brand      TEXT,
  new_full_name  TEXT
)
RETURNS user_profiles
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

  IF new_role NOT IN ('super_admin', 'admin', 'manager', 'cs', 'crm') THEN
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

REVOKE ALL ON FUNCTION admin_update_user_profile(UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_update_user_profile(UUID, TEXT, TEXT, TEXT) TO authenticated;
