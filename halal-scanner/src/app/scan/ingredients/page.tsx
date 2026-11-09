import type { Metadata } from "next";
import { IngredientScanScreen } from "@/components/scan/ingredients/IngredientScanScreen";

export const metadata: Metadata = {
  title: "Ingrediënten scannen · Halal Product Scanner",
  description:
    "Fotografeer de ingrediëntenlijst van een verpakking en laat de ingrediënten controleren.",
};

export default function IngredientScanPage() {
  return <IngredientScanScreen />;
}
