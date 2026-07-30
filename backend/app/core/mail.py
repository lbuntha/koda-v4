"""Sending mail, with the transport chosen by configuration.

The app has never sent an email, and password reset cannot exist without one. Rather than
couple the reset flow to a provider, everything calls `get_mailer().send(...)` and the
transport is config:

* `console` — writes the message to the log. The default, so a developer with nothing
  installed can still exercise the whole flow by copying the link out of the terminal.
* `smtp`   — a real server. Locally that is Mailpit (a container with a web inbox on :8025),
  in production SES/Postmark/Resend. Identical code; only the host differs.
* `memory` — records messages instead of sending. Tests assert on what would have gone out.

Nothing here logs a message body: a reset link is a bearer credential for the duration of its
life, and logs get shipped, pasted, and read by people who should not have it. The console
transport is the deliberate exception, and it refuses to run in production.
"""

from __future__ import annotations

import smtplib
from dataclasses import dataclass, field
from email.message import EmailMessage

from .config import settings
from .logging import get_logger

logger = get_logger("mail")


@dataclass
class Message:
    to: str
    subject: str
    body: str


class Mailer:
    def send(self, message: Message) -> None:  # pragma: no cover - interface
        raise NotImplementedError


class ConsoleMailer(Mailer):
    """Prints the message. Development only — see the guard in `get_mailer`."""

    def send(self, message: Message) -> None:
        logger.info(
            "\n─── email (not sent: console transport) ───\n"
            "To: %s\nSubject: %s\n\n%s\n──────────────────────────────────────────",
            message.to, message.subject, message.body,
        )


@dataclass
class MemoryMailer(Mailer):
    """Records instead of sending, so a test can assert on the message."""

    sent: list[Message] = field(default_factory=list)

    def send(self, message: Message) -> None:
        self.sent.append(message)


class SmtpMailer(Mailer):
    def __init__(self, host: str, port: int, username: str | None,
                 password: str | None, use_tls: bool, sender: str) -> None:
        self._host, self._port = host, port
        self._username, self._password = username, password
        self._use_tls, self._sender = use_tls, sender

    def send(self, message: Message) -> None:
        payload = EmailMessage()
        payload["From"] = self._sender
        payload["To"] = message.to
        payload["Subject"] = message.subject
        payload.set_content(message.body)
        with smtplib.SMTP(self._host, self._port, timeout=10) as server:
            if self._use_tls:
                server.starttls()
            if self._username:
                server.login(self._username, self._password or "")
            server.send_message(payload)
        # Recipient and subject only — never the body.
        logger.info("sent mail to=%s subject=%s", message.to, message.subject)


_override: Mailer | None = None


def set_mailer(mailer: Mailer | None) -> None:
    """Force a transport. Tests use this; nothing in the app does."""
    global _override
    _override = mailer


def get_mailer() -> Mailer:
    if _override is not None:
        return _override
    transport = settings.mail_transport.strip().lower()
    if transport == "memory":
        return MemoryMailer()
    if transport == "smtp":
        return SmtpMailer(
            host=settings.smtp_host, port=settings.smtp_port,
            username=settings.smtp_username, password=settings.smtp_password,
            use_tls=settings.smtp_use_tls, sender=settings.mail_from,
        )
    if settings.is_production:
        # Falling back to console in production would mean reset emails silently never
        # arrive while the endpoint reported success.
        raise RuntimeError(
            "MAIL_TRANSPORT=console is not usable in production; configure smtp"
        )
    return ConsoleMailer()


async def resolve_mailer() -> Mailer:
    """Like `get_mailer()`, but layers admin-configured SMTP overrides (stored,
    encrypted, on `SystemSettings` — set via the admin Settings page) atop the env
    defaults. Every field falls back independently, so filling in just host/port
    while leaving transport on the env default still works.

    A test override always wins, same as `get_mailer()` — this only changes how
    a real transport gets its connection details.
    """
    if _override is not None:
        return _override

    # Imported here, not at module load: `runtime_settings` imports `models.content`,
    # which would be a needless import-time dependency for the common case (tests,
    # scripts) that only ever call `get_mailer()`.
    from .runtime_settings import get_system_settings
    from .security import decrypt_secret

    doc = await get_system_settings()
    transport = (doc.mail_transport_override or settings.mail_transport).strip().lower()
    if transport == "memory":
        return MemoryMailer()
    if transport == "smtp":
        password = (
            decrypt_secret(doc.smtp_password_encrypted)
            if doc.smtp_password_encrypted else settings.smtp_password
        )
        return SmtpMailer(
            host=doc.smtp_host_override or settings.smtp_host,
            port=doc.smtp_port_override or settings.smtp_port,
            username=doc.smtp_username_override or settings.smtp_username,
            password=password,
            use_tls=doc.smtp_use_tls_override if doc.smtp_use_tls_override is not None else settings.smtp_use_tls,
            sender=doc.mail_from_override or settings.mail_from,
        )
    if settings.is_production:
        raise RuntimeError(
            "MAIL_TRANSPORT=console is not usable in production; configure smtp"
        )
    return ConsoleMailer()
