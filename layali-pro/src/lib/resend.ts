import { Resend } from "resend";
import { brand } from "@/lib/brand";

// Lazily construct the Resend client so the app boots (and builds) without an
// API key configured. When RESEND_API_KEY is absent, email sending is skipped
// gracefully instead of throwing.
let client: Resend | null = null;

function getResend(): Resend | null {
  if (client) return client;
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  client = new Resend(key);
  return client;
}

// Bij elke verzending opnieuw lezen: de waarden komen uit de omgeving.
const FROM = () => brand.email.from;
const ADMIN = () => brand.email.admin;

// ---- Shared template ----------------------------------------------------

const COLORS = { brand: "#b9633e", gold: "#c2904f", ink: "#2c2218", soft: "#7c6a59", bg: "#faf6ef" };

function shell(title: string, body: string): string {
  return `
  <div style="background:${COLORS.bg};padding:32px 0;font-family:Helvetica,Arial,sans-serif;color:${COLORS.ink};">
    <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e7dcc9;border-radius:16px;overflow:hidden;">
      <div style="background:${COLORS.brand};padding:28px 32px;text-align:center;">
        <div style="color:#fff;font-size:24px;letter-spacing:4px;font-weight:bold;text-transform:uppercase;">Layali</div>
        <div style="color:rgba(255,255,255,0.8);font-size:12px;margin-top:4px;">${brand.tagline}</div>
      </div>
      <div style="padding:32px;">
        <h1 style="font-size:22px;margin:0 0 16px;color:${COLORS.ink};">${title}</h1>
        ${body}
      </div>
      <div style="padding:20px 32px;border-top:1px solid #e7dcc9;text-align:center;color:${COLORS.soft};font-size:12px;">
        Layali — Oriental Lifestyle &nbsp;·&nbsp; <a href="${brand.url}" style="color:${COLORS.gold};text-decoration:none;">${brand.url.replace(/^https?:\/\//, "")}</a><br/>
        Vragen? Mail ons op ${brand.email.support}
      </div>
    </div>
  </div>`;
}

function money(n: number): string {
  return `€${n.toFixed(2)}`;
}

