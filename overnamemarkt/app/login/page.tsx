import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/LoginForm";
import { getViewer } from "@/lib/auth";
import { safeNext } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Aanmelden", robots: { index: false } };

export default async function LoginPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const searchParams = await props.searchParams;
  const next = safeNext(typeof searchParams.next === "string" ? searchParams.next : undefined, "/account");
  const { user } = await getViewer();
  if (user) redirect(next);
  const failed = searchParams.fout === "link";
  return (
    <section className="panel" style={{ maxWidth: 560 }}>
      <h1 style={{ fontSize: 28 }}>Aanmelden</h1>
      <p>Vul je e-mailadres in. Je krijgt een link waarmee je meteen bent aangemeld, zonder wachtwoord. Nog geen account? Dan maken we er automatisch een aan.</p>
      {failed && <p className="msg err">Die aanmeldlink is verlopen of al gebruikt. Vraag een nieuwe aan.</p>}
      <LoginForm next={next} />
      <p className="hint">Door je aan te melden ga je akkoord met de <Link href="/voorwaarden">voorwaarden</Link> en de <Link href="/privacy">privacyverklaring</Link>.</p>
    </section>
  );
}
