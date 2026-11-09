import Link from "next/link";
import { countryName, eur, formatMultiple, STATUS_LABEL, type ListingStatus } from "@/lib/format";

export type PublicListing = {
  id: string;
  title: string;
  type: string;
  country: string;
  asking_price: number;
  revenue_12m: number;
  profit_12m: number;
  description: string;
  status: ListingStatus;
  published_at: string | null;
};

export function StatusChips({ l }: { l: Pick<PublicListing, "type" | "country" | "status"> }) {
  return (
    <div className="meta">
      <span className="chip type">{l.type}</span>
      <span className="chip">{countryName(l.country)}</span>
      <span className={`chip st-${l.status}`}>{STATUS_LABEL[l.status]}</span>
    </div>
  );
}

export function ListingCard({ l }: { l: PublicListing }) {
  return (
    <Link className="card" href={`/aanbod/${l.id}`}>
      <StatusChips l={l} />
      <h3>{l.title}</h3>
      <p className="desc">{l.description}</p>
      <div className="nums">
        <div className="price"><span>Vraagprijs</span><b>{eur(l.asking_price)}</b></div>
        <div><span>Multiple</span><b>{formatMultiple(l.asking_price, l.profit_12m)}</b></div>
        <div><span>Omzet 12 mnd</span><b>{eur(l.revenue_12m)}</b></div>
        <div><span>Winst 12 mnd</span><b>{eur(l.profit_12m)}</b></div>
      </div>
    </Link>
  );
}
