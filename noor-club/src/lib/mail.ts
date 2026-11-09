import type { ReactElement } from "react";
import { Resend } from "resend";
import { maskEmail } from "@/lib/logger";

let client: Resend | null = null;

function getResend(): Resend | null {
  if (client) return client;

  const key = process.env.RESEND_API_KEY;
  if (!key) return null;

  client = new Resend(key);
  return client;
}

/**
 * Sending is best-effort: a missing API key or a Resend outage must never turn
 * into a failed request for the user. Returns whether the mail actually left.
 */
export async function sendMail({
  to,
  subject,
  react,
}: {
  to: string;
  subject: string;
  react: ReactElement;
}): Promise<boolean> {
  // Explicit opt-in transport for local work and the test suite: log the mail
  // and report success, so flows that depend on delivery (the day-23 reminder
  // marking itself sent) can be exercised without a provider. It has to be set
  // deliberately, so a missing key in production still fails loudly below.
  if (process.env.MAIL_TRANSPORT === "log") {
    console.log(
      JSON.stringify({
        scope: "mail",
        transport: "log",
        to: maskEmail(to),
        subject,
      }),
    );
    return true;
  }

  const resend = getResend();
  if (!resend) {
    console.warn("sendMail: RESEND_API_KEY ontbreekt, mail overgeslagen:", subject);
    return false;
  }

  try {
    const { error } = await resend.emails.send({
      from: process.env.EMAIL_FROM ?? "Noor Club <onboarding@resend.dev>",
      to,
      subject,
      react,
    });

    if (error) {
      console.error("sendMail:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("sendMail:", error);
    return false;
  }
}
