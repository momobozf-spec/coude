import { redirect } from "next/navigation";
import { LoginForm } from "@/components/LoginForm";
import { getDict } from "@/lib/i18n";
import { getStaff, mfaOk } from "@/lib/staff";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminLogin() {
  const staff = await getStaff();
  if (staff) redirect(mfaOk(staff) ? "/admin" : "/admin/mfa");
  const { data } = await (await supabaseServer()).auth.getUser();
  const t = getDict("nl").l;
  return (
    <main className="container" style={{ maxWidth: 480, paddingBlock: "12vh", display: "grid", gap: 18 }}>
      <span className="logo">Huur<span>klaar</span> <span className="pill" style={{ fontSize: 11, verticalAlign: 4 }}>Beheer</span></span>
      <h1 style={{ fontSize: 36 }}>Inloggen voor het <em>team</em></h1>
      {data.user ? (
        <p className="error">Je bent ingelogd als {data.user.email}, maar dit account heeft geen rol in het team. Vraag de eigenaar om je toe te voegen.</p>
      ) : (
        <>
          <p className="lead">Je krijgt een inloglink per mail. Daarna vragen we je code van je authenticator-app.</p>
          <LoginForm t={t} next="/admin" lang="nl" />
        </>
      )}
    </main>
  );
}
