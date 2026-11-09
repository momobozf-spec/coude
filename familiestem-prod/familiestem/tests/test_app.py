"""End-to-end test van de klantreis en de toegangsrechten. Draai: python3 -m pytest -q"""
import hashlib
import hmac
import io
import json
import re
import subprocess
import time
import zipfile

import pytest
from fastapi.testclient import TestClient
from PIL import Image


@pytest.fixture()
def env(tmp_path, monkeypatch):
    monkeypatch.setenv("FS_DATA_DIR", str(tmp_path))
    import importlib
    from app import config, db, main
    importlib.reload(config)
    importlib.reload(db)
    importlib.reload(main)
    client = TestClient(main.app)
    client.__enter__()
    yield main, client
    client.__exit__(None, None, None)


def tone(tmp_path, seconds, name):
    p = tmp_path / name
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i",
                    f"sine=frequency=300:duration={seconds}", "-c:a", "libopus", "-b:a", "16k", str(p)], check=True)
    return p.read_bytes()


def order(client, **extra):
    data = {"buyer_name": "Sara", "buyer_email": "sara@example.invalid", "storyteller_name": "papa",
            "language": "nl", "accept_terms": "1", **extra}
    r = client.post("/bestellen", data=data, follow_redirects=False)
    assert r.status_code == 303
    k, v = re.search(r"k=([^&]+)&v=(.+)$", r.headers["location"]).groups()
    return k, v


def first_question(main, v):
    o = main.order_by("storyteller_token_hash", v)
    return main.many("SELECT id FROM questions WHERE order_id=? ORDER BY position", o["id"])


def test_public_pages(env):
    _, c = env
    assert c.get("/").status_code == 200
    assert "€49" in c.get("/").text
    assert c.get("/voorwaarden").status_code == 200


def test_full_journey_and_access(env, tmp_path):
    main, c = env
    k, v = order(c, print_interest="1")
    # koper krijgt cadeaubon en beheerpagina
    assert c.get(f"/bedankt?k={k}&v={v}").status_code == 200
    gc = c.get(f"/bedankt/cadeaubon.pdf?k={k}&v={v}")
    assert gc.status_code == 200 and gc.content[:4] == b"%PDF"
    assert c.get(f"/k/{k}").status_code == 200

    qs = first_question(main, v)
    audio = tone(tmp_path, 3, "a.webm")
    # opnemen vóór toestemming kan niet
    r = c.post(f"/v/{v}/opname/{qs[0]['id']}", files={"audio_file": ("a.webm", audio, "audio/webm")})
    assert r.status_code == 400
    # toestemming zonder vinkjes geweigerd
    assert c.post(f"/v/{v}/akkoord", data={}).status_code == 400
    assert c.post(f"/v/{v}/akkoord", data={"consent_record": "1", "consent_processing": "1"},
                  follow_redirects=False).status_code == 303

    r = c.post(f"/v/{v}/opname/{qs[0]['id']}", files={"audio_file": ("a.webm", audio, "audio/webm")})
    assert r.status_code == 200, r.text
    sid = r.json()["story_id"]
    s = main.one("SELECT * FROM stories WHERE id=?", sid)
    assert s["status"] == "transcribed" and s["transcript_source"] == "demo"
    assert 2.5 < s["audio_seconds"] < 3.5
    # dezelfde vraag twee keer beantwoorden kan niet
    assert c.post(f"/v/{v}/opname/{qs[0]['id']}",
                  files={"audio_file": ("a.webm", audio, "audio/webm")}).status_code == 400

    # koper: geen toegang tot niet-goedgekeurd verhaal, kan niet goedkeuren
    assert c.get(f"/k/{k}/audio/{sid}").status_code == 404
    assert c.post(f"/k/{k}/verhaal/{sid}", data={"final_text": "x", "approve": "1"}).status_code == 403

    # familie uitnodigen: nog niet toegelaten door verteller
    r = c.post(f"/k/{k}/familie", data={"name": "Yasmine"}, follow_redirects=False)
    ft = r.headers["location"].split("/f/")[1]
    assert "moet je nog toelaten" in c.get(f"/f/{ft}").text
    assert c.get(f"/f/{ft}/audio/{sid}").status_code == 403

    # verteller keurt goed en deelt
    c.post(f"/v/{v}/verhaal/{sid}", data={"final_text": "Ik groeide op in Mechelen.", "approve": "1", "shared": "1"})
    assert c.get(f"/k/{k}/audio/{sid}").status_code == 200
    fam = main.one("SELECT id FROM family WHERE order_id=(SELECT order_id FROM stories WHERE id=?)", sid)
    c.post(f"/v/{v}/familie/{fam['id']}", data={"allow": "1"})
    assert c.get(f"/f/{ft}/audio/{sid}").status_code == 200
    assert "Mechelen" in c.get(f"/f/{ft}").text
    assert c.get(f"/f/{ft}/boek.pdf").status_code == 403          # download niet toegelaten
    c.post(f"/v/{v}/familie/{fam['id']}", data={"allow": "1", "download": "1"})
    assert c.get(f"/f/{ft}/boek.pdf").content[:4] == b"%PDF"

    # tweede verhaal: goedgekeurd maar NIET gedeeld -> onzichtbaar voor familie en koper
    r = c.post(f"/v/{v}/opname/{qs[1]['id']}", files={"audio_file": ("b.webm", audio, "audio/webm")})
    sid2 = r.json()["story_id"]
    c.post(f"/v/{v}/verhaal/{sid2}", data={"final_text": "Geheim verhaal.", "approve": "1"})
    assert c.get(f"/f/{ft}/audio/{sid2}").status_code == 404
    assert c.get(f"/k/{k}/audio/{sid2}").status_code == 404
    assert "Geheim verhaal" not in c.get(f"/k/{k}").text

    # foto: EXIF weg, max 3
    img = Image.new("RGB", (40, 30), "red")
    buf = io.BytesIO()
    img.save(buf, "JPEG")
    for _ in range(3):
        assert c.post(f"/v/{v}/verhaal/{sid}/foto", files={"photo": ("p.jpg", buf.getvalue(), "image/jpeg")},
                      follow_redirects=False).status_code == 303
    assert c.post(f"/v/{v}/verhaal/{sid}/foto",
                  files={"photo": ("p.jpg", buf.getvalue(), "image/jpeg")}).status_code == 400
    assert c.post(f"/v/{v}/verhaal/{sid}/foto",
                  files={"photo": ("x.jpg", b"geen foto", "image/jpeg")}).status_code == 400

    # export verteller: alles; export koper: enkel gedeeld
    z = zipfile.ZipFile(io.BytesIO(c.get(f"/v/{v}/export.zip").content))
    names = z.namelist()
    assert "boek.pdf" in names and "manifest.json" in names
    assert any(n.endswith("_origineel.webm") for n in names) and any(n.endswith(".mp3") for n in names)
    assert len(json.loads(z.read("manifest.json"))["verhalen"]) == 2
    zk = zipfile.ZipFile(io.BytesIO(c.get(f"/k/{k}/export.zip").content))
    assert len(json.loads(zk.read("manifest.json"))["verhalen"]) == 1

    # verteller duidt koper aan als goedkeurder
    r = c.post(f"/v/{v}/opname/{qs[2]['id']}", files={"audio_file": ("c.webm", audio, "audio/webm")})
    sid3 = r.json()["story_id"]
    c.post(f"/v/{v}/goedkeurder", data={"approver": "buyer"})
    assert c.post(f"/k/{k}/verhaal/{sid3}", data={"final_text": "Door koper nagelezen.", "approve": "1"},
                  follow_redirects=False).status_code == 303

    # meetpunten
    from app import config
    config.OPS_KEY = "test"
    page = c.get("/ops?key=test").text
    assert c.get("/ops?key=fout").status_code == 404
    assert "interesse gedrukt boek" in page

    # wissen door verteller: daarna zijn alle links dood
    assert c.post(f"/v/{v}/verwijderen", data={"confirm": "nee"}).status_code == 400
    assert c.post(f"/v/{v}/verwijderen", data={"confirm": "WISSEN"}).status_code == 200
    assert c.get(f"/v/{v}").status_code == 404
    assert c.get(f"/k/{k}").status_code == 404
    assert c.get(f"/f/{ft}").status_code == 404


