# Bouwt het Feestpakket (NL) en Pack festif (FR) voor Moord op Oudejaar als HTML.
# Daarna zet print_pdf.ps1 ze om naar pdf met Edge en voegt ze toe aan de spelpakketten.
import json, html, os

HERE = os.path.dirname(os.path.abspath(__file__))
COST = json.load(open(os.path.join(HERE, 'costumes.json'), encoding='utf-8'))
ORDER = ["linda","kevin","nadia","jp","greet","mos","sofie","dries","elke","jeanine","yusuf","bart"]

T = {
"nl": dict(
 file="7_Feestpakket",
 brand="Tafelmoord", title="Feestpakket", game="Moord op Oudejaar · in Café De Laatste Ronde",
 intro="Alles om van je speelavond een echte oudejaarsavond te maken: een avondplan dat eindigt op middernacht, een Belgisch menu, muziek, decor en een overzicht van de kostuums. Gebruik wat je wil, niets is verplicht.",
 tip="Dit pakket verklapt niets over de dader. Je mag het gerust lezen, ook als je zelf meespeelt.",
 plan_h="Het avondplan", plan_sub="Start om 20:00 en los de moord op vóór de klok twaalf slaat.",
 plan=[("19:45","Deur open","Gasten komen binnen in kostuum. Zet de muziek op en schenk het eerste glas."),
       ("20:00","Proloog","Lees de proloog uit de gids voor. Iedereen stelt zich voor in zijn rol."),
       ("20:30","Ronde 1 + aperitief","Bittergarnituur en kroketten op tafel. Verdachten praten, vragen en liegen."),
       ("21:30","Ronde 2 + hoofdgerecht","Stoverij of stoemp. De eerste bewijzen komen op tafel."),
       ("22:45","Ronde 3 + dessert","Laatste beschuldigingen boven de dame blanche."),
       ("23:30","Stemming","Iedereen vult het stemformulier in. Geen overleg meer."),
       ("23:45","Onthulling","Scan de QR-code en lees de oplossing voor."),
       ("00:00","Aftellen","Klink op een opgeloste zaak en een gelukkig nieuwjaar.")],
 plan_note="Spelen jullie niet op oudejaar? Schuif alles op, maar houd de volgorde: proloog, drie rondes, stemming, onthulling.",
 menu_h="Het menu van Café De Laatste Ronde", menu_sub="Eenvoudig, Belgisch en grotendeels op voorhand klaar te maken.",
 menu=[("Aperitief","Bittergarnituur: blokjes oude kaas met selderijzout en mosterd, salami, augurkjes. Kaas- en garnaalkroketten uit de oven of de friteuse."),
       ("Hoofdgerecht","Stoverij met frietjes, een knipoog naar het frietkot van Dries. Vegetarisch: stoemp met prei en gebakken champignons. Maak de stoverij een dag op voorhand: ze wordt alleen maar beter."),
       ("Dessert","Dame blanche met warme chocoladesaus, of een speculoostiramisu die je de avond voordien maakt."),
       ("Om middernacht","Cava of een alcoholvrije bubbel, en een schaaltje nieuwjaarsbrieven of oliebollen.")],
 drinks_h="Aan de toog",
 drinks=["<b>Kerstbier</b> van een Waalse brouwerij, voor JP's eer.",
         "<b>Een pintje van 't vat</b> of een fles pils op ijs.",
         "<b>Laatste Ronde-mocktail (zonder alcohol):</b> appelsap, een scheut citroen, bruisend water, een kaneelstokje en een schijfje appel.",
         "<b>Alcoholvrij bier</b> en warme chocolademelk voor wie rijdt (zoals Yusuf, de taxichauffeur)."],
 drinks_note="Iedereen speelt mee, ook zonder alcohol. Zet de alcoholvrije opties even mooi op tafel.",
 music_h="Muziek", music=["Van 19:45 tot het hoofdgerecht: Belgische cafékrakers en schlagers uit de jaren 70, 80 en 90. Zoek in je muziekapp op ‘bruin café’ of ‘Vlaamse klassiekers’.",
   "Bij het dessert: zachter, chanson en Franse klassiekers, voor JP en de Franstalige gasten.",
   "Speelt iemand Elke, de DJ? Laat haar de muziek kiezen. Dat past in haar rol.",
   "Om 23:59: muziek uit en samen aftellen."],
 decor_h="Decor", decor=["Kaarsen en lichtjes: om 23:45 viel in het verhaal het licht uit.",
   "Bierviltjes, een krijtbord met de ‘dagschotel’ en een lat met schulden (wie staat er nog op de lat?).",
   "Een hoek of een deur met tape afgezet: ‘Kelder – niet betreden’.",
   "Hang het deurbord achteraan in dit pakket aan je voordeur."],
 dress_h="Kostuums in één oogopslag", dress_sub="Elke gast vindt zijn eigen kostuumtip ook op zijn uitnodiging. Hier staan ze allemaal samen, handig om te helpen of te ruilen.",
 col_role="Rol", col_cost="Kostuum",
 sign_top="Vanavond gesloten", sign_name="Café De Laatste Ronde", sign_sub="wegens moord", sign_foot="Verdachten mogen binnen. Laat je alibi aan de deur.",
 foot="Tafelmoord · Marhaba Cooperation BV · alleen voor eigen gebruik"),
"fr": dict(
 file="7_Pack_festif",
 brand="Tafelmoord", title="Pack festif", game="Meurtre au Réveillon · au Café La Dernière Tournée",
 intro="Tout pour transformer votre soirée de jeu en vrai réveillon : un déroulé qui se termine à minuit, un menu belge, de la musique, la déco et un récapitulatif des costumes. Prenez ce qui vous plaît, rien n'est obligatoire.",
 tip="Ce pack ne révèle rien sur le coupable. Vous pouvez le lire même si vous jouez.",
 plan_h="Le déroulé de la soirée", plan_sub="Commencez à 20h00 et résolvez le meurtre avant les douze coups de minuit.",
 plan=[("19h45","Accueil","Les invités arrivent costumés. Lancez la musique et servez le premier verre."),
       ("20h00","Prologue","Lisez le prologue du guide. Chacun se présente dans son rôle."),
       ("20h30","Manche 1 + apéro","Fromage, charcuterie et croquettes sur la table. Les suspects parlent, questionnent et mentent."),
       ("21h30","Manche 2 + plat","Carbonnade ou stoemp. Les premières preuves arrivent sur la table."),
       ("22h45","Manche 3 + dessert","Dernières accusations autour de la dame blanche."),
       ("23h30","Le vote","Chacun remplit son bulletin de vote. Plus de discussion."),
       ("23h45","La révélation","Scannez le QR code et lisez la solution à voix haute."),
       ("00h00","Le décompte","Trinquez à une enquête résolue et à la nouvelle année.")],
 plan_note="Vous ne jouez pas le 31 ? Décalez les heures, mais gardez l'ordre : prologue, trois manches, vote, révélation.",
 menu_h="Le menu du Café La Dernière Tournée", menu_sub="Simple, belge et presque tout se prépare à l'avance.",
 menu=[("Apéritif","Cubes de vieux fromage au sel de céleri et moutarde, saucisson, cornichons. Croquettes au fromage et aux crevettes, au four ou à la friteuse."),
       ("Plat","Carbonnade flamande et frites, un clin d'œil à la friterie de Dries. Version végétarienne : stoemp aux poireaux et champignons poêlés. Préparez la carbonnade la veille : elle n'en sera que meilleure."),
       ("Dessert","Dame blanche et sauce chocolat chaude, ou un tiramisu au spéculoos préparé la veille."),
       ("À minuit","Cava ou bulles sans alcool, et quelques galettes ou beignets du Nouvel An.")],
 drinks_h="Au comptoir",
 drinks=["<b>Une bière de Noël</b> d'une brasserie wallonne, en l'honneur de JP.",
         "<b>Une pinte au fût</b> ou des bouteilles de pils au frais.",
         "<b>Mocktail Dernière Tournée (sans alcool) :</b> jus de pomme, un trait de citron, eau pétillante, un bâton de cannelle et une tranche de pomme.",
         "<b>Bière sans alcool</b> et chocolat chaud pour ceux qui conduisent (comme Yusuf, le taximan)."],
 drinks_note="Tout le monde joue, avec ou sans alcool. Présentez les boissons sans alcool aussi joliment que les autres.",
 music_h="Musique", music=["De 19h45 jusqu'au plat : les grands classiques des cafés belges et la variété des années 70, 80 et 90. Cherchez « café belge » ou « variété belge » dans votre appli musicale.",
   "Au dessert : plus doux, de la chanson française.",
   "Quelqu'un joue Elke, la DJ ? Laissez-la choisir la musique. C'est dans son rôle.",
   "À 23h59 : coupez la musique et faites le décompte ensemble."],
 decor_h="Déco", decor=["Bougies et guirlandes : dans l'histoire, la lumière s'éteint à 23h45.",
   "Sous-bocks, une ardoise avec le « plat du jour » et une liste d'ardoises (qui a encore une ardoise ?).",
   "Un coin ou une porte barré de ruban adhésif : « Cave – accès interdit ».",
   "Accrochez la pancarte à la fin de ce pack sur votre porte d'entrée."],
 dress_h="Les costumes en un coup d'œil", dress_sub="Chaque invité retrouve aussi son conseil costume sur son invitation. Les voici tous réunis, pratique pour aider ou échanger.",
 col_role="Rôle", col_cost="Costume",
 sign_top="Fermé ce soir", sign_name="Café La Dernière Tournée", sign_sub="pour cause de meurtre", sign_foot="Les suspects peuvent entrer. Laissez votre alibi à la porte.",
 foot="Tafelmoord · Marhaba Cooperation BV · usage privé uniquement"),
}

