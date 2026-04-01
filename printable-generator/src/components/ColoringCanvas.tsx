"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { useI18n } from "@/i18n/context";

interface Props {
  templateSvg: string;
  templateName: string;
}

const KID_COLORS = [
  "#e74c3c", "#e67e22", "#f1c40f", "#2ecc71", "#1abc9c",
  "#3498db", "#9b59b6", "#e91e63", "#00bcd4", "#8bc34a",
  "#ff9800", "#795548", "#607d8b", "#ffffff", "#000000",
];

type Tool = "brush" | "eraser" | "fill";

const BRUSH_SIZES = [4, 8, 14, 22];

export default function ColoringCanvas({ templateSvg, templateName }: Props) {
  const { t } = useI18n();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [color, setColor] = useState("#e74c3c");
  const [tool, setTool] = useState<Tool>("brush");
  const [brushSize, setBrushSize] = useState(8);
  const [isDrawing, setIsDrawing] = useState(false);
  const [history, setHistory] = useState<ImageData[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const canvasWidth = 600;
  const canvasHeight = 750;

  // Load template SVG onto overlay canvas
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;

    const ctx = overlay.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    const blob = new Blob([templateSvg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      ctx.clearRect(0, 0, canvasWidth, canvasHeight);
      ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }, [templateSvg]);

  // Initialize drawing canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Save initial state
    const imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
    setHistory([imageData]);
    setHistoryIndex(0);
  }, []);

  const saveState = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
    setHistory((prev) => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(imageData);
      // Keep max 30 history states
      if (newHistory.length > 30) newHistory.shift();
      return newHistory;
    });
    setHistoryIndex((prev) => Math.min(prev + 1, 29));
  }, [historyIndex]);

  const undo = useCallback(() => {
    if (historyIndex <= 0) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const newIndex = historyIndex - 1;
    ctx.putImageData(history[newIndex], 0, 0);
    setHistoryIndex(newIndex);
  }, [history, historyIndex]);

  const getPos = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };

      const rect = canvas.getBoundingClientRect();
      const scaleX = canvasWidth / rect.width;
      const scaleY = canvasHeight / rect.height;

      let clientX: number, clientY: number;

      if ("touches" in e) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else {
        clientX = e.clientX;
        clientY = e.clientY;
      }

      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY,
      };
    },
    []
  );

  const floodFill = useCallback(
    (startX: number, startY: number, fillColor: string) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
      const data = imageData.data;

      const sx = Math.floor(startX);
      const sy = Math.floor(startY);
      const startIdx = (sy * canvasWidth + sx) * 4;
      const startR = data[startIdx];
      const startG = data[startIdx + 1];
      const startB = data[startIdx + 2];

      // Parse fill color
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = 1;
      tempCanvas.height = 1;
      const tempCtx = tempCanvas.getContext("2d")!;
      tempCtx.fillStyle = fillColor;
      tempCtx.fillRect(0, 0, 1, 1);
      const fillData = tempCtx.getImageData(0, 0, 1, 1).data;
      const fillR = fillData[0];
      const fillG = fillData[1];
      const fillB = fillData[2];

      if (startR === fillR && startG === fillG && startB === fillB) return;

      const tolerance = 32;
      const matches = (idx: number) =>
        Math.abs(data[idx] - startR) <= tolerance &&
        Math.abs(data[idx + 1] - startG) <= tolerance &&
        Math.abs(data[idx + 2] - startB) <= tolerance;

      const stack: [number, number][] = [[sx, sy]];
      const visited = new Uint8Array(canvasWidth * canvasHeight);

      while (stack.length > 0) {
        const [x, y] = stack.pop()!;

        if (x < 0 || x >= canvasWidth || y < 0 || y >= canvasHeight) continue;

        const pixelIdx = y * canvasWidth + x;
        if (visited[pixelIdx]) continue;
        visited[pixelIdx] = 1;

        const idx = pixelIdx * 4;
        if (!matches(idx)) continue;

        data[idx] = fillR;
        data[idx + 1] = fillG;
        data[idx + 2] = fillB;
        data[idx + 3] = 255;

        stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
      }

      ctx.putImageData(imageData, 0, 0);
    },
    []
  );

  const startDraw = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      e.preventDefault();
      const { x, y } = getPos(e);

      if (tool === "fill") {
        floodFill(x, y, color);
        saveState();
        return;
      }

      setIsDrawing(true);

      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = brushSize;

      if (tool === "eraser") {
        ctx.strokeStyle = "#ffffff";
      } else {
        ctx.strokeStyle = color;
      }
    },
    [tool, color, brushSize, getPos, floodFill, saveState]
  );

  const draw = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      if (!isDrawing) return;
      e.preventDefault();

      const { x, y } = getPos(e);
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.lineTo(x, y);
      ctx.stroke();
    },
    [isDrawing, getPos]
  );

  const endDraw = useCallback(() => {
    if (isDrawing) {
      setIsDrawing(false);
      saveState();
    }
  }, [isDrawing, saveState]);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    saveState();
  }, [saveState]);

  const saveImage = useCallback(() => {
    // Merge drawing + overlay into one image
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = canvasWidth;
    exportCanvas.height = canvasHeight;
    const ctx = exportCanvas.getContext("2d")!;

    // Draw the coloring
    if (canvasRef.current) {
      ctx.drawImage(canvasRef.current, 0, 0);
    }
    // Draw the template on top
    if (overlayRef.current) {
      ctx.drawImage(overlayRef.current, 0, 0);
    }

    const link = document.createElement("a");
    link.download = `noor-coloring-${templateName}.png`;
    link.href = exportCanvas.toDataURL("image/png");
    link.click();
  }, [templateName]);

  return (
    <div className="flex flex-col lg:flex-row gap-4">
      {/* Canvas area */}
      <div
        ref={containerRef}
        className="relative bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex-1"
        style={{ touchAction: "none" }}
      >
        <canvas
          ref={canvasRef}
          width={canvasWidth}
          height={canvasHeight}
          className="absolute inset-0 w-full h-full"
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
        />
        {/* SVG overlay (non-interactive, shows outlines) */}
        <canvas
          ref={overlayRef}
          width={canvasWidth}
          height={canvasHeight}
          className="absolute inset-0 w-full h-full pointer-events-none"
        />
      </div>

      {/* Toolbar */}
      <div className="lg:w-56 flex flex-col gap-3">
        {/* Tools */}
        <div className="card">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            {t("color.tools")}
          </p>
          <div className="flex gap-2">
            {(["brush", "fill", "eraser"] as Tool[]).map((t2) => (
              <button
                key={t2}
                onClick={() => setTool(t2)}
                className="flex-1 py-2 px-1 rounded-lg text-xs font-medium transition-all"
                style={{
                  backgroundColor: tool === t2 ? "#0d9488" : "#f3f4f6",
                  color: tool === t2 ? "white" : "#374151",
                }}
              >
                {t2 === "brush" && "✏️"}
                {t2 === "fill" && "🪣"}
                {t2 === "eraser" && "🧹"}
                <br />
                {t(`color.tool.${t2}`)}
              </button>
            ))}
          </div>
        </div>

        {/* Brush size */}
        {tool !== "fill" && (
          <div className="card">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              {t("color.size")}
            </p>
            <div className="flex gap-2 items-center justify-center">
              {BRUSH_SIZES.map((size) => (
                <button
                  key={size}
                  onClick={() => setBrushSize(size)}
                  className="flex items-center justify-center rounded-full transition-all"
                  style={{
                    width: 36,
                    height: 36,
                    backgroundColor: brushSize === size ? "#e0f2f1" : "#f9fafb",
                    border: brushSize === size ? "2px solid #0d9488" : "1px solid #e5e7eb",
                  }}
                >
                  <div
                    className="rounded-full bg-gray-700"
                    style={{ width: size, height: size }}
                  />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Color palette */}
        <div className="card">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            {t("color.palette")}
          </p>
          <div className="grid grid-cols-5 gap-1.5">
            {KID_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => {
                  setColor(c);
                  if (tool === "eraser") setTool("brush");
                }}
                className="w-9 h-9 rounded-lg transition-all border-2"
                style={{
                  backgroundColor: c,
                  borderColor: color === c ? "#0d9488" : c === "#ffffff" ? "#d1d5db" : c,
                  transform: color === c ? "scale(1.15)" : "scale(1)",
                }}
              />
            ))}
          </div>
          {/* Custom color */}
          <div className="mt-2 flex items-center gap-2">
            <input
              type="color"
              value={color}
              onChange={(e) => {
                setColor(e.target.value);
                if (tool === "eraser") setTool("brush");
              }}
              className="w-9 h-9 rounded cursor-pointer border-0"
            />
            <span className="text-xs text-gray-400">{t("color.custom")}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="card flex flex-col gap-2">
          <button onClick={undo} className="btn-secondary text-sm w-full" disabled={historyIndex <= 0}>
            ↩ {t("color.undo")}
          </button>
          <button onClick={clearCanvas} className="btn-secondary text-sm w-full">
            🗑 {t("color.clear")}
          </button>
          <button onClick={saveImage} className="btn-primary text-sm w-full">
            💾 {t("color.save")}
          </button>
        </div>
      </div>
    </div>
  );
}
