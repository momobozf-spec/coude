import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { createElement } from "react";
import { sendEmail } from "@/lib/emails/send";
import { PRICES, formatPrice } from "@/lib/pricing";

const invoiceSchema = z.object({
  schoolName: z.string().min(2).max(200),
  contactName: z.string().min(2).max(100),
  contactEmail: z.string().email(),
  billingAddress: z.string().min(10).max(500),
  vatNumber: z.string().max(50).optional(),
  plan: z.enum(["school_monthly", "school_yearly"]),
});

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = invoiceSchema.safeParse(body);

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || "Invalid input";
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const { schoolName, contactName, contactEmail, billingAddress, vatNumber, plan } = parsed.data;

    // Update user's school info
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        schoolName,
        userType: "school",
      },
    });

    const priceDisplay =
      plan === "school_yearly"
        ? `${formatPrice(PRICES.school.yearly)}/jaar`
        : `${formatPrice(PRICES.school.monthly)}/maand`;

    // Store the contact as a lead for follow-up
    await prisma.lead.upsert({
      where: { email: contactEmail },
      update: {},
      create: { email: contactEmail, source: `invoice_request_${plan}` },
    });

    // Notify the admin inbox (no personal data in server logs).
    const adminEmail = process.env.ADMIN_EMAIL;
    if (adminEmail) {
      const lines = [
        `School: ${schoolName}`,
        `Contact: ${contactName} (${contactEmail})`,
        `Adres: ${billingAddress}`,
        `Btw: ${vatNumber || "n.v.t."}`,
        `Plan: ${plan} (${priceDisplay})`,
        `User ID: ${session.user.id}`,
      ];
      await sendEmail({
        to: adminEmail,
        subject: `Factuuraanvraag School-plan: ${schoolName}`,
        react: createElement("pre", null, lines.join("\n")),
      }).catch(() => {});
    } else {
      console.warn("[Invoice Request] received but ADMIN_EMAIL is not set");
    }

    return NextResponse.json({
      success: true,
      message: "Invoice request received. We'll send the invoice within 1 business day.",
    });
  } catch (error) {
    console.error("Invoice request error:", error instanceof Error ? error.message : "unknown");
    return NextResponse.json(
      { error: "Failed to submit invoice request" },
      { status: 500 }
    );
  }
}
