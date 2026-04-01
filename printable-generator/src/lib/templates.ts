export interface ColoringTemplate {
  id: string;
  nameKey: string; // i18n key
  category: string;
  svg: string;
}

function starPoints(cx: number, cy: number, outerR: number, innerR: number, points: number): string {
  const coords: string[] = [];
  const step = Math.PI / points;
  for (let i = 0; i < 2 * points; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = i * step - Math.PI / 2;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    coords.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return coords.join(" ");
}

export const COLORING_TEMPLATES: ColoringTemplate[] = [
  {
    id: "mosque",
    nameKey: "template.mosque",
    category: "islamic",
    svg: `<svg viewBox="0 0 600 750" xmlns="http://www.w3.org/2000/svg">
  <rect width="600" height="750" fill="none"/>
  <!-- Ground -->
  <line x1="50" y1="600" x2="550" y2="600" stroke="#333" stroke-width="2"/>
  <!-- Main building -->
  <rect x="150" y="400" width="300" height="200" fill="none" stroke="#333" stroke-width="2.5" rx="2"/>
  <!-- Main dome -->
  <path d="M 150 400 Q 300 220 450 400" fill="none" stroke="#333" stroke-width="2.5"/>
  <!-- Dome finial (crescent) -->
  <circle cx="300" cy="250" r="18" fill="none" stroke="#333" stroke-width="2"/>
  <circle cx="308" cy="246" r="14" fill="white" stroke="#333" stroke-width="1.5"/>
  <!-- Star on crescent -->
  <polygon points="${starPoints(288, 238, 6, 3, 5)}" fill="none" stroke="#333" stroke-width="1.5"/>
  <!-- Door (arch) -->
  <path d="M 260 600 L 260 490 Q 300 450 340 490 L 340 600" fill="none" stroke="#333" stroke-width="2.5"/>
  <!-- Windows -->
  <path d="M 180 470 Q 200 450 220 470 L 220 520 L 180 520 Z" fill="none" stroke="#333" stroke-width="2"/>
  <path d="M 380 470 Q 400 450 420 470 L 420 520 L 380 520 Z" fill="none" stroke="#333" stroke-width="2"/>
  <!-- Left minaret -->
  <rect x="80" y="310" width="40" height="290" fill="none" stroke="#333" stroke-width="2"/>
  <path d="M 80 310 Q 100 270 120 310" fill="none" stroke="#333" stroke-width="2"/>
  <circle cx="100" cy="278" r="8" fill="none" stroke="#333" stroke-width="1.5"/>
  <!-- Right minaret -->
  <rect x="480" y="310" width="40" height="290" fill="none" stroke="#333" stroke-width="2"/>
  <path d="M 480 310 Q 500 270 520 310" fill="none" stroke="#333" stroke-width="2"/>
  <circle cx="500" cy="278" r="8" fill="none" stroke="#333" stroke-width="1.5"/>
  <!-- Minaret bands -->
  <line x1="80" y1="380" x2="120" y2="380" stroke="#333" stroke-width="1.5"/>
  <line x1="80" y1="450" x2="120" y2="450" stroke="#333" stroke-width="1.5"/>
  <line x1="480" y1="380" x2="520" y2="380" stroke="#333" stroke-width="1.5"/>
  <line x1="480" y1="450" x2="520" y2="450" stroke="#333" stroke-width="1.5"/>
  <!-- Stars in sky -->
  <polygon points="${starPoints(80, 140, 10, 5, 5)}" fill="none" stroke="#333" stroke-width="1.5"/>
  <polygon points="${starPoints(520, 120, 8, 4, 5)}" fill="none" stroke="#333" stroke-width="1.5"/>
  <polygon points="${starPoints(450, 170, 6, 3, 5)}" fill="none" stroke="#333" stroke-width="1.5"/>
  <!-- Moon -->
  <circle cx="160" cy="100" r="35" fill="none" stroke="#333" stroke-width="2"/>
  <circle cx="175" cy="92" r="28" fill="white" stroke="#333" stroke-width="1.5"/>
  <!-- Title area -->
  <text x="300" y="700" text-anchor="middle" font-family="sans-serif" font-size="22" fill="#999">Mosque</text>
</svg>`,
  },
  {
    id: "lantern",
    nameKey: "template.lantern",
    category: "ramadan",
    svg: `<svg viewBox="0 0 600 750" xmlns="http://www.w3.org/2000/svg">
  <rect width="600" height="750" fill="none"/>
  <!-- Hook -->
  <path d="M 300 50 L 300 100" stroke="#333" stroke-width="2.5"/>
  <path d="M 270 50 Q 300 30 330 50" fill="none" stroke="#333" stroke-width="2.5"/>
  <!-- Lantern top cap -->
  <path d="M 230 120 L 250 100 L 350 100 L 370 120" fill="none" stroke="#333" stroke-width="2.5"/>
  <!-- Lantern body -->
  <path d="M 220 120 Q 200 300 220 480 L 380 480 Q 400 300 380 120 Z" fill="none" stroke="#333" stroke-width="2.5"/>
  <!-- Decorative panels -->
  <path d="M 240 160 L 240 440" stroke="#333" stroke-width="1.5"/>
  <path d="M 300 120 L 300 480" stroke="#333" stroke-width="1.5"/>
  <path d="M 360 160 L 360 440" stroke="#333" stroke-width="1.5"/>
  <!-- Stars inside panels -->
  <polygon points="${starPoints(270, 220, 18, 9, 6)}" fill="none" stroke="#333" stroke-width="1.5"/>
  <polygon points="${starPoints(330, 220, 18, 9, 6)}" fill="none" stroke="#333" stroke-width="1.5"/>
  <polygon points="${starPoints(270, 340, 18, 9, 6)}" fill="none" stroke="#333" stroke-width="1.5"/>
  <polygon points="${starPoints(330, 340, 18, 9, 6)}" fill="none" stroke="#333" stroke-width="1.5"/>
  <!-- Cross bands -->
  <line x1="220" y1="230" x2="380" y2="230" stroke="#333" stroke-width="1.5"/>
  <line x1="220" y1="300" x2="380" y2="300" stroke="#333" stroke-width="1.5"/>
  <line x1="220" y1="370" x2="380" y2="370" stroke="#333" stroke-width="1.5"/>
  <!-- Bottom -->
  <path d="M 240 480 L 260 510 L 340 510 L 360 480" fill="none" stroke="#333" stroke-width="2.5"/>
  <ellipse cx="300" cy="520" rx="30" ry="8" fill="none" stroke="#333" stroke-width="1.5"/>
  <!-- Small lanterns -->
  <path d="M 80 180 L 80 200 Q 60 280 80 360 L 120 360 Q 140 280 120 200 L 120 180 Z" fill="none" stroke="#333" stroke-width="2"/>
  <polygon points="${starPoints(100, 270, 12, 6, 6)}" fill="none" stroke="#333" stroke-width="1.5"/>
  <path d="M 480 220 L 480 240 Q 460 320 480 400 L 520 400 Q 540 320 520 240 L 520 220 Z" fill="none" stroke="#333" stroke-width="2"/>
  <polygon points="${starPoints(500, 310, 12, 6, 6)}" fill="none" stroke="#333" stroke-width="1.5"/>
  <!-- Stars scattered -->
  <polygon points="${starPoints(150, 500, 10, 5, 5)}" fill="none" stroke="#333" stroke-width="1.5"/>
  <polygon points="${starPoints(450, 550, 8, 4, 5)}" fill="none" stroke="#333" stroke-width="1.5"/>
  <polygon points="${starPoints(100, 450, 6, 3, 5)}" fill="none" stroke="#333" stroke-width="1.5"/>
  <polygon points="${starPoints(500, 470, 7, 3, 5)}" fill="none" stroke="#333" stroke-width="1.5"/>
  <text x="300" y="700" text-anchor="middle" font-family="sans-serif" font-size="22" fill="#999">Ramadan Lantern</text>
</svg>`,
  },
  {
    id: "crescent-stars",
    nameKey: "template.crescentStars",
    category: "islamic",
    svg: `<svg viewBox="0 0 600 750" xmlns="http://www.w3.org/2000/svg">
  <rect width="600" height="750" fill="none"/>
  <!-- Large crescent -->
  <circle cx="280" cy="300" r="150" fill="none" stroke="#333" stroke-width="2.5"/>
  <circle cx="330" cy="280" r="120" fill="white" stroke="#333" stroke-width="2"/>
  <!-- Large star -->
  <polygon points="${starPoints(200, 260, 45, 22, 5)}" fill="none" stroke="#333" stroke-width="2.5"/>
  <!-- Decorative circles -->
  <circle cx="300" cy="300" r="200" fill="none" stroke="#333" stroke-width="1" stroke-dasharray="8 4"/>
  <!-- Small stars scattered around -->
  <polygon points="${starPoints(480, 150, 20, 10, 5)}" fill="none" stroke="#333" stroke-width="2"/>
  <polygon points="${starPoints(120, 150, 16, 8, 5)}" fill="none" stroke="#333" stroke-width="2"/>
  <polygon points="${starPoints(500, 350, 14, 7, 5)}" fill="none" stroke="#333" stroke-width="1.5"/>
  <polygon points="${starPoints(100, 400, 12, 6, 5)}" fill="none" stroke="#333" stroke-width="1.5"/>
  <polygon points="${starPoints(450, 500, 18, 9, 5)}" fill="none" stroke="#333" stroke-width="2"/>
  <polygon points="${starPoints(150, 530, 14, 7, 5)}" fill="none" stroke="#333" stroke-width="1.5"/>
  <polygon points="${starPoints(350, 550, 10, 5, 5)}" fill="none" stroke="#333" stroke-width="1.5"/>
  <polygon points="${starPoints(250, 520, 16, 8, 6)}" fill="none" stroke="#333" stroke-width="2"/>
  <!-- 8-pointed star pattern -->
  <polygon points="${starPoints(300, 580, 35, 17, 8)}" fill="none" stroke="#333" stroke-width="2"/>
  <!-- Tiny dots -->
  <circle cx="180" cy="200" r="3" fill="#333"/>
  <circle cx="420" cy="230" r="3" fill="#333"/>
  <circle cx="350" cy="450" r="3" fill="#333"/>
  <circle cx="240" cy="470" r="3" fill="#333"/>
  <circle cx="500" cy="260" r="2" fill="#333"/>
  <circle cx="100" cy="300" r="2" fill="#333"/>
  <text x="300" y="700" text-anchor="middle" font-family="sans-serif" font-size="22" fill="#999">Crescent &amp; Stars</text>
</svg>`,
  },
  {
    id: "geometric",
    nameKey: "template.geometric",
    category: "islamic",
    svg: (() => {
      // Islamic geometric pattern
      const stars: string[] = [];
      const cx = 300, cy = 350;

      // Central 8-pointed star
      stars.push(`<polygon points="${starPoints(cx, cy, 80, 40, 8)}" fill="none" stroke="#333" stroke-width="2.5"/>`);
      stars.push(`<circle cx="${cx}" cy="${cy}" r="25" fill="none" stroke="#333" stroke-width="2"/>`);

      // Ring of 6 stars
      for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI * 2) / 6 - Math.PI / 2;
        const sx = cx + Math.cos(angle) * 160;
        const sy = cy + Math.sin(angle) * 160;
        stars.push(`<polygon points="${starPoints(sx, sy, 40, 20, 8)}" fill="none" stroke="#333" stroke-width="2"/>`);
        stars.push(`<circle cx="${sx}" cy="${sy}" r="12" fill="none" stroke="#333" stroke-width="1.5"/>`);
        // Connect to center
        stars.push(`<line x1="${cx + Math.cos(angle) * 80}" y1="${cy + Math.sin(angle) * 80}" x2="${sx - Math.cos(angle) * 40}" y2="${sy - Math.sin(angle) * 40}" stroke="#333" stroke-width="1.5"/>`);
      }

      // Outer ring of small circles
      for (let i = 0; i < 12; i++) {
        const angle = (i * Math.PI * 2) / 12;
        const sx = cx + Math.cos(angle) * 240;
        const sy = cy + Math.sin(angle) * 240;
        stars.push(`<circle cx="${sx}" cy="${sy}" r="15" fill="none" stroke="#333" stroke-width="1.5"/>`);
      }

      // Border
      stars.push(`<circle cx="${cx}" cy="${cy}" r="280" fill="none" stroke="#333" stroke-width="2"/>`);
      stars.push(`<circle cx="${cx}" cy="${cy}" r="275" fill="none" stroke="#333" stroke-width="0.5"/>`);

      return `<svg viewBox="0 0 600 750" xmlns="http://www.w3.org/2000/svg">
  <rect width="600" height="750" fill="none"/>
  ${stars.join("\n  ")}
  <text x="300" y="700" text-anchor="middle" font-family="sans-serif" font-size="22" fill="#999">Islamic Pattern</text>
</svg>`;
    })(),
  },
  {
    id: "kaaba",
    nameKey: "template.kaaba",
    category: "hajj",
    svg: `<svg viewBox="0 0 600 750" xmlns="http://www.w3.org/2000/svg">
  <rect width="600" height="750" fill="none"/>
  <!-- Kaaba base - 3D box -->
  <polygon points="200,350 400,350 400,550 200,550" fill="none" stroke="#333" stroke-width="2.5"/>
  <polygon points="200,350 300,290 500,290 400,350" fill="none" stroke="#333" stroke-width="2.5"/>
  <polygon points="400,350 500,290 500,490 400,550" fill="none" stroke="#333" stroke-width="2.5"/>
  <!-- Kiswa band (gold band) -->
  <line x1="200" y1="420" x2="400" y2="420" stroke="#333" stroke-width="3"/>
  <line x1="400" y1="420" x2="500" y2="360" stroke="#333" stroke-width="3"/>
  <!-- Door -->
  <rect x="270" y="440" width="60" height="90" rx="2" fill="none" stroke="#333" stroke-width="2"/>
  <path d="M 270 440 Q 300 420 330 440" fill="none" stroke="#333" stroke-width="2"/>
  <!-- Decorative elements on Kiswa -->
  <polygon points="${starPoints(250, 400, 8, 4, 8)}" fill="none" stroke="#333" stroke-width="1.5"/>
  <polygon points="${starPoints(350, 400, 8, 4, 8)}" fill="none" stroke="#333" stroke-width="1.5"/>
  <polygon points="${starPoints(450, 340, 8, 4, 8)}" fill="none" stroke="#333" stroke-width="1.5"/>
  <!-- Ground circle (tawaf) -->
  <ellipse cx="340" cy="580" rx="220" ry="40" fill="none" stroke="#333" stroke-width="1.5" stroke-dasharray="6 3"/>
  <!-- Crescent and stars in sky -->
  <circle cx="150" cy="130" r="40" fill="none" stroke="#333" stroke-width="2"/>
  <circle cx="168" cy="122" r="32" fill="white" stroke="#333" stroke-width="1.5"/>
  <polygon points="${starPoints(120, 110, 8, 4, 5)}" fill="none" stroke="#333" stroke-width="1.5"/>
  <polygon points="${starPoints(450, 100, 12, 6, 5)}" fill="none" stroke="#333" stroke-width="1.5"/>
  <polygon points="${starPoints(380, 150, 8, 4, 5)}" fill="none" stroke="#333" stroke-width="1.5"/>
  <polygon points="${starPoints(520, 180, 10, 5, 5)}" fill="none" stroke="#333" stroke-width="1.5"/>
  <text x="300" y="700" text-anchor="middle" font-family="sans-serif" font-size="22" fill="#999">Kaaba</text>
</svg>`,
  },
  {
    id: "eid-gifts",
    nameKey: "template.eidGifts",
    category: "eid",
    svg: `<svg viewBox="0 0 600 750" xmlns="http://www.w3.org/2000/svg">
  <rect width="600" height="750" fill="none"/>
  <!-- Big gift box -->
  <rect x="180" y="320" width="240" height="180" rx="4" fill="none" stroke="#333" stroke-width="2.5"/>
  <rect x="180" y="280" width="240" height="40" rx="4" fill="none" stroke="#333" stroke-width="2.5"/>
  <!-- Ribbon vertical -->
  <line x1="300" y1="280" x2="300" y2="500" stroke="#333" stroke-width="2.5"/>
  <!-- Ribbon horizontal -->
  <line x1="180" y1="400" x2="420" y2="400" stroke="#333" stroke-width="2.5"/>
  <!-- Bow -->
  <ellipse cx="270" cy="265" rx="30" ry="18" fill="none" stroke="#333" stroke-width="2"/>
  <ellipse cx="330" cy="265" rx="30" ry="18" fill="none" stroke="#333" stroke-width="2"/>
  <circle cx="300" cy="270" r="8" fill="none" stroke="#333" stroke-width="2"/>
  <!-- Stars on gift -->
  <polygon points="${starPoints(240, 360, 14, 7, 5)}" fill="none" stroke="#333" stroke-width="1.5"/>
  <polygon points="${starPoints(360, 360, 14, 7, 5)}" fill="none" stroke="#333" stroke-width="1.5"/>
  <polygon points="${starPoints(240, 450, 14, 7, 5)}" fill="none" stroke="#333" stroke-width="1.5"/>
  <polygon points="${starPoints(360, 450, 14, 7, 5)}" fill="none" stroke="#333" stroke-width="1.5"/>
  <!-- Small gift 1 -->
  <rect x="80" y="430" width="80" height="70" rx="3" fill="none" stroke="#333" stroke-width="2"/>
  <rect x="80" y="410" width="80" height="20" rx="3" fill="none" stroke="#333" stroke-width="2"/>
  <line x1="120" y1="410" x2="120" y2="500" stroke="#333" stroke-width="2"/>
  <polygon points="${starPoints(120, 460, 10, 5, 6)}" fill="none" stroke="#333" stroke-width="1.5"/>
  <!-- Small gift 2 -->
  <rect x="440" y="420" width="90" height="80" rx="3" fill="none" stroke="#333" stroke-width="2"/>
  <rect x="440" y="396" width="90" height="24" rx="3" fill="none" stroke="#333" stroke-width="2"/>
  <line x1="485" y1="396" x2="485" y2="500" stroke="#333" stroke-width="2"/>
  <polygon points="${starPoints(485, 455, 12, 6, 5)}" fill="none" stroke="#333" stroke-width="1.5"/>
  <!-- Celebration elements -->
  <polygon points="${starPoints(150, 180, 20, 10, 5)}" fill="none" stroke="#333" stroke-width="2"/>
  <polygon points="${starPoints(450, 160, 16, 8, 5)}" fill="none" stroke="#333" stroke-width="2"/>
  <polygon points="${starPoints(300, 140, 24, 12, 8)}" fill="none" stroke="#333" stroke-width="2"/>
  <!-- Confetti circles -->
  <circle cx="120" cy="250" r="6" fill="none" stroke="#333" stroke-width="1.5"/>
  <circle cx="480" cy="230" r="6" fill="none" stroke="#333" stroke-width="1.5"/>
  <circle cx="200" cy="200" r="4" fill="none" stroke="#333" stroke-width="1.5"/>
  <circle cx="400" cy="210" r="5" fill="none" stroke="#333" stroke-width="1.5"/>
  <!-- Eid text area -->
  <text x="300" y="600" text-anchor="middle" font-family="sans-serif" font-size="36" fill="#ddd">Eid Mubarak!</text>
  <text x="300" y="700" text-anchor="middle" font-family="sans-serif" font-size="22" fill="#999">Eid Gifts</text>
</svg>`,
  },
];
