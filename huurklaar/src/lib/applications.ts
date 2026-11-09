import { z } from "zod";

export const APP_STATUSES = ["visit", "sent", "waiting", "accepted", "rejected", "withdrawn"] as const;
export type AppStatus = (typeof APP_STATUSES)[number];

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const httpUrl = z.string().max(1000).refine((u) => {
  try { const p = new URL(u).protocol; return p === "https:" || p === "http:"; } catch { return false; }
});

export const ApplicationInput = z.object({
  title: z.string().trim().min(1).max(300),
  url: httpUrl.nullable().optional(),
  status: z.enum(APP_STATUSES).default("sent"),
  applied_on: isoDate.optional(),
  next_action_on: isoDate.nullable().optional(),
  note: z.string().max(2000).nullable().optional(),
});

// Apart gedefinieerd zonder standaardwaarden, zodat een gedeeltelijke update nooit de status terugzet.
export const ApplicationPatch = z.object({
  title: z.string().trim().min(1).max(300).optional(),
  url: httpUrl.nullable().optional(),
  status: z.enum(APP_STATUSES).optional(),
  applied_on: isoDate.optional(),
  next_action_on: isoDate.nullable().optional(),
  note: z.string().max(2000).nullable().optional(),
});

export interface Application {
  id: number;
  title: string;
  url: string | null;
  status: AppStatus;
  applied_on: string;
  next_action_on: string | null;
  note: string | null;
  updated_at: string;
}

/** Heeft deze kandidatuur opvolging nodig vandaag? */
export function needsFollowUp(a: Pick<Application, "status" | "next_action_on">, today = new Date()): boolean {
  if (!["sent", "waiting", "visit"].includes(a.status) || !a.next_action_on) return false;
  return a.next_action_on <= today.toISOString().slice(0, 10);
}
