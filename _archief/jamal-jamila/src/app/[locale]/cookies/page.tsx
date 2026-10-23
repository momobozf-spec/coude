import type { Metadata } from "next";

export const metadata: Metadata = { title: "Cookiebeleid" };

export default function CookiesPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16">
      <h1 className="text-4xl font-bold tracking-tight font-[family-name:var(--font-heading)] mb-8">Cookiebeleid</h1>
      <div className="prose prose-neutral max-w-none space-y-6 text-sm text-muted-foreground leading-relaxed">
        <p>Laatst bijgewerkt: juni 2026</p>

        <h2 className="text-lg font-semibold text-foreground font-[family-name:var(--font-heading)] mt-8">Wat zijn cookies?</h2>
        <p>Cookies zijn kleine tekstbestanden die op je apparaat worden opgeslagen wanneer je onze website bezoekt. Ze helpen ons de website goed te laten werken en je ervaring te verbeteren.</p>

        <h2 className="text-lg font-semibold text-foreground font-[family-name:var(--font-heading)] mt-8">Welke cookies gebruiken wij?</h2>
        <ul className="list-disc pl-5 space-y-2">
          <li><strong>Functionele cookies</strong> — noodzakelijk voor de werking van de webshop (zoals je winkelmandje en inlogsessie). Deze kun je niet uitschakelen.</li>
          <li><strong>Analytische cookies</strong> — helpen ons begrijpen hoe bezoekers de site gebruiken (bijv. Google Analytics). Alleen geplaatst met jouw toestemming.</li>
          <li><strong>Marketingcookies</strong> — gebruikt voor relevante advertenties (bijv. Meta Pixel, TikTok Pixel). Alleen geplaatst met jouw toestemming.</li>
        </ul>

        <h2 className="text-lg font-semibold text-foreground font-[family-name:var(--font-heading)] mt-8">Je toestemming beheren</h2>
        <p>Bij je eerste bezoek vragen we toestemming voor niet-functionele cookies. Je kunt je voorkeuren op elk moment aanpassen of je toestemming intrekken via je browserinstellingen.</p>

        <h2 className="text-lg font-semibold text-foreground font-[family-name:var(--font-heading)] mt-8">Contact</h2>
        <p>Vragen over ons cookiebeleid? Mail ons op hello@layali.shop.</p>
      </div>
    </div>
  );
}
