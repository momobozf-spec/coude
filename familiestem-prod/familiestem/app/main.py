"""Familiestem MVP — FastAPI.

Rollen en toegang (elk via een eigen geheime link, enkel gehasht opgeslagen):
- koper  /k/<token>: vragen kiezen, familie uitnodigen, voortgang zien, gedeelde verhalen lezen.
- verteller /v/<token>: toestemming geven, opnemen, tekst goedkeuren, delen, familie toelaten, alles wissen.
- familie /f/<token>: enkel goedgekeurde én gedeelde verhalen, pas nadat de verteller die persoon toeliet.
De koper ziet geen ruwe opnames of teksten tenzij de verteller hem als goedkeurder aanduidt.
"""
import hashlib
import hmac
import json
import re
import shutil
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

import httpx
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, HTMLResponse, RedirectResponse, Response
from fastapi.templating import Jinja2Templates

from contextlib import asynccontextmanager

from . import audio, config, db, export, mailer, text


@asynccontextmanager
async def lifespan(_app):
    if config.is_production():
        problems = config.production_problems()
        if problems:
            raise RuntimeError("Niet klaar voor productie: " + "; ".join(problems))
    db.init()
    purge_expired()
    yield


app = FastAPI(title="Familiestem", docs_url=None, redoc_url=None, openapi_url=None, lifespan=lifespan)
templates = Jinja2Templates(directory=str(config.BASE_DIR / "templates"))
templates.env.globals.update(cfg=config)


SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "camera=(), geolocation=(), microphone=(self)",
    "Content-Security-Policy": ("default-src 'self'; img-src 'self' data:; media-src 'self' blob:; "
                                "style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; "
                                "connect-src 'self'; form-action 'self' https://checkout.stripe.com; "
                                "frame-ancestors 'none'; base-uri 'none'"),
}


@app.middleware("http")
async def security_headers(request: Request, call_next):
    resp = await call_next(request)
    for k, v in SECURITY_HEADERS.items():
        resp.headers.setdefault(k, v)
    if request.url.path.startswith(("/k/", "/v/", "/f/", "/bedankt", "/ops")):
        resp.headers["Cache-Control"] = "no-store"
    return resp


_rate: dict[str, list[float]] = {}


def rate_limit(request: Request, key: str, limit: int, window: int) -> None:
    ip = request.client.host if request.client else "?"
    k = f"{key}:{ip}"
    now_ = time.time()
    hits = [t for t in _rate.get(k, []) if t > now_ - window]
    if len(hits) >= limit:
        raise HTTPException(429, "Even te veel aanvragen. Probeer straks opnieuw.")
    _rate[k] = hits + [now_]


@app.get("/healthz")
def healthz():
    with db.connect() as c:
        c.execute("SELECT 1").fetchone()
    return {"ok": True}


# ---------------------------------------------------------------- helpers
def render(request: Request, name: str, **ctx):
    ctx.setdefault("demo_payment", config.is_demo_payment())
    ctx.setdefault("demo_transcription", config.is_demo_transcription())
    return templates.TemplateResponse(request, name, ctx)


def one(sql, *args):
    with db.connect() as c:
        r = c.execute(sql, args).fetchone()
        return dict(r) if r else None


def many(sql, *args):
    with db.connect() as c:
        return [dict(r) for r in c.execute(sql, args).fetchall()]


def run(sql, *args):
    with db.connect() as c:
        cur = c.execute(sql, args)
        return cur.lastrowid


def order_by(field: str, token: str):
    if field not in ("buyer_token_hash", "storyteller_token_hash"):
        raise ValueError(field)
    o = one(f"SELECT * FROM orders WHERE {field}=? AND deleted_at IS NULL", db.hash_token(token))
    if not o:
        raise HTTPException(404, "Deze link is niet (meer) geldig.")
    return o


def buyer(token):
    o = order_by("buyer_token_hash", token)
    if o["status"] != "paid":
        raise HTTPException(402, "De betaling is nog niet bevestigd.")
    return o


def pin_cookie_value(o, token):
    return hashlib.sha256(f"{o['pin_hash']}:{token}".encode()).hexdigest()


class PinRequired(Exception):
    def __init__(self, token):
        self.token = token


def storyteller(token, request: Request | None = None, check_pin=True):
    o = order_by("storyteller_token_hash", token)
    if o["status"] != "paid":
        raise HTTPException(404, "Deze link is niet (meer) geldig.")
    if check_pin and o["pin_hash"]:
        cookie = request.cookies.get(f"fs_v{o['id']}", "") if request else ""
        if not hmac.compare_digest(cookie, pin_cookie_value(o, token)):
            raise PinRequired(token)
    return o


@app.exception_handler(PinRequired)
def _pin_required(request: Request, exc: PinRequired):
    return RedirectResponse(f"/v/{exc.token}/pincode", status_code=303)


def family_member(token):
    f = one("SELECT * FROM family WHERE token_hash=?", db.hash_token(token))
    if not f:
        raise HTTPException(404, "Deze link is niet (meer) geldig.")
    o = one("SELECT * FROM orders WHERE id=? AND deleted_at IS NULL AND status='paid'", f["order_id"])
    if not o:
        raise HTTPException(404, "Deze link is niet (meer) geldig.")
    return f, o


