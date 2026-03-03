import secrets
import hashlib
import os
from datetime import datetime, timedelta, timezone
from fastapi import HTTPException
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
storage_root = os.getenv("STORAGE_PATH")
STORAGE_PATH = Path(storage_root) if storage_root else (BASE_DIR / "secure_storage")
STORAGE_PATH.mkdir(exist_ok=True)

TOKEN_TTL_HOURS = 12


def generate_token():
    return secrets.token_urlsafe(16)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def new_session_expiry() -> datetime:
    return utcnow() + timedelta(hours=TOKEN_TTL_HOURS)


def ensure_not_expired(expires_at: datetime) -> None:
    expires = expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if expires <= utcnow():
        raise HTTPException(status_code=401, detail="Session expired")
