import "server-only";
import Stripe from "stripe";
import { required } from "@/lib/env";

let client: Stripe | null = null;
export function stripe(): Stripe {
  if (!client) client = new Stripe(required("STRIPE_SECRET_KEY"), { appInfo: { name: "Huurklaar" } });
  return client;
}

export type Product = "dossier" | "zoekpas";
export function priceFor(product: Product): string {
  return product === "dossier" ? required("STRIPE_PRICE_DOSSIER") : required("STRIPE_PRICE_ZOEKPAS");
}
