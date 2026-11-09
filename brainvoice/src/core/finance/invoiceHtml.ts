import { computeTotals, formatAddress } from './InvoiceEngine';
import { formatCents, formatQuantity } from './money';
import { formatIban } from './payment';
import type { CompanyProfile, Invoice } from '../domain/admin';
import type { Language } from '../types/common';

/**
 * Deterministic HTML rendering of an outgoing invoice (§102). The platform turns this
 * into a PDF with expo-print; the same HTML backs the in-app preview. No AI text.
 */

const LABELS: Record<Language, Record<string, string>> = {
  nl: { invoice: 'FACTUUR', number: 'Factuurnummer', date: 'Factuurdatum', due: 'Vervaldatum', period: 'Periode', to: 'Aan', description: 'Omschrijving', qty: 'Aantal', unit: 'Eenheid', price: 'Eenheidsprijs', total: 'Totaal', subtotal: 'Subtotaal (excl. btw)', vat: 'Btw', grand: 'Te betalen', terms: 'Betalingsvoorwaarden', termsText: 'Gelieve te betalen binnen {days} dagen op', reference: 'Gestructureerde mededeling', vatNumber: 'Btw-nummer', companyNumber: 'Ondernemingsnummer', day: 'dag', hour: 'uur', piece: 'stuk', month: 'maand', km: 'km', other: '' },
  en: { invoice: 'INVOICE', number: 'Invoice number', date: 'Invoice date', due: 'Due date', period: 'Service period', to: 'Bill to', description: 'Description', qty: 'Qty', unit: 'Unit', price: 'Unit price', total: 'Total', subtotal: 'Subtotal (excl. VAT)', vat: 'VAT', grand: 'Amount due', terms: 'Payment terms', termsText: 'Please pay within {days} days to', reference: 'Payment reference', vatNumber: 'VAT number', companyNumber: 'Company number', day: 'day', hour: 'hour', piece: 'piece', month: 'month', km: 'km', other: '' },
  fr: { invoice: 'FACTURE', number: 'Numéro de facture', date: 'Date de facture', due: 'Échéance', period: 'Période', to: 'Facturé à', description: 'Description', qty: 'Qté', unit: 'Unité', price: 'Prix unitaire', total: 'Total', subtotal: 'Sous-total (HTVA)', vat: 'TVA', grand: 'À payer', terms: 'Conditions de paiement', termsText: 'Merci de payer dans les {days} jours sur', reference: 'Communication structurée', vatNumber: 'Numéro de TVA', companyNumber: "Numéro d'entreprise", day: 'jour', hour: 'heure', piece: 'pièce', month: 'mois', km: 'km', other: '' },
};

