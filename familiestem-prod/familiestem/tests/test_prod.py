"""Productiemodus: opstartcontrole, Stripe-flow (nagebootst), bevestigingsmail, dagelijkse jobs, back-up."""
import hashlib
import hmac
import importlib
import json
import re
import tarfile
import time

import pytest
from fastapi.testclient import TestClient

PROD_ENV = {
    "FS_ENV": "production",
    "FS_PUBLIC_URL": "https://familie.test",
    "FS_OPS_KEY": "x" * 32,
    "STRIPE_SECRET_KEY": "sk_test_dummy",
    "STRIPE_WEBHOOK_SECRET": "whsec_dummy",
    "OPENAI_API_KEY": "sk-dummy",
    "OPENAI_BASE_URL": "https://eu.api.openai.com/v1",
    "SMTP_HOST": "smtp.test",
    "SMTP_USER": "u",
    "SMTP_PASSWORD": "p",
    "MAIL_FROM": "Familiestem <hallo@familie.test>",
    "SUPPORT_EMAIL": "hallo@familie.test",
}


def load(monkeypatch, tmp_path, env):
    monkeypatch.setenv("FS_DATA_DIR", str(tmp_path))
    for k in list(PROD_ENV):
        monkeypatch.delenv(k, raising=False)
    for k, v in env.items():
        monkeypatch.setenv(k, v)
    from app import config, db, mailer, main
    for m in (config, db, mailer, main):
        importlib.reload(m)
    return config, db, mailer, main


def test_refuses_to_start_without_keys(monkeypatch, tmp_path):
    config, _, _, main = load(monkeypatch, tmp_path, {"FS_ENV": "production"})
    problems = config.production_problems()
    assert any("STRIPE_SECRET_KEY" in p for p in problems)
    assert any("SMTP" in p for p in problems)
    with pytest.raises(RuntimeError, match="Niet klaar voor productie"):
        with TestClient(main.app):
            pass


@pytest.fixture()
def prod(monkeypatch, tmp_path):
    config, db, mailer, main = load(monkeypatch, tmp_path, PROD_ENV)
    sent = []
    monkeypatch.setattr(mailer, "send", lambda to, subj, body, att=None: sent.append((to, subj, body, att)))

    class FakeResp:
        def __init__(self, data):
            self._d = data

        def raise_for_status(self):
            pass

        def json(self):
            return self._d

    calls = []

    def fake_post(url, **kw):
        calls.append((url, kw))
        return FakeResp({"id": f"cs_{len(calls)}", "url": "https://checkout.stripe.com/c/pay/cs_test"})

    monkeypatch.setattr(main.httpx, "post", fake_post)
    client = TestClient(main.app)
    client.__enter__()
    yield config, db, main, client, sent, calls
    client.__exit__(None, None, None)


def webhook(client, session_id):
    body = json.dumps({"type": "checkout.session.completed",
                       "data": {"object": {"id": session_id, "payment_status": "paid"}}}).encode()
    t = str(int(time.time()))
    sig = hmac.new(b"whsec_dummy", f"{t}.".encode() + body, hashlib.sha256).hexdigest()
    return client.post("/stripe/webhook", content=body, headers={"stripe-signature": f"t={t},v1={sig}"})


def place_order(client, email="sara@example.invalid"):
    return client.post("/bestellen", data={"buyer_name": "Sara", "buyer_email": email, "storyteller_name": "papa",
                                           "accept_terms": "1"}, follow_redirects=False)


