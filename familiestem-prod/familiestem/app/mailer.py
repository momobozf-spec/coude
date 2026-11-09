"""E-mail via SMTP (bv. Brevo, EU). Zonder SMTP-instellingen (enkel buiten productie) gaan berichten naar
data/outbox als .eml-bestand, zodat je ze lokaal kan bekijken."""
import smtplib
import ssl
import time
from email.message import EmailMessage
from email.utils import make_msgid

from . import config


def send(to: str, subject: str, body: str, attachments: list[tuple[str, bytes, str]] | None = None) -> None:
    msg = EmailMessage()
    msg["From"] = config.MAIL_FROM or "Familiestem <noreply@localhost>"
    msg["To"] = to
    msg["Subject"] = subject
    msg["Message-ID"] = make_msgid(domain="familiestem")
    if config.SUPPORT_EMAIL:
        msg["Reply-To"] = config.SUPPORT_EMAIL
    msg.set_content(body)
    for name, data, mime in attachments or []:
        maintype, subtype = mime.split("/", 1)
        msg.add_attachment(data, maintype=maintype, subtype=subtype, filename=name)
    if not config.SMTP_HOST:
        if config.is_production():
            raise RuntimeError("Geen SMTP in productie")
        out = config.DATA_DIR / "outbox"
        out.mkdir(parents=True, exist_ok=True)
        (out / f"{int(time.time() * 1000)}.eml").write_bytes(bytes(msg))
        return
    ctx = ssl.create_default_context()
    with smtplib.SMTP(config.SMTP_HOST, config.SMTP_PORT, timeout=30) as s:
        s.starttls(context=ctx)
        s.login(config.SMTP_USER, config.SMTP_PASSWORD)
        s.send_message(msg)
