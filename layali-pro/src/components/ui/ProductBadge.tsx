import Badge from "@/components/ui/Badge";

/**
 * ProductBadge — renders the stacked status badges for a product (sold out,
 * sale %, new, bestseller) in a consistent priority order. Returns null when
 * there is nothing to show.
 */
export default function ProductBadge({
  badge,
  discount,
  soldOut,
}: {
  badge?: string | null;
  discount?: number;
  soldOut?: boolean;
}) {
  const items: React.ReactNode[] = [];

  if (soldOut) items.push(<Badge key="soldout" variant="soldout">Uitverkocht</Badge>);
  if (discount && discount > 0) items.push(<Badge key="sale" variant="sale">-{discount}%</Badge>);
  if (badge === "NEW") items.push(<Badge key="new" variant="new">Nieuw</Badge>);
  if (badge === "BESTSELLER") items.push(<Badge key="best" variant="bestseller">Bestseller</Badge>);

  if (items.length === 0) return null;

  return <div className="flex flex-col items-start gap-1.5">{items}</div>;
}
