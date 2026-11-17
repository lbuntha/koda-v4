"""The formatted copy of an email, made from its plain text.

Every email Koda sends is written as plain text — by the shipped wording, or by
an operator in Notification Settings — and that text stays the message: it is
what the HTML is made from, and it goes out beside it for any client that reads
text only. The HTML only *dresses* it, so an operator's edit can never fall out
of step with what a parent sees.

The dressing follows a few readable rules rather than a template language:

* A blank line starts a new paragraph; a line that starts with "• " is a row.
  A row's "Name: the rest" shows the name in bold.
* A link at the end of a line is drawn as its label, not its address: the words
  before it, from the start of that sentence, become the link
  ("Don't want these? Unsubscribe: <url>" → "Don't want these? [Unsubscribe]").
  In the message, a link to the app itself is a button instead.
* A line that is only a link to the app is a button labelled with the site name.
* Everything after a line of "---" is the footer: small and grey.

Styles are inline and the layout is a table, because that is what email clients
render; there are no images, so nothing is blocked and nothing needs hosting.
"""

from __future__ import annotations

import html
import re
from urllib.parse import urlparse

_URL = re.compile(r"https?://\S+")
# A label ends where its sentence began: after . ? ! or the Khmer full stop.
_SENTENCE_BREAK = re.compile(r"^(.*[.?!។]\s+)(.+)$")
_TRAILING_COLON = re.compile(r"\s*[:៖：]\s*$")
_NAMED_ROW = re.compile(r"^(.{1,60}?)([:៖])\s+(.+)$")

INK = "#1e1b4b"
BODY = "#334155"
MUTED = "#64748b"
LINE = "#e2e8f0"
ACCENT = "#4f46e5"
PAGE = "#f5f5fb"


def _e(text: str) -> str:
    return html.escape(text, quote=True)


def _link(url: str, label: str, colour: str = ACCENT) -> str:
    return f'<a href="{_e(url)}" style="color:{colour};font-weight:700;text-decoration:underline">{_e(label)}</a>'


def _button(url: str, label: str) -> str:
    return (
        '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 18px">'
        f'<tr><td style="border-radius:12px;background:{ACCENT}">'
        f'<a href="{_e(url)}" style="display:inline-block;padding:12px 22px;font-weight:800;'
        f'font-size:15px;color:#ffffff;text-decoration:none;border-radius:12px">{_e(label)}</a>'
        "</td></tr></table>"
    )


def _site_name(url: str) -> str:
    return urlparse(url).netloc or url


def _inline(line: str, app_link: str | None, colour: str, buttons: bool) -> str:
    """One line: text, with its trailing link folded into its own words."""
    match = _URL.search(line)
    if not match:
        return _e(line)
    url = match.group(0).rstrip(".,)")
    before, after = line[: match.start()], line[match.start() + len(url):]
    if after.strip():
        # A link in the middle of a sentence keeps its address as its words.
        return _e(before) + _link(url, _site_name(url), colour) + _inline(after, app_link, colour, buttons)
    lead = _TRAILING_COLON.sub("", before).rstrip()
    if not lead:
        # A line that is only a link.
        if buttons and app_link and url.startswith(app_link):
            return _button(url, _site_name(url))
        return _link(url, _site_name(url), colour)
    sentence = _SENTENCE_BREAK.match(lead)
    kept, label = (sentence.group(1), sentence.group(2)) if sentence else ("", lead)
    if buttons and app_link and url.startswith(app_link) and not kept:
        return _button(url, label)
    return _e(kept) + _link(url, label, colour)


def _paragraph(block: str, app_link: str | None, *, colour: str, size: int, buttons: bool) -> str:
    lines = [line for line in block.split("\n") if line.strip()]
    if lines and all(line.lstrip().startswith("• ") for line in lines):
        rows = []
        for line in lines:
            text = line.lstrip()[2:]
            named = _NAMED_ROW.match(text)
            cell = (
                f'<strong style="color:{INK}">{_e(named.group(1))}</strong>'
                f'<span style="color:{MUTED}">{"&nbsp;&nbsp;" if named.group(2) == ":" else "៖&nbsp;"}</span>'
                f"{_inline(named.group(3), app_link, colour, False)}"
                if named
                else _inline(text, app_link, colour, False)
            )
            rows.append(
                f'<tr><td style="padding:10px 14px;border-bottom:1px solid {LINE};font-size:{size}px;'
                f'line-height:1.5;color:{colour}">{cell}</td></tr>'
            )
        return (
            f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
            f'style="margin:4px 0 16px;border:1px solid {LINE};border-radius:12px;border-collapse:separate">'
            + "".join(rows)
            + "</table>"
        )
    parts = [_inline(line, app_link, colour, buttons) for line in lines]
    if any(part.startswith("<table") for part in parts):
        return "".join(part if part.startswith("<table") else f'<p style="margin:0 0 8px">{part}</p>' for part in parts)
    return (
        f'<p style="margin:0 0 16px;font-size:{size}px;line-height:1.6;color:{colour}">'
        + "<br>".join(parts)
        + "</p>"
    )


def render(text: str, subject: str, app_link: str | None = None) -> str:
    """The HTML twin of a plain-text email."""
    body, _, footer = text.partition("\n---\n")
    blocks = [b for b in re.split(r"\n\s*\n", body.strip()) if b.strip()]
    main = "".join(_paragraph(b, app_link, colour=BODY, size=16, buttons=True) for b in blocks)
    small = "".join(
        _paragraph(b, app_link, colour=MUTED, size=12, buttons=False)
        for b in re.split(r"\n\s*\n", footer.strip())
        if b.strip()
    )
    return (
        "<!doctype html><html><head>"
        '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
        f"<title>{_e(subject)}</title></head>"
        f'<body style="margin:0;padding:0;background:{PAGE}">'
        f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{PAGE}">'
        '<tr><td align="center" style="padding:24px 12px">'
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">'
        f'<tr><td style="padding:0 4px 14px;font-family:Arial,Helvetica,sans-serif;font-size:20px;'
        f'font-weight:900;color:{ACCENT};letter-spacing:-0.3px">Koda</td></tr>'
        f'<tr><td style="background:#ffffff;border:1px solid {LINE};border-radius:16px;padding:24px 22px;'
        f"font-family:Arial,Helvetica,'Noto Sans Khmer','Khmer OS',sans-serif\">{main}</td></tr>"
        + (
            f'<tr><td style="padding:16px 6px 0;font-family:Arial,Helvetica,sans-serif">{small}</td></tr>'
            if small
            else ""
        )
        + "</table></td></tr></table></body></html>"
    )
