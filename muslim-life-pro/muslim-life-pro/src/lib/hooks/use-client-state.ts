'use client'

import { useSyncExternalStore } from 'react'

/**
 * Hydration-safe client hooks.
 *
 * Both use `useSyncExternalStore`, which is the mechanism React provides for
 * reading values that legitimately differ between server and client. The older
 * `useState(false)` + `useEffect(() => setMounted(true))` idiom produces a
 * cascading render on every mount, which React 19 correctly flags.
 */

const noopSubscribe = () => () => {}

/**
 * `false` during server render and the hydration pass, `true` afterwards.
 * Use to defer UI that cannot be known on the server (resolved theme, locale
 * formatting that depends on the device).
 */
export function useIsMounted(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true, // client snapshot
    () => false, // server snapshot
  )
}

/**
 * A ticking clock as an external store.
 *
 * The snapshot is a number (milliseconds, truncated to the tick interval) rather
 * than a `Date`, because `useSyncExternalStore` compares snapshots by identity —
 * returning a fresh object each read would loop forever.
 */
function createClock(intervalMs: number) {
  let current = 0
  const listeners = new Set<() => void>()
  let timer: ReturnType<typeof setInterval> | null = null

  function tick() {
    current = Math.floor(Date.now() / intervalMs) * intervalMs
    for (const listener of listeners) listener()
  }

  return {
    subscribe(listener: () => void) {
      listeners.add(listener)
      if (timer === null) {
        tick()
        timer = setInterval(tick, intervalMs)
      }
      return () => {
        listeners.delete(listener)
        if (listeners.size === 0 && timer !== null) {
          clearInterval(timer)
          timer = null
        }
      }
    },
    getSnapshot: () => current,
  }
}

const secondClock = createClock(1000)

/**
 * Milliseconds since the epoch, updating once per second.
 * Returns `null` on the server and during hydration so no mismatch is possible.
 */
export function useNow(): number | null {
  return useSyncExternalStore(
    secondClock.subscribe,
    secondClock.getSnapshot,
    () => null, // server snapshot — no clock during SSR
  )
}
