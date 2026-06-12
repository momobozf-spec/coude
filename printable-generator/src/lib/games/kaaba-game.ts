import { sounds } from "./game-sounds";

interface Block { x: number; y: number; w: number; h: number; color: string; }
interface Callbacks { onScore: (s: number) => void; onGameOver: (s: number, meta: Record<string, number>) => void; }

const BLOCK_H = 22;
const COLORS = ["#1a6b4a", "#145239", "#0f3d2a", "#1a6b4a", "#c9920a", "#a07608"];

export class KaabaGame {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  blocks: Block[] = [];
  current: { x: number; w: number; dir: number; speed: number } | null = null;
  score = 0;
  layers = 0;
  perfects = 0;
  gameOver = false;
  animFrame = 0;
  lastTime = 0;
  baseY = 0;
  cb: Callbacks;

  constructor(canvas: HTMLCanvasElement, cb: Callbacks) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.cb = cb;
  }

  init() {
    this.resize();
    const w = this.canvas.width / 2;
    this.baseY = this.canvas.height / 2 - 60;
    this.blocks = []; this.score = 0; this.layers = 0; this.perfects = 0; this.gameOver = false;

    // Base block
    const baseW = Math.min(120, w * 0.5);
    this.blocks.push({ x: (w - baseW) / 2, y: this.baseY, w: baseW, h: BLOCK_H, color: "#1a1a2e" });
    this.spawnNext();
    this.lastTime = performance.now();
    this.loop();
  }

  resize() {
    const rect = this.canvas.parentElement?.getBoundingClientRect();
    const cw = rect?.width || 400;
    const ch = Math.min(cw * 1.4, window.innerHeight - 80);
    this.canvas.width = cw * 2; this.canvas.height = ch * 2;
    this.canvas.style.height = `${ch}px`;
    this.ctx.scale(2, 2);
  }

  spawnNext() {
    const last = this.blocks[this.blocks.length - 1];
    this.current = { x: 0, w: last.w, dir: 1, speed: 80 + this.layers * 6 };
  }

  loop = () => {
    const now = performance.now();
    const dt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    if (!this.gameOver && this.current) this.update(dt);
    this.draw();
    this.animFrame = requestAnimationFrame(this.loop);
  };

  update(dt: number) {
    if (!this.current) return;
    const w = this.canvas.width / 2;
    this.current.x += this.current.dir * this.current.speed * dt;
    if (this.current.x + this.current.w > w - 10) this.current.dir = -1;
    if (this.current.x < 10) this.current.dir = 1;
  }

  draw() {
    const ctx = this.ctx;
    const w = this.canvas.width / 2, h = this.canvas.height / 2;
    ctx.clearRect(0, 0, w, h);

    // Night sky
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "#0a0e1a"); grad.addColorStop(0.6, "#0f172a"); grad.addColorStop(1, "#1a1a2e");
    ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);

    // Stars
    for (let i = 0; i < 20; i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.2 + Math.sin(Date.now() / 1000 + i) * 0.15})`;
      ctx.fillRect((i * 47 + 13) % w, (i * 31 + 7) % (h * 0.5), 1.5, 1.5);
    }

    // Ground
    ctx.fillStyle = "#2a1a0a"; ctx.fillRect(0, this.baseY + BLOCK_H, w, h - this.baseY);

    // Placed blocks
    for (const block of this.blocks) {
      ctx.fillStyle = block.color;
      ctx.fillRect(block.x, block.y, block.w, block.h);
      ctx.strokeStyle = "rgba(0,0,0,0.3)"; ctx.lineWidth = 1;
      ctx.strokeRect(block.x, block.y, block.w, block.h);
    }

    // Moving block
    if (this.current && !this.gameOver) {
      const y = this.baseY - (this.layers + 1) * BLOCK_H;
      ctx.fillStyle = COLORS[this.layers % COLORS.length];
      ctx.fillRect(this.current.x, y, this.current.w, BLOCK_H);
      ctx.strokeStyle = "rgba(255,255,255,0.2)"; ctx.strokeRect(this.current.x, y, this.current.w, BLOCK_H);
    }

    // HUD
    ctx.fillStyle = "#c9920a"; ctx.font = "bold 16px sans-serif"; ctx.textAlign = "center";
    ctx.fillText("Bouw de Kaaba", w / 2, 25);
    ctx.fillStyle = "#fff"; ctx.font = "14px sans-serif";
    ctx.fillText(`Layers: ${this.layers}  |  Score: ${this.score}`, w / 2, 48);

    // Game over
    if (this.gameOver) {
      ctx.fillStyle = "rgba(0,0,0,0.7)"; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#c9920a"; ctx.font = "bold 24px sans-serif"; ctx.textAlign = "center";
      ctx.fillText("Game Over!", w / 2, h / 2 - 25);
      ctx.fillStyle = "#fff"; ctx.font = "16px sans-serif";
      ctx.fillText(`${this.layers} layers · ${this.perfects} perfects · ${this.score} pts`, w / 2, h / 2 + 10);
      ctx.fillStyle = "rgba(255,255,255,0.4)"; ctx.font = "13px sans-serif";
      ctx.fillText("Tap to play again", w / 2, h / 2 + 40);
    }
  }

  handleClick(_e: MouseEvent | React.MouseEvent) {
    if (this.gameOver) { this.init(); return; }
    if (!this.current) return;

    const last = this.blocks[this.blocks.length - 1];
    const y = this.baseY - (this.layers + 1) * BLOCK_H;

    // Calculate overlap
    const overlapLeft = Math.max(this.current.x, last.x);
    const overlapRight = Math.min(this.current.x + this.current.w, last.x + last.w);
    const overlapW = overlapRight - overlapLeft;

    if (overlapW <= 0) {
      // Miss — game over
      this.gameOver = true; sounds.gameOver();
      this.cb.onGameOver(this.score, { layers: this.layers, perfects: this.perfects });
      return;
    }

    // Perfect placement check (within 3px)
    const isPerfect = Math.abs(this.current.x - last.x) < 3;
    const newW = isPerfect ? last.w : overlapW;
    const newX = isPerfect ? last.x : overlapLeft;

    this.blocks.push({ x: newX, y, w: newW, h: BLOCK_H, color: COLORS[this.layers % COLORS.length] });
    this.layers++;

    if (isPerfect) { this.perfects++; this.score += 30; sounds.perfect(); }
    else { this.score += 10 + Math.floor(overlapW / last.w * 10); sounds.correct(); }

    this.cb.onScore(this.score);

    // Scroll down if too high
    if (y < 100) {
      for (const b of this.blocks) b.y += BLOCK_H;
      this.baseY += BLOCK_H;
    }

    this.spawnNext();
  }

  handleTouch(e: TouchEvent | React.TouchEvent) { this.handleClick({} as MouseEvent); }
  destroy() { cancelAnimationFrame(this.animFrame); }
}
