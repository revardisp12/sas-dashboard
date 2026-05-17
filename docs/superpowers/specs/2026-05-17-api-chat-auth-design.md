# Design: Lock down `/api/chat` (auth + rate limit)

**Date:** 2026-05-17
**Status:** Approved by user, ready for implementation plan
**Source:** Critical #1 from SAS Dashboard audit (2026-05-17)

## Problem

`src/app/api/chat/route.ts` has zero authentication. Anyone who discovers the production URL can POST unlimited requests and drain the project's Anthropic credit. Additional issues:

- No rate limit per user
- No input size cap (unbounded `messages[]` and `context`)
- Anthropic client instantiated per request (wasteful)
- Raw error messages echoed to client (info leak)
- System prompt contains stale fact ("Semua data disimpan di localStorage browser" — data is in Supabase now)

## Goals

1. Reject unauthenticated requests with `401`
2. Enforce per-user rate limit of **10 requests / 60-minute sliding window** (stored in Supabase)
3. Cap request input size to prevent abuse via large payloads
4. Cache Anthropic client at module scope
5. Stop leaking raw error messages to clients
6. Update system prompt to reflect Supabase backend

## Non-Goals

- CSRF token (Supabase JWT verification covers this; tokens are not auto-attached cookies)
- IP-based rate limit on top of per-user (per-user is stricter)
- Origin allowlist (redundant given JWT verification)
- Auth session refresh handling on the client (out of scope; user gets "session expired, refresh" message)
- Adding `SUPABASE_SERVICE_ROLE_KEY` to env — explicitly avoided by using SECURITY DEFINER RPC

## Architecture

### Database

New table `chat_rate_limits` with no anon RLS policies. All writes go through a SECURITY DEFINER RPC, so users cannot manipulate their own counter from the anon client. The RPC takes **zero arguments** and uses `auth.uid()` internally — this prevents an authenticated user from bypassing the limit by calling the RPC with custom `p_limit` from the browser console.

```sql
CREATE TABLE chat_rate_limits (
  user_id      UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  count        INT  NOT NULL DEFAULT 0,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE chat_rate_limits ENABLE ROW LEVEL SECURITY;
-- No policies. Anon/authenticated clients cannot SELECT/INSERT/UPDATE directly.

-- Limit & window are hardcoded in the function definition (NOT parameters)
-- so authenticated users cannot bypass by calling with custom args from the client.
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
```

### Server (`src/app/api/chat/route.ts`)

Rewrite request flow:

1. Read `Authorization: Bearer <token>` header. Missing → `401 { error: 'Unauthorized' }`.
2. Construct a per-request Supabase client with that token in the `Authorization` header.
3. `const { data: { user } } = await supabase.auth.getUser()`. `user == null` → `401`.
4. Input validation:
   - `messages` is non-empty array, length ≤ **20**
   - Sum of `content.length` across messages ≤ **8000** chars
   - `context.currentView`, `brand`, `timeframe`, `hasData`, `productCount`, `bundleCount` present and correct types
   - Any failure → `400 { error: 'Invalid input' }`
5. Call `supabase.rpc('check_chat_rate_limit')` (zero args — user identity comes from `auth.uid()` via the JWT-authenticated client; limit and window are hardcoded in the function).
   - `allowed === false` → `429` with response headers:
     - `Retry-After: <seconds until reset_at>`
     - `X-RateLimit-Remaining: 0`
     - `X-RateLimit-Reset: <reset_at ISO>`
     - Body: `{ error: 'Rate limit exceeded', resetAt: <iso> }`
6. Call Anthropic (existing logic). Cache the `Anthropic` client at module scope, not per-request.
7. On Anthropic error: log raw error server-side; respond `500 { error: 'Internal error' }` (no raw message).

System prompt: replace the line `Semua data disimpan di localStorage browser (bukan database server).` with `Data disimpan di Supabase (cloud DB).`

### Client (`src/components/AIChatButton.tsx`)

In `sendMessage`:

