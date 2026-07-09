/**
 * Shared host allowlist for KOL content URLs. Single source of truth for both the
 * per-save API boundary (`api/kol/pull-metrics/route.ts`) and the metrics provider itself
 * (`RapidApiProvider`) — the provider re-checks this independently rather than trusting that
 * every caller already validated, since `content_url` is persisted with no validation at all
 * on some paths (bulk CSV import) and the cron refresh reads it straight back out of the DB
 * with no re-validation of its own. A provider that resolves a short link via an outbound
 * fetch to the URL itself (TikTok's vt/vm.tiktok.com short links) is a real SSRF vector if
 * that URL is ever attacker-controlled and unchecked — validate at the last line of defense,
 * not just the first one.
 */
const ALLOWED_HOSTS = [
  'tiktok.com', 'www.tiktok.com', 'vt.tiktok.com', 'vm.tiktok.com',
  'instagram.com', 'www.instagram.com',
  'youtube.com', 'www.youtube.com', 'youtu.be',
]

export function isAllowedContentUrl(raw: string): boolean {
  try {
    const u = new URL(raw)
    if (u.protocol !== 'https:') return false
    return ALLOWED_HOSTS.includes(u.hostname.toLowerCase())
  } catch {
    return false
  }
}
