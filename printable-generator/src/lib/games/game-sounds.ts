let enabled = true;

export function setSoundEnabled(v: boolean) { enabled = v; if (typeof localStorage !== "undefined") localStorage.setItem("noor_sounds", v ? "1" : "0"); }
export function isSoundEnabled() { if (typeof localStorage !== "undefined") { const v = localStorage.getItem("noor_sounds"); if (v !== null) return v === "1"; } return true; }

function tone(freq: number, dur: number, type: OscillatorType = "sine") {
  if (!enabled || typeof AudioContext === "undefined") return;
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = freq; osc.type = type;
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + dur);
  } catch { /* silent */ }
}

export const sounds = {
  match: () => tone(523, 0.15),
  correct: () => tone(659, 0.12),
  wrong: () => tone(220, 0.3, "sawtooth"),
  perfect: () => { tone(523, 0.1); setTimeout(() => tone(659, 0.1), 100); setTimeout(() => tone(784, 0.2), 200); },
  gameOver: () => tone(196, 0.6, "sawtooth"),
  levelUp: () => { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.15), i * 100)); },
};