def collecting(o) -> bool:
    return bool(o["activated_at"]) and datetime.fromisoformat(o["collect_until"]) > datetime.now(timezone.utc)


def stories_for(order_id: int, only_shared=False, only_approved=False):
    sql = ("SELECT s.*, q.text AS question FROM stories s JOIN questions q ON q.id=s.question_id "
           "WHERE s.order_id=?")
    if only_approved:
        sql += " AND s.status='approved'"
    if only_shared:
        sql += " AND s.shared=1"
    rows = many(sql + " ORDER BY q.position", order_id)
    for s in rows:
        s["photos"] = many("SELECT * FROM photos WHERE story_id=? ORDER BY id", s["id"])
    return rows


def usage(order_id: int):
    r = one("SELECT COUNT(*) n, COALESCE(SUM(audio_seconds),0) sec FROM stories WHERE order_id=?", order_id)
    return r["n"], r["sec"]


def media_dir(order_id: int) -> Path:
    d = config.MEDIA_DIR / str(order_id)
    d.mkdir(parents=True, exist_ok=True)
    return d


def link(path: str) -> str:
    return f"{config.PUBLIC_URL}{path}"


def create_order(buyer_name, buyer_email, storyteller_name, language, gift_message, print_interest,
                 payment_mode, is_demo=False, source="direct", referred_by=None, amount_cents=None):
    bt, st = db.new_token(), db.new_token()
    oid = run("INSERT INTO orders(created_at,buyer_name,buyer_email,storyteller_name,language,gift_message,"
              "print_interest,status,payment_mode,amount_cents,is_demo,buyer_token_hash,storyteller_token_hash,"
              "source,referred_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
              db.now(), buyer_name, buyer_email, storyteller_name, language, gift_message,
              int(print_interest), "pending_payment", payment_mode,
              amount_cents or int(round(config.PRICE_EUR_INCL_VAT * 100)), int(is_demo), db.hash_token(bt),
              db.hash_token(st), source, referred_by)
    for i, q in enumerate(text.DEFAULT_QUESTIONS[language]):
        run("INSERT INTO questions(order_id,position,text) VALUES (?,?,?)", oid, i, q)
    return oid, bt, st


REF_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # geen 0/O/1/I: leesbaar aan de telefoon


def new_referral_code() -> str:
    import secrets as _s
    while True:
        code = "".join(_s.choice(REF_ALPHABET) for _ in range(6))
        if not one("SELECT 1 FROM orders WHERE referral_code=?", code):
            return code


def mark_paid(order_id: int):
    run("UPDATE orders SET status='paid' WHERE id=? AND status='pending_payment'", order_id)
    o = one("SELECT * FROM orders WHERE id=?", order_id)
    if not o["referral_code"] and not o["is_demo"]:
        run("UPDATE orders SET referral_code=? WHERE id=?", new_referral_code(), order_id)
    if o["referred_by"] and not o["reward_status"]:
        run("UPDATE orders SET reward_status='due' WHERE id=?", order_id)
    db.log_event("paid", order_id, o["source"])
    send_confirmation(order_id)


def send_confirmation(order_id: int) -> bool:
    """Bevestigingsmail met links en cadeaubon. Faalt de mail, dan blijft de betaling geldig en probeert de
    dagelijkse job opnieuw (de links blijven max. 48 u leesbaar bewaard)."""
    o = one("SELECT * FROM orders WHERE id=? AND status='paid'", order_id)
    pl = one("SELECT * FROM pending_links WHERE order_id=?", order_id)
    if not o or not pl or o["confirmation_sent_at"] or o["is_demo"]:
        return False
    bt, st = pl["buyer_token"], pl["storyteller_token"]
    body = (f"Dag {o['buyer_name']},\n\n"
            f"Bedankt voor je bestelling. Het cadeau voor {o['storyteller_name']} staat klaar.\n\n"
            f"1. De cadeaubon zit in bijlage. Daarop staat de persoonlijke link voor {o['storyteller_name']}.\n\n"
            f"2. De link voor {o['storyteller_name']} (stuur hem door wanneer je het cadeau geeft):\n"
            f"{link('/v/' + st)}\n\n"
            f"3. Jouw beheerpagina (bewaar deze mail):\n{link('/k/' + bt)}\n\n"
            f"Bedrag: EUR {o['amount_cents'] / 100:.2f} incl. 21% btw.\n"
            f"Is er 60 dagen na vandaag niets opgenomen, of ben je niet tevreden binnen 30 dagen na de eerste "
            f"opname, dan krijg je je geld terug. Antwoord gewoon op deze mail.\n\n"
            f"Hartelijke groet,\nFamiliestem\n")
    try:
        mailer.send(o["buyer_email"], f"Je cadeau voor {o['storyteller_name']} staat klaar", body,
                    [("cadeaubon.pdf", export.gift_card_pdf(o, link('/v/' + st)), "application/pdf")])
    except Exception as e:  # noqa: BLE001 - mailfout mag de betaling nooit breken
        db.log_event("mail_failed", order_id, f"confirmation: {type(e).__name__}")
        return False
    run("UPDATE orders SET confirmation_sent_at=? WHERE id=?", db.now(), order_id)
    run("DELETE FROM pending_links WHERE order_id=?", order_id)
    db.log_event("mail_sent", order_id, "confirmation")
    return True


