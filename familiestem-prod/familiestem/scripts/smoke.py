"""Rooktest van een draaiende omgeving. Gebruik: python3 scripts/smoke.py https://jouwdomein.be
Doet geen bestelling en geen betaling; controleert enkel wat publiek moet werken."""
import sys
import urllib.error
import urllib.request

BASE = sys.argv[1].rstrip("/") if len(sys.argv) > 1 else "http://localhost:8000"
fails = 0


def check(name, path, expect_status=200, contains=None, header=None):
    global fails
    try:
        r = urllib.request.urlopen(urllib.request.Request(BASE + path, headers={"User-Agent": "familiestem-smoke"}),
                                   timeout=20)
        status, body, headers = r.status, r.read().decode("utf-8", "replace"), r.headers
    except urllib.error.HTTPError as e:
        status, body, headers = e.code, "", e.headers
    except Exception as e:  # noqa: BLE001
        print(f"FOUT  {name}: {e}")
        fails += 1
        return
    ok = status == expect_status and (contains is None or contains in body) and (header is None or headers.get(header))
    print(f"{'OK  ' if ok else 'FOUT'}  {name} ({status})")
    fails += not ok


check("gezondheid", "/healthz", contains='"ok"')
check("verkooppagina", "/", contains="Twintig verhalen")
check("geen demo-banner op verkooppagina", "/", contains="Bancontact")
check("voorbeeld", "/voorbeeld", contains="VOORBEELD")
check("voorbeeldboek", "/voorbeeld/boek.pdf")
check("voorwaarden", "/voorwaarden", contains="Marhaba Cooperation BV")
check("beveiligingsheaders", "/", header="Content-Security-Policy")
check("onbekende link geeft 404", "/k/bestaat-niet", expect_status=404)
check("ops zonder sleutel verborgen", "/ops", expect_status=404)
if BASE.startswith("https://"):
    check("HSTS actief", "/", header="Strict-Transport-Security")

try:
    body = urllib.request.urlopen(BASE + "/", timeout=20).read().decode()
    if "DEMO-MODUS" in body:
        print("FOUT  verkooppagina staat in DEMO-MODUS (geen betaalkoppeling)")
        fails += 1
except Exception:  # noqa: BLE001
    pass

print("\nAlles in orde." if not fails else f"\n{fails} controle(s) mislukt.")
sys.exit(1 if fails else 0)
