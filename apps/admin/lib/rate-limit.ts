/**
 * Simple in-memory rate limiter for Next.js API routes.
 * Resets on server restart — sufficient for MVP.
 * For production scale, replace with Upstash Redis.
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

// Clean up expired entries every 10 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt < now) store.delete(key)
  }
}, 10 * 60 * 1000)

/**
 * Check rate limit for a given key.
 * @param key      Unique identifier (e.g. IP address)
 * @param limit    Max requests allowed in the window
 * @param windowMs Time window in milliseconds
 * @returns { ok: true } or { ok: false, retryAfterMs: number }
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { ok: boolean; retryAfterMs?: number } {
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true }
  }

  if (entry.count >= limit) {
    return { ok: false, retryAfterMs: entry.resetAt - now }
  }

  entry.count++
  return { ok: true }
}

/**
 * Get the client IP from a Next.js request.
 */
export function getIp(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  )
}