def test_recording_limits(env, tmp_path):
    main, c = env
    k, v = order(c)
    c.post(f"/v/{v}/akkoord", data={"consent_record": "1", "consent_processing": "1"})
    qs = first_question(main, v)
    long = tone(tmp_path, 11 * 60, "long.webm")
    r = c.post(f"/v/{v}/opname/{qs[0]['id']}", files={"audio_file": ("l.webm", long, "audio/webm")})
    assert r.status_code == 400 and "10 minuten" in r.json()["detail"]
    r = c.post(f"/v/{v}/opname/{qs[0]['id']}", files={"audio_file": ("x.webm", b"x" * 5000, "audio/webm")})
    assert r.status_code == 400
    # buiten verzamelperiode
    main.run("UPDATE orders SET collect_until='2000-01-01T00:00:00+00:00'")
    r = c.post(f"/v/{v}/opname/{qs[0]['id']}", files={"audio_file": ("a.webm", tone(tmp_path, 2, "s.webm"), "audio/webm")})
    assert r.status_code == 400
    # verlengen kan eenmaal
    assert c.post(f"/k/{k}/verlengen", follow_redirects=False).status_code == 303
    assert c.post(f"/k/{k}/verlengen").status_code == 400


def test_pin_protects_storyteller(env):
    main, c = env
    k, v = order(c)
    c.post(f"/v/{v}/akkoord", data={"consent_record": "1", "consent_processing": "1", "pin": "4821"})
    assert c.get(f"/v/{v}").status_code == 200          # zelfde toestel: cookie gezet
    from fastapi.testclient import TestClient
    other = TestClient(main.app)                          # koper met dezelfde link, ander toestel
    r = other.get(f"/v/{v}", follow_redirects=False)
    assert r.status_code == 303 and r.headers["location"].endswith("/pincode")
    assert other.post(f"/v/{v}/verwijderen", data={"confirm": "WISSEN"}, follow_redirects=False).status_code == 303
    assert main.one("SELECT deleted_at FROM orders WHERE deleted_at IS NULL") is not None
    r = other.post(f"/v/{v}/pincode", data={"pin": "0000"}, follow_redirects=False)
    assert r.headers["location"].endswith("fout=1")
    other.post(f"/v/{v}/pincode", data={"pin": "4821"})
    assert other.get(f"/v/{v}", follow_redirects=False).status_code == 200
    for _ in range(5):
        TestClient(main.app).post(f"/v/{v}/pincode", data={"pin": "1111"}, follow_redirects=False)
    assert TestClient(main.app).post(f"/v/{v}/pincode", data={"pin": "4821"}).status_code == 429
    assert c.post(f"/v/{v}/akkoord", data={"consent_record": "1", "consent_processing": "1", "pin": "12a"}).status_code == 400


