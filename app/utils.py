import secrets
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
STORAGE_PATH = BASE_DIR / "secure_storage"
STORAGE_PATH.mkdir(exist_ok=True)


def generate_token():
    return secrets.token_urlsafe(16)
