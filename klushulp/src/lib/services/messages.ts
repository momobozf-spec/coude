import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { message, requestMatch } from "@/db/schema";

export class MessageError extends Error {
  constructor(public code: "forbidden" | "empty") {
    super(code);
  }
}

/**
 * Gesprek = aanvraag × dienstverlener. Toegang:
 * - klant: via het toegangstoken van de aanvraag (gecontroleerd door de aanroeper), enkel threads met gematchte dienstverleners;
 * - dienstverlener: enkel eigen thread, en enkel als er een match bestaat;
 * - admin: alles (moderatie).
 */
export async function listThread(requestId: string, providerId: string) {
  return db
    .select()
    .from(message)
    .where(and(eq(message.requestId, requestId), eq(message.providerId, providerId)))
    .orderBy(asc(message.createdAt));
}

export async function sendMessage(input: { requestId: string; providerId: string; senderRole: "customer" | "provider" | "admin"; senderUserId?: string | null; body: string }) {
  const body = input.body.trim();
  if (!body) throw new MessageError("empty");
  if (body.length > 2000) throw new MessageError("empty");
  const [m] = await db.select().from(requestMatch).where(and(eq(requestMatch.requestId, input.requestId), eq(requestMatch.providerId, input.providerId))).limit(1);
  if (!m) throw new MessageError("forbidden");
  const [row] = await db.insert(message).values({ requestId: input.requestId, providerId: input.providerId, senderRole: input.senderRole, senderUserId: input.senderUserId ?? null, body }).returning();
  return row;
}
