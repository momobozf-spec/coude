"use client";

interface Props {
  embedUrl: string;
  className?: string;
  autoplay?: boolean;
  muted?: boolean;
}

export default function BunnyEmbed({ embedUrl, className, autoplay = false, muted = false }: Props) {
  const isPlaceholder = embedUrl.includes("placeholder");

  if (isPlaceholder) {
    return (
      <div className={`relative bg-gray-900 flex items-center justify-center ${className || ""}`} style={{ aspectRatio: "16/9" }}>
        <div className="text-center text-white">
          <div className="text-5xl mb-3 opacity-40">&#127909;</div>
          <p className="text-sm text-gray-400">Video placeholder</p>
          <p className="text-xs text-gray-500 mt-1">Replace with Bunny.net video ID</p>
        </div>
      </div>
    );
  }

  // Build iframe URL with params
  const params = new URLSearchParams();
  if (autoplay) params.set("autoplay", "true");
  if (muted) params.set("muted", "true");
  params.set("preload", "true");
  params.set("responsive", "true");

  const src = `${embedUrl}?${params.toString()}`;

  return (
    <div className={`relative ${className || ""}`} style={{ aspectRatio: "16/9" }}>
      <iframe
        src={src}
        loading="lazy"
        style={{ border: 0, position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
        allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
}
