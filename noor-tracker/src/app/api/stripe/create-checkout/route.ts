import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createCheckoutSession } from "@/lib/stripe";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { stripeCustomerId: true, email: true },
  });

  if (!user) {
    return NextResponse.json({ error: "Gebruiker niet gevonden" }, { status: 404 });
  }

  try {
    const checkoutSession = await createCheckoutSession(
      session.user.id,
      user.email,
      user.stripeCustomerId
    );

    return NextResponse.json({ url: checkoutSession.url });
  } catch {
    return NextResponse.json(
      { error: "Kon checkout sessie niet aanmaken." },
      { status: 500 }
    );
  }
}
