import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { adminDeleteListing, adminSetInterestStatus, adminSetListingStatus } from "@/app/actions";
import { SubmitButton } from "@/components/SubmitButton";
import { getViewer } from "@/lib/auth";
import { countryName, dateNl, eur, formatMultiple, INTEREST_STATUS_LABEL, STATUS_LABEL, type ListingStatus } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Beheer", robots: { index: false } };

type ContactEmbed = { email: string } | { email: string }[] | null;
/** PostgREST geeft een 1-op-1-relatie als object of als array terug, afhankelijk van de versie. */
function contactEmail(c: ContactEmbed | undefined): string {
  if (!c) return "—";
  if (Array.isArray(c)) return c[0]?.email ?? "—";
  return c.email ?? "—";
}

type AdminListing = {
  id: string; title: string; type: string; country: string; asking_price: number; revenue_12m: number; profit_12m: number;
  description: string; status: ListingStatus; created_at: string; listing_contacts: ContactEmbed;
};
type AdminInterest = {
  id: string; listing_id: string; message: string; contact_email: string; budget: string | null; status: string; created_at: string;
  listings: { title: string; listing_contacts: ContactEmbed } | null;
};

const ALL_STATUSES: ListingStatus[] = ["pending", "published", "under_offer", "sold", "rejected", "withdrawn"];

