import { notFound } from "next/navigation";

/**
 * `app/[locale]/layout.tsx` is the root layout, so unmatched paths need a route
 * *inside* the locale segment to render the localized 404.
 */
export default function CatchAllPage() {
  notFound();
}
