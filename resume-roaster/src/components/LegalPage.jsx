import { LEGAL, legalAddressLine } from '../legal/config'

function DraftBanner() {
  return (
    <div className="mb-8 p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-200 text-sm">
      <strong>Draft — to be reviewed by a lawyer.</strong> This text is a concept and has not yet been
      checked by a legal professional.
    </div>
  )
}

function H2({ children }) {
  return <h2 className="text-xl font-bold text-white mt-10 mb-3">{children}</h2>
}

function P({ children }) {
  return <p className="text-zinc-300 leading-relaxed mb-3">{children}</p>
}

function UL({ children }) {
  return <ul className="list-disc pl-6 space-y-1.5 text-zinc-300 leading-relaxed mb-3">{children}</ul>
}

function Operator() {
  return (
    <P>
      {LEGAL.name}, company number {LEGAL.companyNumber}, registered office: {legalAddressLine()}.
      Contact: <a className="text-flame-400 underline" href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>.
    </P>
  )
}

export function PrivacyPolicy() {
  return (
    <article>
      <DraftBanner />
      <h1 className="text-4xl font-black text-white mb-2">Privacy Policy</h1>
      <p className="text-sm text-zinc-500 mb-8">Last updated: {LEGAL.lastUpdated}</p>

      <H2>1. Who is responsible for your data?</H2>
      <P>The controller of the personal data processed through Resume Roaster is:</P>
      <Operator />

      <H2>2. What data we process</H2>
      <UL>
        <li>
          <strong>Your resume content</strong> — the text you paste or the PDF/TXT file you upload. A
          resume usually contains personal data such as your name, contact details, work history and
          education.
        </li>
        <li>
          <strong>Technical data</strong> — your IP address and basic request data (time, size, status
          code). We use your IP address only in memory to enforce rate limits.
        </li>
      </UL>
      <P>
        Please remove information you do not want to share before submitting (for example your home
        address, phone number, date of birth, photo, or any sensitive data such as health information,
        religion or political opinions). We do not need that information to review your resume.
      </P>

      <H2>3. Why we process it and on what legal basis</H2>
      <UL>
        <li>
          To generate the review you request — necessary to provide the service you ask for (Art. 6(1)(b)
          GDPR).
        </li>
        <li>
          To protect the service against abuse and excessive costs (rate limiting, daily caps, security
          logs without resume content) — our legitimate interest (Art. 6(1)(f) GDPR).
        </li>
      </UL>

      <H2>4. Transfer to Anthropic (United States)</H2>
      <P>
        To create the review, your resume text is sent to <strong>Anthropic PBC</strong> (San Francisco,
        USA), the provider of the Claude AI model, which processes it on our behalf. This is a transfer of
        personal data outside the European Economic Area. The transfer is based on the European
        Commission&apos;s Standard Contractual Clauses included in Anthropic&apos;s Data Processing Addendum
        and, where applicable, the EU-U.S. Data Privacy Framework. Under Anthropic&apos;s commercial terms,
        API data is not used to train its models and is retained only for a limited period (for example for
        trust &amp; safety purposes). See Anthropic&apos;s privacy information at{' '}
        <a className="text-flame-400 underline" href="https://www.anthropic.com/legal/privacy" target="_blank" rel="noopener noreferrer">
          anthropic.com/legal/privacy
        </a>.
      </P>
      <P>
        Our hosting provider stores and serves the application on our behalf, in an EU region, and may keep
        standard access logs (IP address, time, URL) for a short period.
      </P>

      <H2>5. How long we keep your data</H2>
      <UL>
        <li>
          <strong>Resume content:</strong> we do not store it. It is processed in memory, sent to Anthropic,
          and discarded as soon as the response is returned. We do not write resume content to our logs.
        </li>
        <li>
          <strong>Your review:</strong> shown only in your browser; we do not keep a copy.
        </li>
        <li>
          <strong>IP address for rate limiting:</strong> kept in memory for at most the rate-limit window
          (by default one hour).
        </li>
      </UL>

      <H2>6. Cookies and tracking</H2>
      <P>
        Resume Roaster does not use cookies, analytics, advertising trackers or third-party fonts. Fonts are
        served from our own server. If this ever changes, we will update this policy and ask for your
        consent where required.
      </P>

      <H2>7. Automated assessment</H2>
      <P>
        The score and comments are generated automatically by an AI model, for your own information and
        entertainment. They do not produce legal effects for you and are not a decision about you. The
        output can be wrong or incomplete.
      </P>

      <H2>8. Minimum age</H2>
      <P>Resume Roaster is intended for users aged 16 and over.</P>

      <H2>9. Your rights</H2>
      <P>
        You have the right to access, rectify and erase your personal data, to restrict or object to its
        processing, and to data portability. Because we do not store resumes, there is usually nothing for us
        to retrieve after your session. Contact us at{' '}
        <a className="text-flame-400 underline" href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>.
      </P>
      <P>
        You may also lodge a complaint with the Belgian Data Protection Authority
        (Gegevensbeschermingsautoriteit / Autorité de protection des données), Drukpersstraat 35, 1000
        Brussels —{' '}
        <a className="text-flame-400 underline" href="https://www.dataprotectionauthority.be" target="_blank" rel="noopener noreferrer">
          dataprotectionauthority.be
        </a>.
      </P>

      <H2>10. Changes</H2>
      <P>We may update this policy. The date at the top shows the latest version.</P>
    </article>
  )
}