def test_invalid_links_and_payment(env):
    main, c = env
    assert c.get("/k/onzin").status_code == 404
    assert c.get("/v/onzin").status_code == 404
    assert c.get("/f/onzin").status_code == 404
    assert c.post("/bestellen", data={"buyer_name": "a", "buyer_email": "a@b.c", "storyteller_name": "b"}).status_code == 400
    k, v = order(c)
    # onbetaalde bestelling heeft geen toegang
    main.run("UPDATE orders SET status='pending_payment'")
    assert c.get(f"/k/{k}").status_code == 402
    assert c.get(f"/v/{v}").status_code == 404


def test_stripe_webhook_signature(env):
    main, c = env
    from app import config
    config.STRIPE_WEBHOOK_SECRET = "whsec_test"
    k, v = order(c)
    main.run("UPDATE orders SET status='pending_payment', stripe_session_id='cs_1', payment_mode='stripe'")
    body = json.dumps({"type": "checkout.session.completed",
                       "data": {"object": {"id": "cs_1", "payment_status": "paid"}}}).encode()
    assert c.post("/stripe/webhook", content=body, headers={"stripe-signature": "t=1,v1=fout"}).status_code == 400
    t = str(int(time.time()))
    sig = hmac.new(b"whsec_test", f"{t}.".encode() + body, hashlib.sha256).hexdigest()
    assert c.post("/stripe/webhook", content=body, headers={"stripe-signature": f"t={t},v1={sig}"}).status_code == 200
    assert main.one("SELECT status FROM orders")["status"] == "paid"


def test_retention_purge(env, tmp_path):
    main, c = env
    k, v = order(c)
    c.post(f"/v/{v}/akkoord", data={"consent_record": "1", "consent_processing": "1"})
    qs = first_question(main, v)
    c.post(f"/v/{v}/opname/{qs[0]['id']}", files={"audio_file": ("a.webm", tone(tmp_path, 2, "a.webm"), "audio/webm")})
    main.run("UPDATE orders SET host_until='2000-01-01T00:00:00+00:00'")
    main.purge_expired()
    assert main.one("SELECT COUNT(*) n FROM stories")["n"] == 0
    assert c.get(f"/k/{k}").status_code == 404


def test_growth_loops(env):
    main, c = env
    from app import config
    config.OPS_KEY = "test"
    k, v = order(c)
    o = main.order_by("buyer_token_hash", k)
    code = o["referral_code"]
    assert code and len(code) == 6
    assert code in c.get(f"/k/{k}").text and "wa.me" in c.get(f"/k/{k}").text

    # landingspagina via code toont korting
    page = c.get(f"/?code={code}").text
    assert "€39" in page and code in page

    # eigen code gebruiken geeft geen korting
    order(c, ref_code=code)
    own = main.one("SELECT * FROM orders ORDER BY id DESC LIMIT 1")
    assert own["amount_cents"] == 4900 and own["referred_by"] is None

    # iemand anders met de code: €10 korting, beloning klaargezet
    order(c, buyer_email="nadia@example.invalid", ref_code=code.lower())
    ref = main.one("SELECT * FROM orders ORDER BY id DESC LIMIT 1")
    assert ref["amount_cents"] == 3900 and ref["referred_by"] == o["id"]
    assert ref["source"] == "doorverwijzing" and ref["reward_status"] == "due"

    # ongeldige code: volle prijs
    order(c, buyer_email="x@example.invalid", ref_code="ZZZZZZ")
    assert main.one("SELECT amount_cents FROM orders ORDER BY id DESC LIMIT 1")["amount_cents"] == 4900

    # familiepagina toont de oproep, die als bron 'familie' telt
    r = c.post(f"/k/{k}/familie", data={"name": "Yasmine"}, follow_redirects=False)
    ft = r.headers["location"].split("/f/")[1]
    assert "/?bron=familie" in c.get(f"/f/{ft}").text
    assert 'value="familie"' in c.get("/?bron=familie").text
    order(c, buyer_email="fam@example.invalid", source="familie")
    assert main.one("SELECT source FROM orders ORDER BY id DESC LIMIT 1")["source"] == "familie"

    ops = c.get("/ops?key=test").text
    assert "Groeilussen" in ops and "nu terugbetalen" not in ops and "wacht 30 dagen" in ops
