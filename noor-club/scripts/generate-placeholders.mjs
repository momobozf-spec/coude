/**
 * Generates the placeholder media that content/ refers to.
 *
 * Every fileUrl / audioUrl / coverUrl / iconUrl in content/ must resolve to a
 * real file under public/, otherwise a download 404s and the LISTEN engine has
 * nothing to play. Real artwork and recordings replace these one-for-one: same
 * paths, same names.
 *
 *   node scripts/generate-placeholders.mjs
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CONTENT = join(ROOT, "content");
const PUBLIC = join(ROOT, "public");
// Downloads are gated by /api/asset/[assetId], so they must not be reachable
// as static files. Covers, badges and audio stay public.
const PRIVATE_ASSETS = join(ROOT, "private", "assets");

/* ------------------------------------------------------------------ PDF --- */

/** Minimal, spec-valid one-page PDF with a Helvetica title. */
function buildPdf(title, subtitle) {
  const safe = (value) =>
    value
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^\x20-\x7e]/g, "")
      .replace(/([()\\])/g, "\\$1");

  const stream = [
    "BT /F1 22 Tf 60 760 Td (" + safe(title) + ") Tj ET",
    "BT /F1 12 Tf 60 730 Td (" + safe(subtitle) + ") Tj ET",
    "BT /F1 10 Tf 60 60 Td (Noor Club - placeholder) Tj ET",
  ].join("\n");

  const objects = [
    "<</Type/Catalog/Pages 2 0 R>>",
    "<</Type/Pages/Kids[3 0 R]/Count 1>>",
    "<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Resources<</Font<</F1 4 0 R>>>>/Contents 5 0 R>>",
    "<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>",
    `<</Length ${Buffer.byteLength(stream, "latin1")}>>\nstream\n${stream}\nendstream`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [];

  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefStart = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<</Size ${objects.length + 1}/Root 1 0 R>>\nstartxref\n${xrefStart}\n%%EOF\n`;

  return Buffer.from(pdf, "latin1");
}

/* ------------------------------------------------------------------ MP3 --- */

/**
 * ~1 second of silence as raw MPEG-1 Layer III frames.
 * Header bytes: FF FB 90 C4 = MPEG1 / Layer III / 128 kbps / 44.1 kHz / mono.
 */
function buildMp3(seconds = 1) {
  const FRAME_BYTES = Math.floor((144 * 128000) / 44100); // 417
  const FRAMES_PER_SECOND = 44100 / 1152; // ~38.28
  const frameCount = Math.max(1, Math.round(FRAMES_PER_SECOND * seconds));

  const frame = Buffer.alloc(FRAME_BYTES);
  frame[0] = 0xff;
  frame[1] = 0xfb;
  frame[2] = 0x90;
  frame[3] = 0xc4;

  return Buffer.concat(Array.from({ length: frameCount }, () => Buffer.from(frame)));
}

/* ------------------------------------------------------------------ SVG --- */

function buildCover(title, subtitle) {
  const esc = (v) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 400" role="img" aria-label="${esc(title)}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1a6b4a"/>
      <stop offset="1" stop-color="#125037"/>
    </linearGradient>
  </defs>
  <rect width="640" height="400" fill="url(#g)"/>
  <circle cx="545" cy="70" r="120" fill="#c9920a" opacity="0.16"/>
  <circle cx="90" cy="350" r="90" fill="#e8f2ed" opacity="0.12"/>
  <text x="48" y="188" font-family="Nunito, sans-serif" font-size="42" font-weight="800" fill="#ffffff">${esc(title)}</text>
  <text x="48" y="232" font-family="Nunito, sans-serif" font-size="20" fill="#e8f2ed">${esc(subtitle)}</text>
  <text x="48" y="342" font-family="Nunito, sans-serif" font-size="16" fill="#c9920a" font-weight="700">Noor Club</text>
</svg>
`;
}

function buildBadge(title) {
  const esc = (v) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" role="img" aria-label="${esc(title)}">
  <circle cx="80" cy="80" r="72" fill="#fdf6e3" stroke="#c9920a" stroke-width="8"/>
  <path d="M80 34l11.6 23.5 25.9 3.8-18.8 18.3 4.5 25.8L80 93.2 56.8 105.4l4.5-25.8-18.8-18.3 25.9-3.8z" fill="#c9920a"/>
  <circle cx="80" cy="126" r="10" fill="#1a6b4a"/>
</svg>
`;
}

/* ----------------------------------------------------------------- main --- */

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function write(publicPath, data) {
  const target = join(PUBLIC, publicPath.replace(/^\//, ""));
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, data);
  return target;
}

/** Downloads: written outside public/, addressed by their stored relative path. */
function writePrivate(relativePath, data) {
  const target = join(PRIVATE_ASSETS, relativePath.replace(/^\//, ""));
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, data);
  return target;
}

const packDirs = readdirSync(CONTENT).filter((entry) =>
  statSync(join(CONTENT, entry)).isDirectory(),
);

let written = 0;

for (const dir of packDirs) {
  const pack = readJson(join(CONTENT, dir, "pack.json"));
  const packTitle = pack.titles?.nl ?? dir;
  const packSubtitle = pack.descriptions?.nl ?? "";

  write(pack.coverUrl, buildCover(packTitle, packSubtitle.slice(0, 64)));
  written += 1;

  for (const asset of pack.assets ?? []) {
    writePrivate(asset.fileUrl, buildPdf(asset.titles?.nl ?? asset.kind, packTitle));
    written += 1;
  }

  for (const badge of pack.badges ?? []) {
    write(badge.iconUrl, buildBadge(badge.titles?.nl ?? badge.slug));
    written += 1;
  }

  const gamesDir = join(CONTENT, dir, "games");
  for (const file of readdirSync(gamesDir)) {
    const raw = readFileSync(join(gamesDir, file), "utf8");
    const urls = new Set(
      [...raw.matchAll(/"audioUrl"\s*:\s*"([^"]+)"/g)].map((match) => match[1]),
    );
    for (const url of urls) {
      write(url, buildMp3(1));
      written += 1;
    }
  }
}

console.log(`Placeholders geschreven: ${written} bestanden onder public/`);
