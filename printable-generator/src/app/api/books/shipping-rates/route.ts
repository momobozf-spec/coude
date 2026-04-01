import { NextRequest, NextResponse } from "next/server";
import { getShippingRates, BookVariant } from "@/lib/printful";

export async function POST(req: NextRequest) {
  try {
    const { country, zip, city, variant } = await req.json();
    if (!country) return NextResponse.json({ error: "country required" }, { status: 400 });

    const rates = await getShippingRates(
      { country, zip: zip || "0000", city: city || "" },
      (variant as BookVariant) || "softcover_20"
    );

    return NextResponse.json({ rates });
  } catch (error) {
    console.error("Shipping rates error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