def valid_referrer(code: str, buyer_email: str):
    """Geeft de doorverwijzende bestelling terug, of None. Geen eigen code, geen demo, enkel betaald."""
    code = (code or "").strip().upper()
    if not code:
        return None
    ref = one("SELECT * FROM orders WHERE referral_code=? AND status='paid' AND is_demo=0", code)
    if not ref or ref["buyer_email"].strip().lower() == buyer_email.strip().lower():
        return None
    return ref


SOURCES = {"familie", "doorverwijzing"}


def clean_source(bron: str) -> str:
    bron = re.sub(r"[^a-z0-9_-]", "", (bron or "").lower())[:30]
    return bron or "direct"


def purge_expired():
    """Verwijdert media en inhoud van bestellingen voorbij hun bewaartermijn."""
    for o in many("SELECT id FROM orders WHERE deleted_at IS NULL AND host_until IS NOT NULL AND host_until < ?",
                  db.now()):
        delete_order_content(o["id"], reason="bewaartermijn")


def delete_order_content(order_id: int, reason: str):
    shutil.rmtree(config.MEDIA_DIR / str(order_id), ignore_errors=True)
    with db.connect() as c:
        c.execute("DELETE FROM photos WHERE story_id IN (SELECT id FROM stories WHERE order_id=?)", (order_id,))
        c.execute("DELETE FROM stories WHERE order_id=?", (order_id,))
        c.execute("DELETE FROM family WHERE order_id=?", (order_id,))
        c.execute("DELETE FROM pending_links WHERE order_id=?", (order_id,))
        c.execute("UPDATE orders SET deleted_at=?, gift_message=NULL WHERE id=?", (db.now(), order_id))
    db.log_event("deleted", order_id, reason)


# ---------------------------------------------------------------- publiek
@app.get("/", response_class=HTMLResponse)
def home(request: Request, bron: str = "", utm_source: str = "", code: str = ""):
    source = clean_source(bron or utm_source)
    code = re.sub(r"[^A-Z0-9]", "", code.upper())[:6]
    if code:
        source = "doorverwijzing"
    db.log_event("page_view", detail=source)
    if source == "familie":
        db.log_event("family_cta_click")
    return render(request, "home.html", source=source, ref_code=code,
                  discount=config.REFERRAL_DISCOUNT_EUR if code else 0)


@app.get("/voorbeeld", response_class=HTMLResponse)
def example(request: Request):
    o = one("SELECT * FROM orders WHERE is_demo=1 AND deleted_at IS NULL ORDER BY id LIMIT 1")
    stories = stories_for(o["id"], only_approved=True) if o else []
    return render(request, "example.html", order=o, stories=stories)


@app.get("/voorbeeld/boek.pdf")
def example_pdf():
    o = one("SELECT * FROM orders WHERE is_demo=1 AND deleted_at IS NULL ORDER BY id LIMIT 1")
    if not o:
        raise HTTPException(404)
    return Response(export.book_pdf(o, stories_for(o["id"], only_approved=True)), media_type="application/pdf")


@app.get("/voorbeeld/audio/{sid}")
def example_audio(sid: int):
    s = one("SELECT s.* FROM stories s JOIN orders o ON o.id=s.order_id WHERE s.id=? AND o.is_demo=1", sid)
    if not s:
        raise HTTPException(404)
    return FileResponse(str(Path(s["audio_path"]).with_suffix(".mp3")), media_type="audio/mpeg")


@app.get("/voorwaarden", response_class=HTMLResponse)
def terms(request: Request):
    return render(request, "terms.html")


