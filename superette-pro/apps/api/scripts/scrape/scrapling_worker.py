"""Scrapling-fetcher voor de Superette-scrapers.

Leest per regel een JSON-opdracht van stdin en schrijft per regel een JSON-antwoord
naar stdout. De TypeScript-kant (polite-scrapling.ts) beslist ALLES over beleefdheid:
robots.txt, wachttijd, maximum aantal pagina's en stoppen bij een blokkade.
Deze worker haalt alleen op wat hem gevraagd wordt, met de user-agent die hij krijgt.

Bewust GEEN stealth-, browser- of imitatiemodus (impersonate=None): geen omzeiling van botbescherming.
Blokkeert een site gewone HTTP-clients, dan volgt een 403 en stopt de run. Gebruik dan PoliteBrowser.

Opdracht:  {"url": "...", "userAgent": "...", "timeout": 45}
Antwoord:  {"url": "...", "status": 200, "finalUrl": "...", "body": "...", "error": null}

Start (Windows of Linux, uv installeert scrapling eenmalig in een cache):
    uv run --no-project --with "scrapling[fetchers]" python scripts/scrape/scrapling_worker.py
"""
import json
import sys


def _fetcher():
    try:
        from scrapling.fetchers import Fetcher  # scrapling >= 0.3
    except ImportError:  # oudere versies
        from scrapling import Fetcher  # type: ignore
    return Fetcher


def _body(page) -> str:
    # Eerst de ruwe bytes zelf decoderen (UTF-8 tenzij de server iets anders zegt):
    # zo vermijden we verkeerd geraden tekensets (bv. "â‚¬" in plaats van "€").
    raw = getattr(page, "body", None)
    if isinstance(raw, (bytes, bytearray)) and raw:
        encoding = getattr(page, "encoding", None) or "utf-8"
        try:
            return bytes(raw).decode(encoding)
        except (LookupError, UnicodeDecodeError):
            return bytes(raw).decode("utf-8", errors="replace")
    for attr in ("html_content", "text"):
        value = getattr(page, attr, None)
        if isinstance(value, str) and value:
            return value
    return str(raw or "")


def fetch(fetcher, job: dict) -> dict:
    url = job["url"]
    headers = {"User-Agent": job["userAgent"], "Accept-Language": "nl-BE,nl;q=0.9"}
    try:
        page = fetcher.get(
            url,
            headers=headers,
            # Geen browser-imitatie (TLS-vingerafdruk) en geen nagebootste headers:
            # wie ons als gewone HTTP-client weigert, krijgt die keuze gerespecteerd.
            impersonate=None,
            stealthy_headers=False,
            follow_redirects=True,
            retries=1,
            timeout=job.get("timeout", 45),
        )
        return {
            "url": url,
            "status": int(getattr(page, "status", 0) or 0),
            "finalUrl": str(getattr(page, "url", url) or url),
            "body": _body(page),
            "error": None,
        }
    except Exception as exc:  # netwerkfout: de TS-kant beslist wat ermee gebeurt
        return {"url": url, "status": 0, "finalUrl": url, "body": "", "error": f"{type(exc).__name__}: {exc}"[:500]}


def main() -> None:
    fetcher = _fetcher()
    sys.stdout.write(json.dumps({"ready": True}) + "\n")
    sys.stdout.flush()
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            job = json.loads(line)
        except json.JSONDecodeError:
            sys.stdout.write(json.dumps({"error": "ongeldige opdracht"}) + "\n")
            sys.stdout.flush()
            continue
        sys.stdout.write(json.dumps(fetch(fetcher, job), ensure_ascii=False) + "\n")
        sys.stdout.flush()


if __name__ == "__main__":
    main()
