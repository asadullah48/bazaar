"""WhatsApp (Twilio) and email (Resend) notification helpers.

Both functions are fire-and-forget safe: if credentials are absent they return
silently, so the app works in dev without any external accounts configured.
"""
import logging

from app.core.config import get_settings

logger = logging.getLogger(__name__)


def send_whatsapp(to_phone: str, body: str) -> None:
    """Send a WhatsApp message via Twilio. No-op if credentials not set."""
    settings = get_settings()
    if not settings.twilio_account_sid or not settings.twilio_auth_token:
        logger.debug("Twilio not configured — skipping WhatsApp to %s", to_phone)
        return
    try:
        from twilio.rest import Client
        client = Client(settings.twilio_account_sid, settings.twilio_auth_token)
        client.messages.create(
            body=body,
            from_=settings.twilio_whatsapp_from,
            to=f"whatsapp:{to_phone}",
        )
    except Exception:
        logger.exception("WhatsApp send failed to %s", to_phone)


def send_email(to_email: str, subject: str, html: str) -> None:
    """Send a transactional email via Resend. No-op if API key not set."""
    settings = get_settings()
    if not settings.resend_api_key:
        logger.debug("Resend not configured — skipping email to %s", to_email)
        return
    try:
        import resend as resend_sdk
        resend_sdk.api_key = settings.resend_api_key
        resend_sdk.Emails.send({
            "from": settings.from_email,
            "to": [to_email],
            "subject": subject,
            "html": html,
        })
    except Exception:
        logger.exception("Email send failed to %s", to_email)
