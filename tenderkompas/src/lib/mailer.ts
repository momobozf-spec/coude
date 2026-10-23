import nodemailer from "nodemailer";

/**
 * Resultaat van een overhandiging aan SMTP. Let op: "accepted" betekent dat de SMTP-server het bericht aanvaardde,
 * NIET dat het in de mailbox van de ontvanger is aangekomen. Aflevering kan enkel bevestigd worden via een
 * provider-webhook of bounceverwerking (niet gebouwd in de pilot).
 */
export type HandoffResult = { messageId: string; accepted: string[]; rejected: string[]; response: string | null };

export type MailTransport = {
  send(msg: { to: string; subject: string; html: string; text: string; idempotencyKey: string }): Promise<HandoffResult>;
};

/** Geeft null terug als er geen e-mailprovider is ingesteld: dan enkel preview/export. */
export function getMailTransport(): MailTransport | null {
  const host = process.env.SMTP_HOST;
  if (!host) return null;
  const port = Number(process.env.SMTP_PORT ?? 587);
  const t = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    requireTLS: process.env.SMTP_REQUIRE_TLS === "true",
    tls: process.env.SMTP_ALLOW_SELF_SIGNED === "true" ? { rejectUnauthorized: false } : undefined,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
  });
  return {
    async send(msg) {
      const info = await t.sendMail({
        from: process.env.SMTP_FROM,
        to: msg.to,
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
        headers: { "X-Idempotency-Key": msg.idempotencyKey },
      });
      return {
        messageId: info.messageId,
        accepted: addrList(info.accepted),
        rejected: addrList(info.rejected),
        response: info.response ?? null,
      };
    },
  };
}

function addrList(v: unknown): string[] {
  return ((v as (string | { address: string })[] | undefined) ?? []).map((a) => (typeof a === "string" ? a : a.address).toLowerCase());
}