export function Terms() {
  return (
    <article>
      <DraftBanner />
      <h1 className="text-4xl font-black text-white mb-2">Terms of Use</h1>
      <p className="text-sm text-zinc-500 mb-8">Last updated: {LEGAL.lastUpdated}</p>

      <H2>1. Operator</H2>
      <P>Resume Roaster is operated by:</P>
      <Operator />

      <H2>2. The service</H2>
      <P>
        Resume Roaster lets you submit a resume and receive an AI-generated, humorous but constructive
        review. The service is currently provided free of charge, without an account, and may be limited per
        user and per day. We may change, limit or stop the service at any time.
      </P>

      <H2>3. AI-generated output</H2>
      <UL>
        <li>All feedback is generated by an AI model (Claude, by Anthropic) and is clearly AI-generated.</li>
        <li>
          It may be inaccurate, incomplete or blunt by design. It is not professional career, legal or HR
          advice. You decide what you do with it.
        </li>
      </UL>

      <H2>4. Your use of the service</H2>
      <UL>
        <li>You must be at least 16 years old.</li>
        <li>Only submit your own resume, or one you are authorised to share.</li>
        <li>
          Do not use the service to evaluate, rank or select job applicants or employees. It is designed for
          self-review only.
        </li>
        <li>
          Do not abuse the service: no automated or bulk requests, no attempts to bypass limits, no attempts
          to make the AI produce unlawful or harmful content, and no use of the API from other websites or
          applications.
        </li>
      </UL>

      <H2>5. Your content</H2>
      <P>
        You keep all rights to your resume. You give us the limited permission needed to process it to
        generate your review, as described in the{' '}
        <a className="text-flame-400 underline" href="/privacy">Privacy Policy</a>. You may freely use the
        review you receive.
      </P>

      <H2>6. Liability</H2>
      <P>
        The service is provided &quot;as is&quot;. To the extent permitted by law, we are not liable for indirect
        damage or for decisions you take based on the AI output. Nothing in these terms limits liability for
        intent, gross negligence, death or personal injury, or your mandatory rights as a consumer.
      </P>

      <H2>7. Applicable law</H2>
      <P>
        These terms are governed by Belgian law. Disputes are submitted to the competent courts of Belgium,
        without prejudice to mandatory consumer-protection rules of your country of residence. Consumers can
        also use the Belgian Consumer Mediation Service (consumentenombudsdienst.be).
      </P>

      <H2>8. Contact</H2>
      <P>
        Questions? Email <a className="text-flame-400 underline" href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>.
      </P>
    </article>
  )
}

export default function LegalPage({ page }) {
  return (
    <section className="max-w-3xl mx-auto px-6 py-16">
      <a href="/" className="text-sm text-zinc-500 hover:text-white">&larr; Back to Resume Roaster</a>
      <div className="mt-6">{page === 'privacy' ? <PrivacyPolicy /> : <Terms />}</div>
    </section>
  )
}
