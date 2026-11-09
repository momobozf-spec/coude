import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { testSession } from "./setup";

let counter = 0;

export async function createUser(data: Partial<{ role: string; plan: string; referralCode: string; name: string; stripeCustomerId: string; stripeSubscriptionId: string }> = {}) {
  counter++;
  return prisma.user.create({
    data: {
      name: data.name ?? `User ${counter}`,
      email: `user${counter}-${Date.now()}@example.test`,
      role: data.role ?? "user",
      plan: data.plan ?? "free",
      referralCode: data.referralCode,
      stripeCustomerId: data.stripeCustomerId,
      stripeSubscriptionId: data.stripeSubscriptionId,
    },
  });
}

export function loginAs(userId: string | null) {
  testSession.userId = userId;
}

export function req(url: string, init: { method?: string; body?: unknown; headers?: Record<string, string> } = {}) {
  const body = init.body === undefined ? undefined : typeof init.body === "string" ? init.body : JSON.stringify(init.body);
  return new NextRequest(new URL(url, "http://localhost:3000"), {
    method: init.method ?? (body ? "POST" : "GET"),
    body,
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
  });
}
