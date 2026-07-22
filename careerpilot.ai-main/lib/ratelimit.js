// Simple in-memory rate limiter (token bucket per user+key).
// For production, use Redis. In dev/preview this is fine.
const buckets = new Map()
const LIMITS = {
  default: { max: 60, windowMs: 60_000 },
  llm: { max: 20, windowMs: 60_000 },
  auth: { max: 10, windowMs: 60_000 },
  export: { max: 20, windowMs: 60_000 },
}

export function limit(key, subject) {
  const cfg = LIMITS[key] || LIMITS.default
  const bucketKey = `${key}:${subject}`
  const now = Date.now()
  const b = buckets.get(bucketKey)
  if (!b || now - b.start > cfg.windowMs) {
    buckets.set(bucketKey, { start: now, count: 1 })
    return { ok: true, remaining: cfg.max - 1 }
  }
  if (b.count >= cfg.max) return { ok: false, remaining: 0, retryAfterSec: Math.ceil((b.start + cfg.windowMs - now) / 1000) }
  b.count++
  return { ok: true, remaining: cfg.max - b.count }
}

// Cleanup old buckets every 5 min
setInterval(() => {
  const now = Date.now()
  for (const [k, v] of buckets) if (now - v.start > 300_000) buckets.delete(k)
}, 300_000)
