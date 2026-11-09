"""PDF-boek, cadeaubon en volledige ZIP-export."""
import io
import json
import zipfile
from pathlib import Path

from reportlab.lib.pagesizes import A5
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.platypus import Image, PageBreak, Paragraph, SimpleDocTemplate, Spacer
from xml.sax.saxutils import escape

from . import config

TITLE = ParagraphStyle("t", fontName="Times-Bold", fontSize=22, leading=28, spaceAfter=10)
H = ParagraphStyle("h", fontName="Times-Bold", fontSize=15, leading=19, spaceBefore=6, spaceAfter=8)
Q = ParagraphStyle("q", fontName="Times-Italic", fontSize=10, leading=13, textColor="#555555", spaceAfter=8)
BODY = ParagraphStyle("b", fontName="Times-Roman", fontSize=11, leading=15.5, spaceAfter=7)
SMALL = ParagraphStyle("s", fontName="Helvetica", fontSize=8, leading=10, textColor="#777777")
DEMO = ParagraphStyle("d", fontName="Helvetica-Bold", fontSize=9, leading=11, textColor="#b00020", spaceAfter=8)


def _footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 7)
    canvas.setFillColor("#888888")
    canvas.drawCentredString(A5[0] / 2, 8 * mm, f"{doc.page}")
    canvas.restoreState()


def _mark_uncertain(text: str, flags: list[str]) -> str:
    out = escape(text)
    for f in set(flags):
        if f:
            out = out.replace(escape(f), f"<u>{escape(f)}</u>")
    return out


def book_pdf(order: dict, stories: list[dict]) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A5, leftMargin=16 * mm, rightMargin=16 * mm,
                            topMargin=18 * mm, bottomMargin=18 * mm,
                            title=f"Verhalen van {order['storyteller_name']}")
    el = []
    if order.get("is_demo"):
        el.append(Paragraph("VOORBEELD MET FICTIEVE VERHALEN — geen echte persoon", DEMO))
    el += [Spacer(1, 40 * mm), Paragraph(escape(f"Verhalen van {order['storyteller_name']}"), TITLE),
           Paragraph("In eigen woorden verteld en opgenomen.", Q),
           Paragraph(f"{len(stories)} verhalen. Onderlijnde woorden waren onzeker bij het uitschrijven.", SMALL),
           PageBreak()]
    for i, s in enumerate(stories, 1):
        el.append(Paragraph(f"{i}. {escape(s['question'])}", H))
        el.append(Paragraph(f"Opname van {int(s['audio_seconds'] // 60)} min {int(s['audio_seconds'] % 60)} s "
                            f"— originele opname zit in de download (map audio, nr. {s['id']}).", Q))
        flags = json.loads(s.get("transcript_flags") or "[]")
        for par in (s["final_text"] or "").split("\n\n"):
            if par.strip():
                el.append(Paragraph(_mark_uncertain(par.strip(), flags), BODY))
        for p in s.get("photos", []):
            try:
                ir = ImageReader(p["path"])
                w, h = ir.getSize()
                maxw = A5[0] - 32 * mm
                el.append(Image(p["path"], width=maxw, height=maxw * h / w))
                if p.get("caption"):
                    el.append(Paragraph(escape(p["caption"]), SMALL))
            except Exception:
                el.append(Paragraph("[foto kon niet geladen worden]", SMALL))
        el.append(PageBreak())
    doc.build(el, onFirstPage=_footer, onLaterPages=_footer)
    return buf.getvalue()


def gift_card_pdf(order: dict, storyteller_link: str) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A5, leftMargin=18 * mm, rightMargin=18 * mm, topMargin=25 * mm)
    el = []
    if order.get("is_demo"):
        el.append(Paragraph("DEMO-BESTELLING — geen echte betaling", DEMO))
    el += [Paragraph(escape(f"Voor {order['storyteller_name']}"), TITLE),
           Paragraph("Een cadeau om je verhalen te vertellen, in je eigen stem.", BODY)]
    if order.get("gift_message"):
        el.append(Paragraph(escape(order["gift_message"]), Q))
    el += [Spacer(1, 8 * mm),
           Paragraph("Zo werkt het: je krijgt telkens één vraag. Je drukt op de grote knop en vertelt. "
                     "Je mag elke vraag overslaan en je beslist zelf wat de familie mag lezen.", BODY),
           Spacer(1, 6 * mm),
           Paragraph("Je persoonlijke link (deel hem niet verder):", SMALL),
           Paragraph(escape(storyteller_link), SMALL),
           Paragraph(f"20 verhalen · {config.COLLECT_DAYS} dagen om te vertellen, eenmaal verlengbaar · "
                     "alles downloadbaar.", SMALL)]
    doc.build(el)
    return buf.getvalue()


def full_zip(order: dict, stories: list[dict], pdf: bytes) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("boek.pdf", pdf)
        manifest = {"verteller": order["storyteller_name"], "taal": order["language"],
                    "demo": bool(order.get("is_demo")), "verhalen": []}
        for s in stories:
            ext = Path(s["audio_path"]).suffix
            z.write(s["audio_path"], f"audio/{s['id']}_origineel{ext}")
            mp3 = str(Path(s["audio_path"]).with_suffix(".mp3"))
            if Path(mp3).exists() and mp3 != s["audio_path"]:
                z.write(mp3, f"audio/{s['id']}.mp3")
            z.writestr(f"tekst/{s['id']}_transcriptie.txt", s.get("transcript") or "")
            z.writestr(f"tekst/{s['id']}_hoofdstuk.txt", s.get("final_text") or "")
            entry = {"id": s["id"], "vraag": s["question"], "seconden": s["audio_seconds"],
                     "onzekere_woorden": json.loads(s.get("transcript_flags") or "[]"), "fotos": []}
            for p in s.get("photos", []):
                name = f"fotos/{s['id']}_{Path(p['path']).name}"
                z.write(p["path"], name)
                entry["fotos"].append({"bestand": name, "bijschrift": p.get("caption")})
            manifest["verhalen"].append(entry)
        z.writestr("manifest.json", json.dumps(manifest, ensure_ascii=False, indent=2))
    return buf.getvalue()