1. Before `fetch`, call `supabase.auth.getSession()`. If `session == null`, append assistant message `"Sesi login expired. Refresh halaman dulu ya."` and return.
2. Add `Authorization: Bearer ${session.access_token}` to the fetch headers.
3. Handle response status codes explicitly (replaces current silent fallback):
   - `401`: append `"Sesi login expired. Refresh halaman dulu."`
   - `429`: parse `{ resetAt }`, compute minutes until reset, append `"Limit chat tercapai (10/jam). Coba lagi <N> menit lagi."`
   - Any other non-OK: append `"Ada error di server. Coba lagi sebentar."`
   - OK: existing happy path

## Data Flow

```
[Browser]                          [Vercel /api/chat]                [Supabase]
sendMessage()
  ├─ getSession() ────────────────────────────────────────────────────► (cached)
  ├─ POST /api/chat (Authorization: Bearer <jwt>, body)
                                   ├─ read Authorization header
                                   ├─ supabase.auth.getUser() ───────► verify JWT
                                   │                                   ◄── { user }
                                   ├─ validate input shape & size
                                   ├─ rpc('check_chat_rate_limit') ──► atomic upsert
                                   │                                   ◄── { allowed, remaining, reset_at }
                                   ├─ if !allowed: return 429 + Retry-After
                                   ├─ anthropic.messages.create()
                                   └─ return 200 { reply, X-RateLimit-Remaining }
  └─ render reply / error message
```

## Error Handling

| Failure | Status | User sees |
|---|---|---|
| No `Authorization` header | 401 | "Sesi login expired. Refresh halaman dulu." |
| Invalid/expired JWT | 401 | "Sesi login expired. Refresh halaman dulu." |
| Input validation fail | 400 | "Ada error di server. Coba lagi sebentar." (rare; client controls payload) |
| Rate limit exceeded | 429 | "Limit chat tercapai (10/jam). Coba lagi N menit lagi." |
| Anthropic API error | 500 | "Ada error di server. Coba lagi sebentar." (raw error logged server-side) |
| Network failure | n/a | existing `catch` in `sendMessage` (browser network error) |

## Testing

No automated tests exist in this repo. Manual smoke test plan:

1. **Unauth:** `curl -X POST /api/chat -H 'Content-Type: application/json' -d '{"messages":[],"context":{}}'` → expect `401`
2. **Bad JWT:** add bogus `Authorization: Bearer xyz` → expect `401`
3. **Valid login:** chat 10 times → all succeed; 11th → `429` with `Retry-After`
4. **Window reset:** wait 60 minutes, retry → succeeds; counter reset
5. **Input cap:** payload with 25 messages → `400`
6. **Stale system prompt:** ask the bot "where is data stored?" → no longer says localStorage

## Migration

1. **PRE-IMPLEMENTATION:** Read `node_modules/next/dist/docs/` for Next.js 16 route handler API conventions. The repo's `AGENTS.md` warns: "This is NOT the Next.js you know" — `NextRequest`/`NextResponse` imports, header access (`req.headers.get('authorization')`), body parsing (`await req.json()`), and response construction may have changed from training-data assumptions. Verify all syntax before writing the route file.
2. Apply SQL block above to Supabase prod via Supabase Studio SQL editor. **Additive only** — `CREATE TABLE` (new table), `CREATE OR REPLACE FUNCTION` (new function or overwrite definition). Zero `DROP`/`DELETE`/`ALTER` on existing data.
3. Deploy code changes.
4. Migration is backward compatible: existing logged-in sessions in browsers will start sending the JWT immediately; no localStorage migration needed.

## Open Risks

