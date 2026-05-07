"""Telegram Bot integration for Zantia Formação."""
import os
import secrets
import httpx
import logging

logger = logging.getLogger(__name__)


def get_token() -> str:
    return os.environ.get("TELEGRAM_BOT_TOKEN", "")


async def send_message(chat_id: str | int, text: str, parse_mode: str = "HTML") -> bool:
    """Send a Telegram message. Returns True on success."""
    token = get_token()
    if not token or not chat_id:
        return False
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.post(url, json={
                "chat_id": chat_id,
                "text": text,
                "parse_mode": parse_mode,
                "disable_web_page_preview": True,
            })
            if r.status_code == 200:
                return True
            logger.warning("Telegram send failed: %s %s", r.status_code, r.text[:200])
            return False
    except Exception as e:
        logger.warning("Telegram send error: %s", e)
        return False


async def get_bot_username() -> str:
    """Returns bot username for building t.me/<bot>?start=<token> links."""
    token = get_token()
    if not token:
        return ""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(f"https://api.telegram.org/bot{token}/getMe")
            if r.status_code == 200:
                data = r.json()
                return data.get("result", {}).get("username", "")
    except Exception:
        pass
    return ""


async def set_webhook(public_url: str) -> bool:
    """Configure Telegram webhook to receive /start and chat messages."""
    token = get_token()
    if not token or not public_url:
        return False
    webhook_url = f"{public_url.rstrip('/')}/api/telegram/webhook"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.post(
                f"https://api.telegram.org/bot{token}/setWebhook",
                json={"url": webhook_url, "allowed_updates": ["message"]},
            )
            return r.status_code == 200
    except Exception:
        return False


def generate_start_token() -> str:
    return secrets.token_urlsafe(12)