@app.post("/bestellen")
def order(request: Request, buyer_name: str = Form(..., max_length=120), buyer_email: str = Form(..., max_length=200),
          storyteller_name: str = Form(..., max_length=120), language: str = Form("nl"),
          gift_message: str = Form("", max_length=600), print_interest: str = Form(""),
          accept_terms: str = Form(""), source: str = Form("direct"), ref_code: str = Form("")):
    if language not in text.DEFAULT_QUESTIONS:
        raise HTTPException(400, "Onbekende taal.")
    if not accept_terms or not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", buyer_email.strip()):
        raise HTTPException(400, "Vul een geldig e-mailadres in en aanvaard de voorwaarden.")
    rate_limit(request, "order", 10, 600)
    mode = "demo" if config.is_demo_payment() else "stripe"
    referrer = valid_referrer(ref_code, buyer_email)
    source = "doorverwijzing" if referrer else clean_source(source)
    price = config.PRICE_EUR_INCL_VAT - (config.REFERRAL_DISCOUNT_EUR if referrer else 0)
    oid, bt, st = create_order(buyer_name.strip(), buyer_email.strip(), storyteller_name.strip(), language,
                               gift_message.strip(), bool(print_interest), mode, source=source,
                               referred_by=referrer["id"] if referrer else None,
                               amount_cents=int(round(price * 100)))
    run("INSERT INTO pending_links(order_id,buyer_token,storyteller_token,created_at) VALUES (?,?,?,?)",
        oid, bt, st, db.now())
    db.log_event("checkout_start", oid, "print_interest" if print_interest else "")
    # Verteller-token wordt pas getoond aan de koper na betaling; we bewaren hem tijdelijk in een cookie-loze
    # manier door hem in de succes-URL te stoppen (enkel in de browser van de koper).
    success = f"/bedankt?k={bt}&v={st}"
    if mode == "demo":
        mark_paid(oid)
        return RedirectResponse(success, status_code=303)
    r = httpx.post("https://api.stripe.com/v1/checkout/sessions", auth=(config.STRIPE_SECRET_KEY, ""), data={
        "mode": "payment",
        "payment_method_types[0]": "card",
        "payment_method_types[1]": "bancontact",
        "line_items[0][price_data][currency]": "eur",
        "line_items[0][price_data][unit_amount]": str(int(round(price * 100))),
        "line_items[0][price_data][product_data][name]": "Familiestem: 20 verhalen in eigen stem",
        "line_items[0][quantity]": "1",
        "customer_email": buyer_email.strip(),
        "locale": "nl",
        "client_reference_id": str(oid),
        "success_url": link(success),
        "cancel_url": link("/?geannuleerd=1"),
    }, timeout=30)
    r.raise_for_status()
    sess = r.json()
    run("UPDATE orders SET stripe_session_id=? WHERE id=?", sess["id"], oid)
    return RedirectResponse(sess["url"], status_code=303)


@app.post("/stripe/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")
    parts = dict(p.split("=", 1) for p in sig.split(",") if "=" in p)
    expected = hmac.new(config.STRIPE_WEBHOOK_SECRET.encode(), f"{parts.get('t', '')}.".encode() + payload,
                        hashlib.sha256).hexdigest()
    if not config.STRIPE_WEBHOOK_SECRET or not hmac.compare_digest(expected, parts.get("v1", "")) \
            or abs(time.time() - int(parts.get("t", "0") or 0)) > 300:
        raise HTTPException(400, "Ongeldige handtekening")
    event = json.loads(payload)
    if event.get("type") == "checkout.session.completed":
        sess = event["data"]["object"]
        o = one("SELECT id FROM orders WHERE stripe_session_id=?", sess["id"])
        if o and sess.get("payment_status") == "paid":
            mark_paid(o["id"])
    return {"ok": True}


@app.get("/bedankt", response_class=HTMLResponse)
def thanks(request: Request, k: str, v: str):
    o = order_by("buyer_token_hash", k)
    if db.hash_token(v) != o["storyteller_token_hash"]:
        raise HTTPException(404)
    return render(request, "thanks.html", order=o, k=k, v=v, paid=o["status"] == "paid",
                  buyer_link=link(f"/k/{k}"), storyteller_link=link(f"/v/{v}"))


@app.get("/bedankt/cadeaubon.pdf")
def gift_card(k: str, v: str):
    o = buyer(k)
    if db.hash_token(v) != o["storyteller_token_hash"]:
        raise HTTPException(404)
    return Response(export.gift_card_pdf(o, link(f"/v/{v}")), media_type="application/pdf",
                    headers={"Content-Disposition": 'attachment; filename="cadeaubon.pdf"'})


# ---------------------------------------------------------------- koper
@app.get("/k/{token}", response_class=HTMLResponse)
def buyer_home(request: Request, token: str, nieuw: str = ""):
    o = buyer(token)
    n, sec = usage(o["id"])
    qs = many("SELECT q.*, (SELECT COUNT(*) FROM stories s WHERE s.question_id=q.id) AS answered "
              "FROM questions q WHERE order_id=? ORDER BY position", o["id"])
    fam = many("SELECT id,name,approved_by_storyteller,can_download FROM family WHERE order_id=?", o["id"])
    to_review = stories_for(o["id"]) if o["approver"] == "buyer" else []
    shared = stories_for(o["id"], only_shared=True, only_approved=True)
    share = link(f"/?code={o['referral_code']}") if o["referral_code"] else ""
    return render(request, "buyer.html", order=o, token=token, n=n, minutes=round(sec / 60), questions=qs,
                  share_link=share,
                  family=fam, to_review=[s for s in to_review if s["status"] != "approved"], shared=shared,
                  new_family_link=nieuw, collecting=collecting(o))


@app.post("/k/{token}/vraag")
def buyer_add_question(token: str, question: str = Form(..., min_length=5, max_length=300)):
    o = buyer(token)
    pos = one("SELECT COALESCE(MAX(position),0)+1 p FROM questions WHERE order_id=?", o["id"])["p"]
    run("INSERT INTO questions(order_id,position,text,custom) VALUES (?,?,?,1)", o["id"], pos, question.strip())
    return RedirectResponse(f"/k/{token}", status_code=303)


@app.post("/k/{token}/vraag/{qid}/verwijder")
def buyer_remove_question(token: str, qid: int):
    o = buyer(token)
    if one("SELECT 1 FROM stories WHERE question_id=?", qid):
        raise HTTPException(400, "Deze vraag is al beantwoord en blijft staan.")
    run("DELETE FROM questions WHERE id=? AND order_id=?", qid, o["id"])
    return RedirectResponse(f"/k/{token}", status_code=303)


