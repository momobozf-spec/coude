#!/usr/bin/env node
/**
 * Lokale SMTP-"sink" voor tests en demo's: aanvaardt berichten en logt enkel ontvanger + onderwerp.
 * Levert NIETS af naar buiten. Gebruik: node scripts/smtp-sink.mjs [poort=2525]
 * Start de app dan met SMTP_HOST=127.0.0.1 SMTP_PORT=2525.
 */
import { SMTPServer } from "smtp-server";
const port = Number(process.argv[2] ?? 2525);
const server = new SMTPServer({
  authOptional: true,
  disabledCommands: ["STARTTLS"],
  onData(stream, session, cb) {
    let data = "";
    stream.on("data", (c) => (data += c));
    stream.on("end", () => {
      const subject = /^Subject: (.*)$/m.exec(data)?.[1] ?? "";
      console.log(`[smtp-sink] ${new Date().toISOString()} → ${session.envelope.rcptTo.map((r) => r.address).join(", ")} | ${subject}`);
      cb();
    });
  },
});
server.listen(port, "127.0.0.1", () => console.log(`[smtp-sink] luistert op 127.0.0.1:${port} (levert niets af)`));
