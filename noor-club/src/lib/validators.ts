import { z } from "zod";
import { LOCALES } from "@/lib/locales";

/**
 * Every message here is an i18n *key*, not prose. Server actions hand the key
 * back to the client as `{ error }`, and the component renders `t(error)`. That
 * keeps rule 10 (no hardcoded UI strings) intact across the network boundary.
 */

export const AVATARS = ["fox", "cat", "owl", "lion", "bee", "star"] as const;
export type AvatarId = (typeof AVATARS)[number];

export const AGE_BANDS = ["4-6", "7-9"] as const;
export type AgeBand = (typeof AGE_BANDS)[number];

export const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { message: "errors.nameTooShort" })
    .max(60, { message: "errors.nameTooLong" }),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email({ message: "errors.emailInvalid" }),
  password: z
    .string()
    .min(8, { message: "errors.passwordTooShort" })
    .max(72, { message: "errors.passwordTooLong" }),
  locale: z.enum(LOCALES).catch("nl"),
});

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email({ message: "errors.emailInvalid" }),
  password: z.string().min(1, { message: "errors.passwordRequired" }),
});

export const childCreateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: "errors.childNameRequired" })
    .max(30, { message: "errors.childNameTooLong" }),
  avatar: z.enum(AVATARS).catch("fox"),
  ageBand: z.enum(AGE_BANDS).catch("4-6"),
});

export const childUpdateSchema = childCreateSchema.extend({
  childId: z.string().min(1, { message: "errors.childNotFound" }),
});

export const childIdSchema = z.object({
  childId: z.string().min(1, { message: "errors.childNotFound" }),
});

export const recordPlaySchema = z.object({
  childId: z.string().min(1, { message: "errors.childNotFound" }),
  gameSlug: z.string().min(1, { message: "errors.gameNotFound" }),
  // Carried explicitly so the action can localize the badge title it returns
  // and revalidate the right paths, without depending on request context.
  locale: z.enum(LOCALES).catch("nl"),
  score: z
    .number()
    .int()
    .min(0, { message: "errors.scoreInvalid" })
    .max(100, { message: "errors.scoreInvalid" }),
  durationSec: z
    .number()
    .int()
    .min(0, { message: "errors.durationInvalid" })
    // A single sitting is never longer than two hours; anything above is a bug
    // or a tab left open, and must not pollute the parent dashboard averages.
    .max(7_200, { message: "errors.durationInvalid" }),
});

export const localeSchema = z.object({
  locale: z.enum(LOCALES),
});

export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email({ message: "errors.emailInvalid" }),
  locale: z.enum(LOCALES).catch("nl"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, { message: "errors.resetTokenInvalid" }),
  password: z
    .string()
    .min(8, { message: "errors.passwordTooShort" })
    .max(72, { message: "errors.passwordTooLong" }),
  locale: z.enum(LOCALES).catch("nl"),
});

export const deleteAccountSchema = z.object({
  confirmEmail: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, { message: "errors.deleteConfirmMismatch" }),
  locale: z.enum(LOCALES).catch("nl"),
});

/** First zod issue as an i18n key, with a safe generic fallback. */
export function firstIssueKey(error: z.ZodError, fallback = "errors.generic"): string {
  const issue = error.issues[0];
  if (!issue) return fallback;
  return issue.message.startsWith("errors.") ? issue.message : fallback;
}
