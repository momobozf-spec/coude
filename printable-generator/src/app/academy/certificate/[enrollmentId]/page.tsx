"use client";

import { useRef, useState, use } from "react";

export default function CertificatePage({ params }: { params: Promise<{ enrollmentId: string }> }) {
  const { enrollmentId } = use(params);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [childName, setChildName] = useState("");
  const [generated, setGenerated] = useState(false);

  function generateCertificate() {
    const canvas = canvasRef.current;
    if (!canvas || !childName.trim()) return;

    const ctx = canvas.getContext("2d")!;
    const W = 1200, H = 850;
    canvas.width = W; canvas.height = H;

    // Background
    ctx.fillStyle = "#fdf8f0";
    ctx.fillRect(0, 0, W, H);

    // Islamic geometric border
    ctx.strokeStyle = "#c9920a";
    ctx.lineWidth = 3;
    ctx.strokeRect(30, 30, W - 60, H - 60);
    ctx.strokeStyle = "#1a6b4a";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(40, 40, W - 80, H - 80);

    // Corner ornaments
    const corners = [[50, 50], [W - 50, 50], [50, H - 50], [W - 50, H - 50]];
    corners.forEach(([cx, cy]) => {
      ctx.beginPath();
      for (let i = 0; i < 16; i++) {
        const r = i % 2 === 0 ? 18 : 9;
        const a = (i * Math.PI) / 8 - Math.PI / 2;
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = "#c9920a";
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    // Moon
    ctx.font = "48px serif";
    ctx.fillStyle = "#c9920a";
    ctx.textAlign = "center";
    ctx.fillText("🌙", W / 2, 100);

    // Title
    ctx.font = "bold 32px Georgia, serif";
    ctx.fillStyle = "#1a6b4a";
    ctx.fillText("CERTIFICATE OF COMPLETION", W / 2, 150);

    ctx.font = "18px Georgia, serif";
    ctx.fillStyle = "#888";
    ctx.fillText("Noor Academy — Islamic Education for Kids", W / 2, 180);

    // This certifies
    ctx.font = "20px Georgia, serif";
    ctx.fillStyle = "#555";
    ctx.fillText("This certifies that", W / 2, 260);

    // Child name
    ctx.font = "bold 44px Georgia, serif";
    ctx.fillStyle = "#1a1a2e";
    ctx.fillText(childName, W / 2, 320);

    // Line under name
    ctx.strokeStyle = "#c9920a";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(300, 335);
    ctx.lineTo(900, 335);
    ctx.stroke();

    // Has completed
    ctx.font = "20px Georgia, serif";
    ctx.fillStyle = "#555";
    ctx.fillText("has successfully completed the course", W / 2, 390);

    // Course name placeholder
    ctx.font = "bold 28px Georgia, serif";
    ctx.fillStyle = "#1a6b4a";
    ctx.fillText("Noor Academy Course", W / 2, 440);

    // Date
    ctx.font = "16px Georgia, serif";
    ctx.fillStyle = "#888";
    ctx.fillText(`Completed on ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`, W / 2, 510);

    // Stars
    ctx.font = "24px serif";
    ctx.fillText("⭐⭐⭐⭐⭐", W / 2, 560);

    // Barakallah
    ctx.font = "italic 18px Georgia, serif";
    ctx.fillStyle = "#c9920a";
    ctx.fillText("بارك الله فيك", W / 2, 620);

    // Signature line
    ctx.strokeStyle = "#ccc";
    ctx.beginPath(); ctx.moveTo(400, 700); ctx.lineTo(800, 700); ctx.stroke();
    ctx.font = "14px Georgia, serif";
    ctx.fillStyle = "#999";
    ctx.fillText("Noor Printables Team", W / 2, 720);

    // Enrollment ID
    ctx.font = "10px monospace";
    ctx.fillStyle = "#ccc";
    ctx.fillText(`ID: ${enrollmentId}`, W / 2, H - 50);

    setGenerated(true);
  }

  function download() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `noor-certificate-${childName.replace(/\s+/g, "-").toLowerCase()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  function shareWhatsApp() {
    const text = encodeURIComponent(`Masha'Allah! ${childName} has completed a Noor Academy course! 🎓🌙 Check it out: https://noorprintables.com/academy`);
    window.open(`https://wa.me/?text=${text}`, "_blank");
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8" style={{ background: "#fdf8f0" }}>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">&#127942; Course Certificate</h1>
      <p className="text-gray-500 mb-6">Enter your child&apos;s name to generate their certificate.</p>

      {!generated ? (
        <div className="card w-full max-w-md text-center">
          <input
            type="text"
            className="input-field mb-4"
            placeholder="Child's name"
            value={childName}
            onChange={e => setChildName(e.target.value)}
          />
          <button onClick={generateCertificate} disabled={!childName.trim()} className="btn-primary w-full" style={{ backgroundColor: "#1a6b4a" }}>
            Generate Certificate
          </button>
        </div>
      ) : (
        <div className="w-full max-w-3xl">
          <canvas ref={canvasRef} className="w-full rounded-xl shadow-lg border border-gray-200" />
          <div className="flex gap-3 justify-center mt-6">
            <button onClick={download} className="btn-primary" style={{ backgroundColor: "#1a6b4a" }}>&#128190; Download PNG</button>
            <button onClick={shareWhatsApp} className="btn-primary" style={{ backgroundColor: "#25D366" }}>Share WhatsApp</button>
            <button onClick={() => setGenerated(false)} className="btn-outline">Edit Name</button>
          </div>
        </div>
      )}

      <canvas ref={canvasRef} style={{ display: generated ? "none" : "none" }} />
    </div>
  );
}
