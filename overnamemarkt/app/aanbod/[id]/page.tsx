import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { InterestForm } from "@/components/InterestForm";
import { StatusChips } from "@/components/ListingCard";
import { getViewer } from "@/lib/auth";
import { dateNl, eur, formatMultiple, INTEREST_STATUS_LABEL, type ListingStatus } from "@/lib/format";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Listing = {
  id: string; owner_id: string; title: string; type: string; country: string; founded_year: number | null;
  asking_price: number; revenue_12m: number; profit_12m: number; customers: number | null;
  tech_stack: string; sale_reason: string; description: string; status: ListingStatus; published_at: string | null;
};

async function load(id: string) {
  if (!UUID.test(id)) return null;
  const viewer = await getViewer();
  const { data } = await viewer.supabase
    .from("listings")
    .select("id,owner_id,title,type,country,founded_year,asking_price,revenue_12m,profit_12m,customers,tech_stack,sale_reason,description,status,published_at")
    .eq("id", id)
    .maybeSingle();
  return data ? { viewer, listing: data as Listing } : null;
}

export async function generateMetadata(props: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await props.params;
  const res = await load(id).catch(() => null);
  if (!res) return { title: "Aanbieding niet gevonden" };
  return { title: res.listing.title, description: res.listing.description.slice(0, 155) };
}

export default async function ListingPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const res = await load(id);
  if (!res) notFound();
  const { viewer, listing: l } = res;
  const isOwner = viewer.user?.id === l.owner_id;
  const age = l.founded_year ? new Date().getFullYear() - l.founded_year : null;

  let existing: { created_at: string; status: string } | null = null;
  if (viewer.user && !isOwner) {
    const { data } = await viewer.supabase
      .from("interests").select("created_at,status").eq("listing_id", l.id).eq("buyer_id", viewer.user.id).maybeSingle();
    existing = data;
  }
  const open = l.status === "published" || l.status === "under_offer";

  return (
    <section className="panel">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <StatusChips l={l} />
        <Link className="btn small" href="/">Terug naar het aanbod</Link>
      </div>
      <h1 style={{ fontSize: "clamp(24px,4vw,34px)" }}>{l.title}</h1>
      <div className="detail-grid">
        <div><span>Vraagprijs</span><b>{eur(l.asking_price)}</b></div>
        <div><span>Omzet 12 mnd</span><b>{eur(l.revenue_12m)}</b></div>
        <div><span>Nettowinst 12 mnd</span><b>{eur(l.profit_12m)}</b></div>
        <div><span>Multiple</span><b>{formatMultiple(l.asking_price, l.profit_12m)}</b></div>
        <div><span>Betalende klanten</span><b>{l.customers != null ? l.customers.toLocaleString("nl-BE") : "—"}</b></div>
        <div><span>Gestart</span><b>{l.founded_year ? `${l.founded_year}${age !== null ? ` (${age} jaar)` : ""}` : "—"}</b></div>
      </div>
      <p className="prose">{l.description}</p>
      <p className="hint">
        {[l.sale_reason && `Reden van verkoop: ${l.sale_reason}`, l.tech_stack && `Technologie: ${l.tech_stack}`, l.published_at && `Gepubliceerd op ${dateNl(l.published_at)}`]
          .filter(Boolean).join(" · ")}
      </p>
      <p className="msg info">Cijfers zijn opgegeven door de verkoper en niet door ons gecontroleerd. Laat ze verifiëren door je eigen accountant vóór je een bod doet.</p>

      <div style={{ borderTop: "1px solid var(--line)", paddingTop: 18, display: "grid", gap: 14 }}>
        <h2 style={{ fontSize: 20 }}>Interesse tonen</h2>
        {isOwner ? (
          <p className="msg info">Dit is je eigen aanbieding. De interesse van kopers zie je als aantal op <Link href="/account">Mijn account</Link>.</p>
        ) : !open ? (
          <p className="msg info">Deze aanbieding staat niet meer open voor interesse.</p>
        ) : !viewer.user ? (
          <p>
            <Link className="btn primary" href={`/login?next=${encodeURIComponent(`/aanbod/${l.id}`)}`}>Meld je aan om interesse te tonen</Link>
          </p>
        ) : existing ? (
          <p className="msg ok">Je toonde interesse op {dateNl(existing.created_at)}. Status: {INTEREST_STATUS_LABEL[existing.status] ?? existing.status}.</p>
        ) : (
          <InterestForm listingId={l.id} defaultEmail={viewer.user.email ?? ""} />
        )}
      </div>
    </section>
  );
}
