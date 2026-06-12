export const metadata = { title: "Terms & Conditions — Bayt Noor" };

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-16 lg:px-6 lg:py-20">
      <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-warmbrown-600">
        Legal
      </span>
      <h1 className="mt-3 font-display text-5xl leading-tight text-forest-800">
        Terms & conditions
      </h1>
      <p className="mt-4 text-sm text-warmbrown-500">Last updated: 6 May 2026</p>

      <div className="mt-10 grid gap-8 text-base leading-relaxed text-warmbrown-600">
        <Section title="1. About these terms">
          By using baytnoor.com you agree to these terms. Bayt Noor BV is registered in Belgium under VAT BE0123.456.789.
        </Section>
        <Section title="2. Pricing & currencies">
          All prices are inclusive of VAT and shown in EUR by default. You can switch to USD or GBP using the currency selector — final billing is in EUR using the displayed conversion rate.
        </Section>
        <Section title="3. Payment">
          We accept Visa, Mastercard, Amex, Bancontact, iDEAL, PayPal, Apple Pay and Google Pay. Payment is processed securely by Stripe and Mollie.
        </Section>
        <Section title="4. Shipping">
          We ship from Antwerp, Belgium to over 35 countries. Standard delivery is 3-5 business days within the EU and 5-10 business days worldwide. Customs duties and import taxes outside the EU are the customer's responsibility.
        </Section>
        <Section title="5. Returns">
          You may return unopened products within 14 days of delivery for a full refund. Food and skincare products with broken seals cannot be returned for hygiene reasons.
        </Section>
        <Section title="6. Warranty">
          We warrant our products to be free from defects in materials and workmanship for one year. Defective products will be replaced or refunded.
        </Section>
        <Section title="7. Liability">
          To the extent permitted by law, our liability for any product is limited to the price paid for that product.
        </Section>
        <Section title="8. Governing law">
          These terms are governed by Belgian law. Any disputes will be settled in the courts of Antwerp.
        </Section>
        <Section title="9. Contact">
          Bayt Noor BV · Antwerp, Belgium · hallo@baytnoor.com
        </Section>
      </div>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-2xl text-forest-800">{title}</h2>
      <p className="mt-2">{children}</p>
    </section>
  );
}
