-- /api/chat rate limit (additive — does not touch existing tables)
-- Apply via Supabase Studio SQL editor.

CREATE TABLE IF NOT EXISTS chat_rate_limits (
  user_id      UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  count        INT  NOT NULL DEFAULT 0,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE chat_rate_limits ENABLE ROW LEVEL SECURITY;
-- No policies on purpose. Anon/authenticated clients cannot SELECT/INSERT/UPDATE
-- this table directly. All writes go through check_chat_rate_limit() below,
-- which runs as SECURITY DEFINER.

CREATE OR REPLACE FUNCTION check_chat_rate_limit()
RETURNS TABLE(allowed BOOLEAN, remaining INT, reset_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now         TIMESTAMPTZ := now();
  v_user_id     UUID        := auth.uid();
  v_limit       CONSTANT INT := 10;
  v_window_min  CONSTANT INT := 60;
  v_row chat_rate_limits;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  INSERT INTO chat_rate_limits (user_id, count, window_start)
  VALUES (v_user_id, 1, v_now)
  ON CONFLICT (user_id) DO UPDATE
    SET count = CASE
          WHEN chat_rate_limits.window_start + (v_window_min || ' minutes')::interval < v_now
            THEN 1
          ELSE chat_rate_limits.count + 1
        END,
        window_start = CASE
          WHEN chat_rate_limits.window_start + (v_window_min || ' minutes')::interval < v_now
            THEN v_now
          ELSE chat_rate_limits.window_start
        END
  RETURNING * INTO v_row;

  RETURN QUERY SELECT
    v_row.count <= v_limit,
    GREATEST(0, v_limit - v_row.count),
    v_row.window_start + (v_window_min || ' minutes')::interval;
END;
$$;

REVOKE ALL ON FUNCTION check_chat_rate_limit() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION check_chat_rate_limit() TO authenticated;
