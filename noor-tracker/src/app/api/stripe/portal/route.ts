import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createBillingPortalSession } from "@/lib/stripe";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { stripeCustomerId: true },
  });

  if (!user?.stripeCustomerId) {
    return NextResponse.json(
      { error: "Geen Stripe klant gevonden." },
      { status: 404 }
    );
  }

  try {
    const portalSession = await createBillingPortalSession(
      user.stripeCustomerId
    );

    return NextResponse.json({ url: portalSession.url });
  } catch {
    return NextResponse.json(
      { error: "Kon billing portaal niet openen." },
      { status: 500 }
    );
  }
}
