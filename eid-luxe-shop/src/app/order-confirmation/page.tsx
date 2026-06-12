import { CheckCircle2, Mail, Truck, Package } from "lucide-react";
import { LinkButton } from "@/components/ui/Button";

export default function OrderConfirmationPage() {
  const orderId = "BN-" + Math.floor(Math.random() * 900000 + 100000);

  return (
    <section className="relative overflow-hidden bg-cream-100">
      <svg
        className="absolute inset-0 h-full w-full opacity-[0.04]"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 200 200"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <pattern id="conf-pat" x="0" y="0" width="48" height="48" patternUnits="userSpaceOnUse">
            <path d="M24 4 L44 24 L24 44 L4 24 Z" fill="none" stroke="#3a4527" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="200" height="200" fill="url(#conf-pat)" />
      </svg>

      <div className="relative mx-auto max-w-3xl px-4 py-20 text-center lg:px-6">
        <div className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-full bg-olive-600 shadow-soft">
          <CheckCircle2 size={28} className="text-cream-50" strokeWidth={1.6} />
        </div>
        <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-warmbrown-500">
          Alhamdulillah · barakallahu fik
        </span>
        <h1 className="mt-3 font-display text-5xl leading-tight text-forest-800 sm:text-6xl">
          Bedankt voor je vertrouwen.
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-warmbrown-600">
          Je bestelling{" "}
          <span className="font-medium text-forest-800">#{orderId}</span> is
          binnen. Wij gaan ze met zorg voor je inpakken, in shaa Allah.
        </p>

        <div className="mx-auto mt-10 grid max-w-2xl gap-3 sm:grid-cols-3">
          <Step
            icon={<Mail size={16} strokeWidth={1.6} />}
            title="Bevestiging onderweg"
            desc="Kijk in je inbox (en spamfolder) voor het bewijs"
            active
          />
          <Step
            icon={<Package size={16} strokeWidth={1.6} />}
            title="Met onze handen ingepakt"
            desc="Met handgeschreven kaartje"
          />
          <Step
            icon={<Truck size={16} strokeWidth={1.6} />}
            title="Op weg naar jou"
            desc="Tracking volgt zodra het pakket vertrekt"
          />
        </div>

        <div className="mx-auto mt-10 max-w-md rounded-2xl border border-cream-200 bg-cream-50 p-6 text-left text-sm">
          <h3 className="font-display text-xl text-forest-800">Wat er nu gebeurt</h3>
          <ol className="mt-4 grid gap-3 text-warmbrown-700">
            <li>1. Je krijgt een bevestiging per e-mail, meestal binnen enkele minuten.</li>
            <li>2. We pakken je bestelling met liefde in, doorgaans binnen 24 uur.</li>
            <li>3. Zodra je pakket vertrekt, krijg je een tracking-link.</li>
            <li>4. Je ontvangt het, en in shaa Allah brengt het glimlach en baraka.</li>
          </ol>
        </div>

        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <LinkButton href="/" variant="primary">Terug naar home</LinkButton>
          <LinkButton href="/shop" variant="ghost">Verder kijken</LinkButton>
        </div>

        <p className="mt-12 font-display text-2xl italic text-warmbrown-600">
          Eid Mubarak, en barakallahu fikum.
        </p>
      </div>
    </section>
  );
}

function Step({
  icon,
  title,
  desc,
  active,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  active?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 text-center ${
        active ? "border-olive-200 bg-cream-50" : "border-cream-200 bg-cream-50/60"
      }`}
    >
      <span
        className={`mx-auto mb-2 grid h-9 w-9 place-items-center rounded-full ${
          active ? "bg-olive-600 text-cream-50" : "bg-cream-200 text-warmbrown-500"
        }`}
      >
        {icon}
      </span>
      <p className="text-sm font-medium text-forest-800">{title}</p>
      <p className="text-xs text-warmbrown-500">{desc}</p>
    </div>
  );
}
