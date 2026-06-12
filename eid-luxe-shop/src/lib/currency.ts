import type { Currency } from "@/types";

// Mock conversion rates relative to EUR (base).
// In production, replace with a live rate API.
export const RATES: Record<Currency, number> = {
  EUR: 1,
  USD: 1.08,
  GBP: 0.86,
};

export const SYMBOLS: Record<Currency, string> = {
  EUR: "€",
  USD: "$",
  GBP: "£",
};

export const convert = (amountInEur: number, target: Currency) =>
  amountInEur * RATES[target];

export const formatPrice = (amountInEur: number, currency: Currency) => {
  const value = convert(amountInEur, currency);
  return `${SYMBOLS[currency]}${value.toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};
