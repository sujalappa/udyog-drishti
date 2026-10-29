"""PDF report for the industrial SO2 and NO2 watch."""

from __future__ import annotations

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

GREEN = colors.HexColor("#3f3a36")
LINE = colors.HexColor("#d9d4cf")


def _styles():
    ss = getSampleStyleSheet()
    ss.add(ParagraphStyle("H1x", parent=ss["Title"], fontSize=17, textColor=GREEN, alignment=0, spaceAfter=4))
    ss.add(ParagraphStyle("H2x", parent=ss["Heading2"], fontSize=12, textColor=GREEN, spaceBefore=10, spaceAfter=4))
    ss.add(ParagraphStyle("Cell", parent=ss["BodyText"], fontSize=7.5, leading=9.5))
    ss.add(ParagraphStyle("Small", parent=ss["BodyText"], fontSize=8, leading=10, textColor=colors.HexColor("#555")))
    return ss


def _table(rows, widths, header_bg=GREEN):
    t = Table(rows, colWidths=widths, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), header_bg), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTSIZE", (0, 0), (-1, -1), 7.5), ("GRID", (0, 0), (-1, -1), 0.4, LINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"), ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f6f3ec")]),
    ]))
    return t


def _c(text) -> str:
    """The built-in PDF fonts have no subscript digits."""
    return str(text).replace("₂", "2")


def _p(text, style):
    return Paragraph(_c(text), style)


def build(path, title: str, subtitle: str, facts: list[tuple[str, str]], method: dict, sources: list[dict],
          columns: list[tuple[str, str]], rows: list[dict], note: str) -> None:
    ss = _styles()
    doc = SimpleDocTemplate(str(path), pagesize=landscape(A4), leftMargin=14 * mm, rightMargin=14 * mm,
                            topMargin=12 * mm, bottomMargin=12 * mm, title=title, author="Udyog-drishti AI")
    story = [_p(title, ss["H1x"]), _p(subtitle, ss["Small"]), Spacer(1, 6)]
    story.append(_table([["Item", "Value"]] + [[_c(k), _p(str(v), ss["Cell"])] for k, v in facts],
                        [70 * mm, 190 * mm]))
    story.append(_p("Method", ss["H2x"]))
    story += [_p(f"<b>{k.replace('_', ' ').capitalize()}:</b> {v}", ss["Small"]) for k, v in method.items()]
    story.append(_p("Results", ss["H2x"]))
    body = [[_p(f"<font color='white'><b>{label}</b></font>", ss["Cell"]) for _, label in columns]] + [
        [_p("" if r.get(k) is None else str(r.get(k)), ss["Cell"]) for k, _ in columns] for r in rows]
    width = (269 * mm) / len(columns)
    story.append(_table(body, [width] * len(columns)))
    story.append(_p("Data sources", ss["H2x"]))
    story.append(_table([["Dataset", "Provider", "Used for", "Licence / citation"]] + [
        [_p(s["dataset"], ss["Cell"]), _p(s.get("provider", ""), ss["Cell"]),
         _p(s.get("used_for", ""), ss["Cell"]),
         _p(f"{s.get('license', '')}. {s.get('citation', '')}", ss["Cell"])] for s in sources],
        [70 * mm, 55 * mm, 80 * mm, 64 * mm]))
    story += [Spacer(1, 6), _p(note, ss["Small"])]
    doc.build(story)