export default async function AdminPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const searchParams = await props.searchParams;
  const { supabase, user, isAdmin } = await getViewer();
  if (!user || !isAdmin) notFound();

  const [{ data: lData, error: lErr }, { data: iData, error: iErr }] = await Promise.all([
    supabase.from("listings")
      .select("id,title,type,country,asking_price,revenue_12m,profit_12m,description,status,created_at,listing_contacts(email)")
      .order("created_at", { ascending: false }).limit(500),
    supabase.from("interests")
      .select("id,listing_id,message,contact_email,budget,status,created_at,listings(title,listing_contacts(email))")
      .order("created_at", { ascending: false }).limit(500),
  ]);
  const listings = (lData ?? []) as unknown as AdminListing[];
  const interests = (iData ?? []) as unknown as AdminInterest[];
  const pending = listings.filter((l) => l.status === "pending");
  const others = listings.filter((l) => l.status !== "pending");

  return (
    <>
      <section className="head">
        <p className="eyebrow">Beheer</p>
        <h1>Controle, publicatie en contactaanvragen</h1>
        <p>Publiceer pas na controle van de cijfers. Geef contactgegevens van kopers alleen door aan de verkoper van die aanbieding.</p>
      </section>
      {searchParams.fout === "bevestig" && <p className="msg err">Vink "zeker" aan om een aanbieding definitief te verwijderen.</p>}
      {searchParams.fout === "1" && <p className="msg err">Die actie lukte niet. Probeer het opnieuw.</p>}
      {(lErr || iErr) && <p className="msg err">Niet alle gegevens konden geladen worden.</p>}

      <h2 className="sec">Ter controle ({pending.length})</h2>
      {pending.length ? (
        <div className="tablewrap">
          <table>
            <thead><tr><th>Aanbieding</th><th>Cijfers</th><th>Verkoper</th><th>Beslissing</th></tr></thead>
            <tbody>
              {pending.map((l) => (
                <tr key={l.id}>
                  <td>{l.title}<span className="sub">{l.type} · {countryName(l.country)} · {dateNl(l.created_at)}</span><span className="sub">{l.description.slice(0, 220)}</span></td>
                  <td className="mono">{eur(l.asking_price)}<span className="sub">omzet {eur(l.revenue_12m)}</span><span className="sub">winst {eur(l.profit_12m)}</span><span className="sub">{formatMultiple(l.asking_price, l.profit_12m)}</span></td>
                  <td>{contactEmail(l.listing_contacts)}</td>
                  <td style={{ display: "grid", gap: 8 }}>
                    <form action={adminSetListingStatus} className="inline">
                      <input type="hidden" name="id" value={l.id} />
                      <input type="hidden" name="status" value="published" />
                      <SubmitButton className="btn small primary">Publiceren</SubmitButton>
                    </form>
                    <form action={adminSetListingStatus} className="inline">
                      <input type="hidden" name="id" value={l.id} />
                      <input type="hidden" name="status" value="rejected" />
                      <label className="hint" htmlFor={`note-${l.id}`}>Reden</label>
                      <input type="text" id={`note-${l.id}`} name="note" maxLength={500} placeholder="Zichtbaar voor verkoper" />
                      <SubmitButton className="btn small danger">Afwijzen</SubmitButton>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty"><strong>Niets ter controle</strong><p>Nieuwe aanbiedingen van verkopers verschijnen hier.</p></div>
      )}

      <h2 className="sec">Alle aanbiedingen ({others.length})</h2>
      {others.length ? (
        <div className="tablewrap">
          <table>
            <thead><tr><th>Aanbieding</th><th>Vraagprijs</th><th>Verkoper</th><th>Status</th><th>Verwijderen</th></tr></thead>
            <tbody>
              {others.map((l) => (
                <tr key={l.id}>
                  <td><Link href={`/aanbod/${l.id}`}>{l.title}</Link><span className="sub">{l.type} · {countryName(l.country)}</span></td>
                  <td className="mono">{eur(l.asking_price)}</td>
                  <td>{contactEmail(l.listing_contacts)}</td>
                  <td>
                    <form action={adminSetListingStatus} className="inline">
                      <input type="hidden" name="id" value={l.id} />
                      <label className="hint" htmlFor={`st-${l.id}`}>Status</label>
                      <select id={`st-${l.id}`} name="status" defaultValue={l.status}>
                        {ALL_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                      </select>
                      <SubmitButton className="btn small">Opslaan</SubmitButton>
                    </form>
                  </td>
                  <td>
                    <form action={adminDeleteListing} className="inline">
                      <input type="hidden" name="id" value={l.id} />
                      <label className="check" htmlFor={`del-${l.id}`} style={{ gridTemplateColumns: "18px auto" }}>
                        <input type="checkbox" id={`del-${l.id}`} name="confirm" /><span className="hint">zeker</span>
                      </label>
                      <SubmitButton className="btn small danger">Verwijderen</SubmitButton>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty"><strong>Nog niets beoordeeld</strong><p>Gepubliceerde, afgewezen en verkochte aanbiedingen verschijnen hier.</p></div>
      )}

      <h2 className="sec">Interesse van kopers ({interests.length})</h2>
      {interests.length ? (
        <div className="tablewrap">
          <table>
            <thead><tr><th>Aanbieding</th><th>Koper</th><th>Bericht</th><th>Verkoper</th><th>Status</th></tr></thead>
            <tbody>
              {interests.map((i) => (
                <tr key={i.id}>
                  <td><Link href={`/aanbod/${i.listing_id}`}>{i.listings?.title ?? "Aanbieding"}</Link><span className="sub">{dateNl(i.created_at)}</span></td>
                  <td>{i.contact_email}<span className="sub">{i.budget ?? "Budget niet opgegeven"}</span></td>
                  <td style={{ maxWidth: 320 }}>{i.message}</td>
                  <td>{contactEmail(i.listings?.listing_contacts)}</td>
                  <td>
                    <form action={adminSetInterestStatus} className="inline">
                      <input type="hidden" name="id" value={i.id} />
                      <label className="hint" htmlFor={`is-${i.id}`}>Status</label>
                      <select id={`is-${i.id}`} name="status" defaultValue={i.status}>
                        {Object.entries(INTEREST_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                      <SubmitButton className="btn small">Opslaan</SubmitButton>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty"><strong>Nog geen interesse</strong><p>Berichten van kopers verschijnen hier, met hun e-mailadres en budget.</p></div>
      )}
    </>
  );
}
