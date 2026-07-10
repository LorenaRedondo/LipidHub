// Tiny in-memory fixed-window rate limiter, keyed by API key. Sufficient for a
// single-process deployment (mcp/httpServer.ts) — no Redis/external store needed.
const WINDOW_MS = 60_000
const LIMIT_PER_WINDOW = 60

interface Window { count: number; resetAt: number }
const windows = new Map<string, Window>()

export interface RateLimitResult { allowed: boolean; retryAfterSec?: number }

export function checkRateLimit(key: string): RateLimitResult {
  const now = Date.now()
  const w = windows.get(key)
  if (!w || now >= w.resetAt) {
    windows.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return { allowed: true }
  }
  if (w.count >= LIMIT_PER_WINDOW) {
    return { allowed: false, retryAfterSec: Math.ceil((w.resetAt - now) / 1000) }
  }
  w.count++
  return { allowed: true }
}
