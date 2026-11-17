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
render. The one image is the app icon the site already serves; with images
blocked, the word "Koda" beside it still carries the header.

Around the message: the subject as the heading, a hidden preview line (what an
inbox shows beside the subject), and a quiet footer with the site's address.
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

INK = "#111827"
BODY = "#374151"
MUTED = "#6b7280"
LINE = "#e5e7eb"
ACCENT = "#4f46e5"
PAGE = "#f3f4f8"
ROW = "#fafafc"
#: The line every email ends on, so a parent can tell a real one from a fake.
SAFETY = "Koda never asks for your password or payment details by email."
SAFETY_KM = "Koda មិនដែលសុំពាក្យសម្ងាត់ ឬព័ត៌មានបង់ប្រាក់របស់អ្នកតាមអ៊ីមែលទេ។"
_KHMER = re.compile(r"[\u1780-\u17FF]")
FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,'Noto Sans Khmer','Khmer OS',sans-serif"


def _e(text: str) -> str:
    return html.escape(text, quote=True)


def _link(url: str, label: str, colour: str = ACCENT) -> str:
    return f'<a href="{_e(url)}" style="color:{colour};font-weight:700;text-decoration:underline">{_e(label)}</a>'


def _button(url: str, label: str) -> str:
    return (
        '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px">'
        f'<tr><td style="border-radius:10px;background:{ACCENT}">'
        f'<a href="{_e(url)}" style="display:inline-block;padding:14px 28px;font-family:{FONT};font-weight:700;'
        f'font-size:15px;line-height:20px;color:#ffffff;text-decoration:none;border-radius:10px">{_e(label)}</a>'
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
        for index, line in enumerate(lines):
            text = line.lstrip()[2:]
            named = _NAMED_ROW.match(text)
            # A named row reads as a name with its details beneath, the way a
            # statement lists accounts; an unnamed one is a plain line.
            cell = (
                f'<strong style="display:block;font-size:{size}px;line-height:22px;font-weight:700;color:{INK}">'
                f"{_e(named.group(1))}</strong>"
                f'<div style="font-size:{size - 2}px;line-height:20px;color:{MUTED};margin-top:2px">'
                f"{_inline(named.group(3), app_link, MUTED, False)}</div>"
                if named
                else f'<div style="font-size:{size}px;line-height:22px;color:{colour}">{_inline(text, app_link, colour, False)}</div>'
            )
            divider = f"border-top:1px solid {LINE};" if index else ""
            rows.append(f'<tr><td style="padding:14px 16px;{divider}">{cell}</td></tr>')
        return (
            f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
            f'style="margin:4px 0 24px;background:{ROW};border:1px solid {LINE};border-radius:12px;border-collapse:separate">'
            + "".join(rows)
            + "</table>"
        )
    parts = [_inline(line, app_link, colour, buttons) for line in lines]
    style = f"margin:0 0 16px;font-size:{size}px;line-height:1.6;color:{colour}"
    if any(part.startswith("<table") for part in parts):
        return "".join(part if part.startswith("<table") else f'<p style="{style}">{part}</p>' for part in parts)
    if buttons and len(lines) == 1 and lines[0].lstrip().startswith(("—", "–")):
        # The sign-off: quieter than the message it closes.
        style = f"margin:8px 0 0;font-size:{size - 1}px;line-height:1.6;color:{MUTED}"
    return f'<p style="{style}">' + "<br>".join(parts) + "</p>"


def _preview(blocks: list[str]) -> str:
    """The line an inbox shows after the subject: the message's first words, not "Hi Dara,"."""
    for block in blocks[1:] if len(blocks) > 1 else blocks:
        words = " ".join(_URL.sub("", line).strip(" •:") for line in block.split("\n") if line.strip())
        if words.strip():
            return words.strip()[:120]
    return ""


def _header(app_link: str | None) -> str:
    icon = (
        f'<td style="padding-right:10px;vertical-align:middle"><img src="{_e(app_link.rstrip("/"))}/icons/icon-192.png" '
        'width="32" height="32" alt="" style="display:block;border:0;border-radius:8px"></td>'
        if app_link
        else ""
    )
    return (
        '<table role="presentation" cellpadding="0" cellspacing="0"><tr>'
        f'{icon}<td style="vertical-align:middle;font-family:{FONT};font-size:20px;font-weight:800;'
        f'color:{INK};letter-spacing:-0.3px">Koda</td></tr></table>'
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
    # A test send's "[Test] " belongs to the inbox line, not the heading.
    heading = re.sub(r"^\[Test\]\s*", "", subject).strip()
    site = (
        f'<p style="margin:10px 0 0;font-size:12px;line-height:1.6;color:{MUTED}">Learn with Koda · '
        f'<a href="{_e(app_link)}" style="color:{MUTED};text-decoration:underline">{_e(_site_name(app_link))}</a></p>'
        # What a parent can check every email against: we never ask for these.
        f'<p style="margin:6px 0 0;font-size:12px;line-height:1.6;color:{MUTED}">{_e(SAFETY_KM if _KHMER.search(text) else SAFETY)}</p>'
        if app_link
        else ""
    )
    return (
        "<!doctype html><html><head>"
        '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
        '<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">'
        f"<title>{_e(subject)}</title></head>"
        f'<body style="margin:0;padding:0;background:{PAGE};-webkit-text-size-adjust:100%">'
        f'<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:{PAGE}">{_e(_preview(blocks))}</div>'
        f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{PAGE}">'
        '<tr><td align="center" style="padding:32px 12px">'
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px">'
        f'<tr><td style="padding:0 8px 20px">{_header(app_link)}</td></tr>'
        f'<tr><td style="background:#ffffff;border:1px solid {LINE};border-radius:16px;padding:32px 28px;font-family:{FONT}">'
        + (
            f'<h1 style="margin:0 0 20px;font-size:22px;line-height:1.3;font-weight:800;color:{INK};'
            f'letter-spacing:-0.2px">{_e(heading)}</h1>'
            if heading
            else ""
        )
        + f"{main}</td></tr>"
        + f'<tr><td align="center" style="padding:24px 16px 0;font-family:{FONT};text-align:center">{small}{site}</td></tr>'
        + "</table></td></tr></table></body></html>"
    )
