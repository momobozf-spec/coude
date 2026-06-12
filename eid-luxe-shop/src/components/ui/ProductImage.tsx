import { cn } from "@/lib/utils";

// Stylised SVG product mock — uses the product's accent color and slug to vary
// the visual without relying on external image assets.
export function ProductImage({
  slug,
  accent,
  className,
  alt,
}: {
  slug: string;
  accent: string;
  className?: string;
  alt?: string;
}) {
  // Hash the slug into a small int for variation
  const seed = Array.from(slug).reduce((s, c) => s + c.charCodeAt(0), 0);
  const variant = seed % 5;

  return (
    <div
      role="img"
      aria-label={alt}
      className={cn(
        "relative overflow-hidden bg-gradient-to-br from-cream-100 via-cream-50 to-sand-100",
        className,
      )}
    >
      {/* soft radial glow */}
      <div
        className="absolute inset-0 opacity-60"
        style={{
          background: `radial-gradient(60% 60% at 50% 40%, ${accent}30 0%, transparent 70%)`,
        }}
      />

      {/* geometric pattern overlay */}
      <svg
        className="absolute inset-0 h-full w-full opacity-[0.07]"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <pattern id={`pat-${slug}`} x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M10 0 L20 10 L10 20 L0 10 Z" fill="none" stroke={accent} strokeWidth="0.5" />
            <circle cx="10" cy="10" r="1" fill={accent} />
          </pattern>
        </defs>
        <rect width="100" height="100" fill={`url(#pat-${slug})`} />
      </svg>

      {/* central decorative motif */}
      <div className="absolute inset-0 flex items-center justify-center">
        <svg
          width="60%"
          height="60%"
          viewBox="0 0 200 200"
          xmlns="http://www.w3.org/2000/svg"
          className="drop-shadow-md"
        >
          {variant === 0 && (
            // Lantern-like ornament
            <g fill="none" stroke={accent} strokeWidth="2.5">
              <ellipse cx="100" cy="100" rx="55" ry="70" />
              <path d="M70 60 Q100 30 130 60" />
              <path d="M70 140 Q100 170 130 140" />
              <line x1="100" y1="20" x2="100" y2="40" />
              <circle cx="100" cy="100" r="20" fill={accent} fillOpacity="0.15" />
            </g>
          )}
          {variant === 1 && (
            // 8-point star (Islamic geometric)
            <g fill="none" stroke={accent} strokeWidth="2.5">
              <polygon points="100,30 120,80 170,80 130,110 145,160 100,130 55,160 70,110 30,80 80,80" fill={accent} fillOpacity="0.12" />
              <circle cx="100" cy="100" r="25" />
            </g>
          )}
          {variant === 2 && (
            // Crescent + star
            <g fill="none" stroke={accent} strokeWidth="2.5">
              <path d="M130 100 a 50 50 0 1 1 -50 -50 a 38 38 0 1 0 50 50 z" fill={accent} fillOpacity="0.18" />
              <polygon points="155,80 160,95 175,95 163,104 168,120 155,110 142,120 147,104 135,95 150,95" fill={accent} fillOpacity="0.6" />
            </g>
          )}
          {variant === 3 && (
            // Tulip / arch motif
            <g fill="none" stroke={accent} strokeWidth="2.5">
              <path d="M60 160 L60 90 Q60 40 100 40 Q140 40 140 90 L140 160 Z" fill={accent} fillOpacity="0.12" />
              <path d="M85 160 L85 110 Q85 90 100 90 Q115 90 115 110 L115 160" />
              <circle cx="100" cy="60" r="6" fill={accent} />
            </g>
          )}
          {variant === 4 && (
            // Mandala
            <g fill="none" stroke={accent} strokeWidth="2.2">
              <circle cx="100" cy="100" r="60" />
              <circle cx="100" cy="100" r="42" />
              <circle cx="100" cy="100" r="22" fill={accent} fillOpacity="0.15" />
              {Array.from({ length: 8 }).map((_, i) => {
                const angle = (i * Math.PI) / 4;
                const x1 = 100 + Math.cos(angle) * 22;
                const y1 = 100 + Math.sin(angle) * 22;
                const x2 = 100 + Math.cos(angle) * 60;
                const y2 = 100 + Math.sin(angle) * 60;
                return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />;
              })}
            </g>
          )}
        </svg>
      </div>
    </div>
  );
}
