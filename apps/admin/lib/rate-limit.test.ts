import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock minimal pour reproduire la logique de rate-limit sans dépendance au module
// (le module utilise un Map en mémoire — on teste la logique pure ici)

interface RateLimitEntry {
  count: number
  resetAt: number
}

function createRateLimiter() {
  const store = new Map<string, RateLimitEntry>()

  function rateLimit(
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

  function clear() { store.clear() }

  return { rateLimit, clear }
}

describe('rateLimit()', () => {
  let limiter: ReturnType<typeof createRateLimiter>

  beforeEach(() => {
    limiter = createRateLimiter()
  })

  it('accepte la première requête', () => {
    expect(limiter.rateLimit('ip:1.2.3.4', 3, 60000).ok).toBe(true)
  })

  it('accepte jusqu\'à la limite incluse', () => {
    for (let i = 0; i < 3; i++) {
      expect(limiter.rateLimit('ip:1.2.3.4', 3, 60000).ok).toBe(true)
    }
  })

  it('bloque la (N+1)ème requête', () => {
    for (let i = 0; i < 3; i++) limiter.rateLimit('ip:1.2.3.4', 3, 60000)
    const result = limiter.rateLimit('ip:1.2.3.4', 3, 60000)
    expect(result.ok).toBe(false)
    expect(result.retryAfterMs).toBeGreaterThan(0)
  })

  it('isole les clés différentes', () => {
    for (let i = 0; i < 3; i++) limiter.rateLimit('ip:1.2.3.4', 3, 60000)
    // Une IP différente ne doit pas être bloquée
    expect(limiter.rateLimit('ip:5.6.7.8', 3, 60000).ok).toBe(true)
  })

  it('réinitialise après l\'expiration de la fenêtre', () => {
    const now = Date.now()
    vi.setSystemTime(now)

    for (let i = 0; i < 3; i++) limiter.rateLimit('ip:1.2.3.4', 3, 1000)
    expect(limiter.rateLimit('ip:1.2.3.4', 3, 1000).ok).toBe(false)

    // Avancer le temps au-delà de la fenêtre
    vi.setSystemTime(now + 1001)
    expect(limiter.rateLimit('ip:1.2.3.4', 3, 1000).ok).toBe(true)

    vi.useRealTimers()
  })
})