@app.post("/k/{token}/familie")
def buyer_invite(token: str, name: str = Form(..., min_length=1, max_length=80)):
    o = buyer(token)
    if one("SELECT COUNT(*) n FROM family WHERE order_id=?", o["id"])["n"] >= config.MAX_FAMILY:
        raise HTTPException(400, f"Maximaal {config.MAX_FAMILY} familieleden.")
    ft = db.new_token()
    run("INSERT INTO family(order_id,name,token_hash,created_at) VALUES (?,?,?,?)",
        o["id"], name.strip(), db.hash_token(ft), db.now())
    db.log_event("family_invited", o["id"])
    return RedirectResponse(f"/k/{token}?nieuw={link('/f/' + ft)}", status_code=303)


@app.post("/k/{token}/verlengen")
def buyer_extend(token: str):
    o = buyer(token)
    if not o["activated_at"] or o["extended"]:
        raise HTTPException(400, "Verlengen kan eenmaal, na de start.")
    until = datetime.fromisoformat(o["collect_until"]) + timedelta(days=config.EXTENSION_DAYS)
    run("UPDATE orders SET extended=1, collect_until=?, host_until=? WHERE id=?",
        until.isoformat(timespec="seconds"),
        (until + timedelta(days=365 * config.HOSTING_YEARS)).isoformat(timespec="seconds"), o["id"])
    return RedirectResponse(f"/k/{token}", status_code=303)


@app.post("/k/{token}/verhaal/{sid}")
def buyer_review(token: str, sid: int, final_text: str = Form(...), approve: str = Form("")):
    o = buyer(token)
    if o["approver"] != "buyer":
        raise HTTPException(403, "Enkel de verteller keurt de tekst goed.")
    return _save_story(o, sid, final_text, approve, None, f"/k/{token}")


@app.get("/k/{token}/audio/{sid}")
def buyer_audio(token: str, sid: int):
    o = buyer(token)
    cond = "" if o["approver"] == "buyer" else " AND status='approved' AND shared=1"
    s = one(f"SELECT * FROM stories WHERE id=? AND order_id=?{cond}", sid, o["id"])
    if not s:
        raise HTTPException(404)
    return FileResponse(str(Path(s["audio_path"]).with_suffix(".mp3")), media_type="audio/mpeg")


@app.get("/k/{token}/boek.pdf")
def buyer_pdf(token: str):
    o = buyer(token)
    return Response(export.book_pdf(o, stories_for(o["id"], only_shared=True, only_approved=True)),
                    media_type="application/pdf")


@app.get("/k/{token}/export.zip")
def buyer_zip(token: str):
    o = buyer(token)
    st = stories_for(o["id"], only_shared=True, only_approved=True)
    return Response(export.full_zip(o, st, export.book_pdf(o, st)), media_type="application/zip",
                    headers={"Content-Disposition": 'attachment; filename="familiestem.zip"'})


# ---------------------------------------------------------------- verteller
@app.get("/v/{token}", response_class=HTMLResponse)
def st_home(request: Request, token: str, vraag: int | None = None, ok: str = ""):
    o = storyteller(token, request)
    buyer_name = o["buyer_name"]
    if not o["activated_at"]:
        return render(request, "consent.html", order=o, token=token, buyer_name=buyer_name)
    qs = many("SELECT q.*, (SELECT s.id FROM stories s WHERE s.question_id=q.id) AS story_id "
              "FROM questions q WHERE order_id=? ORDER BY position", o["id"])
    open_qs = [q for q in qs if not q["story_id"]]
    current = next((q for q in open_qs if q["id"] == vraag), open_qs[0] if open_qs else None)
    n, sec = usage(o["id"])
    fam = many("SELECT * FROM family WHERE order_id=?", o["id"])
    return render(request, "record.html", order=o, token=token, q=current, open_qs=open_qs,
                  stories=stories_for(o["id"]), n=n, minutes=round(sec / 60), family=fam,
                  collecting=collecting(o), full=n >= config.MAX_STORIES, ok=ok)


@app.post("/v/{token}/akkoord")
def st_consent(request: Request, token: str, consent_record: str = Form(""), consent_processing: str = Form(""),
               pin: str = Form("")):
    o = storyteller(token, request)
    if not (consent_record and consent_processing):
        raise HTTPException(400, "Zonder beide vinkjes kunnen we niet starten. Je mag ook gewoon niet deelnemen.")
    pin = pin.strip()
    if pin and not (pin.isdigit() and 4 <= len(pin) <= 6):
        raise HTTPException(400, "Een pincode bestaat uit 4 tot 6 cijfers.")
    resp = RedirectResponse(f"/v/{token}", status_code=303)
    if not o["activated_at"]:
        until = datetime.now(timezone.utc) + timedelta(days=config.COLLECT_DAYS)
        pin_hash = hash_pin(o, pin) if pin else None
        run("UPDATE orders SET activated_at=?, consent_version=?, collect_until=?, host_until=?, pin_hash=? "
            "WHERE id=?", db.now(), config.CONSENT_VERSION, until.isoformat(timespec="seconds"),
            (until + timedelta(days=365 * config.HOSTING_YEARS)).isoformat(timespec="seconds"), pin_hash, o["id"])
        db.log_event("activated", o["id"], "pin" if pin else "")
        if pin_hash:
            o["pin_hash"] = pin_hash
            resp.set_cookie(f"fs_v{o['id']}", pin_cookie_value(o, token), max_age=3600 * 24 * 180,
                            httponly=True, samesite="lax", secure=config.PUBLIC_URL.startswith("https"))
    return resp


