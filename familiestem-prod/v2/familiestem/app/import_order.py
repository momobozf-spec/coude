"""Zet een betaling uit de Stripe-betaallink om in een bestelling in de app en mailt de cadeaubon met links.

Gebruik (op de server):
  docker compose exec app python -m app.import_order \
      --naam "Sara Peeters" --email sara@voorbeeld.be --voor "papa" [--boodschap "..."] [--bedrag 49]

Neem naam, e-mail en "Voor wie is het cadeau?" over uit Stripe > Payments > de betaling.
Hetzelfde e-mailadres + dezelfde verteller twee keer importeren wordt geweigerd (tegen dubbele bestellingen),
tenzij je --toch meegeeft.
"""
import argparse
import sys

from . import config, db
from .main import create_order, link, mark_paid, one, run


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description="Bestelling uit Stripe-betaallink importeren")
    p.add_argument("--naam", required=True)
    p.add_argument("--email", required=True)
    p.add_argument("--voor", required=True, help="Voor wie is het cadeau (zoals ingevuld in Stripe)")
    p.add_argument("--boodschap", default="")
    p.add_argument("--bedrag", type=float, default=config.PRICE_EUR_INCL_VAT)
    p.add_argument("--toch", action="store_true", help="Ook importeren als een gelijkaardige bestelling bestaat")
    a = p.parse_args(argv)

    db.init()
    if "@" not in a.email:
        print("FOUT: ongeldig e-mailadres", file=sys.stderr)
        return 1
    dup = one("SELECT id FROM orders WHERE lower(buyer_email)=lower(?) AND lower(storyteller_name)=lower(?) "
              "AND deleted_at IS NULL", a.email.strip(), a.voor.strip())
    if dup and not a.toch:
        print(f"Bestaat al (bestelling #{dup['id']}). Gebruik --toch voor een tweede cadeau.", file=sys.stderr)
        return 2

    oid, bt, st = create_order(a.naam.strip(), a.email.strip(), a.voor.strip(), "nl", a.boodschap.strip(),
                               False, "stripe_link", source="betaallink",
                               amount_cents=int(round(a.bedrag * 100)))
    run("INSERT INTO pending_links(order_id,buyer_token,storyteller_token,created_at) VALUES (?,?,?,?)",
        oid, bt, st, db.now())
    mark_paid(oid)  # stuurt ook de bevestigingsmail met cadeaubon
    sent = one("SELECT confirmation_sent_at FROM orders WHERE id=?", oid)["confirmation_sent_at"]
    print(f"Bestelling #{oid} aangemaakt voor {a.naam} ({a.email}), cadeau voor {a.voor}.")
    print("Bevestigingsmail: " + ("verstuurd" if sent else "NIET verstuurd, wordt vannacht opnieuw geprobeerd"))
    if not sent:
        print(f"Beheerpagina koper:  {link('/k/' + bt)}")
        print(f"Link verteller:      {link('/v/' + st)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
