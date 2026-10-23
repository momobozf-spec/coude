import { fromCents, shippingCents, toCents } from "@/lib/money";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat("nl-BE", {
    style: "currency",
    currency: "EUR",
  }).format(price);
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w ]+/g, "")
    .replace(/ +/g, "-");
}

export function truncate(str: string, length: number): string {
  return str.length > length ? str.substring(0, length) + "..." : str;
}

/** Standaardverzending voor de weergave in de winkelmand; dezelfde regels als de checkout (money.ts). */
export function getShippingCost(subtotal: number): number {
  return fromCents(shippingCents(toCents(subtotal), "standard"));
}
