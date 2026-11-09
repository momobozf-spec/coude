/**
 * Audio for the games, built on the Web Audio API rather than `new Audio()`.
 *
 * Safari on iOS refuses to produce sound until an AudioContext has been resumed
 * inside a real user gesture. An `<audio>` element fails *silently* there: the
 * child taps play, nothing happens, and no error is raised. So the context is
 * created once, unlocked on the first tap (see `unlockAudio`), and every clip
 * is decoded into a buffer that can be replayed instantly afterwards.
 */

let ctx: AudioContext | null = null;
let unlocked = false;

const cache = new Map<string, AudioBuffer>();
const inflight = new Map<string, Promise<AudioBuffer>>();

type WebkitWindow = Window & { webkitAudioContext?: typeof AudioContext };

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;

  const AC = window.AudioContext ?? (window as WebkitWindow).webkitAudioContext;
  if (!AC) return null;

  ctx = new AC();
  return ctx;
}

/**
 * Call this inside a real user gesture (pointerdown / click).
 *
 * Playing one silent sample is the trick that flips iOS out of its blocked
 * state; `resume()` alone is not always enough.
 */
export function unlockAudio(): void {
  const c = getContext();
  if (!c) return;

  if (!unlocked) {
    const buffer = c.createBuffer(1, 1, 22050);
    const source = c.createBufferSource();
    source.buffer = buffer;
    source.connect(c.destination);
    source.start(0);
    unlocked = true;
  }

  void c.resume();
}

async function load(url: string): Promise<AudioBuffer | null> {
  const c = getContext();
  if (!c) return null;

  const cached = cache.get(url);
  if (cached) return cached;

  const pending = inflight.get(url);
  if (pending) return pending;

  const task = (async () => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Audio load failed: ${url}`);
    const buffer = await c.decodeAudioData(await response.arrayBuffer());
    cache.set(url, buffer);
    return buffer;
  })();

  // Cleared in both directions: leaving a rejected promise behind would make
  // every later attempt at this clip fail without even retrying the fetch.
  inflight.set(
    url,
    task.finally(() => {
      inflight.delete(url);
    }),
  );

  return task;
}

/** Decodes clips up front so there is no pause on the first tap of a round. */
export async function preload(urls: readonly string[]): Promise<void> {
  if (urls.length === 0) return;
  await Promise.allSettled(urls.map((url) => load(url)));
}

/** Plays a clip. Never throws — returns false when nothing was heard. */
export async function play(url: string): Promise<boolean> {
  const c = getContext();
  if (!c) return false;

  if (c.state === "suspended") {
    try {
      await c.resume();
    } catch {
      return false;
    }
  }

  try {
    const buffer = await load(url);
    if (!buffer) return false;

    const source = c.createBufferSource();
    source.buffer = buffer;
    source.connect(c.destination);
    source.start(0);
    return true;
  } catch {
    return false;
  }
}
