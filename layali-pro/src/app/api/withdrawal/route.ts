import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { emailConfigured, sendAdminWithdrawal, sendWithdrawalAcknowledgement } from "@/lib/resend";
import { withdrawalSchema } from "@/lib/withdrawal";

/**
 * Online herroepingsfunctie (Richtlijn (EU) 2023/2673, art. 11bis
 * Richtlijn 2011/83/EU; van toepassing sinds 19 juni 2026).
 *
 * De consument geeft naam, de overeenkomst (bestelnummer) en het e-mailadres
 * voor de bevestiging, en bevestigt. Wij sturen zonder onnodige vertraging een
 * ontvangstbevestiging met de verklaring en datum/tijd van ontvangst.
 *
 * Een verklaring wordt nooit geweigerd omdat het bestelnummer niet klopt: het
 * herroepingsrecht hangt niet af van ons formulier. De beheerder krijgt dan een
 * melding om het handmatig na te gaan.
 */
export async function POST(request: Request) {
  const ip = clientIp(request.headers.get("x-forwarded-for"));
  if (!rateLimit(`withdrawal:${ip}`, 10, 60 * 60 * 1000).allowed) {
    return NextResponse.json({ error: "Te veel verzoeken. Probeer het later opnieuw of mail ons." }, { status: 429 });
  }
  const parsed = withdrawalSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Vul je naam, e-mailadres en bestelnummer in." }, { status: 400 });
  }
  const { name, email, items } = parsed.data;
  const orderNumber = parsed.data.orderNumber.toUpperCase();
  const receivedAt = new Date();

  let matchedOrder = false;
  try {
    const order = await prisma.order.findFirst({
      where: { orderNumber, customerEmail: { equals: email, mode: "insensitive" } },
      select: { id: true, needsAttention: true },
    });
    if (order) {
      matchedOrder = true;
      const note = `Herroeping ontvangen op ${receivedAt.toISOString()} via de site${items ? ` (${items.slice(0, 200)})` : ""}`;
      await prisma.order.update({
        where: { id: order.id },
        data: { needsAttention: order.needsAttention ? `${order.needsAttention}; ${note}` : note },
      });
    }
  } catch (error) {
    // De verklaring blijft geldig; de mail aan de beheerder volstaat dan.
    console.error("[withdrawal] order bijwerken mislukt:", error instanceof Error ? error.message : error);
  }

  const statement = { name, email, orderNumber, items, receivedAt, matchedOrder };
  let acknowledged = false;
  if (emailConfigured()) {
    try {
      await sendAdminWithdrawal(statement);
      await sendWithdrawalAcknowledgement(statement);
      acknowledged = true;
    } catch (error) {
      console.error("[withdrawal] e-mail mislukt:", error instanceof Error ? error.message : error);
    }
  } else {
    console.error("[withdrawal] RESEND_API_KEY ontbreekt: geen ontvangstbevestiging verstuurd", { orderNumber });
  }

  return NextResponse.json({ ok: true, receivedAt: receivedAt.toISOString(), acknowledged });
}
