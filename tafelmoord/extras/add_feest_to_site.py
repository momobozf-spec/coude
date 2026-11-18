# Voegt het Feestpakket toe aan de inhoudslijst (bron shop.json en de gepubliceerde pagina's).
import io, json, os, sys
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ITEMS = {
    "nl": ("Stemformulier en de volledige oplossing", "Bonus: Feestpakket met avondplan tot middernacht, Belgisch menu, muziek, decor en een deurbord"),
    "fr": ("Bulletin de vote et solution complète", "Bonus : Pack festif avec déroulé jusqu'à minuit, menu belge, musique, déco et pancarte de porte"),
}
ok = True
for lang, (last, new) in ITEMS.items():
    p = os.path.join(BASE, "content", "games", "oudejaar", lang, "shop.json")
    d = json.load(io.open(p, encoding="utf-8"))
    if new not in d["contents"]:
        d["contents"].append(new)
        io.open(p, "w", encoding="utf-8").write(json.dumps(d, ensure_ascii=False, indent=2) + "\n")
    page = os.path.join(BASE, "deploy", lang, "oudejaar.html")
    s = io.open(page, encoding="utf-8").read()
    if new in s:
        print(lang, "al aanwezig"); continue
    old = f"<li>{last}</li>"
    if s.count(old) != 1:
        print(lang, "FOUT: anker niet uniek gevonden", s.count(old)); ok = False; continue
    s = s.replace(old, old + f"\n        <li>{new}</li>")
    io.open(page, "w", encoding="utf-8").write(s)
    print(lang, "toegevoegd")
sys.exit(0 if ok else 1)
