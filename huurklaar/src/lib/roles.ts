// Rollen en rechten van het team. Puur en getest.

export const ROLES = ["owner", "admin", "support", "analyst"] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  "dashboard.view",      // cijfers zonder persoonsgegevens
  "finance.view",        // omzet, kosten, marge, betalingen
  "costs.edit",          // vaste kosten beheren
  "users.view",          // gebruikerslijst met e-mail en plan
  "users.support",       // bonuschecks, gratis dossier toekennen of intrekken
  "users.block",         // account blokkeren of deblokkeren
  "payments.refund",     // terugbetalen via Stripe
  "users.delete",        // account definitief wissen (AVG-verzoek)
  "team.manage",         // rollen toekennen en intrekken
  "audit.view",          // auditlog bekijken
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const MATRIX: Record<Role, Permission[]> = {
  owner: [...PERMISSIONS],
  admin: ["dashboard.view", "finance.view", "costs.edit", "users.view", "users.support", "users.block", "payments.refund", "audit.view"],
  support: ["dashboard.view", "users.view", "users.support"],
  analyst: ["dashboard.view", "finance.view"],
};

export function can(role: Role | null | undefined, p: Permission): boolean {
  return !!role && MATRIX[role].includes(p);
}

export function isRole(x: unknown): x is Role {
  return typeof x === "string" && (ROLES as readonly string[]).includes(x);
}

export const ROLE_LABEL: Record<Role, string> = {
  owner: "Eigenaar",
  admin: "Beheerder",
  support: "Support",
  analyst: "Analist",
};

export const ROLE_INFO: Record<Role, string> = {
  owner: "Alles, inclusief team beheren en accounts definitief wissen.",
  admin: "Gebruikers, terugbetalingen, financiën en vaste kosten. Geen teambeheer.",
  support: "Gebruikers opzoeken en helpen met bonuschecks of gratis toegang. Geen financiën.",
  analyst: "Alleen cijfers en financiën, zonder persoonsgegevens.",
};

export function permissionsOf(role: Role): Permission[] {
  return [...MATRIX[role]];
}
