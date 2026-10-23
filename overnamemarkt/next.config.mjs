import { checkProductionEnv, guardApplies } from "./lib/production-guard.mjs";

// Productie-guard bij de Vercel-productiebuild: placeholders => build faalt => geen deploy.
if (guardApplies(process.env, "build")) {
  const { errors, warnings } = checkProductionEnv(process.env);
  for (const w of warnings) console.warn(`[productie-guard] LET OP: ${w}`);
  if (errors.length) throw new Error(`[productie-guard] Build geweigerd:\n- ${errors.join("\n- ")}`);
}

const isDev = process.env.NODE_ENV !== "production";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseOrigin = supabaseUrl ? new URL(supabaseUrl).origin : "";

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  `connect-src 'self' ${supabaseOrigin}`.trim(),
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        ],
      },
    ];
  },
};

export default nextConfig;
