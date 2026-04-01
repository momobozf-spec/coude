"use client";

import Link from "next/link";
import { useState, useEffect, useRef, use } from "react";

interface CertData { title: string; childName: string; description: string; issuedAt: string; }

export default function PublicCertificatePage({ params }: { params: Promise<{ publicToken: string }> }) {
  const { publicToken } = use(params);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cert, setCert] = useState<CertData | null>(null);
  const [generated, setGenerated] = useState(false);

  useEffect(() => {
    // In production, fetch from /api/achievements/certificate/public/[token]
    // For now, use the token to show a demo certificate
    setCert({ title: "Achievement Certificate", childName: "Young Scholar", description: "Completed an achievement on Noor Printables", issuedAt: new Date().toISOString() });
  }, [publicToken]);

  useEffect(() => {
    if (!cert || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d")!;
    const W = 1122, H = 794;
    canvas.width = W; canvas.height = H;

    // Background
    ctx.fillStyle = "#fdf6e3";
    ctx.fillRect(0, 0, W, H);

    // Borders
    ctx.strokeStyle = "#1a6b4a"; ctx.lineWidth = 8;
    ctx.strokeRect(20, 20, W - 40, H - 40);
    ctx.strokeStyle = "#c9920a"; ctx.lineWidth = 2;
    ctx.strokeRect(32, 32, W - 64, H - 64);

    // Bismillah
    ctx.font = "22px Georgia, serif"; ctx.fillStyle = "#1a6b4a"; ctx.textAlign = "center";
    ctx.fillText("بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ", W / 2, 90);

    // Header
    ctx.font = "13px Georgia, serif"; ctx.fillStyle = "#c9920a";
    ctx.fillText("NOOR PRINTABLES — ISLAMIC LEARNING FOR KIDS", W / 2, 130);
    ctx.strokeStyle = "#c9920a"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(200, 145); ctx.lineTo(W - 200, 145); ctx.stroke();

    // Certificate of Achievement
    ctx.font = "italic 42px Georgia, serif"; ctx.fillStyle = "#1a6b4a";
    ctx.fillText("Certificate of Achievement", W / 2, 210);

    // This certifies that
    ctx.font = "16px Georgia, serif"; ctx.fillStyle = "#666";
    ctx.fillText("THIS CERTIFIES THAT", W / 2, 265);

    // Child name
    ctx.font = "bold 56px Georgia, serif"; ctx.fillStyle = "#c9920a";
    ctx.fillText(cert.childName, W / 2, 340);
    ctx.beginPath(); ctx.moveTo(200, 355); ctx.lineTo(W - 200, 355); ctx.strokeStyle = "#c9920a"; ctx.stroke();

    // Has earned
    ctx.font = "16px Georgia, serif"; ctx.fillStyle = "#666";
    ctx.fillText("HAS SUCCESSFULLY EARNED THE", W / 2, 395);

    // Badge/title
    ctx.font = "bold 32px Georgia, serif"; ctx.fillStyle = "#1a6b4a";
    ctx.fillText(cert.title, W / 2, 460);

    // Description
    ctx.font = "italic 15px Georgia, serif"; ctx.fillStyle = "#555";
    ctx.fillText(`"${cert.description}"`, W / 2, 500);

    // Quran verse
    ctx.font = "18px Georgia, serif"; ctx.fillStyle = "#1a6b4a";
    ctx.fillText("اقْرَأْ بِاسْمِ رَبِّكَ الَّذِي خَلَقَ", W / 2, 580);
    ctx.font = "italic 12px Georgia, serif"; ctx.fillStyle = "#888";
    ctx.fillText('"Read in the name of your Lord who created." — Quran 96:1', W / 2, 605);

    // Date + signature
    ctx.font = "13px Georgia, serif"; ctx.fillStyle = "#666";
    ctx.fillText(new Date(cert.issuedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }), 200, 720);
    ctx.beginPath(); ctx.moveTo(120, 728); ctx.lineTo(280, 728); ctx.stroke();
    ctx.font = "10px Georgia, serif"; ctx.fillStyle = "#999";
    ctx.fillText("DATE OF ACHIEVEMENT", 200, 742);

    ctx.font = "italic 18px Georgia, serif"; ctx.fillStyle = "#1a6b4a";
    ctx.fillText("Noor Printables", W - 200, 715);
    ctx.beginPath(); ctx.moveTo(W - 280, 728); ctx.lineTo(W - 120, 728); ctx.stroke();
    ctx.font = "10px Georgia, serif"; ctx.fillStyle = "#999";
    ctx.fillText("AUTHORIZED SIGNATURE", W - 200, 742);

    setGenerated(true);
  }, [cert]);

  function download() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `noor-certificate-${cert?.childName?.replace(/\s+/g, "-").toLowerCase() || "certificate"}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  function shareWhatsApp() {
    const text = encodeURIComponent(`🏆 Masha'Allah! ${cert?.childName} earned a certificate on Noor Printables!\n\nSee it: ${window.location.href}\n\nCreate yours: ${window.location.origin}/register`);
    window.open(`https://wa.me/?text=${text}`, "_blank");
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8" style={{ background: "#faf9f5" }}>
      <div className="text-center mb-6">
        <div className="text-4xl mb-2">&#127942;</div>
        <h1 className="text-xl font-bold" style={{ color: "#1a6b4a" }}>
          {cert ? `${cert.childName} earned a certificate!` : "Certificate"}
        </h1>
        <p className="text-sm text-gray-500">Noor Printables — Islamic Learning for Kids</p>
      </div>

      <canvas ref={canvasRef} className="w-full max-w-3xl rounded-xl shadow-lg border" />

      {generated && (
        <div className="flex gap-3 mt-6">
          <button onClick={download} className="btn-primary" style={{ backgroundColor: "#1a6b4a" }}>&#128190; Download</button>
          <button onClick={shareWhatsApp} className="btn-primary" style={{ backgroundColor: "#25D366" }}>WhatsApp</button>
          <button onClick={() => navigator.clipboard.writeText(window.location.href)} className="btn-outline">Copy Link</button>
        </div>
      )}

      <Link href="/register" className="mt-8 text-sm hover:underline" style={{ color: "#1a6b4a" }}>
        Create your child&apos;s certificates &rarr;
      </Link>
    </div>
  );
}