- **Counter increments on attempt, not on success**: every accepted POST increments the counter regardless of whether the downstream Anthropic call succeeds. If Anthropic returns 500 or times out, the user has "spent" a quota slot for nothing. Intentional — prevents retry-amplification attacks where a malicious client could force unlimited Anthropic calls by simulating failures. Acceptable for chat-support use case.
- **Clock skew between Vercel and Supabase**: `reset_at` from RPC is Supabase clock; `Retry-After` calculation uses Vercel's `Date.now()`. Mismatch in seconds is acceptable; minutes would matter. Postgres time-sync is sub-second on managed Supabase.
- **Cold start latency**: per-request Supabase client + RPC adds ~50-150 ms p50, ~300 ms p99 on Vercel cold start. Acceptable for chat UX.
- **Spec only covers `/api/chat`**: this is the only API route today. If new routes are added later, the auth+ratelimit pattern should be extracted into a helper (out of scope here, deferred until second route exists).
- **Limit change requires SQL migration**: because limit/window are hardcoded inside the function, raising 10/hr to 20/hr is a `CREATE OR REPLACE FUNCTION` rerun, not a code-only deploy. Accepted trade-off — it prevents the bypass-via-args attack and forces limit changes through a deliberate DB migration.

## Next.js 16 API verification (Task 0)

Verified against installed Next.js **16.2.4** docs bundled in `node_modules/next/dist/docs/`. All five route-handler APIs assumed in the spec match the installed version. **All five APIs unchanged from spec assumptions. Proceed.**

| # | Question | Answer | Citation |
|---|---|---|---|
| Q1 | Is `import { NextRequest, NextResponse } from 'next/server'` still the import path? | **Yes.** `NextRequest` is imported from `next/server` (`import type { NextRequest } from 'next/server'`); `NextResponse` is imported from `next/server` (`import { NextResponse } from 'next/server'`). | `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md:67`, `:110`, `:186`; `.../04-functions/next-response.md:81`, `:89` |
| Q2 | Is `req.headers.get('authorization')` still how you read a header? | **Yes.** `NextRequest` extends the Web `Request` API, which exposes `.headers` as a `Headers` instance with `.get(name)`. Docs show `new Headers(request.headers)` and reading via the Web API directly is supported. `next/headers`'s `headers()` is an alternative (async, returns read-only) but `req.headers.get(...)` remains valid. | `.../03-file-conventions/route.md:252-266`; `.../04-functions/next-request.md:8` ("NextRequest extends the Web Request API") |
| Q3 | Is `await req.json()` still the body-parsing API? | **Yes.** Docs explicitly show `const res = await request.json()` for POST body parsing. | `.../03-file-conventions/route.md:487-491` |
| Q4 | Does `NextResponse.json(body, { status, headers })` still work as expected? | **Yes.** Docs show `return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })`. Second arg is a standard `ResponseInit` so `headers` works the same. | `.../04-functions/next-response.md:80-94` |
| Q5 | Does the route handler still default to Node runtime, or has it changed to Edge? | **Still defaults to `'nodejs'`.** `runtime` segment config explicitly lists `'nodejs'` as default; `'edge'` is opt-in (and incompatible with Cache Components). | `.../02-route-segment-config/runtime.md:18` ("`'nodejs'` (default)"); `.../03-file-conventions/route.md:649` (`export const runtime = 'nodejs'` shown as default segment config) |

### Additional Next.js 16 notes (non-blocking, FYI)

- **`context.params` is now a `Promise`** (changed in `v15.0.0-RC`). Not relevant to `/api/chat` because the route has no dynamic segment, but worth noting for future routes. (`route.md:668`)
- **`GET` default caching changed from static to dynamic** in `v15.0.0-RC`. Not relevant; our handler is `POST`. (`route.md:669`)
- **`request.ip` and `request.geo` removed in `v15.0.0`.** Not used by current/planned spec. (`next-request.md:123`)
- Anthropic SDK calls in `/api/chat` run on Node runtime by default; no `export const runtime = ...` needed in the rewritten handler.

Verified the current `src/app/api/chat/route.ts` already uses all five APIs as documented (`import { NextRequest, NextResponse } from 'next/server'`, `await req.json()`, `NextResponse.json(body, { status })`), so the Server pseudocode (spec §Architecture → Server) needs **no syntax updates**.
