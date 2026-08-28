"""Sending mail, behind one function and two drivers.

This is the service's first dependency on anything outside its own database, so
it goes in behind a seam rather than as a call to `smtplib` from a route. Two
consequences worth having:

* **Tests and local work need no mail server.** The `console` driver logs the
  message, so a developer clicks the reset link out of `make logs-api` and the
  whole flow is exercisable with nothing installed.
* **Moving to SES or Postmark later is a driver, not a refactor.** Nothing that
  calls `send()` knows or cares which one is running.

Deliberately plain text. An HTML mail is a rendering problem — inlined CSS, a
dozen clients, a plain-text fallback anyway — and nothing sent from here yet is
worth that. The one message this exists for is a sentence and a link.
"""

import asyncio
import logging
import smtplib
from email.message import EmailMessage

from app.settings import settings

log = logging.getLogger("koda.mail")


def _compose(to: str, subject: str, body: str) -> EmailMessage:
    message = EmailMessage()
    message["From"] = settings().mail_from
    message["To"] = to
    message["Subject"] = subject
    message.set_content(body)
    return message


def _send_smtp(message: EmailMessage) -> None:
    """Blocking, and called in a thread — `smtplib` has no async form.

    STARTTLS on by default because that is what port 587 wants, and what Gmail
    requires. A local catcher like Mailpit takes neither TLS nor credentials, so
    both are conditional rather than assumed.
    """
    cfg = settings()
    with smtplib.SMTP(cfg.smtp_host, cfg.smtp_port, timeout=15) as smtp:
        if cfg.smtp_starttls:
            smtp.starttls()
        if cfg.smtp_user and cfg.smtp_password:
            smtp.login(cfg.smtp_user, cfg.smtp_password)
        smtp.send_message(message)


async def send(to: str, subject: str, body: str) -> bool:
    """Send one message. Returns whether it went.

    Never raises. A caller here is a route that must not tell the world whether
    an address exists, and one that would be turned into an error page by a mail
    server having a bad afternoon. A failure is logged and swallowed — the
    account is unchanged and the person can ask again.
    """
    cfg = settings()

    if cfg.mail_driver == "console":
        # The whole message, so a developer can read the link out of the log.
        log.info("mail (console driver)\nTo: %s\nSubject: %s\n\n%s", to, subject, body)
        return True

    try:
        await asyncio.to_thread(_send_smtp, _compose(to, subject, body))
        return True
    except Exception:  # noqa: BLE001 — every failure here is the same failure
        log.exception("could not send mail to %s", to)
        return False
