/**
 * Generates the app icons in the house style — no image library involved.
 *
 * The motif is a rub el hizb (two overlapping squares, one rotated 45°) in gold
 * on emerald: a plain Islamic geometric mark that stays readable at 32px on a
 * home screen. Everything is computed per pixel and encoded as PNG by hand,
 * because Node already ships zlib and this project adds no dependencies for
 * something that runs once.
 *
 *   node scripts/generate-icons.mjs
 */

import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = join(ROOT, "public");

const EMERALD = [0x1a, 0x6b, 0x4a];
const EMERALD_DARK = [0x12, 0x50, 0x37];
const GOLD = [0xc9, 0x92, 0x0a];
const GOLD_LIGHT = [0xfd, 0xf6, 0xe3];

/* ------------------------------------------------------------ PNG encoder - */

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type, "latin1");
  const body = Buffer.concat([typeBuffer, data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

/** Encodes an RGB pixel buffer (size*size*3) as an opaque PNG. */
function encodePng(size, rgb) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // colour type: truecolour RGB
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  // One filter byte (0 = none) in front of every scanline.
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y += 1) {
    const rowStart = y * (size * 3 + 1);
    raw[rowStart] = 0;
    rgb.copy(raw, rowStart + 1, y * size * 3, (y + 1) * size * 3);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/* ----------------------------------------------------------------- design - */

function mix(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

/**
 * Colour at a point in unit space (0..1), before anti-aliasing.
 * `scale` shrinks the motif for maskable icons, whose outer 10% gets cropped.
 */
function sample(u, v, scale) {
  const dx = u - 0.5;
  const dy = v - 0.5;
  const dist = Math.hypot(dx, dy);

  // Background: a soft diagonal wash so the icon is not a flat slab.
  let colour = mix(EMERALD, EMERALD_DARK, Math.min(1, (u + v) / 2));

  // Faint ring, echoing the badge artwork elsewhere in the app.
  const ringRadius = 0.4 * scale;
  if (Math.abs(dist - ringRadius) < 0.012 * scale) {
    colour = mix(colour, GOLD_LIGHT, 0.25);
  }

  // Rub el hizb: an axis-aligned square unioned with the same square at 45°.
  const r = 0.3 * scale;
  const inSquare = Math.abs(dx) <= r && Math.abs(dy) <= r;
  const diag = r * Math.SQRT2;
  const inRotated = Math.abs(dx + dy) <= diag && Math.abs(dx - dy) <= diag;

  if (inSquare || inRotated) {
    colour = GOLD;

    // Hollow centre, which keeps the mark legible when it is tiny.
    const innerR = 0.15 * scale;
    const innerSquare = Math.abs(dx) <= innerR && Math.abs(dy) <= innerR;
    const innerDiag = innerR * Math.SQRT2;
    const innerRotated =
      Math.abs(dx + dy) <= innerDiag && Math.abs(dx - dy) <= innerDiag;
    if (innerSquare || innerRotated) {
      colour = mix(EMERALD, EMERALD_DARK, Math.min(1, (u + v) / 2));
    }
  }

  return colour;
}

/** 3x3 supersampling — the diagonals look ragged without it. */
function render(size, scale) {
  const rgb = Buffer.alloc(size * size * 3);
  const steps = [1 / 6, 3 / 6, 5 / 6];

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (const sy of steps) {
        for (const sx of steps) {
          const [cr, cg, cb] = sample((x + sx) / size, (y + sy) / size, scale);
          r += cr;
          g += cg;
          b += cb;
        }
      }
      const i = (y * size + x) * 3;
      rgb[i] = Math.round(r / 9);
      rgb[i + 1] = Math.round(g / 9);
      rgb[i + 2] = Math.round(b / 9);
    }
  }

  return rgb;
}

function write(path, size, scale) {
  const target = join(PUBLIC, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, encodePng(size, render(size, scale)));
  console.log(`  ${path}  ${size}x${size}`);
}

console.log("Iconen:");
write("icons/192.png", 192, 1);
write("icons/512.png", 512, 1);
// Maskable: platforms crop to a circle/squircle, so the motif is pulled in to
// sit safely inside the middle 80%.
write("icons/512-maskable.png", 512, 0.72);
// iOS home screen. Without this Safari screenshots the page instead.
write("apple-touch-icon.png", 180, 1);
console.log("Klaar.");
