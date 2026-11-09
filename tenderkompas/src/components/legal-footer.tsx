import Link from "next/link";
import { connection } from "next/server";
import { legalLine } from "@/lib/legal";

/** Footer met wettelijke vermeldingen en links naar voorwaarden en privacy (adres wordt per verzoek uit env gelezen). */
export async function LegalFooter({ note }: { note?: string }) {
  await connection();
  return (
    <footer className="border-t border-line bg-white py-6 text-center text-xs text-muted">
      {note && <p className="mb-1">{note}</p>}
      <p>
        {legalLine()} ·{" "}
        <Link href="/voorwaarden" className="underline">
          Algemene voorwaarden
        </Link>{" "}
        ·{" "}
        <Link href="/privacy" className="underline">
          Privacyverklaring
        </Link>
      </p>
    </footer>
  );
}
