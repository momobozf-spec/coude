// Global daily cap on model calls (cost guard / denial-of-wallet protection).
// In-memory: correct for a single server instance. Resets at 00:00 UTC.

export function createDailyLimiter(limit, now = () => new Date()) {
  let day = ''
  let count = 0

  function currentDay() {
    return now().toISOString().slice(0, 10)
  }

  function roll() {
    const d = currentDay()
    if (d !== day) {
      day = d
      count = 0
    }
  }

  return {
    // Reserves one slot. Returns false when today's budget is used up.
    tryConsume() {
      roll()
      if (count >= limit) return false
      count++
      return true
    },
    // Give a slot back (e.g. when the upstream call failed before costing tokens).
    release() {
      roll()
      if (count > 0) count--
    },
    remaining() {
      roll()
      return Math.max(0, limit - count)
    },
  }
}
