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

const FROM = brand.email.from;
const ADMIN = brand.email.admin;

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
    from: FROM,
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
      <tr><td style="padding:6px 0;color:${COLORS.soft};">Klant</td><td style="padding:6px 0;text-align:right;">${order.customerEmail ?? "—"}</td></tr>
      <tr><td style="padding:6px 0;color:${COLORS.soft};">Totaal</td><td style="padding:6px 0;text-align:right;"><strong>${money(order.total)}</strong></td></tr>
    </table>
    <a href="${brand.url}/admin/orders" style="display:inline-block;background:${COLORS.brand};color:#fff;text-decoration:none;padding:12px 24px;border-radius:999px;font-size:14px;">Open in dashboard</a>
  `;
  await resend.emails.send({
    from: FROM,
    to: ADMIN,
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
    ? `<a href="${data.trackingUrl}" style="display:inline-block;background:${COLORS.brand};color:#fff;text-decoration:none;padding:12px 24px;border-radius:999px;font-size:14px;margin-top:8px;">Volg je pakket</a>`
    : data.trackingNumber
      ? `<p style="line-height:1.6;">Trackingnummer: <strong>${data.trackingNumber}</strong></p>`
      : "";
  const body = `
    <p style="line-height:1.6;">Goed nieuws — je bestelling <strong>${data.orderNumber}</strong> is onderweg naar je toe! 📦</p>
    ${tracking}
    <p style="line-height:1.6;color:${COLORS.soft};margin-top:16px;">We hopen dat je geniet van een warm stukje Oriënt thuis.</p>
  `;
  await resend.emails.send({
    from: FROM,
    to,
    subject: `Je bestelling is onderweg — ${data.orderNumber}`,
    html: shell("Je bestelling is verzonden", body),
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
    .map(([k, v]) => `<tr><td style="padding:6px 0;color:${COLORS.soft};">${k}</td><td style="padding:6px 0;text-align:right;"><strong>${v}</strong></td></tr>`)
    .join("");
  const body = `
    <p style="line-height:1.6;">Er is een nieuwe aanvraag binnengekomen om verkoper te worden op Layali.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">${rows}</table>
    ${data.description ? `<p style="line-height:1.6;color:${COLORS.soft};"><em>${data.description}</em></p>` : ""}
  `;
  await resend.emails.send({
    from: FROM,
    to: ADMIN,
    subject: `Nieuwe verkoper-aanvraag — ${data.businessName}`,
    html: shell("Nieuwe verkoper-aanvraag", body),
  });
}
