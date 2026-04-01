import PDFDocument from "pdfkit";

interface BookData {
  childName: string;
  title: string;
  dedicationText?: string | null;
  coverColor: string;
}

// Printful 8.5x8.5 inch with 0.125 inch bleed = 636pt x 636pt
const PW = 636;

function sp(cx: number, cy: number, oR: number, iR: number, pts: number): { x: number; y: number }[] {
  const coords: { x: number; y: number }[] = [];
  const step = Math.PI / pts;
  for (let i = 0; i < 2 * pts; i++) {
    const r = i % 2 === 0 ? oR : iR;
    const a = i * step - Math.PI / 2;
    coords.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  return coords;
}

function drawStar(doc: PDFKit.PDFDocument, cx: number, cy: number, r: number, color: string) {
  const pts = sp(cx, cy, r, r / 2, 8);
  doc.strokeColor(color).lineWidth(1.5);
  doc.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) doc.lineTo(pts[i].x, pts[i].y);
  doc.lineTo(pts[0].x, pts[0].y).stroke();
}

export async function generateBookPDF(
  book: BookData,
  worksheetSvgs: string[]
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: [PW, PW], margin: 18, autoFirstPage: false });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // ── COVER PAGE ──
    doc.addPage();
    doc.rect(0, 0, PW, PW).fill(book.coverColor);
    // Border
    doc.rect(20, 20, PW - 40, PW - 40).strokeColor("#c9920a").lineWidth(2).stroke();
    doc.rect(26, 26, PW - 52, PW - 52).strokeColor("#c9920a").lineWidth(0.5).stroke();
    // Corner stars
    for (const [cx, cy] of [[38, 38], [PW - 38, 38], [38, PW - 38], [PW - 38, PW - 38]]) {
      drawStar(doc, cx, cy, 10, "#c9920a");
    }
    // Title
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(26)
      .text(book.title, 50, 200, { width: PW - 100, align: "center" });
    doc.fillColor("#f5c842").fontSize(20)
      .text(`${book.childName}'s`, 50, 250, { width: PW - 100, align: "center" });
    doc.fillColor("rgba(255,255,255,0.8)").fontSize(13).font("Helvetica")
      .text("Islamic Coloring & Activity Book", 50, 290, { width: PW - 100, align: "center" });
    doc.fillColor("rgba(255,255,255,0.5)").fontSize(9)
      .text("NoorPrintables.com", 50, PW - 60, { width: PW - 100, align: "center" });

    // ── TITLE PAGE ──
    doc.addPage();
    doc.fillColor(book.coverColor).font("Helvetica-Bold").fontSize(22)
      .text(book.title, 50, 120, { width: PW - 100, align: "center" });
    doc.fillColor("#c9920a").fontSize(18)
      .text("بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ", 50, 170, { width: PW - 100, align: "center" });
    doc.fillColor("#666").font("Helvetica").fontSize(11)
      .text("In the name of Allah, the Most Gracious, the Most Merciful", 50, 200, { width: PW - 100, align: "center" });
    doc.moveTo(150, 240).lineTo(PW - 150, 240).strokeColor("#c9920a").lineWidth(1).stroke();
    doc.fillColor("#333").fontSize(12)
      .text("This book belongs to:", 50, 260, { width: PW - 100, align: "center" });
    doc.rect(160, 285, PW - 320, 45).strokeColor(book.coverColor).lineWidth(1.5).stroke();
    doc.fillColor(book.coverColor).font("Helvetica-Bold").fontSize(18)
      .text(book.childName, 160, 297, { width: PW - 320, align: "center" });

    // ── DEDICATION ──
    if (book.dedicationText) {
      doc.addPage();
      doc.fillColor("#c9920a").fontSize(15).font("Helvetica-Oblique")
        .text("A special message...", 50, 160, { width: PW - 100, align: "center" });
      doc.fillColor("#333").fontSize(13).font("Helvetica")
        .text(book.dedicationText, 80, 210, { width: PW - 160, align: "center", lineGap: 8 });
      drawStar(doc, PW / 2, 420, 16, "#c9920a");
    }

    // ── WORKSHEET PAGES ──
    for (let i = 0; i < worksheetSvgs.length; i++) {
      doc.addPage();
      // Draw a placeholder frame for each worksheet
      doc.rect(28, 28, PW - 56, PW - 100).strokeColor("#ddd").lineWidth(0.5).stroke();
      doc.fillColor("#eee").fontSize(60).text("🎨", PW / 2 - 30, PW / 2 - 60);
      doc.fillColor("#bbb").fontSize(11).font("Helvetica")
        .text(`Activity Page ${i + 1}`, 50, PW / 2 + 20, { width: PW - 100, align: "center" });
      // Footer
      doc.fillColor("#ccc").fontSize(8)
        .text(`${book.childName} — NoorPrintables.com`, 50, PW - 50, { width: PW - 100, align: "center" });
    }

    // ── BACK COVER ──
    doc.addPage();
    doc.rect(0, 0, PW, PW).fill(book.coverColor);
    doc.rect(20, 20, PW - 40, PW - 40).strokeColor("#c9920a").lineWidth(2).stroke();
    doc.fillColor("#ffffff").font("Helvetica-Oblique").fontSize(15)
      .text('"Seek knowledge from the cradle to the grave."', 80, 200, { width: PW - 160, align: "center" });
    doc.fillColor("#c9920a").fontSize(12)
      .text("— Prophet Muhammad ﷺ", 80, 240, { width: PW - 160, align: "center" });
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(16)
      .text("Noor Printables", 80, PW - 150, { width: PW - 160, align: "center" });
    doc.fillColor("rgba(255,255,255,0.6)").font("Helvetica").fontSize(10)
      .text("Islamic Educational Activities for Kids", 80, PW - 125, { width: PW - 160, align: "center" });
    doc.fillColor("rgba(255,255,255,0.4)").fontSize(9)
      .text("noorprintables.com", 80, PW - 105, { width: PW - 160, align: "center" });

    doc.end();
  });
}
