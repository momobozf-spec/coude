import { PRICES } from "@/lib/pricing";

// Feature lists only describe what is actually implemented in the core product.
export const PLANS = {
  free: {
    name: "Free",
    generationLimit: 3,
    features: [
      "3 printable sheets (+ bonus sheets via referrals)",
      "All activity types",
      "Digital coloring",
    ],
  },
  pro: {
    name: "Pro",
    priceMonthly: PRICES.pro.monthly,
    priceYearly: PRICES.pro.yearly,
    generationLimit: Infinity,
    features: [
      "Unlimited printable sheets",
      "All activity types",
      "Digital coloring",
      "Use in your own family, classes and lessons (see terms)",
    ],
  },
  school: {
    name: "School",
    priceMonthly: PRICES.school.monthly,
    priceYearly: PRICES.school.yearly,
    generationLimit: Infinity,
    features: [
      "Everything in Pro",
      "For schools and weekend schools",
      "Invoice billing on request",
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
