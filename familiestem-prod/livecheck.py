from app import config, mailer, text
try:
    mailer.send(config.SUPPORT_EMAIL, "Familiestem: testmail",
                "Dit is een testmail van je server. Als je dit leest, werken de klantmails.")
    print("MAIL: verstuurd")
except Exception as e:
    print("MAIL FOUT:", type(e).__name__, str(e)[:200])
try:
    t = text.transcribe("/data/voices/opa-jef-1.mp3", "nl")
    print("TRANSCRIPTIE (" + t["source"] + "):", t["text"][:400])
    print("ONZEKERE WOORDEN:", t["flags"][:10])
except Exception as e:
    print("TRANSCRIPTIE FOUT:", type(e).__name__, str(e)[:300])
