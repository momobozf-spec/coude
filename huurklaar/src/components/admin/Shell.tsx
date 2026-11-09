import Link from "next/link";
import { AdminNav } from "@/components/admin/AdminNav";
import { can, ROLE_LABEL } from "@/lib/roles";
import type { Staff } from "@/lib/staff";

export function Shell({ staff, children }: { staff: Staff; children: React.ReactNode }) {
  const items = [
    { href: "/admin", label: "Overzicht", show: can(staff.role, "dashboard.view") },
    { href: "/admin/gebruikers", label: "Gebruikers", show: can(staff.role, "users.view") },
    { href: "/admin/betalingen", label: "Betalingen", show: can(staff.role, "finance.view") },
    { href: "/admin/kosten", label: "Kosten", show: can(staff.role, "finance.view") },
    { href: "/admin/team", label: "Team en rollen", show: can(staff.role, "team.manage") },
    { href: "/admin/audit", label: "Auditlog", show: can(staff.role, "audit.view") },
  ].filter((i) => i.show);

  return (
    <div className="admin-shell">
      <aside className="admin-side">
        <Link href="/admin" className="logo">Huur<span>klaar</span> <span className="pill" style={{ fontSize: 11, verticalAlign: 4 }}>Beheer</span></Link>
        <AdminNav items={items} />
        <div className="admin-me">
          <span className="pill accent" style={{ justifySelf: "start" }}>{ROLE_LABEL[staff.role]}</span>
          <span>{staff.email}</span>
          <div className="btns">
            <Link href="/nl" className="small">Naar de site</Link>
            <form action="/auth/logout" method="post">
              <input type="hidden" name="lang" value="nl" />
              <button className="linkbtn small" type="submit">Uitloggen</button>
            </form>
          </div>
        </div>
      </aside>
      <main className="admin-main">{children}</main>
    </div>
  );
}
