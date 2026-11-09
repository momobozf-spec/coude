import Link from "next/link";
import { ListingCard, type PublicListing } from "@/components/ListingCard";
import { getViewer } from "@/lib/auth";
import { COUNTRIES, LISTING_TYPES, multiple } from "@/lib/format";

export const dynamic = "force-dynamic";

const MAX_OPTIONS = [50000, 150000, 500000, 1000000];
const SORTS = { new: "Nieuwste eerst", "price-asc": "Prijs laag – hoog", "price-desc": "Prijs hoog – laag", "mult-asc": "Laagste multiple" } as const;
type Sort = keyof typeof SORTS;

function pick<T extends readonly string[]>(value: unknown, allowed: T): T[number] | "" {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T[number]) : "";
}

export default async function Home(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const searchParams = await props.searchParams;
  const type = pick(searchParams.type, LISTING_TYPES);
  const country = pick(searchParams.land, COUNTRIES);
  const maxRaw = Number(searchParams.max);
  const max = MAX_OPTIONS.includes(maxRaw) ? maxRaw : 0;
  const sort: Sort = typeof searchParams.sort === "string" && searchParams.sort in SORTS ? (searchParams.sort as Sort) : "new";

  let listings: PublicListing[] = [];
  let loadError = false;
  try {
    const { supabase } = await getViewer();
    let q = supabase
      .from("listings")
      .select("id,title,type,country,asking_price,revenue_12m,profit_12m,description,status,published_at")
      .in("status", ["published", "under_offer"])
      .limit(200);
    if (type) q = q.eq("type", type);
    if (country) q = q.eq("country", country);
    if (max) q = q.lte("asking_price", max);
    if (sort === "price-asc") q = q.order("asking_price", { ascending: true });
    else if (sort === "price-desc") q = q.order("asking_price", { ascending: false });
    else q = q.order("published_at", { ascending: false, nullsFirst: false });
    const { data, error } = await q;
    if (error) throw error;
    listings = (data ?? []) as PublicListing[];
    if (sort === "mult-asc") {
      listings.sort((a, b) => (multiple(a.asking_price, a.profit_12m) ?? 1e9) - (multiple(b.asking_price, b.profit_12m) ?? 1e9));
    }
  } catch (e) {
    console.error("Listings load failed", e);
    loadError = true;
  }

  const filtered = Boolean(type || country || max);

  return (
    <>
      <section className="head">
        <p className="eyebrow">Online bedrijven te koop · België en Nederland</p>
        <h1>SaaS, websites, apps en online diensten die een nieuwe eigenaar zoeken</h1>
        <p>Bekijk het aanbod en toon interesse. Je contactgegevens gaan eerst naar ons; wij leggen het contact met de verkoper. Cijfers zijn opgegeven door de verkoper.</p>
      </section>

      <form className="filters" method="get" action="/">
        <div className="field">
          <label htmlFor="type">Type</label>
          <select id="type" name="type" defaultValue={type}>
            <option value="">Alle types</option>
            {LISTING_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="land">Land</label>
          <select id="land" name="land" defaultValue={country}>
            <option value="">België en Nederland</option>
            <option value="BE">België</option>
            <option value="NL">Nederland</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="max">Max. vraagprijs</label>
          <select id="max" name="max" defaultValue={max ? String(max) : ""}>
            <option value="">Geen maximum</option>
            {MAX_OPTIONS.map((m) => <option key={m} value={m}>€{m.toLocaleString("nl-BE")}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="sort">Sorteren</label>
          <select id="sort" name="sort" defaultValue={sort}>
            {Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <button className="btn" type="submit">Toon</button>
      </form>

      {loadError ? (
        <p className="msg err">Het aanbod kon niet geladen worden. Probeer het over een minuut opnieuw.</p>
      ) : listings.length ? (
        <div className="listings">{listings.map((l) => <ListingCard key={l.id} l={l} />)}</div>
      ) : (
        <div className="empty">
          <strong>{filtered ? "Geen aanbiedingen voor deze filters" : "Nog geen aanbiedingen"}</strong>
          <p>
            {filtered ? <>Pas de filters aan of <Link href="/">toon alles</Link>.</> : <>Wil je zelf iets verkopen? <Link href="/verkopen">Bied je bedrijf aan</Link>.</>}
          </p>
        </div>
      )}
    </>
  );
}
