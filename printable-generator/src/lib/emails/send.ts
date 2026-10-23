import { Resend } from "resend";
import { ReactElement } from "react";

// Lazy: instantiating Resend without a key throws, which used to break `next build`.
let resend: Resend | null = null;
function client(): Resend {
  if (!resend) resend = new Resend(process.env.RESEND_API_KEY);
  return resend;
}
const FROM = process.env.EMAIL_FROM || "Noor Printables <hello@noorprintables.com>";

interface SendEmailOptions {
  to: string;
  subject: string;
  react: ReactElement;
}

export async function sendEmail({ to, subject, react }: SendEmailOptions) {
  if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY.startsWith("re_YOUR")) {
    console.log(`[Email Mock] Subject: ${subject}`);
    return { id: "mock", error: null };
  }

  try {
    const { data, error } = await client().emails.send({
      from: FROM,
      to,
      subject,
      react,
    });

    if (error) {
      console.error("[Email Error]", error);
      return { id: null, error };
    }

    console.log(`[Email Sent] Subject: ${subject} | ID: ${data?.id}`);
    return { id: data?.id, error: null };
  } catch (err) {
    console.error("[Email Exception]", err);
    return { id: null, error: err };
  }
}
