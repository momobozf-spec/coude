import type { LegalTexts } from "./types";

// Translation of the Dutch version (nl.ts), which prevails in case of discrepancy.
export const en: LegalTexts = {
  privacy: {
    title: "Privacy Policy",
    sections: [
      {
        h: "1. Who is responsible?",
        p: [
          "Noor Printables is operated by {NAME}, company number {CBE}, registered office at {ADDRESS} (\"we\"). We are the controller of the personal data processed through Noor Printables. Contact: {EMAIL}.",
        ],
      },
      {
        h: "2. Who is Noor Printables for? (children)",
        p: [
          "Noor Printables creates worksheets for children aged 4 to 8, but the service is intended for adults: parents, guardians, teachers and schools. Only people aged 18 or over may create an account; you confirm this when registering.",
          "Children do not create accounts and we do not ask for children's personal data. In Belgium, children under 13 cannot consent themselves to the processing of their data by online services (Art. 8 GDPR and Art. 7 of the Belgian Act of 30 July 2018); they only use the worksheets or digital coloring through the account and under the supervision of a parent, guardian or teacher.",
          "Do not enter children's names or other data in free-text fields (e.g. a worksheet theme). If you believe a child has created an account or entered a child's data, contact us and we will delete it.",
          "Optional modules that could ask for data about a child (e.g. a first name and age for a certificate) are switched off by default. If they are enabled later, only the parent or guardian enters such data, with their consent, limited to what is necessary, and it can be deleted at any time.",
        ],
      },
      {
        h: "3. What data do we process?",
        ul: [
          "Account data: name, e-mail address, password (only as an encrypted hash) or — when signing in with Google, Microsoft or Apple — that provider's unique ID and your profile picture if provided.",
          "Usage data: which worksheets you create (type, theme, date) and how many, your plan, your referral code and who invited you, if anyone.",
          "Payment data: payments are handled by Stripe. We do not receive card or account numbers; we store your Stripe customer ID, subscription ID and subscription status.",
          "School billing data: school name, contact person, e-mail, billing address and VAT number when you request an invoice.",
          "Communication: e-mails you send us and the transactional e-mails we send you (e.g. welcome, upgrade confirmation).",
          "Technical data: IP address and technical logs at our hosting provider, and the cookies needed to keep you logged in (see our cookie policy).",
          "Only with your consent: analytics data via Google Analytics (see cookie policy).",
        ],
      },
      {
        h: "4. Why, and on what legal basis?",
        ul: [
          "To provide your account and the service (generating worksheets, managing your subscription, support) — performance of the contract (Art. 6(1)(b) GDPR).",
          "To process payments and keep our accounts — performance of the contract and legal obligation (Art. 6(1)(b) and (c) GDPR).",
          "To secure the service and prevent abuse (e.g. limits, referral fraud prevention) — our legitimate interest (Art. 6(1)(f) GDPR).",
          "To analyse and improve the website with analytics cookies — only with your consent (Art. 6(1)(a) GDPR), which you can withdraw at any time.",
          "We do not send marketing e-mails without your prior consent. We do not sell your data and do not carry out profiling or automated decision-making with legal effects.",
        ],
      },
      {
        h: "5. Who do we share data with?",
        p: [
          "We use the following processors, which only use your data on our instructions: our hosting provider (e.g. Vercel) and database provider (e.g. Turso), preferably in an EU region; Stripe Payments Europe Ltd. (Ireland) for payments; Resend for sending e-mails; and Google, Microsoft or Apple only if you sign in with them. Google Analytics is only used after your consent.",
          "Some of these parties are established in the United States or can access data there. Such transfers outside the European Economic Area are based on the EU-U.S. Data Privacy Framework (for certified companies) or the European Commission's Standard Contractual Clauses.",
          "We only disclose data to authorities when required by law.",
        ],
      },
      {
        h: "6. How long do we keep your data?",
        ul: [
          "Account and usage data: as long as your account exists. After your account is deleted we erase it within 30 days, except what we are legally required to keep.",
          "Invoices and accounting documents: for the statutory retention period for accounting records.",
          "Technical logs: as briefly as possible, usually at most 30 days (depending on the hosting provider).",
          "Your cookie choice: until you change it or clear your browser data.",
        ],
      },
      {
        h: "7. Security",
        p: ["Passwords are only stored as bcrypt hashes, all connections use HTTPS, and access to admin functions is limited to administrators with a personal account."],
      },
      {
        h: "8. Your rights",
        p: [
          "You have the right of access, rectification, erasure, restriction of processing, data portability and to object to processing based on our legitimate interest. You can withdraw consent at any time. Send your request to {EMAIL}; we reply within one month.",
          "If you are not satisfied, you can lodge a complaint with the Belgian Data Protection Authority, Drukpersstraat/Rue de la Presse 35, 1000 Brussels, contact@apd-gba.be, www.dataprotectionauthority.be.",
        ],
      },
      {
        h: "9. Changes",
        p: ["We may update this policy. The date of the latest version is shown at the top. We notify registered users of important changes by e-mail."],
      },
    ],
  },

  terms: {
    title: "Terms of Use",
    sections: [
      {
        h: "1. Who we are",
        p: [
          "Noor Printables is provided by {NAME}, company and VAT number {CBE}, registered office: {ADDRESS}, e-mail: {EMAIL}.",
          "These terms apply to any use of Noor Printables and to every free or paid subscription.",
        ],
      },
      {
        h: "2. Account",
        ul: [
          "You must be 18 or older to create an account. Children only use the service under the supervision of a parent, guardian or teacher.",
          "You provide accurate information and keep your password secret. You are responsible for the use of your account.",
          "You can have your account deleted at any time via {EMAIL}.",
        ],
      },
      {
        h: "3. The service",
        p: [
          "With Noor Printables you create Islamic worksheets (coloring pages, mazes, word searches) as PDF and can color digitally. The free plan allows a limited number of worksheets; Pro and School give unlimited worksheets.",
          "We do our best to display religious texts, Arabic letters and translations correctly. If you notice an error, please report it so we can fix it.",
          "We aim for good availability but cannot guarantee uninterrupted operation. We may change or add features; we announce material changes to a paid subscription in advance.",
        ],
      },
      {
        h: "4. Prices, payment and renewal",
        ul: [
          "Current prices are shown on the website and include VAT for consumers. You always see the amount you will pay before confirming on the Stripe payment page.",
          "Pro and School subscriptions run monthly or yearly and renew automatically for the same period until you cancel.",
          "You can cancel at any time via your account (Stripe customer portal). Cancellation takes effect at the end of the current paid period; no refund is given for that period, except in case of withdrawal (section 5) or where required by law.",
          "We notify you of a price change at least 30 days in advance. If you do not agree, you can cancel before the new price applies.",
          "If a payment fails, we keep your access temporarily; after repeated failed payments your account is moved to the free plan.",
        ],
      },
      {
        h: "5. Right of withdrawal (consumers)",
        p: [
          "As a consumer you have the right to withdraw from a paid subscription within 14 days of concluding it, without giving any reason.",
          "If you expressly request that the service starts immediately (by activating the subscription straight away), you pay an amount proportionate to what has been provided up to the moment of withdrawal.",
          "For worksheets you download as digital content, the right of withdrawal lapses once the download starts, if you expressly agreed to this beforehand and acknowledged that you thereby lose your right of withdrawal (Art. VI.53, 13° Belgian Code of Economic Law).",
          "To withdraw, send a clear statement to {EMAIL}, for example using this model form: \"To {NAME}, {ADDRESS}, {EMAIL}: I hereby give notice that I withdraw from my contract for the [Pro/School] subscription. Ordered on: [date]. Name: [name]. Account e-mail: [e-mail]. Date: [date].\" We refund the amount due within 14 days using the same payment method.",
        ],
      },
      {
        h: "6. Use of the worksheets (licence)",
        ul: [
          "You may print worksheets created with Noor Printables and use them in your own family and — with a Pro or School subscription — in your own classes and lessons, even if you are paid for those lessons.",
          "With a School subscription, the school may use the worksheets in its own classes.",
          "Not allowed: reselling worksheets (digital or printed) as such, distributing them publicly online or offering them in a competing service, and scraping the service automatically or in bulk.",
          "The software, designs and templates remain the property of {NAME} or its licensors.",
        ],
      },
      {
        h: "7. Fair use and abuse",
        p: ["You do not use the service for unlawful purposes, do not try to circumvent limits or security and do not create fake accounts (e.g. to obtain referral bonuses). In case of abuse we may withdraw bonuses, restrict access or terminate the account, after prior notice unless that is not reasonable."],
      },
      {
        h: "8. Liability",
        p: ["We provide the service with due care. To the extent permitted by law, we are not liable for indirect damage (such as lost profits). Our liability is in any case limited to the amount you paid in the 12 months before the event causing the damage. These limitations do not apply in case of intent, gross negligence, death or personal injury, and do not affect your mandatory rights as a consumer."],
      },
      {
        h: "9. Complaints and disputes",
        p: [
          "If you have a complaint, e-mail {EMAIL}; we reply within 14 days. Consumers can also contact the Belgian Consumer Mediation Service (www.consumentenombudsdienst.be).",
          "These terms are governed by Belgian law. Disputes are submitted to the competent courts; as a consumer you keep the protection of the mandatory rules of your place of residence.",
        ],
      },
      {
        h: "10. Changes",
        p: ["We may update these terms. We announce material changes at least 30 days in advance by e-mail; you can then cancel before they take effect."],
      },
    ],
  },

  cookies: {
    title: "Cookie Policy",
    sections: [
      {
        h: "1. What are cookies?",
        p: ["Cookies are small text files a website stores on your device. Similar techniques, such as local storage (localStorage) in your browser, are also covered by this policy."],
      },
      {
        h: "2. Strictly necessary cookies (no consent required)",
        ul: [
          "authjs.session-token / __Secure-authjs.session-token — keeps you logged in; up to 30 days.",
          "authjs.csrf-token / __Host-authjs.csrf-token — protection against forged requests; session.",
          "authjs.callback-url / __Secure-authjs.callback-url — remembers where to go after login; session.",
          "Local storage \"noor-locale\" — your language choice; until you clear it.",
          "Local storage \"noor-cookie-consent\" — your cookie choice; until you change or clear it.",
        ],
      },
      {
        h: "3. Analytics cookies (only with consent)",
        p: ["If you consent, we use Google Analytics (Google Ireland Ltd.) to measure use of the website, with truncated IP address. Cookies: _ga and _ga_<ID>, kept for up to 2 years. Without consent, Google Analytics is not loaded."],
      },
      {
        h: "4. Third-party cookies when paying",
        p: ["When paying you are redirected to Stripe. Stripe sets its own cookies there (e.g. for fraud prevention) under its own cookie policy."],
      },
      {
        h: "5. Managing your choice",
        p: ["You can change your choice at any time via \"Cookie settings\" at the bottom of every page, or delete cookies in your browser settings. Questions: {EMAIL}."],
      },
    ],
  },

  legal: {
    title: "Legal notice",
    sections: [
      {
        h: "Operator",
        ul: ["{NAME}", "Registered office: {ADDRESS}", "Company number (CBE) and VAT number: {CBE}", "E-mail: {EMAIL}"],
      },
      {
        h: "Documents",
        p: ["See also our privacy policy, terms of use and cookie policy (links at the bottom of every page)."],
      },
    ],
  },
};
