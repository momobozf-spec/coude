"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";

export default function RamadanCertificatePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [childName, setChildName] = useState("");
  const [generated, setGenerated] = useState(false);

  useEffect(() => {
    fetch("/api/ramadan/dashboard").then(r => r.json()).then(d => {
      if (d.enrollment?.childName) setChildName(d.enrollment.childName);
    }).catch(() => {});
  }, []);

  function generate() {
    const canvas = canvasRef.current;
    if (!canvas || !childName.trim()) return;
    const ctx = canvas.getContext("2d")!;
    const W = 1200, H = 850;
    canvas.width = W; canvas.height = H;

    // Night sky background
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, W, H);

    // Stars
    for (let i = 0; i < 50; i++) {
      ctx.fillStyle = `rgba(245,200,66,${0.2 + Math.random() * 0.5})`;
      ctx.beginPath();
      ctx.arc(Math.random() * W, Math.random() * H, 1 + Math.random() * 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Gold border
    ctx.strokeStyle = "#f5c842";
    ctx.lineWidth = 4;
    ctx.strokeRect(30, 30, W - 60, H - 60);
    ctx.lineWidth = 1;
    ctx.strokeRect(40, 40, W - 80, H - 80);

    // Corner stars
    [[55, 55], [W - 55, 55], [55, H - 55], [W - 55, H - 55]].forEach(([cx, cy]) => {
      ctx.fillStyle = "#f5c842";
      ctx.font = "20px serif";
      ctx.textAlign = "center";
      ctx.fillText("⭐", cx, cy + 7);
    });

    // Crescent moon
    ctx.font = "60px serif";
    ctx.textAlign = "center";
    ctx.fillText("🌙", W / 2, 110);

    // Bismillah
    ctx.font = "24px 'Amiri', Georgia, serif";
    ctx.fillStyle = "#f5c842";
    ctx.fillText("بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ", W / 2, 160);

    // Title
    ctx.font = "bold 36px Georgia, serif";
    ctx.fillStyle = "#ffffff";
    ctx.fillText("RAMADAN CHALLENGE", W / 2, 220);

    ctx.font = "18px Georgia, serif";
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.fillText("Certificate of Completion", W / 2, 250);

    // Child name
    ctx.font = "20px Georgia, serif";
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillText("This certifies that", W / 2, 320);

    ctx.font = "bold 48px Georgia, serif";
    ctx.fillStyle = "#f5c842";
    ctx.fillText(childName, W / 2, 380);

    // Gold line
    ctx.strokeStyle = "#f5c842";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(300, 395); ctx.lineTo(900, 395); ctx.stroke();

    ctx.font = "20px Georgia, serif";
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillText("has completed all 30 days of the", W / 2, 440);

    ctx.font = "bold 26px Georgia, serif";
    ctx.fillStyle = "#ffffff";
    ctx.fillText("30 Days of Ramadan Challenge 2026", W / 2, 480);

    // Badges
    ctx.font = "32px serif";
    ctx.fillText("🌟 🏆 💫 🎉", W / 2, 540);

    // Date
    ctx.font = "16px Georgia, serif";
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.fillText(`Ramadan ${new Date().getFullYear()}`, W / 2, 590);

    // Eid Mubarak
    ctx.font = "italic 22px Georgia, serif";
    ctx.fillStyle = "#f5c842";
    ctx.fillText("عيد مبارك — Eid Mubarak!", W / 2, 650);

    // Signature
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.beginPath(); ctx.moveTo(400, 720); ctx.lineTo(800, 720); ctx.stroke();
    ctx.font = "14px Georgia, serif";
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.fillText("Noor Printables — noorprintables.com", W / 2, 740);

    setGenerated(true);
  }

  function download() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `ramadan-certificate-${childName.replace(/\s+/g, "-").toLowerCase()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  function shareWhatsApp() {
    const text = encodeURIComponent(`🌙🎉 Eid Mubarak! ${childName} has completed the 30 Days of Ramadan Challenge! Masha'Allah!\n\nStart next year: ${window.location.origin}/ramadan-challenge`);
    window.open(`https://wa.me/?text=${text}`, "_blank");
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8" style={{ background: "#0f172a", color: "#fff" }}>
      <div className="text-4xl mb-3">🎉🌙</div>
      <h1 className="text-2xl font-bold mb-1" style={{ color: "#f5c842" }}>Ramadan Challenge Certificate</h1>
      <p className="text-white/50 mb-6">Eid Mubarak! Generate your completion certificate.</p>

      {!generated ? (
        <div className="w-full max-w-md rounded-2xl p-6" style={{ backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
          <input type="text" value={childName} onChange={e => setChildName(e.target.value)} placeholder="Child's name"
            className="w-full mb-4 px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/30 outline-none focus:border-yellow-400" />
          <button onClick={generate} disabled={!childName.trim()} className="w-full py-3 rounded-lg font-bold disabled:opacity-50" style={{ backgroundColor: "#f5c842", color: "#0f172a" }}>
            Generate Certificate
          </button>
        </div>
      ) : (
        <div className="w-full max-w-3xl">
          <canvas ref={canvasRef} className="w-full rounded-xl shadow-2xl" />
          <div className="flex gap-3 justify-center mt-6">
            <button onClick={download} className="px-6 py-2.5 rounded-lg font-bold text-sm" style={{ backgroundColor: "#f5c842", color: "#0f172a" }}>&#128190; Download</button>
            <button onClick={shareWhatsApp} className="px-6 py-2.5 rounded-lg font-bold text-sm" style={{ backgroundColor: "#25D366", color: "#fff" }}>WhatsApp</button>
            <button onClick={() => setGenerated(false)} className="px-6 py-2.5 rounded-lg text-sm" style={{ backgroundColor: "rgba(255,255,255,0.1)" }}>Edit</button>
          </div>
        </div>
      )}

      <Link href="/ramadan-challenge/dashboard" className="mt-8 text-sm text-white/40 hover:text-white">
        &larr; Back to Dashboard
      </Link>

      <canvas ref={canvasRef} style={{ display: "none" }} />
    </div>
  );
}
