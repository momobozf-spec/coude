import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendSellerApplication } from "@/lib/resend";

const OFFER_TYPES = ["PRODUCTS", "SERVICES", "BOTH"];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const businessName = String(body.businessName || "").trim();
    const contactName = String(body.contactName || "").trim();
    const email = String(body.email || "").trim();
    const phone = body.phone ? String(body.phone).trim() : null;
    const offerType = OFFER_TYPES.includes(body.offerType) ? body.offerType : "PRODUCTS";
    const category = body.category ? String(body.category).trim() : null;
    const description = body.description ? String(body.description).trim() : null;

    if (!businessName || !contactName || !email) {
      return NextResponse.json({ error: "Vul de verplichte velden in." }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Vul een geldig e-mailadres in." }, { status: 400 });
    }

    const application = await prisma.sellerApplication.create({
      data: { businessName, contactName, email, phone, offerType, category, description },
    });

    // Notify admin (best-effort).
    try {
      await sendSellerApplication({ businessName, contactName, email, phone, offerType, category, description });
    } catch (err) {
      console.error("[seller/apply] email failed:", err);
    }

    return NextResponse.json({ ok: true, id: application.id });
  } catch (error) {
    console.error("Seller application error:", error);
    return NextResponse.json({ error: "Er is een fout opgetreden. Probeer opnieuw." }, { status: 500 });
  }
}