function esc(value: string | null | undefined): string {
  return (value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
}

function daysBetween(a: string | null, b: string | null): number | null {
  if (!a || !b) return null;
  const ms = Date.UTC(Number(b.slice(0, 4)), Number(b.slice(5, 7)) - 1, Number(b.slice(8, 10))) - Date.UTC(Number(a.slice(0, 4)), Number(a.slice(5, 7)) - 1, Number(a.slice(8, 10)));
  return Math.round(ms / 86_400_000);
}

export function renderInvoiceHtml(invoice: Invoice, profile: CompanyProfile, language: Language): string {
  const L = LABELS[language];
  const totals = computeTotals(invoice.lines);
  const money = (cents: number) => formatCents(cents, invoice.currency, language);
  const terms = daysBetween(invoice.issueDate, invoice.dueDate) ?? profile.paymentTermsDays;
  const rows = invoice.lines
    .map(
      (line) => `<tr><td>${esc(line.description)}</td><td class="num">${formatQuantity(line.quantity, language)}</td><td>${esc(L[line.unit] ?? line.unit)}</td><td class="num">${money(line.unitPriceCents)}</td><td class="num">${line.taxRate}%</td><td class="num">${money(line.totalCents)}</td></tr>`,
    )
    .join('');
  const vatRows = totals.taxByRate.map((g) => `<tr><td colspan="5" class="label">${L.vat} ${g.rate}% (${money(g.baseCents)})</td><td class="num">${money(g.taxCents)}</td></tr>`).join('');
  const period = invoice.servicePeriodStart ? `<div><span class="k">${L.period}</span> ${esc(invoice.servicePeriodStart)} – ${esc(invoice.servicePeriodEnd ?? invoice.servicePeriodStart)}</div>` : '';
  const logo = profile.logoUri ? `<img src="${esc(profile.logoUri)}" alt="" style="max-height:64px;max-width:200px" />` : '';
  return `<!doctype html><html lang="${language}"><head><meta charset="utf-8"><title>${esc(L.invoice)} ${esc(invoice.invoiceNumber ?? '')}</title>
<style>
body{font-family:-apple-system,Helvetica,Arial,sans-serif;color:#111;font-size:12px;margin:40px}
h1{font-size:26px;letter-spacing:2px;margin:0 0 4px}
.head{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px}
.block{line-height:1.5}.k{color:#666;display:inline-block;min-width:120px}
table{width:100%;border-collapse:collapse;margin-top:18px}
th{text-align:left;border-bottom:2px solid #111;padding:6px 4px;font-size:11px;text-transform:uppercase;letter-spacing:.5px}
td{padding:7px 4px;border-bottom:1px solid #ddd;vertical-align:top}
td.num,th.num{text-align:right;white-space:nowrap}
td.label{text-align:right;color:#444}
tr.grand td{border-top:2px solid #111;border-bottom:none;font-weight:700;font-size:14px}
.footer{margin-top:36px;color:#444;line-height:1.6;font-size:11px;border-top:1px solid #ddd;padding-top:12px}
.ref{font-family:ui-monospace,Menlo,monospace;font-size:14px}
</style></head><body>
<div class="head">
  <div class="block"><strong>${esc(profile.companyName)}</strong><br>${formatAddress(profile.address).map(esc).join('<br>')}${profile.vatNumber ? `<br>${L.vatNumber}: ${esc(profile.vatNumber)}` : ''}${profile.companyNumber ? `<br>${L.companyNumber}: ${esc(profile.companyNumber)}` : ''}${profile.email ? `<br>${esc(profile.email)}` : ''}${profile.phone ? `<br>${esc(profile.phone)}` : ''}</div>
  <div style="text-align:right">${logo}<h1>${L.invoice}</h1><div class="block"><div><span class="k">${L.number}</span> <strong>${esc(invoice.invoiceNumber ?? '—')}</strong></div><div><span class="k">${L.date}</span> ${esc(invoice.issueDate ?? '')}</div><div><span class="k">${L.due}</span> ${esc(invoice.dueDate ?? '')}</div>${period}</div></div>
</div>
<div class="block"><span class="k">${L.to}</span><br><strong>${esc(invoice.counterpartyName)}</strong><br>${formatAddress(invoice.counterpartyAddress).map(esc).join('<br>')}${invoice.counterpartyVat ? `<br>${L.vatNumber}: ${esc(invoice.counterpartyVat)}` : ''}</div>
${invoice.description ? `<p>${esc(invoice.description)}</p>` : ''}
<table><thead><tr><th>${L.description}</th><th class="num">${L.qty}</th><th>${L.unit}</th><th class="num">${L.price}</th><th class="num">${L.vat}</th><th class="num">${L.total}</th></tr></thead>
<tbody>${rows}
<tr><td colspan="5" class="label">${L.subtotal}</td><td class="num">${money(totals.subtotalCents)}</td></tr>
${vatRows}
<tr class="grand"><td colspan="5" class="label">${L.grand}</td><td class="num">${money(totals.totalCents)}</td></tr>
</tbody></table>
<div class="footer">
  <div><strong>${L.terms}</strong>: ${L.termsText?.replace('{days}', String(terms))} <strong>${esc(invoice.iban ? formatIban(invoice.iban) : '')}</strong>${invoice.bic ? ` (BIC ${esc(invoice.bic)})` : ''}</div>
  ${invoice.paymentReference ? `<div>${L.reference}: <span class="ref">${esc(invoice.paymentReference)}</span></div>` : ''}
  ${invoice.notes ? `<div>${esc(invoice.notes)}</div>` : ''}
  ${profile.invoiceFooter ? `<div style="margin-top:8px">${esc(profile.invoiceFooter)}</div>` : ''}
</div>
</body></html>`;
}
