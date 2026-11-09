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


_FONTS_DONE = False


def _register_fonts() -> bool:
    """Registreert de merklettertypes voor PDF's. Zonder bestanden valt alles terug op Times/Helvetica."""
    global _FONTS_DONE
    if _FONTS_DONE:
        return True
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    d = config.BASE_DIR / "fonts_ttf"
    try:
        pdfmetrics.registerFont(TTFont("Gloock", str(d / "gloock-latin-400.ttf")))
        pdfmetrics.registerFont(TTFont("Caveat", str(d / "caveat-latin-500.ttf")))
        pdfmetrics.registerFont(TTFont("Figtree", str(d / "figtree-latin-400.ttf")))
        pdfmetrics.registerFont(TTFont("Figtree-SemiBold", str(d / "figtree-latin-600.ttf")))
    except Exception:  # noqa: BLE001
        return False
    _FONTS_DONE = True
    return True


CRANBERRY = (0x7D / 255, 0x1F / 255, 0x2C / 255)
GOLD = (0xB4 / 255, 0x8A / 255, 0x3C / 255)
INK = (0x2A / 255, 0x22 / 255, 0x20 / 255)
MUTED = (0x6B / 255, 0x5C / 255, 0x56 / 255)
PAPER = (1, 0xFB / 255, 0xF7 / 255)


def _wrap(c, text, font, size, width):
    from reportlab.pdfbase.pdfmetrics import stringWidth
    lines, cur = [], ""
    for word in text.split():
        trial = (cur + " " + word).strip()
        if stringWidth(trial, font, size) <= width:
            cur = trial
        else:
            if cur:
                lines.append(cur)
            cur = word
    if cur:
        lines.append(cur)
    return lines


def gift_card_pdf(order: dict, storyteller_link: str) -> bytes:
    """Cadeaubon als wenskaart (A5 staand): cranberry kader, gouden lijn, handgeschreven boodschap, QR-code."""
    from reportlab.graphics import renderPDF
    from reportlab.graphics.barcode.qr import QrCodeWidget
    from reportlab.graphics.shapes import Drawing
    from reportlab.pdfgen import canvas as rl_canvas

    brand = _register_fonts()
    DISPLAY = "Gloock" if brand else "Times-Bold"
    HAND = "Caveat" if brand else "Times-Italic"
    BODY = "Figtree" if brand else "Helvetica"
    BODY_B = "Figtree-SemiBold" if brand else "Helvetica-Bold"

    W, Hh = A5
    buf = io.BytesIO()
    c = rl_canvas.Canvas(buf, pagesize=A5)
    c.setTitle(f"Cadeaubon voor {order['storyteller_name']}")
    c.setFillColorRGB(*PAPER)
    c.rect(0, 0, W, Hh, stroke=0, fill=1)
    # kader
    m = 9 * mm
    c.setStrokeColorRGB(*CRANBERRY)
    c.setLineWidth(3)
    c.roundRect(m, m, W - 2 * m, Hh - 2 * m, 6, stroke=1, fill=0)
    c.setStrokeColorRGB(*GOLD)
    c.setLineWidth(0.8)
    c.roundRect(m + 3 * mm, m + 3 * mm, W - 2 * m - 6 * mm, Hh - 2 * m - 6 * mm, 4, stroke=1, fill=0)

    x = m + 11 * mm
    inner = W - 2 * x
    y = Hh - m - 22 * mm
    if order.get("is_demo") or order.get("payment_mode") == "demo":
        c.setFillColorRGB(0.69, 0, 0.13)
        c.setFont(BODY_B, 8)
        c.drawString(x, y + 10 * mm, "DEMO: geen echte betaling")

    c.setFillColorRGB(*GOLD)
    c.setFont(BODY_B, 10)
    c.drawString(x, y, "Familiestem")
    y -= 15 * mm
    c.setFillColorRGB(*INK)
    size = 34
    for line in _wrap(c, f"Voor {order['storyteller_name']}", DISPLAY, size, inner):
        c.setFont(DISPLAY, size)
        c.drawString(x, y, line)
        y -= size * 1.1
    y -= 2 * mm
    c.setFillColorRGB(*MUTED)
    c.setFont(BODY, 12)
    for line in _wrap(c, "Een cadeau om je verhalen te vertellen, in je eigen stem.", BODY, 12, inner):
        c.drawString(x, y, line)
        y -= 16
    if order.get("gift_message"):
        y -= 6 * mm
        c.setFillColorRGB(*CRANBERRY)
        for line in _wrap(c, order["gift_message"], HAND, 20, inner)[:6]:
            c.setFont(HAND, 20)
            c.drawString(x, y, line)
            y -= 22
        c.setFont(HAND, 16)
        c.setFillColorRGB(*MUTED)
        c.drawString(x, y - 2, f"van {order['buyer_name']}")
        y -= 20

    # gouden scheidingslijn
    y -= 6 * mm
    c.setStrokeColorRGB(*GOLD)
    c.setLineWidth(0.8)
    c.line(x, y, x + 30 * mm, y)
    y -= 9 * mm

    # QR + uitleg
    qr_size = 34 * mm
    qr_y = m + 30 * mm
    widget = QrCodeWidget(storyteller_link)
    b = widget.getBounds()
    d = Drawing(qr_size, qr_size, transform=[qr_size / (b[2] - b[0]), 0, 0, qr_size / (b[3] - b[1]), 0, 0])
    d.add(widget)
    renderPDF.draw(d, c, x, qr_y)
    tx = x + qr_size + 7 * mm
    tw = W - tx - x
    ty = qr_y + qr_size - 4
    c.setFillColorRGB(*INK)
    c.setFont(BODY_B, 12)
    c.drawString(tx, ty, "Zo begin je")
    ty -= 16
    c.setFont(BODY, 10.5)
    for line in _wrap(c, "Scan de code met je gsm. Je krijgt telkens één vraag en drukt op de grote knop om te vertellen. "
                         "Overslaan mag altijd, en jij beslist wat de familie mag lezen.", BODY, 10.5, tw):
        c.drawString(tx, ty, line)
        ty -= 13.5

    c.setFillColorRGB(*MUTED)
    c.setFont(BODY, 7.5)
    c.drawString(x, m + 20 * mm, "Of open deze persoonlijke link (deel hem niet verder):")
    c.setFont(BODY, 7)
    c.drawString(x, m + 16 * mm, storyteller_link[:95])
    c.setFont(BODY, 7.5)
    c.drawString(x, m + 10 * mm, f"20 verhalen. {config.COLLECT_DAYS} dagen om te vertellen, één keer verlengbaar. Alles downloadbaar.")
    c.showPage()
    c.save()
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
