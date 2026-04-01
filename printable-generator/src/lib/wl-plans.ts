// Client-safe — no Prisma imports
export const WL_PLANS = {
  basic: { name: "Basic", price: 297, seats: 10, features: ["School branding", "All worksheets", "10 teacher seats", "Custom subdomain", "PDF branding"] },
  advanced: { name: "Advanced", price: 497, seats: 25, features: ["Everything in Basic", "25 teacher seats", "AI worksheet generator", "Usage reports", "Marketplace access", "Custom domain", "Priority support"] },
} as const;
