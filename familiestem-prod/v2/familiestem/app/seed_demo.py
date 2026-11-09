"""Laadt één duidelijk FICTIEF voorbeeld (python -m app.seed_demo). Audio = testtoon, geen echte stem."""
import subprocess

from . import config, db
from .main import create_order, mark_paid, media_dir, run

STORIES = [
    ("Hoe heb je je partner leren kennen?",
     "Het was op de kermis in het dorp, in de zomer. Ik stond bij de botsauto's met mijn broer. Ik reed expres "
     "drie keer tegen haar wagen, en daarna ben ik me gaan excuseren. Ze vond dat eigenlijk wel grappig.\n\n"
     "Een week later stond ik aan haar deur met een zak kersen. Haar moeder heeft me binnengelaten, zij niet."),
    ("Wat was je eerste baan?",
     "Ik was vijftien en werkte in de bakkerij op de hoek. Om vijf uur 's morgens moest ik er zijn. "
     "Het eerste wat ik leerde was hoe je een brood snijdt zonder het plat te drukken.\n\n"
     "Ik verdiende niet veel, maar ik mocht elke zaterdag de gebroken koekjes meenemen."),
    ("Welke herinnering wil je doorgeven?",
     "Dat je niet alles in één keer moet weten. Ik heb veel dingen pas laat geleerd, en dat was ook goed."),
]


def refresh_texts():
    """Zet de tekst en naam van een bestaand voorbeeld gelijk met STORIES (na een tekstwijziging)."""
    from .main import many, one
    o = one("SELECT id FROM orders WHERE is_demo=1 AND deleted_at IS NULL ORDER BY id LIMIT 1")
    if not o:
        return 0
    run("UPDATE orders SET storyteller_name='opa Jef (fictief)' WHERE id=?", o["id"])
    rows = many("SELECT s.id FROM stories s JOIN questions q ON q.id=s.question_id WHERE s.order_id=? "
                "ORDER BY q.position", o["id"])
    for r, (_, body) in zip(rows, STORIES):
        run("UPDATE stories SET transcript=?, readable=?, final_text=? WHERE id=?", body, body, body, r["id"])
    return len(rows)


def main():
    db.init()
    with db.connect() as c:
        exists = c.execute("SELECT 1 FROM orders WHERE is_demo=1").fetchone()
    if exists:
        print("Voorbeeld bestaat al.")
        return
    oid, bt, st = create_order("Voorbeeldkoper", "voorbeeld@example.invalid", "opa Jef (fictief)", "nl",
                               "Dit is een verzonnen voorbeeld.", False, "demo", is_demo=True)
    mark_paid(oid)
    run("UPDATE orders SET activated_at=?, collect_until='2099-01-01T00:00:00+00:00', "
        "host_until='2099-01-01T00:00:00+00:00', consent_version='demo' WHERE id=?", db.now(), oid)
    d = media_dir(oid)
    for i, (q, body) in enumerate(STORIES):
        qid = run("INSERT INTO questions(order_id,position,text,custom) VALUES (?,?,?,1)", oid, 100 + i, q)
        path = d / f"demo_{i}.webm"
        subprocess.run([config.ffmpeg_bin(), "-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i",
                        "sine=frequency=330:duration=4", "-c:a", "libopus", str(path)], check=True)
        subprocess.run([config.ffmpeg_bin(), "-hide_banner", "-loglevel", "error", "-y", "-i", str(path), "-c:a",
                        "libmp3lame", str(path.with_suffix(".mp3"))], check=True)
        run("INSERT INTO stories(order_id,question_id,audio_path,audio_seconds,transcript,transcript_flags,"
            "transcript_source,readable,readable_ok,final_text,status,shared,created_at,approved_at) "
            "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            oid, qid, str(path), 4.0, body, "[]", "demo", body, 1, body, "approved", 1, db.now(), db.now())
    print(f"Fictief voorbeeld geladen (order {oid}). Verteller-link: {config.PUBLIC_URL}/v/{st}")


if __name__ == "__main__":
    main()