def test_production_order_flow(prod):
    config, db, main, c, sent, calls = prod
    home = c.get("/")
    assert "DEMO-MODUS" not in home.text
    assert home.headers["content-security-policy"] and home.headers["x-frame-options"] == "DENY"
    assert c.get("/healthz").json() == {"ok": True}

    r = place_order(c)
    assert r.status_code == 303 and r.headers["location"].startswith("https://checkout.stripe.com")
    url, kw = calls[0]
    assert url.endswith("/checkout/sessions")
    assert kw["data"]["line_items[0][price_data][unit_amount]"] == "4900"
    assert kw["data"]["payment_method_types[1]"] == "bancontact"
    assert kw["data"]["success_url"].startswith("https://familie.test/bedankt?k=")
    o = main.one("SELECT * FROM orders")
    assert o["status"] == "pending_payment" and not sent

    # vóór betaling: geen toegang
    k = re.search(r"k=([^&]+)", kw["data"]["success_url"]).group(1)
    assert c.get(f"/k/{k}").status_code == 402

    assert webhook(c, "cs_1").status_code == 200
    assert main.one("SELECT status FROM orders")["status"] == "paid"
    assert len(sent) == 1
    to, subj, body, att = sent[0]
    assert to == "sara@example.invalid" and "papa" in subj
    assert "https://familie.test/k/" in body and "https://familie.test/v/" in body
    assert att[0][0] == "cadeaubon.pdf" and att[0][1][:4] == b"%PDF"
    assert main.one("SELECT COUNT(*) n FROM pending_links")["n"] == 0
    assert c.get(f"/k/{k}").status_code == 200
    assert c.get(f"/k/{k}").headers["cache-control"] == "no-store"

    # dubbele webhook stuurt geen tweede mail
    webhook(c, "cs_1")
    assert len(sent) == 1


def test_mail_failure_does_not_break_payment(prod, monkeypatch):
    config, db, main, c, sent, calls = prod
    from app import mailer, jobs
    importlib.reload(jobs)

    def boom(*a, **k):
        raise OSError("smtp down")

    monkeypatch.setattr(mailer, "send", boom)
    place_order(c)
    webhook(c, "cs_1")
    assert main.one("SELECT status FROM orders")["status"] == "paid"
    assert main.one("SELECT COUNT(*) n FROM events WHERE name='mail_failed'")["n"] == 1
    assert main.one("SELECT COUNT(*) n FROM pending_links")["n"] == 1

    monkeypatch.setattr(mailer, "send", lambda to, subj, body, att=None: sent.append(subj))
    assert jobs.retry_confirmations() == 1
    assert main.one("SELECT confirmation_sent_at FROM orders")["confirmation_sent_at"]
    assert main.one("SELECT COUNT(*) n FROM pending_links")["n"] == 0


def test_unpaid_links_expire(prod):
    config, db, main, c, sent, calls = prod
    from app import jobs
    importlib.reload(jobs)
    place_order(c)
    main.run("UPDATE pending_links SET created_at='2000-01-01T00:00:00+00:00'")
    jobs.retry_confirmations()
    assert main.one("SELECT COUNT(*) n FROM pending_links")["n"] == 0


def test_daily_jobs(prod, tmp_path):
    config, db, main, c, sent, calls = prod
    from app import jobs
    importlib.reload(jobs)
    place_order(c)
    webhook(c, "cs_1")
    sent.clear()
    # 11 dagen stil, niet gestart -> één seintje, niet twee keer
    main.run("UPDATE orders SET created_at='2000-01-01T00:00:00+00:00'")
    assert jobs.nudge_quiet() == 1
    assert "nog niet gestart" in sent[-1][2]
    assert jobs.nudge_quiet() == 0
    # einde bewaring nadert -> bericht
    main.run("UPDATE orders SET host_until=?", "2099-01-01T00:00:00+00:00")
    assert jobs.expiry_notices() == 0
    from datetime import datetime, timedelta, timezone
    main.run("UPDATE orders SET host_until=?",
             (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(timespec="seconds"))
    assert jobs.expiry_notices() == 1 and jobs.expiry_notices() == 0
    # back-up bevat databank
    path = jobs.backup()
    with tarfile.open(path) as t:
        assert "familiestem.db" in t.getnames()
    jobs.main()


def test_rate_limit_on_orders(prod):
    config, db, main, c, sent, calls = prod
    for i in range(10):
        assert place_order(c, f"a{i}@example.invalid").status_code == 303
    assert place_order(c, "z@example.invalid").status_code == 429


def test_invalid_email_rejected(prod):
    config, db, main, c, sent, calls = prod
    assert place_order(c, "geen-mail").status_code == 400
    assert place_order(c, "a@b").status_code == 400
