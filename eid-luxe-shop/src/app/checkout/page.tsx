"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CreditCard, Lock, Truck, ChevronRight } from "lucide-react";
import { useCart } from "@/lib/store";
import { Price } from "@/components/ui/Price";
import { ProductImage } from "@/components/ui/ProductImage";
import { Button, LinkButton } from "@/components/ui/Button";

export default function CheckoutPage() {
  const router = useRouter();
  const { items, subtotal, clear } = useCart();
  const [shipMethod, setShipMethod] = useState("standard");
  const [payMethod, setPayMethod] = useState("card");
  const [submitting, setSubmitting] = useState(false);

  const total = subtotal();
  const shippingFee =
    shipMethod === "express" ? 14.95 : total > 120 ? 0 : 7.95;
  const grand = total + shippingFee;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setTimeout(() => {
      clear();
      router.push("/order-confirmation");
    }, 900);
  };

  if (items.length === 0) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-20 text-center lg:px-6">
        <h1 className="font-display text-4xl text-forest-800">Je mandje is leeg.</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-warmbrown-500">
          Kies eerst rustig iets moois voor wie je liefhebt.
        </p>
        <LinkButton href="/shop" variant="primary" className="mt-6">
          Naar de shop
        </LinkButton>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 lg:px-6">
      <nav className="flex items-center gap-1.5 text-xs text-warmbrown-500">
        <Link href="/cart" className="hover:text-forest-700">Mandje</Link>
        <ChevronRight size={12} />
        <span className="text-forest-700">Afrekenen</span>
      </nav>
      <h1 className="mt-3 font-display text-4xl text-forest-800 sm:text-5xl">
        Rustig afronden.
      </h1>
      <p className="mt-2 max-w-xl text-sm text-warmbrown-600">
        Veilig betalen, en wij zorgen dat je pakket met zorg vertrekt.
      </p>

      <form onSubmit={onSubmit} className="mt-10 grid gap-10 lg:grid-cols-[1fr_400px]">
        {/* Left: form */}
        <div className="grid gap-8">
          <Section title="Hoe kunnen we je bereiken?" step="01">
            <Field label="E-mailadres" type="email" required placeholder="jij@voorbeeld.com" />
            <label className="flex cursor-pointer items-center gap-2 text-xs text-warmbrown-600">
              <input type="checkbox" className="accent-olive-600" defaultChecked />
              Houd me rustig op de hoogte van nieuwe collecties
            </label>
          </Section>

          <Section title="Waar mag het pakket naartoe?" step="02">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Voornaam" required />
              <Field label="Achternaam" required />
            </div>
            <Field label="Straat en huisnummer" required />
            <Field label="Bus / appartement (optioneel)" />
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Postcode" required />
              <Field label="Gemeente" required className="sm:col-span-2" />
            </div>
            <FieldSelect
              label="Land"
              options={[
                "België",
                "Nederland",
                "Frankrijk",
                "Duitsland",
                "Verenigd Koninkrijk",
                "Verenigde Staten",
                "Ander land (wereldwijd)",
              ]}
              required
            />
            <Field label="Telefoon (enkel voor de levering)" type="tel" />
          </Section>

          <Section title="Hoe versturen we het?" step="03">
            <RadioCard
              checked={shipMethod === "standard"}
              onChange={() => setShipMethod("standard")}
              title="Wereldwijd standaard"
              meta={total > 120 ? "Gratis" : "€7,95"}
              desc="3-5 werkdagen · met track & trace"
              icon={<Truck size={18} />}
            />
            <RadioCard
              checked={shipMethod === "express"}
              onChange={() => setShipMethod("express")}
              title="Express binnen de EU"
              meta="€14,95"
              desc="1-2 werkdagen · met voorrang"
              icon={<Truck size={18} />}
            />
          </Section>

          <Section title="Hoe wil je betalen?" step="04">
            <RadioCard
              checked={payMethod === "bancontact"}
              onChange={() => setPayMethod("bancontact")}
              title="Bancontact"
              desc="Belgisch bankieren"
              icon={<CreditCard size={18} />}
            />
            <RadioCard
              checked={payMethod === "ideal"}
              onChange={() => setPayMethod("ideal")}
              title="iDEAL"
              desc="Nederlands bankieren"
              icon={<CreditCard size={18} />}
            />
            <RadioCard
              checked={payMethod === "card"}
              onChange={() => setPayMethod("card")}
              title="Kaart"
              desc="Visa, Mastercard, American Express"
              icon={<CreditCard size={18} />}
            />
            <RadioCard
              checked={payMethod === "paypal"}
              onChange={() => setPayMethod("paypal")}
              title="PayPal"
              desc="Met je PayPal-account"
              icon={<CreditCard size={18} />}
            />

            {payMethod === "card" && (
              <div className="mt-3 grid gap-3 rounded-xl border border-cream-200 bg-cream-100/50 p-4">
                <Field label="Kaartnummer" placeholder="1234 5678 9012 3456" />
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Vervaldatum" placeholder="MM/JJ" className="sm:col-span-2" />
                  <Field label="CVC" placeholder="123" />
                </div>
                <Field label="Naam op de kaart" />
              </div>
            )}
          </Section>
        </div>

        {/* Right: summary */}
        <aside>
          <div className="sticky top-32 rounded-3xl border border-cream-200 bg-cream-50 p-6 shadow-card">
            <h3 className="font-display text-2xl text-forest-800">Je bestelling</h3>
            <ul className="mt-5 grid gap-3 border-b border-cream-200 pb-5">
              {items.map((it) => (
                <li key={it.product.id} className="flex gap-3">
                  <div className="relative">
                    <ProductImage
                      slug={it.product.slug}
                      accent={it.product.imageAccent}
                      alt={it.product.name}
                      className="h-14 w-14 rounded-lg"
                    />
                    <span className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-forest-700 text-[10px] font-semibold text-cream-50">
                      {it.quantity}
                    </span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium leading-tight text-forest-800">
                      {it.product.name}
                    </p>
                    <Price amount={it.product.price * it.quantity} size="sm" className="mt-1" />
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-5 grid gap-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-warmbrown-500">Subtotaal</span>
                <Price amount={total} size="sm" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-warmbrown-500">Verzending</span>
                <span className="text-forest-800">
                  {shippingFee === 0 ? "Gratis" : <Price amount={shippingFee} size="sm" />}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between border-t border-cream-300 pt-3">
                <span className="font-medium text-forest-800">Totaal</span>
                <Price amount={grand} size="lg" />
              </div>
            </div>
            <Button type="submit" variant="primary" fullWidth className="mt-6" disabled={submitting}>
              <Lock size={14} />
              {submitting ? "Even geduld…" : "Bestelling bevestigen"}
            </Button>
            <p className="mt-4 flex items-center justify-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-warmbrown-500">
              <Lock size={10} /> Veilig en versleuteld
            </p>
          </div>
        </aside>
      </form>
    </section>
  );
}

function Section({
  title,
  step,
  children,
}: {
  title: string;
  step: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-cream-200 bg-cream-50 p-6">
      <div className="mb-4 flex items-center gap-3">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-forest-700 text-[10px] font-semibold text-cream-50">
          {step}
        </span>
        <h2 className="font-display text-xl text-forest-800">{title}</h2>
      </div>
      <div className="grid gap-3">{children}</div>
    </section>
  );
}

function Field({
  label,
  type = "text",
  required,
  placeholder,
  className,
}: {
  label: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  className?: string;
}) {
  return (
    <label className={`block ${className || ""}`}>
      <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-warmbrown-600">
        {label}
        {required && <span className="text-gold-400"> *</span>}
      </span>
      <input
        type={type}
        required={required}
        placeholder={placeholder}
        className="mt-1.5 block w-full rounded-xl border border-cream-300 bg-cream-50 px-4 py-2.5 text-sm text-forest-800 placeholder:text-warmbrown-400 focus:border-forest-400 focus:outline-none focus:ring-2 focus:ring-forest-200"
      />
    </label>
  );
}

function FieldSelect({
  label,
  options,
  required,
}: {
  label: string;
  options: string[];
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-warmbrown-600">
        {label}
        {required && <span className="text-gold-400"> *</span>}
      </span>
      <select
        required={required}
        defaultValue=""
        className="mt-1.5 block w-full rounded-xl border border-cream-300 bg-cream-50 px-4 py-2.5 text-sm text-forest-800 focus:border-forest-400 focus:outline-none focus:ring-2 focus:ring-forest-200"
      >
        <option value="" disabled>Select…</option>
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </label>
  );
}

function RadioCard({
  checked,
  onChange,
  title,
  desc,
  meta,
  icon,
}: {
  checked: boolean;
  onChange: () => void;
  title: string;
  desc: string;
  meta?: string;
  icon: React.ReactNode;
}) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-3 rounded-2xl border-2 p-4 transition-colors ${
        checked ? "border-forest-600 bg-cream-50" : "border-cream-200 bg-cream-50/50 hover:border-cream-300"
      }`}
    >
      <input type="radio" checked={checked} onChange={onChange} className="sr-only" />
      <span
        className={`grid h-9 w-9 place-items-center rounded-full ${
          checked ? "bg-forest-600 text-cream-50" : "bg-cream-100 text-warmbrown-500"
        }`}
      >
        {icon}
      </span>
      <div className="flex-1">
        <p className="text-sm font-medium text-forest-800">{title}</p>
        <p className="text-xs text-warmbrown-500">{desc}</p>
      </div>
      {meta && <span className="text-sm font-medium text-forest-800">{meta}</span>}
    </label>
  );
}
