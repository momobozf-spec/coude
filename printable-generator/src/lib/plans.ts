export const PLANS = {
  free: {
    name: "Free",
    generationLimit: 3,
    features: [
      "3 printable sheets",
      "All activity types",
      "Digital coloring (3 templates)",
      "Watermarked exports",
    ],
  },
  pro: {
    name: "Pro",
    priceMonthly: 12,
    priceYearly: 97, // ~$8/mo, saves $47/yr
    generationLimit: Infinity,
    features: [
      "Unlimited printable sheets",
      "All activity types",
      "All digital coloring templates",
      "No watermarks",
      "Priority new themes",
      "Commercial use license",
    ],
  },
  school: {
    name: "School",
    priceMonthly: 49,
    priceYearly: 397, // ~$33/mo, saves $191/yr
    generationLimit: Infinity,
    features: [
      "Everything in Pro",
      "Up to 25 teacher accounts",
      "Bulk PDF generation",
      "Custom school branding",
      "Classroom management",
      "Curriculum-aligned themes",
      "Priority support",
      "Invoice billing",
    ],
  },
} as const;

export type PlanId = keyof typeof PLANS;

export function getGenerationLimit(plan: string, bonusGenerations: number): number {
  if (plan === "pro" || plan === "school") return Infinity;
  return PLANS.free.generationLimit + bonusGenerations;
}

export function getRemainingGenerations(
  plan: string,
  used: number,
  bonus: number
): number | "unlimited" {
  if (plan === "pro" || plan === "school") return "unlimited";
  const limit = PLANS.free.generationLimit + bonus;
  return Math.max(0, limit - used);
}
