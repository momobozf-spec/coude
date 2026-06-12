import { sounds } from "./game-sounds";

const LETTERS = [
  { ar: "أ", name: "Alif" }, { ar: "ب", name: "Ba" }, { ar: "ت", name: "Ta" },
  { ar: "ث", name: "Tha" }, { ar: "ج", name: "Jim" }, { ar: "ح", name: "Ha" },
  { ar: "خ", name: "Kha" }, { ar: "د", name: "Dal" }, { ar: "ذ", name: "Dhal" },
  { ar: "ر", name: "Ra" }, { ar: "ز", name: "Zay" }, { ar: "س", name: "Sin" },
  { ar: "ش", name: "Shin" }, { ar: "ص", name: "Sad" }, { ar: "ض", name: "Dad" },
  { ar: "ط", name: "Ta" }, { ar: "ظ", name: "Dha" }, { ar: "ع", name: "Ain" },
  { ar: "غ", name: "Ghain" }, { ar: "ف", name: "Fa" }, { ar: "ق", name: "Qaf" },
  { ar: "ك", name: "Kaf" }, { ar: "ل", name: "Lam" }, { ar: "م", name: "Mim" },
];

interface Bubble { x: number; y: number; r: number; letterIdx: number; speed: number; }
interface Callbacks { onScore: (s: number) => void; onGameOver: (s: number, meta: Record<string, number>) => void; }

export class ArabicGame {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  bubbles: Bubble[] = [];
  targetIdx = 0;
  score = 0;
  lives = 3;
  combo = 0;
  maxCombo = 0;
  caught = 0;
  missed = 0;
  gameOver = false;
  spawnTimer = 0;
  animFrame = 0;
  lastTime = 0;
  difficulty = 1;
  cb: Callbacks;