CSS = """
@page { size: A4; margin: 18mm 18mm 20mm; @bottom-center { content: "%(foot)s · " counter(page); font: 8.5pt 'Segoe UI', Arial, sans-serif; color: #7a5c3c; } }
@page cover { margin: 0; @bottom-center { content: none; } }
@page sign { margin: 0; @bottom-center { content: none; } }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; font-family: Charter, Georgia, 'Times New Roman', serif; color: #2b1d12; font-size: 10.5pt; line-height: 1.5; }
h1,h2,h3 { line-height: 1.15; margin: 0 0 .4em; }
h2 { font-size: 20pt; color: #2b1d12; margin-top: 0; }
h3 { font-size: 12pt; color: #9b2a1a; margin: 1em 0 .2em; }
.eyebrow { font-family: 'Segoe UI', Arial, sans-serif; text-transform: uppercase; letter-spacing: .18em; font-size: 7.5pt; color: #c8873e; font-weight: bold; }
.sub { color: #7a5c3c; margin: 0 0 1.2em; }
.cover { page: cover; background: #2a1810; color: #f6efe2; height: 297mm; padding: 70mm 22mm 0; box-sizing: border-box; }
.cover h1 { font-size: 44pt; font-weight: bold; margin: .2em 0 .1em; }
.cover .game { color: #e9dcc4; font-size: 13pt; margin-bottom: 18mm; }
.cover p { color: #e9dcc4; max-width: 140mm; }
.cover .tip { border-top: 1px solid #c8873e; padding-top: 4mm; margin-top: 10mm; font-size: 9.5pt; color: #c9b28f; }
.page { break-before: page; }
table { width: 100%%; border-collapse: collapse; }
tr { break-inside: avoid; }
td, th { text-align: left; vertical-align: top; padding: 2.2mm 2mm; border-bottom: 1px solid #e2d4b9; }
th { font-family: 'Segoe UI', Arial, sans-serif; font-size: 7.5pt; text-transform: uppercase; letter-spacing: .12em; color: #7a5c3c; }
td.time { font-weight: bold; color: #9b2a1a; width: 16mm; white-space: nowrap; }
td.what { font-weight: bold; width: 42mm; }
.note { background: #efe3cc; padding: 3mm 4mm; border-radius: 1mm; margin-top: 5mm; font-size: 9.5pt; }
ul { padding-left: 5mm; margin: .2em 0; } li { margin: .25em 0; }
.cols { display: flex; gap: 8mm; } .cols > div { flex: 1; }
.dress td { font-size: 9.5pt; } .dress td.n { font-weight: bold; width: 36mm; } .dress td.r { color: #7a5c3c; width: 46mm; }
.sign { page: sign; background: #2a1810; color: #f6efe2; height: 297mm; box-sizing: border-box; padding: 60mm 18mm 0; text-align: center; }
.sign .frame { border: 2px solid #c8873e; padding: 18mm 10mm; }
.sign .top { font-family: 'Segoe UI', Arial, sans-serif; text-transform: uppercase; letter-spacing: .3em; color: #c8873e; font-size: 13pt; font-weight: bold; }
.sign .name { font-size: 40pt; font-weight: bold; margin: 8mm 0 3mm; line-height: 1.05; }
.sign .subl { font-size: 22pt; font-style: italic; color: #e07a5a; }
.sign .foot { margin-top: 16mm; color: #e9dcc4; font-size: 13pt; }
"""

