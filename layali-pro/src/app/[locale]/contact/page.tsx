import { getTranslations } from "next-intl/server";
import { Mail, MapPin } from "lucide-react";
import { legalEntity } from "@/lib/legal";
import ContactForm from "./ContactForm";

export const dynamic = "force-dynamic";

export default async function ContactPage() {
  const t = await getTranslations("common");
  const legal = legalEntity();
  // Gegevens van de verkoper uit src/lib/legal.ts (adres via LEGAL_ENTITY_ADDRESS).
  const items = [
    legal.email ? { icon: Mail, label: "E-mail", value: legal.email } : null,
    { icon: MapPin, label: "Adres", value: legal.displayAddress },
  ].filter((i): i is { icon: typeof Mail; label: string; value: string } => i !== null);

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-16">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold tracking-tight font-[family-name:var(--font-heading)]">{t("contact")}</h1>
        <p className="mt-3 text-muted-foreground">Neem contact met ons op. We helpen je graag!</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="space-y-6">
          {items.map((item) => (
            <div key={item.label} className="flex items-start gap-4 p-6 rounded-2xl border border-border bg-white">
              <div className="h-10 w-10 rounded-full bg-sage/20 flex items-center justify-center shrink-0">
                <item.icon className="h-5 w-5 text-emerald" />
              </div>
              <div>
                <p className="font-semibold text-sm">{item.label}</p>
                <p className="text-sm text-muted-foreground">{item.value}</p>
              </div>
            </div>
          ))}
          <p className="px-2 text-xs text-muted-foreground">{legal.name} · {legal.vat}</p>
        </div>
        <div className="lg:col-span-2">
          <ContactForm />
        </div>
      </div>
    </div>
  );
}
