import { sounds } from "./game-sounds";

const SYMBOLS = [
  { emoji: "🕌", name: "Mosque", nameAr: "مسجد" },
  { emoji: "🌙", name: "Crescent", nameAr: "هلال" },
  { emoji: "⭐", name: "Star", nameAr: "نجمة" },
  { emoji: "📿", name: "Tasbih", nameAr: "تسبيح" },
  { emoji: "📖", name: "Quran", nameAr: "قرآن" },
  { emoji: "🕋", name: "Kaaba", nameAr: "كعبة" },
  { emoji: "🏮", name: "Lantern", nameAr: "فانوس" },
  { emoji: "🌺", name: "Flower", nameAr: "زهرة" },
];

interface Card { id: number; symbolIdx: number; flipped: boolean; matched: boolean; x: number; y: number; w: number; h: number; }
interface Callbacks { onScore: (s: number) => void; onGameOver: (s: number, meta: Record<string, number>) => void; }

export class MemoryGame {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  cards: Card[] = [];
  flippedIds: number[] = [];
  score = 0;
  moves = 0;
  matches = 0;
  startTime = 0;
  gameOver = false;
  animFrame = 0;
  cb: Callbacks;

  constructor(canvas: HTMLCanvasElement, cb: Callbacks) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.cb = cb;
  }

  init() {
    this.resize();
    const pairs = [...SYMBOLS, ...SYMBOLS].map((s, i) => ({ ...s, id: i, symbolIdx: i % SYMBOLS.length }));
    // Shuffle
    for (let i = pairs.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pairs[i], pairs[j]] = [pairs[j], pairs[i]]; }

    const cols = 4, rows = 4, pad = 10;
    const cw = (this.canvas.width - pad * (cols + 1)) / cols;
    const ch = (this.canvas.height - 100 - pad * (rows + 1)) / rows;

    this.cards = pairs.map((p, i) => ({
      id: i, symbolIdx: p.symbolIdx, flipped: false, matched: false,
      x: pad + (i % cols) * (cw + pad), y: 80 + pad + Math.floor(i / cols) * (ch + pad),
      w: cw, h: ch,
    }));

    this.score = 0; this.moves = 0; this.matches = 0; this.gameOver = false;
    this.startTime = Date.now();
    this.loop();
  }

  resize() {
    const rect = this.canvas.parentElement?.getBoundingClientRect();
    const w = rect?.width || 400;
    const h = Math.min(w * 1.2, window.innerHeight - 100);
    this.canvas.width = w * 2; this.canvas.height = h * 2;
    this.canvas.style.height = `${h}px`;
    this.ctx.scale(2, 2); // retina
  }

  loop = () => {
    this.draw();
    if (!this.gameOver) this.animFrame = requestAnimationFrame(this.loop);
  };

  draw() {
    const ctx = this.ctx;
    const w = this.canvas.width / 2, h = this.canvas.height / 2;
    ctx.clearRect(0, 0, w, h);

    // Background
    ctx.fillStyle = "#0f172a"; ctx.fillRect(0, 0, w, h);

    // Header
    ctx.fillStyle = "#c9920a"; ctx.font = "bold 18px sans-serif"; ctx.textAlign = "center";
    ctx.fillText("Moskee Memory", w / 2, 30);
    ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.font = "13px sans-serif";
    ctx.fillText(`Score: ${this.score}  |  Moves: ${this.moves}  |  Matches: ${this.matches}/8`, w / 2, 55);

    // Cards
    for (const card of this.cards) {
      const show = card.flipped || card.matched;

      // Card background
      ctx.fillStyle = card.matched ? "#1a6b4a" : show ? "#1e293b" : "#334155";
      ctx.beginPath();
      ctx.roundRect(card.x, card.y, card.w, card.h, 8);
      ctx.fill();

      if (show) {
        const sym = SYMBOLS[card.symbolIdx];
        ctx.font = `${card.w * 0.4}px sans-serif`;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(sym.emoji, card.x + card.w / 2, card.y + card.h / 2 - 8);
        ctx.fillStyle = "rgba(255,255,255,0.6)"; ctx.font = "10px sans-serif";
        ctx.fillText(sym.name, card.x + card.w / 2, card.y + card.h / 2 + card.w * 0.22);
      } else {
        // Back pattern
        ctx.fillStyle = "#c9920a"; ctx.font = `${card.w * 0.3}px sans-serif`;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText("🌙", card.x + card.w / 2, card.y + card.h / 2);
      }
    }

    // Game over overlay
    if (this.gameOver) {
      ctx.fillStyle = "rgba(0,0,0,0.7)"; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#c9920a"; ctx.font = "bold 28px sans-serif"; ctx.textAlign = "center";
      ctx.fillText("Masha'Allah!", w / 2, h / 2 - 30);
      ctx.fillStyle = "#fff"; ctx.font = "18px sans-serif";
      ctx.fillText(`Score: ${this.score}`, w / 2, h / 2 + 10);
      const elapsed = Math.round((Date.now() - this.startTime) / 1000);
      ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.font = "14px sans-serif";
      ctx.fillText(`${this.moves} moves · ${elapsed}s`, w / 2, h / 2 + 40);
    }
  }

  handleClick(e: MouseEvent | React.MouseEvent) {
    if (this.gameOver || this.flippedIds.length >= 2) return;

    const rect = this.canvas.getBoundingClientRect();
    const sx = (this.canvas.width / 2) / rect.width;
    const x = (e.clientX - rect.left) * sx;
    const y = (e.clientY - rect.top) * sx;

    for (const card of this.cards) {
      if (card.matched || card.flipped) continue;
      if (x >= card.x && x <= card.x + card.w && y >= card.y && y <= card.y + card.h) {
        card.flipped = true;
        this.flippedIds.push(card.id);
        sounds.correct();

        if (this.flippedIds.length === 2) {
          this.moves++;
          const [a, b] = this.flippedIds.map(id => this.cards.find(c => c.id === id)!);
          if (a.symbolIdx === b.symbolIdx) {
            a.matched = b.matched = true;
            this.matches++;
            this.score += 20 + Math.max(0, 10 - this.moves);
            this.cb.onScore(this.score);
            sounds.match();
            this.flippedIds = [];

            if (this.matches === 8) {
              this.gameOver = true;
              const elapsed = Math.round((Date.now() - this.startTime) / 1000);
              this.score += Math.max(0, 200 - elapsed * 2); // time bonus
              sounds.perfect();
              this.cb.onGameOver(this.score, { moves: this.moves, time: elapsed, matches: 8 });
            }
          } else {
            sounds.wrong();
            setTimeout(() => { a.flipped = b.flipped = false; this.flippedIds = []; }, 800);
          }
        }
        break;
      }
    }
  }

  handleTouch(e: TouchEvent | React.TouchEvent) {
    const touch = ("touches" in e ? e.touches[0] : (e as React.TouchEvent).touches[0]);
    this.handleClick({ clientX: touch.clientX, clientY: touch.clientY } as MouseEvent);
  }

  destroy() { cancelAnimationFrame(this.animFrame); }
}
