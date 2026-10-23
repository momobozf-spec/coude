import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { withdrawListing } from "@/app/actions";
import { SubmitButton } from "@/components/SubmitButton";
import { getViewer } from "@/lib/auth";
import { countryName, dateNl, eur, INTEREST_STATUS_LABEL, STATUS_LABEL, type ListingStatus } from "@/lib/format";
import { site } from "@/lib/site";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Mijn account", robots: { index: false } };

type MyListing = { id: string; title: string; type: string; country: string; asking_price: number; status: ListingStatus; rejection_note: string; created_at: string };
type MyInterest = { id: string; created_at: string; status: string; listing_id: string; listings: { title: string } | null };

export default async function AccountPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const searchParams = await props.searchParams;
  const { supabase, user } = await getViewer();
  if (!user) redirect("/login?next=/account");

  const [{ data: listingsData }, { data: interestsData }] = await Promise.all([
    supabase.from("listings").select("id,title,type,country,asking_price,status,rejection_note,created_at").eq("owner_id", user.id).order("created_at", { ascending: false }),
    supabase.from("interests").select("id,created_at,status,listing_id,listings(title)").eq("buyer_id", user.id).order("created_at", { ascending: false }),
  ]);
  const listings = (listingsData ?? []) as MyListing[];
  const interests = (interestsData ?? []) as unknown as MyInterest[];
  const counts = await Promise.all(listings.map((l) => supabase.rpc("interest_count", { p_listing: l.id }).then((r) => (r.data as number) ?? 0)));

  return (
    <>
      <section className="head">
        <p className="eyebrow">Alleen voor jou zichtbaar</p>
        <h1>Mijn account</h1>
        <p>Aangemeld als {user.email}. Je aanbiedingen en de interesse die je toonde.</p>
      </section>
      {searchParams.ingediend === "1" && <p className="msg ok">Je aanbieding is ingediend. Na controle wordt ze gepubliceerd; je ziet de status hieronder.</p>}
      {searchParams.fout && <p className="msg err">Dat lukte niet. Probeer het opnieuw.</p>}

      <h2 className="sec">Mijn aanbiedingen</h2>
      {listings.length ? (
        <div className="tablewrap">
          <table>
            <thead><tr><th>Aanbieding</th><th>Vraagprijs</th><th>Ingediend</th><th>Status</th><th>Geïnteresseerden</th><th>Actie</th></tr></thead>
            <tbody>
              {listings.map((l, i) => (
                <tr key={l.id}>
                  <td>
                    {["published", "under_offer", "sold"].includes(l.status) ? <Link href={`/aanbod/${l.id}`}>{l.title}</Link> : l.title}
                    <span className="sub">{l.type} · {countryName(l.country)}</span>
                  </td>
                  <td className="mono">{eur(l.asking_price)}</td>
                  <td className="mono">{dateNl(l.created_at)}</td>
                  <td>
                    <span className={`chip st-${l.status}`}>{STATUS_LABEL[l.status]}</span>
                    {l.status === "rejected" && l.rejection_note && <span className="sub">{l.rejection_note}</span>}
                  </td>
                  <td className="mono">{counts[i]}</td>
                  <td>
                    {["pending", "published", "under_offer"].includes(l.status) ? (
                      <form action={withdrawListing} className="inline">
                        <input type="hidden" name="id" value={l.id} />
                        <SubmitButton className="btn small danger" pendingText="Bezig…">Intrekken</SubmitButton>
                      </form>
                    ) : <span className="sub">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty"><strong>Nog geen aanbiedingen</strong><p><Link href="/verkopen">Bied je bedrijf aan</Link>.</p></div>
      )}
      <p className="hint" style={{ marginTop: 8 }}>Geïnteresseerden zie je als aantal. Wij geven hun gegevens door zodra ze daar toestemming voor gaven.</p>

      <h2 className="sec">Mijn interesse</h2>
      {interests.length ? (
        <div className="tablewrap">
          <table>
            <thead><tr><th>Aanbieding</th><th>Verstuurd</th><th>Status</th></tr></thead>
            <tbody>
              {interests.map((i) => (
                <tr key={i.id}>
                  <td><Link href={`/aanbod/${i.listing_id}`}>{i.listings?.title ?? "Aanbieding"}</Link></td>
                  <td className="mono">{dateNl(i.created_at)}</td>
                  <td>{INTEREST_STATUS_LABEL[i.status] ?? i.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty"><strong>Nog geen interesse getoond</strong><p>Open een aanbieding in het <Link href="/">aanbod</Link> en klik op Interesse versturen.</p></div>
      )}

      <h2 className="sec">Je gegevens</h2>
      <p className="hint">Wil je je account en alle gegevens laten verwijderen? Mail naar {site.email} vanaf {user.email}. We verwijderen alles binnen 30 dagen.</p>
    </>
  );
}
