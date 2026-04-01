import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

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

    // In production, send this to your admin inbox via email service (Resend, SendGrid, etc.)
    // For now, log it and store it as a lead so the admin can process it manually.
    const invoiceRequest = {
      userId: session.user.id,
      schoolName,
      contactName,
      contactEmail,
      billingAddress,
      vatNumber: vatNumber || "N/A",
      plan,
      priceDisplay: plan === "school_yearly" ? "€397/year" : "€49/month",
      requestedAt: new Date().toISOString(),
    };

    console.log("[Invoice Request]", JSON.stringify(invoiceRequest, null, 2));

    // Store the contact as a lead for follow-up
    await prisma.lead.upsert({
      where: { email: contactEmail },
      update: {},
      create: {
        email: contactEmail,
        source: `invoice_request_${plan}`,
      },
    });

    // TODO: Replace with actual email sending
    // await sendEmail({
    //   to: process.env.ADMIN_EMAIL || "admin@noorprintables.com",
    //   subject: `🏫 New School Invoice Request: ${schoolName}`,
    //   body: `
    //     School: ${schoolName}
    //     Contact: ${contactName} (${contactEmail})
    //     Address: ${billingAddress}
    //     VAT: ${vatNumber || "N/A"}
    //     Plan: ${plan === "school_yearly" ? "School Yearly (€397/year)" : "School Monthly (€49/month)"}
    //     User ID: ${session.user.id}
    //   `,
    // });

    return NextResponse.json({
      success: true,
      message: "Invoice request received. We'll send the invoice within 1 business day.",
    });
  } catch (error) {
    console.error("Invoice request error:", error);
    return NextResponse.json(
      { error: "Failed to submit invoice request" },
      { status: 500 }
    );
  }
}