def hash_pin(o, pin: str) -> str:
    return hashlib.pbkdf2_hmac("sha256", pin.encode(), o["storyteller_token_hash"].encode(), 200_000).hex()


_pin_attempts: dict[int, list[float]] = {}


@app.get("/v/{token}/pincode", response_class=HTMLResponse)
def st_pin_form(request: Request, token: str, fout: str = ""):
    o = storyteller(token, request, check_pin=False)
    return render(request, "pin.html", order=o, token=token, fout=fout)


@app.post("/v/{token}/pincode")
def st_pin(request: Request, token: str, pin: str = Form("")):
    o = storyteller(token, request, check_pin=False)
    tries = [t for t in _pin_attempts.get(o["id"], []) if t > time.time() - 900]
    if len(tries) >= 5:
        raise HTTPException(429, "Te veel pogingen. Probeer over een kwartier opnieuw.")
    if not o["pin_hash"] or hmac.compare_digest(hash_pin(o, pin.strip()), o["pin_hash"]):
        _pin_attempts.pop(o["id"], None)
        resp = RedirectResponse(f"/v/{token}", status_code=303)
        if o["pin_hash"]:
            resp.set_cookie(f"fs_v{o['id']}", pin_cookie_value(o, token), max_age=3600 * 24 * 180,
                            httponly=True, samesite="lax", secure=config.PUBLIC_URL.startswith("https"))
        return resp
    _pin_attempts[o["id"]] = tries + [time.time()]
    return RedirectResponse(f"/v/{token}/pincode?fout=1", status_code=303)


@app.post("/v/{token}/opname/{qid}")
async def st_record(request: Request, token: str, qid: int, audio_file: UploadFile = File(...)):
    o = storyteller(token, request)
    if not collecting(o):
        raise HTTPException(400, "De periode om te vertellen is voorbij. Vraag de koper om te verlengen.")
    q = one("SELECT * FROM questions WHERE id=? AND order_id=?", qid, o["id"])
    if not q or one("SELECT 1 FROM stories WHERE question_id=?", qid):
        raise HTTPException(400, "Deze vraag bestaat niet of is al beantwoord.")
    n, sec = usage(o["id"])
    if n >= config.MAX_STORIES:
        raise HTTPException(400, f"Alle {config.MAX_STORIES} verhalen zijn opgenomen.")
    data = await audio_file.read(config.MAX_AUDIO_BYTES + 1)
    if len(data) > config.MAX_AUDIO_BYTES or len(data) < 1000:
        raise HTTPException(400, "Opname te groot of leeg.")
    ext = ".mp4" if "mp4" in (audio_file.content_type or "") else ".webm"
    path = media_dir(o["id"]) / f"{qid}_{int(time.time())}{ext}"
    path.write_bytes(data)
    try:
        secs = audio.duration_seconds(str(path))
    except audio.AudioError as e:
        path.unlink(missing_ok=True)
        raise HTTPException(400, str(e))
    if secs > config.MAX_SECONDS_PER_STORY + 5 or sec + secs > config.MAX_SECONDS_TOTAL:
        path.unlink(missing_ok=True)
        raise HTTPException(400, "Deze opname is langer dan toegelaten (max. 10 minuten per verhaal).")
    audio.to_mp3(str(path), str(path.with_suffix(".mp3")))
    sid = run("INSERT INTO stories(order_id,question_id,audio_path,audio_seconds,status,created_at) "
              "VALUES (?,?,?,?,?,?)", o["id"], qid, str(path), secs, "recorded", db.now())
    if n == 0:
        db.log_event("first_recording", o["id"])
    process_story(sid, o["language"])
    return {"ok": True, "story_id": sid}


def process_story(sid: int, language: str):
    s = one("SELECT * FROM stories WHERE id=?", sid)
    try:
        t = text.transcribe(s["audio_path"], language)
    except text.TranscriptionError:
        db.log_event("transcription_failed", s["order_id"], str(sid))
        return
    readable, ok, _extra = text.readable_version(t["text"], language)
    run("UPDATE stories SET transcript=?, transcript_flags=?, transcript_source=?, readable=?, readable_ok=?, "
        "final_text=?, status='transcribed' WHERE id=?",
        t["text"], text.flags_json(t["flags"]), t["source"], readable, int(ok), readable, sid)