  constructor(canvas: HTMLCanvasElement, cb: Callbacks) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.cb = cb;
  }

  init() {
    this.resize();
    this.score = 0; this.lives = 3; this.combo = 0; this.maxCombo = 0;
    this.caught = 0; this.missed = 0; this.gameOver = false;
    this.bubbles = []; this.difficulty = 1;
    this.targetIdx = Math.floor(Math.random() * LETTERS.length);
    this.lastTime = performance.now();
    this.loop();
  }

  resize() {
    const rect = this.canvas.parentElement?.getBoundingClientRect();
    const w = rect?.width || 400;
    const h = Math.min(w * 1.4, window.innerHeight - 80);
    this.canvas.width = w * 2; this.canvas.height = h * 2;
    this.canvas.style.height = `${h}px`;
    this.ctx.scale(2, 2);
  }

  loop = () => {
    const now = performance.now();
    const dt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    if (!this.gameOver) this.update(dt);
    this.draw();
    this.animFrame = requestAnimationFrame(this.loop);
  };

  update(dt: number) {
    const w = this.canvas.width / 2, h = this.canvas.height / 2;

    // Spawn
    this.spawnTimer += dt;
    const spawnRate = Math.max(0.4, 1.2 - this.difficulty * 0.08);
    if (this.spawnTimer > spawnRate) {
      this.spawnTimer = 0;
      const isTarget = Math.random() < 0.35;
      const idx = isTarget ? this.targetIdx : Math.floor(Math.random() * LETTERS.length);
      this.bubbles.push({
        x: 30 + Math.random() * (w - 60), y: -30, r: 22,
        letterIdx: idx, speed: 60 + this.difficulty * 8 + Math.random() * 30,
      });
    }

    // Move bubbles
    for (const b of this.bubbles) b.y += b.speed * dt;

    // Remove off-screen (missed targets)
    this.bubbles = this.bubbles.filter(b => {
      if (b.y > h + 40) {
        if (b.letterIdx === this.targetIdx) { this.lives--; this.missed++; this.combo = 0; sounds.wrong(); if (this.lives <= 0) this.endGame(); }
        return false;
      }
      return true;
    });

    this.difficulty = 1 + Math.floor(this.score / 50);
  }

  draw() {
    const ctx = this.ctx;
    const w = this.canvas.width / 2, h = this.canvas.height / 2;
    ctx.clearRect(0, 0, w, h);

    // Sky gradient
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "#0f172a"); grad.addColorStop(1, "#1e293b");
    ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);

    // Bubbles
    for (const b of this.bubbles) {
      const isTarget = b.letterIdx === this.targetIdx;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fillStyle = isTarget ? "#1a6b4a" : "#334155";
      ctx.fill();
      ctx.strokeStyle = isTarget ? "#c9920a" : "rgba(255,255,255,0.1)";
      ctx.lineWidth = isTarget ? 2.5 : 1; ctx.stroke();

      ctx.fillStyle = "#fff"; ctx.font = "bold 20px Amiri, serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(LETTERS[b.letterIdx].ar, b.x, b.y);
    }

    // HUD top
    ctx.fillStyle = "#fff"; ctx.font = "bold 16px sans-serif"; ctx.textAlign = "left";
    ctx.fillText(`Score: ${this.score}`, 15, 25);
    ctx.textAlign = "right";
    ctx.fillText("❤️".repeat(this.lives), w - 15, 25);
    if (this.combo > 1) { ctx.fillStyle = "#c9920a"; ctx.textAlign = "center"; ctx.fillText(`${this.combo}x Combo!`, w / 2, 25); }

    // Target at bottom
    const target = LETTERS[this.targetIdx];
    ctx.fillStyle = "rgba(26,107,74,0.3)"; ctx.fillRect(0, h - 70, w, 70);
    ctx.fillStyle = "#c9920a"; ctx.font = "13px sans-serif"; ctx.textAlign = "center";
    ctx.fillText("Catch:", w / 2, h - 52);
    ctx.fillStyle = "#fff"; ctx.font = "bold 28px Amiri, serif";
    ctx.fillText(target.ar, w / 2, h - 22);
    ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.font = "11px sans-serif";
    ctx.fillText(target.name, w / 2, h - 5);

    // Game over
    if (this.gameOver) {
      ctx.fillStyle = "rgba(0,0,0,0.75)"; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#c9920a"; ctx.font = "bold 26px sans-serif"; ctx.textAlign = "center";
      ctx.fillText("Game Over!", w / 2, h / 2 - 25);
      ctx.fillStyle = "#fff"; ctx.font = "18px sans-serif";
      ctx.fillText(`Score: ${this.score}`, w / 2, h / 2 + 10);
      ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.font = "13px sans-serif";
      ctx.fillText(`Best combo: ${this.maxCombo}x · Caught: ${this.caught}`, w / 2, h / 2 + 35);
    }
  }

  handleClick(e: MouseEvent | React.MouseEvent) {
    if (this.gameOver) { this.init(); return; }
    const rect = this.canvas.getBoundingClientRect();
    const sx = (this.canvas.width / 2) / rect.width;
    const x = (e.clientX - rect.left) * sx;
    const y = (e.clientY - rect.top) * sx;

    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i];
      if (Math.hypot(x - b.x, y - b.y) < b.r + 10) {
        if (b.letterIdx === this.targetIdx) {
          this.combo++;
          this.maxCombo = Math.max(this.maxCombo, this.combo);
          this.caught++;
          const pts = 10 * Math.min(this.combo, 5);
          this.score += pts;
          this.cb.onScore(this.score);
          sounds.correct();
          if (this.combo >= 5) sounds.perfect();
          this.bubbles.splice(i, 1);
          // New target every 3 catches
          if (this.caught % 3 === 0) this.targetIdx = Math.floor(Math.random() * LETTERS.length);
        } else {
          this.combo = 0;
          this.lives--;
          sounds.wrong();
          this.bubbles.splice(i, 1);
          if (this.lives <= 0) this.endGame();
        }
        return;
      }
    }
  }

  handleTouch(e: TouchEvent | React.TouchEvent) {
    const t = ("touches" in e ? e.touches[0] : (e as React.TouchEvent).touches[0]);
    this.handleClick({ clientX: t.clientX, clientY: t.clientY } as MouseEvent);
  }

  endGame() {
    this.gameOver = true;
    sounds.gameOver();
    this.cb.onGameOver(this.score, { combo: this.maxCombo, caught: this.caught, missed: this.missed });
  }

  destroy() { cancelAnimationFrame(this.animFrame); }
}
