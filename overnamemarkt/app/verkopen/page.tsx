import type { Metadata } from "next";
import Link from "next/link";
import { SellForm } from "@/components/SellForm";
import { getViewer } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Je online bedrijf verkopen" };

export default async function SellPage() {
  const { user } = await getViewer();
  return (
    <>
      <section className="head">
        <p className="eyebrow">Voor verkopers</p>
        <h1>Bied je online bedrijf aan</h1>
        <p>Je aanbieding wordt eerst gecontroleerd en pas daarna gepubliceerd. Je naam en e-mailadres worden nooit publiek getoond. Kopers nemen contact op via ons.</p>
      </section>
      <div className="rules">
        <strong>Wat dit platform doet en niet doet</strong>
        <p>Het brengt kopers en verkopers met elkaar in contact. Het geeft geen waardering, prijs-, juridisch of fiscaal advies, regelt geen betalingen en onderhandelt niet. Sluit een verkoop altijd af met je eigen accountant en advocaat. Lees ook de <Link href="/voorwaarden">voorwaarden</Link>.</p>
      </div>
      {user ? (
        <SellForm defaultEmail={user.email ?? ""} />
      ) : (
        <div className="panel">
          <h2>Meld je eerst aan</h2>
          <p>Je hebt alleen een e-mailadres nodig. We sturen je een aanmeldlink, zonder wachtwoord.</p>
          <p><Link className="btn primary" href="/login?next=/verkopen">Aanmelden</Link></p>
        </div>
      )}
    </>
  );
}
