"""Centrale instellingen en pakketlimieten. Alles via omgevingsvariabelen, geen secrets in code."""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = Path(os.environ.get("FS_DATA_DIR", BASE_DIR.parent / "data"))
DB_PATH = DATA_DIR / "familiestem.db"
MEDIA_DIR = DATA_DIR / "media"

PUBLIC_URL = os.environ.get("FS_PUBLIC_URL", "http://localhost:8000")
OPS_KEY = os.environ.get("FS_OPS_KEY", "")  # leeg = ops-dashboard uit

# Betaling: zonder Stripe-sleutel draait de app in DEMO-betaalmodus (duidelijk gemarkeerd).
STRIPE_SECRET_KEY = os.environ.get("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")

# Transcriptie: zonder OpenAI-sleutel draait de app in DEMO-transcriptiemodus.
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
OPENAI_BASE_URL = os.environ.get("OPENAI_BASE_URL", "https://eu.api.openai.com/v1")
TRANSCRIBE_MODEL = os.environ.get("FS_TRANSCRIBE_MODEL", "gpt-4o-transcribe")

# Pakket "Familiestem"
PRICE_EUR_INCL_VAT = 49.00
VAT_RATE = 0.21
MAX_STORIES = 20
MAX_SECONDS_PER_STORY = 10 * 60
MAX_SECONDS_TOTAL = 300 * 60
MAX_PHOTOS_PER_STORY = 3
MAX_FAMILY = 10
COLLECT_DAYS = 90            # vanaf activatie door verteller
EXTENSION_DAYS = 90          # 1x gratis verlengbaar
HOSTING_YEARS = 2            # online bewaren na einde verzamelperiode
REFERRAL_DISCOUNT_EUR = 10.00   # korting voor wie via een code bestelt
REFERRAL_REWARD_EUR = 10.00     # terugbetaling aan de doorverwijzer, na 30 dagen
MAX_AUDIO_BYTES = 25 * 1024 * 1024
MAX_PHOTO_BYTES = 8 * 1024 * 1024
CONSENT_VERSION = "2026-11-v1"


def ffmpeg_bin() -> str:
    """ffmpeg: FS_FFMPEG, anders op het PATH, anders het meegeleverde binary van imageio-ffmpeg (Windows/laptop)."""
    import shutil
    explicit = os.environ.get("FS_FFMPEG")
    if explicit:
        return explicit
    found = shutil.which("ffmpeg")
    if found:
        return found
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:  # noqa: BLE001
        return "ffmpeg"


def is_demo_payment() -> bool:
    return not STRIPE_SECRET_KEY


def is_demo_transcription() -> bool:
    return not OPENAI_API_KEY


# ---------------------------------------------------------------- productie
ENV = os.environ.get("FS_ENV", "development")          # development | production
SMTP_HOST = os.environ.get("SMTP_HOST", "")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER = os.environ.get("SMTP_USER", "")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "")
MAIL_FROM = os.environ.get("MAIL_FROM", "")             # bv. "Familiestem <hallo@jouwdomein.be>"
SUPPORT_EMAIL = os.environ.get("SUPPORT_EMAIL", "")
BACKUP_DIR = Path(os.environ.get("FS_BACKUP_DIR", DATA_DIR / "backups"))
BACKUP_KEEP_DAYS = 14
QUIET_DAYS = 10                 # seintje aan de koper na zoveel dagen stilte (eenmalig)
EXPIRY_NOTICE_DAYS = 60         # bericht vóór einde online bewaring


def is_production() -> bool:
    return ENV == "production"


def production_problems() -> list[str]:
    """Alles wat ontbreekt om veilig live te gaan. Leeg = in orde."""
    p = []
    if not PUBLIC_URL.startswith("https://"):
        p.append("FS_PUBLIC_URL moet met https:// beginnen")
    if len(OPS_KEY) < 24:
        p.append("FS_OPS_KEY moet minstens 24 tekens lang zijn")
    if not STRIPE_SECRET_KEY.startswith(("sk_live_", "sk_test_", "rk_live_", "rk_test_")):
        p.append("STRIPE_SECRET_KEY ontbreekt of is ongeldig")
    if not STRIPE_WEBHOOK_SECRET.startswith("whsec_"):
        p.append("STRIPE_WEBHOOK_SECRET ontbreekt")
    if not OPENAI_API_KEY:
        p.append("OPENAI_API_KEY ontbreekt")
    if not OPENAI_BASE_URL.startswith("https://eu."):
        p.append("OPENAI_BASE_URL moet het EU-endpoint zijn (https://eu.api.openai.com/v1)")
    if not (SMTP_HOST and SMTP_USER and SMTP_PASSWORD and MAIL_FROM):
        p.append("SMTP_HOST, SMTP_USER, SMTP_PASSWORD en MAIL_FROM zijn verplicht")
    if not SUPPORT_EMAIL:
        p.append("SUPPORT_EMAIL ontbreekt")
    return p
