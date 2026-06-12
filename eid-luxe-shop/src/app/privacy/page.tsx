export const metadata = { title: "Privacy policy — Bayt Noor" };

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-16 lg:px-6 lg:py-20 prose-style">
      <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-warmbrown-600">
        Legal
      </span>
      <h1 className="mt-3 font-display text-5xl leading-tight text-forest-800">
        Privacy policy
      </h1>
      <p className="mt-4 text-sm text-warmbrown-500">Last updated: 6 May 2026</p>

      <div className="mt-10 grid gap-8 text-base leading-relaxed text-warmbrown-600">
        <Section title="1. Who we are">
          Bayt Noor BV, established in Antwerp, Belgium, is the data controller for the
          personal information collected through this website. You can reach us at
          hallo@baytnoor.com for any privacy-related questions.
        </Section>

        <Section title="2. What data we collect">
          We collect: name, email, shipping and billing address, phone number, order
          history, IP address, browser type and pages visited. We never collect or store
          full card details — payments are processed by our PCI-DSS certified providers
          (Stripe, Mollie, PayPal).
        </Section>

        <Section title="3. Why we collect it">
          To process your orders, deliver your products, provide customer service, send
          you newsletters (with your consent) and improve our website. We do not sell
          your data to third parties.
        </Section>

        <Section title="4. Cookies">
          We use essential cookies to keep your shopping bag working, and optional
          analytics cookies (Google Analytics) to understand usage. You can control
          cookies through our consent banner.
        </Section>

        <Section title="5. Your rights (GDPR)">
          You have the right to access, correct, delete or export your data, and to
          object to processing. Contact us at hallo@baytnoor.com to exercise any of
          these rights.
        </Section>

        <Section title="6. Data retention">
          We keep order data for 7 years to comply with Belgian tax law. Newsletter
          data is kept until you unsubscribe.
        </Section>

        <Section title="7. Security">
          All data is encrypted in transit (256-bit SSL) and at rest. We follow
          industry best practices to keep your information safe.
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
