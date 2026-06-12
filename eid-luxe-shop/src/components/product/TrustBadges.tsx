import { Truck, ShieldCheck, Gift, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { icon: Truck, title: "Wereldwijd verzonden", desc: "Vanuit Antwerpen, in 3-5 werkdagen" },
  { icon: ShieldCheck, title: "Veilig betalen", desc: "Bancontact, iDEAL, kaart, PayPal" },
  { icon: Gift, title: "Met liefde verpakt", desc: "Met handgeschreven kaartje" },
  { icon: MessageCircle, title: "Persoonlijke service", desc: "Wij antwoorden zelf, in NL/EN/FR" },
];

export function TrustBadges({
  variant = "row",
  className,
}: {
  variant?: "row" | "compact";
  className?: string;
}) {
  if (variant === "compact") {
    return (
      <div className={cn("grid grid-cols-2 gap-3", className)}>
        {ITEMS.map((it) => (
          <div
            key={it.title}
            className="flex items-center gap-2.5 rounded-xl border border-cream-200 bg-cream-50 px-3 py-2.5"
          >
            <it.icon size={17} className="text-olive-600" strokeWidth={1.6} />
            <div>
              <p className="text-xs font-medium text-forest-800">{it.title}</p>
              <p className="text-[10px] text-warmbrown-500">{it.desc}</p>
            </div>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-4", className)}>
      {ITEMS.map((it) => (
        <div
          key={it.title}
          className="flex items-start gap-4 rounded-2xl border border-cream-200 bg-cream-50 p-5"
        >
          <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl bg-cream-200 text-olive-600">
            <it.icon size={18} strokeWidth={1.6} />
          </span>
          <div>
            <p className="font-medium text-forest-800">{it.title}</p>
            <p className="mt-0.5 text-sm text-warmbrown-500">{it.desc}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
