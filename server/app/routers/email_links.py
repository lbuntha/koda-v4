"""The unsubscribe link at the bottom of a notification email.

The one route here that needs no sign-in, because the person clicking it is in
their inbox, not in Koda. What authorises it is the signed token in the link,
which names one person and one kind and expires.

**A click shows a page; only a POST unsubscribes.** Mail security scanners open
every link in a message before a person does, and a GET that switched emails off
would quietly unsubscribe everybody behind such a scanner. The page's button
posts, and so does the one-click unsubscribe a mail client sends
(`List-Unsubscribe-Post`, RFC 8058) — to the same URL, token in the query.
"""

import html
from typing import Annotated

from fastapi import APIRouter, Query
from fastapi.responses import HTMLResponse

from app.deps import Db
from app.push_defaults import BY_KIND
from app.repos import notify_prefs
from app.services import email_notify
from app.settings import settings

router = APIRouter(prefix="/notifications", tags=["notifications"], include_in_schema=False)

Token = Annotated[str, Query(max_length=2048)]
StopAll = Annotated[bool, Query(alias="all")]


def _page(title: str, message: str, *, actions: str = "", status: int = 200) -> HTMLResponse:
    """A small, self-contained page in Koda's colours, light and dark."""
    app = html.escape(settings().app_base_url, quote=True)
    body = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(title)} · Koda</title>
<style>
  :root {{ color-scheme: light dark; --bg:#f7f6fb; --card:#fff; --ink:#1f1a33; --muted:#6b6780; --line:#e6e3ef; --accent:#6b46c1; }}
  @media (prefers-color-scheme: dark) {{
    :root {{ --bg:#0f0d17; --card:#1a1726; --ink:#f4f2fa; --muted:#a7a2ba; --line:#2d2940; --accent:#9f7aea; }}
  }}
  body {{ margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center; padding:16px;
         background:var(--bg); color:var(--ink); font:16px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }}
  main {{ width:100%; max-width:420px; background:var(--card); border:2px solid var(--line); border-radius:24px; padding:28px; }}
  h1 {{ font-size:20px; margin:0 0 8px; }}
  p {{ margin:0 0 20px; color:var(--muted); }}
  form {{ margin:0 0 10px; }}
  button, a.button {{ display:block; width:100%; box-sizing:border-box; text-align:center;
         padding:12px 16px; border-radius:14px; font:600 15px system-ui, sans-serif;
         cursor:pointer; text-decoration:none; border:2px solid var(--accent);
         background:var(--accent); color:#fff; }}
  button.quiet, a.quiet {{ background:transparent; color:var(--ink); border-color:var(--line); }}
</style></head>
<body><main>
  <h1>{html.escape(title)}</h1>
  <p>{html.escape(message)}</p>
  {actions}
  <a class="button quiet" href="{app}">Open Koda</a>
</main></body></html>"""
    return HTMLResponse(body, status_code=status)


def _expired() -> HTMLResponse:
    return _page(
        "This link has expired",
        "You can change which emails Koda sends in the app, under Settings → Notifications.",
        status=400,
    )


def _label(kind: str) -> str:
    if kind == email_notify.STOP_ALL:
        return "progress"
    return BY_KIND.get(kind, {}).get("label", "these")


@router.get("/unsubscribe", response_class=HTMLResponse)
async def confirm(token: Token = "") -> HTMLResponse:
    """Say what the link would stop, and offer the buttons. Changes nothing."""
    parsed = email_notify.read_unsubscribe_token(token)
    if not parsed:
        return _expired()
    _, kind = parsed
    safe = html.escape(token, quote=True)
    label = html.escape(_label(kind))
    actions = f'<form method="post" action="?token={safe}"><button type="submit">Stop {label} emails</button></form>'
    if kind != email_notify.STOP_ALL:
        actions += (
            f'<form method="post" action="?token={safe}&amp;all=1">'
            '<button class="quiet" type="submit">Stop all progress emails</button></form>'
        )
    return _page(
        "Stop these emails?",
        "Account and security notices will still arrive, because they are about your account.",
        actions=actions,
    )


@router.post("/unsubscribe", response_class=HTMLResponse)
async def unsubscribe(db: Db, token: Token = "", stop_all: StopAll = False) -> HTMLResponse:
    """Switch the email off — from the page's button, or a mail client's one-click."""
    parsed = email_notify.read_unsubscribe_token(token)
    if not parsed:
        return _expired()
    user_id, kind = parsed

    if stop_all or kind == email_notify.STOP_ALL:
        await notify_prefs.set_pref(db, user_id, email_notify.STOP_ALL, False, channel="email")
        message = "Koda won't send you progress emails any more."
    elif BY_KIND.get(kind, {}).get("class") == "account":
        # No link is ever issued for one, but a token is a token.
        message = "Account notices can't be switched off, because they tell you about your account."
    else:
        await notify_prefs.set_pref(db, user_id, kind, False, channel="email")
        message = f"You won't get {_label(kind)} emails any more."

    return _page(
        "You're unsubscribed",
        f"{message} You can turn emails back on in Koda under Settings → Notifications.",
    )