def build(lang):
    t = T[lang]; e = html.escape
    rows = "".join(f"<tr><td class='time'>{e(a)}</td><td class='what'>{e(b)}</td><td>{e(c)}</td></tr>" for a,b,c in t['plan'])
    menu = "".join(f"<h3>{e(a)}</h3><p>{e(b)}</p>" for a,b in t['menu'])
    drinks = "".join(f"<li>{d}</li>" for d in t['drinks'])
    music = "".join(f"<li>{e(d)}</li>" for d in t['music'])
    decor = "".join(f"<li>{e(d)}</li>" for d in t['decor'])
    dress = "".join(f"<tr><td class='n'>{e(COST[lang][k]['name'])}</td><td class='r'>{e(COST[lang][k]['role'])}</td><td>{e(COST[lang][k]['costume'])}</td></tr>" for k in ORDER)
    doc = f"""<!doctype html><html lang='{lang}'><head><meta charset='utf-8'><title>{e(t['title'])}</title><style>{CSS % {'foot': t['foot']}}</style></head><body>
<section class='cover'><div class='eyebrow'>{e(t['brand'])}</div><h1>{e(t['title'])}</h1><div class='game'>{e(t['game'])}</div>
<p>{e(t['intro'])}</p><p class='tip'>{e(t['tip'])}</p></section>
<section class='page'><div class='eyebrow'>{e(t['brand'])}</div><h2>{e(t['plan_h'])}</h2><p class='sub'>{e(t['plan_sub'])}</p>
<table>{rows}</table><p class='note'>{e(t['plan_note'])}</p></section>
<section class='page'><div class='eyebrow'>{e(t['brand'])}</div><h2>{e(t['menu_h'])}</h2><p class='sub'>{e(t['menu_sub'])}</p>{menu}
<h3>{e(t['drinks_h'])}</h3><ul>{drinks}</ul><p class='note'>{e(t['drinks_note'])}</p></section>
<section class='page'><div class='eyebrow'>{e(t['brand'])}</div><div class='cols'><div><h2>{e(t['music_h'])}</h2><ul>{music}</ul></div><div><h2>{e(t['decor_h'])}</h2><ul>{decor}</ul></div></div></section>
<section class='page'><div class='eyebrow'>{e(t['brand'])}</div><h2>{e(t['dress_h'])}</h2><p class='sub'>{e(t['dress_sub'])}</p>
<table class='dress'><tr><th></th><th>{e(t['col_role'])}</th><th>{e(t['col_cost'])}</th></tr>{dress}</table></section>
<section class='sign page'><div class='frame'><div class='top'>{e(t['sign_top'])}</div><div class='name'>{e(t['sign_name'])}</div><div class='subl'>{e(t['sign_sub'])}</div><div class='foot'>{e(t['sign_foot'])}</div></div></section>
</body></html>"""
    out = os.path.join(HERE, f"{t['file']}.html")
    open(out, "w", encoding="utf-8").write(doc)
    print(out)

for l in ("nl", "fr"):
    build(l)
