import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const title = searchParams.get("title") || "Noor Printables";
  const subtitle = searchParams.get("subtitle") || "Islamic Educational Activities for Kids";

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          background: "linear-gradient(135deg, #0d9488 0%, #0f766e 50%, #115e59 100%)",
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        {/* Decorative elements */}
        <div style={{ position: "absolute", top: 40, left: 60, fontSize: 80, opacity: 0.15 }}>&#127769;</div>
        <div style={{ position: "absolute", bottom: 40, right: 60, fontSize: 80, opacity: 0.15 }}>&#11088;</div>
        <div style={{ position: "absolute", top: 60, right: 120, fontSize: 50, opacity: 0.1 }}>&#127769;</div>
        <div style={{ position: "absolute", bottom: 60, left: 120, fontSize: 50, opacity: 0.1 }}>&#11088;</div>

        {/* Content */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "0 80px" }}>
          <div style={{ fontSize: 28, color: "rgba(255,255,255,0.7)", marginBottom: 16, fontWeight: 500 }}>
            &#127769; Noor Printables
          </div>
          <div style={{
            fontSize: title.length > 40 ? 42 : 52,
            fontWeight: 800,
            color: "white",
            lineHeight: 1.2,
            marginBottom: 16,
            maxWidth: 900,
          }}>
            {title}
          </div>
          <div style={{ fontSize: 22, color: "rgba(255,255,255,0.8)", maxWidth: 700 }}>
            {subtitle}
          </div>
        </div>

        {/* Bottom bar */}
        <div style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 60,
          background: "rgba(0,0,0,0.2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 32,
        }}>
          <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 16 }}>&#127912; Coloring Pages</span>
          <span style={{ color: "rgba(255,255,255,0.4)" }}>&#8226;</span>
          <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 16 }}>&#128300; Mazes</span>
          <span style={{ color: "rgba(255,255,255,0.4)" }}>&#8226;</span>
          <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 16 }}>&#128260; Word Search</span>
          <span style={{ color: "rgba(255,255,255,0.4)" }}>&#8226;</span>
          <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 16 }}>Ages 4-8</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
