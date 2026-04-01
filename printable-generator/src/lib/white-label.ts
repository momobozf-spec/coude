import { prisma } from "./prisma";

export interface SchoolBranding {
  id: string;
  subdomain: string;
  schoolName: string;
  schoolNameAr: string | null;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  welcomeMessage: string | null;
  footerText: string | null;
  plan: string;
  isActive: boolean;
}

const brandingCache = new Map<string, { data: SchoolBranding | null; expires: number }>();
const CACHE_TTL = 60_000; // 1 minute

export async function getSchoolFromSubdomain(subdomain: string): Promise<SchoolBranding | null> {
  const now = Date.now();
  const cached = brandingCache.get(subdomain);
  if (cached && cached.expires > now) return cached.data;

  const account = await prisma.whiteLabelAccount.findUnique({
    where: { subdomain },
    select: {
      id: true, subdomain: true, schoolName: true, schoolNameAr: true,
      logoUrl: true, primaryColor: true, secondaryColor: true,
      welcomeMessage: true, footerText: true, plan: true, isActive: true,
    },
  });

  const result = account?.isActive ? account : null;
  brandingCache.set(subdomain, { data: result, expires: now + CACHE_TTL });
  return result;
}

export function isWhiteLabelHost(host: string): { isWhiteLabel: boolean; subdomain: string | null } {
  // Match: [subdomain].noorprintables.com or [subdomain].localhost:3000
  const mainDomain = process.env.NEXT_PUBLIC_APP_URL?.replace(/https?:\/\//, "").replace(/:\d+$/, "") || "noorprintables.com";

  if (host === mainDomain || host === `www.${mainDomain}` || host.startsWith("localhost")) {
    return { isWhiteLabel: false, subdomain: null };
  }

  const parts = host.split(".");
  if (parts.length >= 3) {
    const subdomain = parts[0];
    if (subdomain !== "www" && subdomain !== "api") {
      return { isWhiteLabel: true, subdomain };
    }
  }

  return { isWhiteLabel: false, subdomain: null };
}

export function getBrandingCSS(branding: SchoolBranding): string {
  return `
    :root {
      --primary: ${branding.primaryColor};
      --primary-hover: ${branding.primaryColor}dd;
      --accent: ${branding.secondaryColor};
      --gold: ${branding.secondaryColor};
    }
    .btn-primary { background-color: ${branding.primaryColor} !important; }
    .btn-primary:hover { background-color: ${branding.primaryColor}dd !important; }
    .btn-gold { background-color: ${branding.secondaryColor} !important; }
  `;
}

export function generateInviteToken(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let token = "";
  for (let i = 0; i < 24; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}

export function generateDemoToken(): string {
  return `demo_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export { WL_PLANS } from "./wl-plans";
