import { NextResponse } from "next/server";
import { getAccount } from "@/lib/account";
import { limit } from "@/lib/ratelimit";
import { siteUrl } from "@/lib/env";
import { stripe } from "@/lib/stripe";

export async function POST(req: Request) {
  const { lang } = (await req.json().catch(() => ({}))) as { lang?: string };
  const l = lang === "fr" ? "fr" : "nl";
  const account = await getAccount();
  if (!account) return NextResponse.json({ error: "login" }, { status: 401 });
  const limited = await limit(`portal:${account.userId}`, 20, 3600);
  if (limited) return limited;
  if (!account.stripeCustomerId) return NextResponse.json({ error: "no_customer" }, { status: 404 });

  const session = await stripe().billingPortal.sessions.create({
    customer: account.stripeCustomerId,
    locale: l,
    return_url: `${siteUrl()}/${l}/account`,
  });
  return NextResponse.json({ url: session.url });
}
