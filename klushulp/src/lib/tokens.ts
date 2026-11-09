import { randomBytes, createHash } from "node:crypto";

export function newAccessToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashIp(ip: string): string {
  const salt = process.env.BETTER_AUTH_SECRET ?? "klushulp";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}
