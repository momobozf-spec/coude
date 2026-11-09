import { redirect } from "next/navigation";
import { MfaForm } from "@/components/admin/MfaForm";
import { getStaff, mfaOk } from "@/lib/staff";

export const dynamic = "force-dynamic";

export default async function MfaPage() {
  const staff = await getStaff();
  if (!staff) redirect("/admin/login");
  if (mfaOk(staff)) redirect("/admin");
  return (
    <main className="container" style={{ maxWidth: 520, paddingBlock: "10vh", display: "grid", gap: 18 }}>
      <span className="logo">Huur<span>klaar</span> <span className="pill" style={{ fontSize: 11, verticalAlign: 4 }}>Beheer</span></span>
      <h1 style={{ fontSize: 36 }}>Tweestaps<em>verificatie</em></h1>
      <p className="lead">
        Het beheerplatform geeft toegang tot klantgegevens en betalingen. Daarom vragen we naast de inloglink ook een code uit een
        authenticator-app (Google Authenticator, Microsoft Authenticator, 1Password, …).
      </p>
      <MfaForm hasFactor={staff.hasFactor} />
    </main>
  );
}