/** Alles wat van een gebruiker of beheerder komt, gaat geëscapet de HTML in. */
function esc(value: string | null | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ---- Order confirmation (to customer) -----------------------------------

export interface OrderEmailData {
  orderNumber: string;
  total: number;
  subtotal: number;
  shipping: number;
  discount?: number;
}

export async function sendOrderConfirmation(to: string, order: OrderEmailData) {
  const resend = getResend();
  if (!resend) {
    console.warn("[email] RESEND_API_KEY not set — skipping order confirmation email");
    return;
  }
  const rows = [
    `<tr><td style="padding:6px 0;color:${COLORS.soft};">Subtotaal</td><td style="padding:6px 0;text-align:right;">${money(order.subtotal)}</td></tr>`,
    order.discount && order.discount > 0
      ? `<tr><td style="padding:6px 0;color:${COLORS.soft};">Korting</td><td style="padding:6px 0;text-align:right;">-${money(order.discount)}</td></tr>`
      : "",
    `<tr><td style="padding:6px 0;color:${COLORS.soft};">Verzending</td><td style="padding:6px 0;text-align:right;">${order.shipping === 0 ? "Gratis" : money(order.shipping)}</td></tr>`,
    `<tr><td style="padding:10px 0 0;font-weight:bold;border-top:1px solid #e7dcc9;">Totaal</td><td style="padding:10px 0 0;text-align:right;font-weight:bold;border-top:1px solid #e7dcc9;">${money(order.total)}</td></tr>`,
  ].join("");

  const body = `
    <p style="line-height:1.6;">Bedankt voor je bestelling bij Layali! We zijn al begonnen met het zorgvuldig klaarmaken van je pakket.</p>
    <p style="line-height:1.6;">Je bestelnummer is <strong>${order.orderNumber}</strong>.</p>
    <table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:14px;">${rows}</table>
    <p style="line-height:1.6;color:${COLORS.soft};">Je ontvangt een nieuwe e-mail zodra je bestelling onderweg is. ✨</p>
    <a href="${brand.url}" style="display:inline-block;margin-top:8px;background:${COLORS.brand};color:#fff;text-decoration:none;padding:12px 24px;border-radius:999px;font-size:14px;">Verder ontdekken</a>
  `;
  await resend.emails.send({
    from: FROM(),
    to,
    subject: `Bestelling bevestigd — ${order.orderNumber}`,
    html: shell("Bedankt voor je bestelling!", body),
  });
}

// ---- Admin notification (new order) -------------------------------------

export async function sendAdminNewOrder(order: { orderNumber: string; total: number; customerEmail?: string | null }) {
  const resend = getResend();
  if (!resend) return;
  const body = `
    <p style="line-height:1.6;">Er is een nieuwe betaalde bestelling binnengekomen.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
      <tr><td style="padding:6px 0;color:${COLORS.soft};">Bestelnummer</td><td style="padding:6px 0;text-align:right;"><strong>${order.orderNumber}</strong></td></tr>
      <tr><td style="padding:6px 0;color:${COLORS.soft};">Klant</td><td style="padding:6px 0;text-align:right;">${esc(order.customerEmail ?? "—")}</td></tr>
      <tr><td style="padding:6px 0;color:${COLORS.soft};">Totaal</td><td style="padding:6px 0;text-align:right;"><strong>${money(order.total)}</strong></td></tr>
    </table>
    <a href="${brand.url}/admin/orders" style="display:inline-block;background:${COLORS.brand};color:#fff;text-decoration:none;padding:12px 24px;border-radius:999px;font-size:14px;">Open in dashboard</a>
  `;
  await resend.emails.send({
    from: FROM(),
    to: ADMIN(),
    subject: `Nieuwe bestelling — ${order.orderNumber}`,
    html: shell("Nieuwe bestelling", body),
  });
}

// ---- Shipping update (status change) ------------------------------------

export async function sendShippingUpdate(
  to: string,
  data: { orderNumber: string; trackingNumber?: string | null; trackingUrl?: string | null },
) {
  const resend = getResend();
  if (!resend) return;
  const tracking = data.trackingUrl
    ? `<a href="${esc(data.trackingUrl)}" style="display:inline-block;background:${COLORS.brand};color:#fff;text-decoration:none;padding:12px 24px;border-radius:999px;font-size:14px;margin-top:8px;">Volg je pakket</a>`
    : data.trackingNumber
      ? `<p style="line-height:1.6;">Trackingnummer: <strong>${esc(data.trackingNumber)}</strong></p>`
      : "";
  const body = `
    <p style="line-height:1.6;">Goed nieuws — je bestelling <strong>${data.orderNumber}</strong> is onderweg naar je toe! 📦</p>
    ${tracking}
    <p style="line-height:1.6;color:${COLORS.soft};margin-top:16px;">We hopen dat je geniet van een warm stukje Oriënt thuis.</p>
  `;
  await resend.emails.send({
    from: FROM(),
    to,
    subject: `Je bestelling is onderweg — ${data.orderNumber}`,
    html: shell("Je bestelling is verzonden", body),
  });
}

// ---- Contact form (to admin) ---------------------------------------------

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendContactMessage(data: { name: string; email: string; subject: string; message: string }) {
  const resend = getResend();
  if (!resend) throw new Error("RESEND_API_KEY ontbreekt");
  const body = `
    <p style="line-height:1.6;"><strong>${esc(data.name)}</strong> &lt;${esc(data.email)}&gt; schreef via het contactformulier:</p>
    <p style="line-height:1.6;white-space:pre-wrap;border-left:3px solid ${COLORS.gold};padding-left:12px;">${esc(data.message)}</p>
    <p style="line-height:1.6;color:${COLORS.soft};">Antwoorden kan rechtstreeks op deze e-mail.</p>
  `;
  const { error } = await resend.emails.send({
    from: FROM(),
    to: ADMIN(),
    replyTo: data.email,
    subject: `Contact: ${data.subject.replace(/[\r\n]/g, " ").slice(0, 120)}`,
    html: shell("Nieuw bericht", body),
  });
  if (error) throw new Error(error.message);
}

// ---- Password reset -------------------------------------------------------

export async function sendPasswordReset(to: string, link: string) {
  const resend = getResend();
  if (!resend) {
    console.warn("[email] RESEND_API_KEY ontbreekt — herstelmail niet verstuurd");
    return;
  }
  const body = `
    <p style="line-height:1.6;">Je vroeg om een nieuw wachtwoord voor je Layali-account. Klik op de knop hieronder; de link werkt één uur en maar één keer.</p>
    <a href="${esc(link)}" style="display:inline-block;margin:12px 0;background:${COLORS.brand};color:#fff;text-decoration:none;padding:12px 24px;border-radius:999px;font-size:14px;">Nieuw wachtwoord kiezen</a>
    <p style="line-height:1.6;color:${COLORS.soft};">Heb je dit niet zelf gevraagd? Dan mag je deze e-mail negeren; je wachtwoord blijft ongewijzigd.</p>
  `;
  await resend.emails.send({
    from: FROM(),
    to,
    subject: "Je wachtwoord herstellen",
    html: shell("Wachtwoord herstellen", body),
  });
}

// ---- Seller application (to admin) --------------------------------------

export async function sendSellerApplication(data: {
  businessName: string;
  contactName: string;
  email: string;
  phone?: string | null;
  offerType: string;
  category?: string | null;
  description?: string | null;
}) {
  const resend = getResend();
  if (!resend) {
    console.warn("[email] RESEND_API_KEY not set — skipping seller application email");
    return;
  }
  const rows = [
    ["Onderneming", data.businessName],
    ["Contactpersoon", data.contactName],
    ["E-mail", data.email],
    ["Telefoon", data.phone || "—"],
    ["Type aanbod", data.offerType],
    ["Categorie", data.category || "—"],
  ]
    .map(([k, v]) => `<tr><td style="padding:6px 0;color:${COLORS.soft};">${k}</td><td style="padding:6px 0;text-align:right;"><strong>${esc(v)}</strong></td></tr>`)
    .join("");
  const body = `
    <p style="line-height:1.6;">Er is een nieuwe aanvraag binnengekomen om verkoper te worden op Layali.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">${rows}</table>
    ${data.description ? `<p style="line-height:1.6;color:${COLORS.soft};"><em>${esc(data.description)}</em></p>` : ""}
  `;
  await resend.emails.send({
    from: FROM(),
    to: ADMIN(),
    subject: `Nieuwe verkoper-aanvraag — ${data.businessName.replace(/[\r\n]/g, " ").slice(0, 100)}`,
    html: shell("Nieuwe verkoper-aanvraag", body),
  });
}

// ---- Herroeping (online herroepingsfunctie) --------------------------------

export interface WithdrawalStatement {
  name: string;
  email: string;
  orderNumber: string;
  items: string | null;
  receivedAt: Date;
  /** Of de bestelling met dit nummer en e-mailadres gevonden werd. */
  matchedOrder: boolean;
}

function withdrawalRows(s: WithdrawalStatement): string {
  const when = s.receivedAt.toLocaleString("nl-BE", { timeZone: "Europe/Brussels" });
  return `
    <table style="width:100%;border-collapse:collapse;line-height:1.6;">
      <tr><td style="padding:4px 0;color:${COLORS.soft};width:40%;">Naam</td><td>${esc(s.name)}</td></tr>
      <tr><td style="padding:4px 0;color:${COLORS.soft};">E-mail</td><td>${esc(s.email)}</td></tr>
      <tr><td style="padding:4px 0;color:${COLORS.soft};">Bestelnummer</td><td>${esc(s.orderNumber)}</td></tr>
      <tr><td style="padding:4px 0;color:${COLORS.soft};">Producten</td><td>${esc(s.items ?? "volledige bestelling")}</td></tr>
      <tr><td style="padding:4px 0;color:${COLORS.soft};">Ontvangen op</td><td>${esc(when)} (${esc(s.receivedAt.toISOString())})</td></tr>
    </table>`;
}

/**
 * Ontvangstbevestiging van een herroeping aan de consument, op een duurzame
 * drager (e-mail), met de verklaring en datum en tijd van ontvangst.
 */
export async function sendWithdrawalAcknowledgement(s: WithdrawalStatement): Promise<void> {
  const resend = getResend();
  if (!resend) throw new Error("RESEND_API_KEY ontbreekt");
  const body = `
    <p style="line-height:1.6;">We hebben je herroeping goed ontvangen. Hieronder staat je verklaring zoals je ze verstuurde.</p>
    ${withdrawalRows(s)}
    <p style="line-height:1.6;margin-top:16px;">Stuur de producten uiterlijk 14 dagen na vandaag terug. We sturen je de retourinstructies en betalen je terug volgens onze voorwaarden.</p>
    <p style="line-height:1.6;color:${COLORS.soft};">Nous avons bien reçu votre rétractation (voir ci-dessus). Renvoyez les produits au plus tard 14 jours après aujourd'hui.</p>
  `;
  const { error } = await resend.emails.send({
    from: FROM(),
    to: s.email,
    subject: `Ontvangstbevestiging herroeping ${s.orderNumber.replace(/[\r\n]/g, " ").slice(0, 60)}`,
    html: shell("Herroeping ontvangen", body),
  });
  if (error) throw new Error(error.message);
}

/** Melding van een herroeping aan de beheerder. */
export async function sendAdminWithdrawal(s: WithdrawalStatement): Promise<void> {
  const resend = getResend();
  if (!resend) throw new Error("RESEND_API_KEY ontbreekt");
  const body = `
    <p style="line-height:1.6;">Een klant heeft via de site een herroeping ingediend.${
      s.matchedOrder ? "" : " <strong>Geen bestelling gevonden met dit nummer en e-mailadres: controleer handmatig.</strong>"
    }</p>
    ${withdrawalRows(s)}
  `;
  const { error } = await resend.emails.send({
    from: FROM(),
    to: ADMIN(),
    replyTo: s.email,
    subject: `Herroeping: ${s.orderNumber.replace(/[\r\n]/g, " ").slice(0, 60)}`,
    html: shell("Herroeping ontvangen", body),
  });
  if (error) throw new Error(error.message);
}
