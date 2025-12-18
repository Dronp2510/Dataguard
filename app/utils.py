import secrets
from pathlib import Path

STORAGE_PATH = Path("secure_storage")
STORAGE_PATH.mkdir(exist_ok=True)

def generate_token():
    return secrets.token_urlsafe(16)