def _save_story(o, sid, final_text, approve, shared, back):
    s = one("SELECT * FROM stories WHERE id=? AND order_id=?", sid, o["id"])
    if not s:
        raise HTTPException(404)
    final_text = final_text.strip()[:20000]
    if approve:
        run("UPDATE stories SET final_text=?, status='approved', approved_at=?, shared=COALESCE(?, shared) "
            "WHERE id=?", final_text, db.now(), None if shared is None else int(shared), sid)
        db.log_event("story_approved", o["id"], str(sid))
    else:
        run("UPDATE stories SET final_text=?, shared=COALESCE(?, shared) WHERE id=?",
            final_text, None if shared is None else int(shared), sid)
    return RedirectResponse(back, status_code=303)


@app.get("/v/{token}/verhaal/{sid}", response_class=HTMLResponse)
def st_story(request: Request, token: str, sid: int):
    o = storyteller(token, request)
    s = next((x for x in stories_for(o["id"]) if x["id"] == sid), None)
    if not s:
        raise HTTPException(404)
    return render(request, "story.html", order=o, token=token, s=s, flags=json.loads(s["transcript_flags"] or "[]"))


@app.post("/v/{token}/verhaal/{sid}")
def st_story_save(request: Request, token: str, sid: int, final_text: str = Form(...), approve: str = Form(""),
                  shared: str = Form("")):
    o = storyteller(token, request)
    return _save_story(o, sid, final_text, approve, bool(shared), f"/v/{token}/verhaal/{sid}")


@app.post("/v/{token}/verhaal/{sid}/foto")
async def st_photo(request: Request, token: str, sid: int, photo: UploadFile = File(...), caption: str = Form("", max_length=200)):
    o = storyteller(token, request)
    if not one("SELECT 1 FROM stories WHERE id=? AND order_id=?", sid, o["id"]):
        raise HTTPException(404)
    if one("SELECT COUNT(*) n FROM photos WHERE story_id=?", sid)["n"] >= config.MAX_PHOTOS_PER_STORY:
        raise HTTPException(400, f"Maximaal {config.MAX_PHOTOS_PER_STORY} foto's per verhaal.")
    data = await photo.read(config.MAX_PHOTO_BYTES + 1)
    if len(data) > config.MAX_PHOTO_BYTES:
        raise HTTPException(400, "Foto te groot (max. 8 MB).")
    from io import BytesIO
    from PIL import Image, ImageOps
    try:
        img = ImageOps.exif_transpose(Image.open(BytesIO(data))).convert("RGB")
    except Exception:
        raise HTTPException(400, "Dit bestand is geen foto.")
    img.thumbnail((1600, 1600))
    path = media_dir(o["id"]) / f"foto_{sid}_{int(time.time() * 1000)}.jpg"
    img.save(path, "JPEG", quality=85)  # her-encoderen verwijdert ook EXIF/GPS
    run("INSERT INTO photos(story_id,path,caption) VALUES (?,?,?)", sid, str(path), caption.strip())
    return RedirectResponse(f"/v/{token}/verhaal/{sid}", status_code=303)


@app.get("/v/{token}/audio/{sid}")
def st_audio(request: Request, token: str, sid: int):
    o = storyteller(token, request)
    s = one("SELECT * FROM stories WHERE id=? AND order_id=?", sid, o["id"])
    if not s:
        raise HTTPException(404)
    return FileResponse(str(Path(s["audio_path"]).with_suffix(".mp3")), media_type="audio/mpeg")


@app.get("/v/{token}/foto/{pid}")
def st_photo_get(request: Request, token: str, pid: int):
    o = storyteller(token, request)
    p = one("SELECT p.* FROM photos p JOIN stories s ON s.id=p.story_id WHERE p.id=? AND s.order_id=?", pid, o["id"])
    if not p:
        raise HTTPException(404)
    return FileResponse(p["path"], media_type="image/jpeg")


@app.post("/v/{token}/goedkeurder")
def st_approver(request: Request, token: str, approver: str = Form(...)):
    o = storyteller(token, request)
    if approver not in ("storyteller", "buyer"):
        raise HTTPException(400)
    run("UPDATE orders SET approver=? WHERE id=?", approver, o["id"])
    return RedirectResponse(f"/v/{token}?ok=instellingen", status_code=303)


@app.post("/v/{token}/familie/{fid}")
def st_family(request: Request, token: str, fid: int, allow: str = Form(""), download: str = Form("")):
    o = storyteller(token, request)
    run("UPDATE family SET approved_by_storyteller=?, can_download=? WHERE id=? AND order_id=?",
        int(bool(allow)), int(bool(allow and download)), fid, o["id"])
    return RedirectResponse(f"/v/{token}?ok=instellingen", status_code=303)


@app.get("/v/{token}/boek.pdf")
def st_pdf(request: Request, token: str):
    o = storyteller(token, request)
    return Response(export.book_pdf(o, stories_for(o["id"], only_approved=True)), media_type="application/pdf")


@app.get("/v/{token}/export.zip")
def st_zip(request: Request, token: str):
    o = storyteller(token, request)
    st = stories_for(o["id"])
    for s in st:
        s["final_text"] = s["final_text"] or ""
    return Response(export.full_zip(o, st, export.book_pdf(o, [s for s in st if s["status"] == "approved"])),
                    media_type="application/zip", headers={"Content-Disposition": 'attachment; filename="mijn-verhalen.zip"'})


