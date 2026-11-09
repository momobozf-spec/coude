"""Dagelijkse taken. Draai: python -m app.jobs  (de deploy-kit doet dit elke nacht).

1. Bewaartermijnen afdwingen (wissen).
2. Bevestigingsmails die faalden opnieuw proberen; onbetaalde links na 48 u weggooien.
3. Eenmalig seintje aan de koper als het 10 dagen stil is.
4. Bericht aan de koper 60 dagen vóór het einde van de online bewaring.
5. Back-up van de databank en media, 14 dagen bewaard.
"""
import sqlite3
import tarfile
from datetime import datetime, timedelta, timezone

from . import config, db, mailer
from .main import link, many, purge_expired, run, send_confirmation


def iso(dt: datetime) -> str:
    return dt.isoformat(timespec="seconds")


def retry_confirmations() -> int:
    sent = 0
    for r in many("SELECT p.order_id FROM pending_links p JOIN orders o ON o.id=p.order_id WHERE o.status='paid'"):
        sent += send_confirmation(r["order_id"])
    cutoff = iso(datetime.now(timezone.utc) - timedelta(hours=48))
    run("DELETE FROM pending_links WHERE created_at < ? AND order_id IN "
        "(SELECT id FROM orders WHERE status!='paid')", cutoff)
    return sent


def nudge_quiet() -> int:
    cutoff = iso(datetime.now(timezone.utc) - timedelta(days=config.QUIET_DAYS))
    rows = many("SELECT o.*, (SELECT MAX(created_at) FROM stories s WHERE s.order_id=o.id) AS last "
                "FROM orders o WHERE o.status='paid' AND o.is_demo=0 AND o.deleted_at IS NULL "
                "AND o.nudged_at IS NULL AND o.created_at < ?", cutoff)
    n = 0
    for o in rows:
        if (o["last"] or o["activated_at"] or o["created_at"]) >= cutoff:
            continue
        if o["activated_at"]:
            body = (f"Dag {o['buyer_name']},\n\n{o['storyteller_name']} heeft al even niets opgenomen. Dat is normaal: "
                    "vaak helpt het om één keer samen een vraag op te nemen. Open de link van "
                    f"{o['storyteller_name']} op je eigen telefoon terwijl jullie samen zitten.\n\n"
                    "Je kan de verzamelperiode ook eenmaal gratis verlengen via je beheerpagina.\n\n"
                    "Hartelijke groet,\nFamiliestem\n")
        else:
            body = (f"Dag {o['buyer_name']},\n\n{o['storyteller_name']} is nog niet gestart. Geen haast: de 90 dagen "
                    "beginnen pas te lopen bij de eerste keer. Wil je helpen? Neem de eerste vraag samen op.\n\n"
                    "Is er 60 dagen na je bestelling niets opgenomen, dan betalen we je terug. Antwoord gewoon op "
                    "deze mail.\n\nHartelijke groet,\nFamiliestem\n")
        try:
            mailer.send(o["buyer_email"], f"Hoe gaat het met de verhalen van {o['storyteller_name']}?", body)
        except Exception as e:  # noqa: BLE001
            db.log_event("mail_failed", o["id"], f"nudge: {type(e).__name__}")
            continue
        run("UPDATE orders SET nudged_at=? WHERE id=?", db.now(), o["id"])
        db.log_event("mail_sent", o["id"], "nudge")
        n += 1
    return n


def expiry_notices() -> int:
    soon = iso(datetime.now(timezone.utc) + timedelta(days=config.EXPIRY_NOTICE_DAYS))
    rows = many("SELECT * FROM orders WHERE status='paid' AND is_demo=0 AND deleted_at IS NULL "
                "AND expiry_notice_at IS NULL AND host_until IS NOT NULL AND host_until < ?", soon)
    n = 0
    for o in rows:
        body = (f"Dag {o['buyer_name']},\n\nDe verhalen van {o['storyteller_name']} blijven online tot "
                f"{o['host_until'][:10]}. Daarna wissen we ze, zoals afgesproken.\n\n"
                f"Download vóór die datum alles (boek, opnames, foto's) via je beheerpagina. "
                f"{o['storyteller_name']} kan via de eigen link ook alles downloaden.\n\n"
                "Hartelijke groet,\nFamiliestem\n")
        try:
            mailer.send(o["buyer_email"], "Download de verhalen vóór ze offline gaan", body)
        except Exception as e:  # noqa: BLE001
            db.log_event("mail_failed", o["id"], f"expiry: {type(e).__name__}")
            continue
        run("UPDATE orders SET expiry_notice_at=? WHERE id=?", db.now(), o["id"])
        n += 1
    return n


def backup() -> str:
    config.BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d")
    target = config.BACKUP_DIR / f"familiestem-{stamp}.tar.gz"
    tmp_db = config.BACKUP_DIR / f"db-{stamp}.sqlite"
    src = sqlite3.connect(config.DB_PATH)
    dst = sqlite3.connect(tmp_db)
    with dst:
        src.backup(dst)
    src.close()
    dst.close()
    with tarfile.open(target, "w:gz") as tar:
        tar.add(tmp_db, arcname="familiestem.db")
        if config.MEDIA_DIR.exists():
            tar.add(config.MEDIA_DIR, arcname="media")
    tmp_db.unlink()
    cutoff = datetime.now(timezone.utc) - timedelta(days=config.BACKUP_KEEP_DAYS)
    for f in config.BACKUP_DIR.glob("familiestem-*.tar.gz"):
        if datetime.fromtimestamp(f.stat().st_mtime, timezone.utc) < cutoff:
            f.unlink()
    return str(target)


def main() -> None:
    db.init()
    purge_expired()
    report = {
        "bevestigingen": retry_confirmations(),
        "seintjes": nudge_quiet(),
        "bewaarberichten": expiry_notices(),
        "backup": backup(),
    }
    db.log_event("daily_job", detail=str(report))
    print(report)


if __name__ == "__main__":
    main()
