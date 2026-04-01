import { Resend } from "resend";
import { ReactElement } from "react";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM || "Noor Printables <hello@noorprintables.com>";

interface SendEmailOptions {
  to: string;
  subject: string;
  react: ReactElement;
}

export async function sendEmail({ to, subject, react }: SendEmailOptions) {
  if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY.startsWith("re_YOUR")) {
    console.log(`[Email Mock] To: ${to} | Subject: ${subject}`);
    return { id: "mock", error: null };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: FROM,
      to,
      subject,
      react,
    });

    if (error) {
      console.error("[Email Error]", error);
      return { id: null, error };
    }

    console.log(`[Email Sent] To: ${to} | Subject: ${subject} | ID: ${data?.id}`);
    return { id: data?.id, error: null };
  } catch (err) {
    console.error("[Email Exception]", err);
    return { id: null, error: err };
  }
}