@app.post("/v/{token}/verwijderen")
def st_delete(request: Request, token: str, confirm: str = Form("")):
    o = storyteller(token, request)
    if confirm.strip().upper() != "WISSEN":
        raise HTTPException(400, "Typ WISSEN om te bevestigen.")
    delete_order_content(o["id"], reason="verteller")
    return HTMLResponse("<p style='font:20px sans-serif;padding:2em'>Alles is gewist. Er blijft niets van je "
                        "opnames, teksten of foto's bewaard.</p>")


# ---------------------------------------------------------------- familie
@app.get("/f/{token}", response_class=HTMLResponse)
def fam_home(request: Request, token: str):
    f, o = family_member(token)
    stories = stories_for(o["id"], only_shared=True, only_approved=True) if f["approved_by_storyteller"] else []
    return render(request, "family.html", f=f, order=o, token=token, stories=stories)


def _fam_story(token, sid):
    f, o = family_member(token)
    if not f["approved_by_storyteller"]:
        raise HTTPException(403)
    s = one("SELECT * FROM stories WHERE id=? AND order_id=? AND status='approved' AND shared=1", sid, o["id"])
    if not s:
        raise HTTPException(404)
    return f, o, s


@app.get("/f/{token}/audio/{sid}")
def fam_audio(token: str, sid: int):
    _, _, s = _fam_story(token, sid)
    return FileResponse(str(Path(s["audio_path"]).with_suffix(".mp3")), media_type="audio/mpeg")


@app.get("/f/{token}/foto/{pid}")
def fam_photo(token: str, pid: int):
    p = one("SELECT * FROM photos WHERE id=?", pid)
    if not p:
        raise HTTPException(404)
    _fam_story(token, p["story_id"])
    return FileResponse(p["path"], media_type="image/jpeg")


@app.get("/k/{token}/foto/{pid}")
def buyer_photo(token: str, pid: int):
    o = buyer(token)
    p = one("SELECT p.* FROM photos p JOIN stories s ON s.id=p.story_id WHERE p.id=? AND s.order_id=? "
            "AND s.status='approved' AND s.shared=1", pid, o["id"])
    if not p:
        raise HTTPException(404)
    return FileResponse(p["path"], media_type="image/jpeg")


@app.get("/f/{token}/boek.pdf")
def fam_pdf(token: str):
    f, o = family_member(token)
    if not (f["approved_by_storyteller"] and f["can_download"]):
        raise HTTPException(403, "De verteller heeft downloaden niet toegelaten.")
    return Response(export.book_pdf(o, stories_for(o["id"], only_shared=True, only_approved=True)),
                    media_type="application/pdf")


# ---------------------------------------------------------------- ops
@app.get("/ops", response_class=HTMLResponse)
def ops(request: Request, key: str = ""):
    if not config.OPS_KEY or not hmac.compare_digest(key, config.OPS_KEY):
        raise HTTPException(404)
    counts = {r["name"]: r["n"] for r in many(
        "SELECT name, COUNT(DISTINCT COALESCE(order_id, id)) n FROM events e WHERE NOT EXISTS "
        "(SELECT 1 FROM orders o WHERE o.id=e.order_id AND o.is_demo=1) GROUP BY name")}
    real = "FROM orders WHERE is_demo=0 AND status='paid'"
    stats = {
        "paid": one(f"SELECT COUNT(*) n {real}")["n"],
        "print_interest": one(f"SELECT COUNT(*) n {real} AND print_interest=1")["n"],
        "activated": one(f"SELECT COUNT(*) n {real} AND activated_at IS NOT NULL")["n"],
        "five_plus": one("SELECT COUNT(*) n FROM (SELECT order_id FROM stories s JOIN orders o ON o.id=s.order_id "
                         "WHERE o.is_demo=0 GROUP BY order_id HAVING COUNT(*)>=5)")["n"],
    }
    cutoff = (datetime.now(timezone.utc) - timedelta(days=10)).isoformat(timespec="seconds")
    quiet = many("SELECT o.id, o.created_at, o.activated_at, (SELECT MAX(created_at) FROM stories s WHERE "
                 "s.order_id=o.id) last FROM orders o WHERE o.is_demo=0 AND o.status='paid' AND o.deleted_at IS NULL")
    quiet = [q for q in quiet if (q["last"] or q["activated_at"] or q["created_at"]) < cutoff]
    by_source = many(f"SELECT source, COUNT(*) n {real} GROUP BY source ORDER BY n DESC")
    loop = sum(r["n"] for r in by_source if r["source"] in SOURCES)
    rewards = many("SELECT o.id, o.created_at, r.buyer_email AS referrer_email, r.id AS referrer_id "
                   "FROM orders o JOIN orders r ON r.id=o.referred_by WHERE o.reward_status='due' "
                   "AND o.status='paid'")
    cutoff30 = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat(timespec="seconds")
    for rw in rewards:
        rw["payable"] = rw["created_at"] < cutoff30
    return render(request, "ops.html", counts=counts, stats=stats, quiet=quiet, by_source=by_source,
                  loop_orders=loop, rewards=rewards)
