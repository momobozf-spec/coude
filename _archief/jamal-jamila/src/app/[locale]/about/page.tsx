import { getTranslations } from "next-intl/server";
import Image from "next/image";

export default async function AboutPage() {
  const t = await getTranslations("about");

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-16">
      <div className="text-center mb-16">
        <h1 className="text-4xl font-bold tracking-tight font-[family-name:var(--font-heading)]">{t("title")}</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center mb-20">
        <div className="relative aspect-[4/5] rounded-2xl overflow-hidden bg-muted">
          <Image
            src="https://picsum.photos/seed/layali-about/800/1000"
            alt="Layali — oriental lifestyle"
            fill
            className="object-cover"
          />
        </div>
        <div>
          <h2 className="text-2xl font-bold font-[family-name:var(--font-heading)] mb-4">Wie zijn wij?</h2>
          <p className="text-muted-foreground leading-relaxed mb-4">{t("content")}</p>
          <p className="text-muted-foreground leading-relaxed mb-4">
            Onze collectie is zorgvuldig samengesteld met oog voor sfeer, kwaliteit en beleving.
            Van Marokkaanse theeglazen en lantaarns tot geurkaarsen, home fragrance en sfeervolle
            cadeauboxen — bij Layali vind je alles om thuis een warme oosterse sfeer te creëren.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            Wij houden van de warmte en gastvrijheid van de Oriënt en laten dat terugkomen in elk
            product dat we aanbieden. Onze missie is eenvoudig: oriental lifestyle met karakter —
            warm, elegant en betaalbaar.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
        {[
          { value: "5000+", label: "Tevreden klanten" },
          { value: "Handmade", label: "Met zorg gemaakt" },
          { value: "BE & NL", label: "Snelle verzending" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-border p-8 bg-white">
            <p className="text-3xl font-bold text-emerald font-[family-name:var(--font-heading)]">{stat.value}</p>
            <p className="text-sm text-muted-foreground mt-2">{stat.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
