import hashlib
import os
import re
import secrets
from datetime import datetime, timedelta, timezone
from fastapi import HTTPException
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
storage_root = os.getenv("STORAGE_PATH")
STORAGE_PATH = Path(storage_root) if storage_root else (BASE_DIR / "secure_storage")
STORAGE_PATH.mkdir(parents=True, exist_ok=True)

MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_BYTES", str((3 * 1024 * 1024 * 1024) // 2)))
MAX_USER_STORAGE_BYTES = int(os.getenv("MAX_USER_STORAGE_BYTES", str(15 * 1024 * 1024 * 1024)))
TOKEN_TTL_HOURS = 12
IST = timezone(timedelta(hours=5, minutes=30))
MAX_NAME_CHARS = 255
MAX_METADATA_CHARS = 8192
MIME_TYPE_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9!#$&^_.+-]{0,126}/[A-Za-z0-9][A-Za-z0-9!#$&^_.+-]{0,126}$")


def generate_token(byte_length: int = 32) -> str:
    return secrets.token_urlsafe(byte_length)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def sanitize_display_name(value: str | None, field_name: str, default: str | None = None) -> str:
    cleaned = (value or default or "").strip()
    cleaned = re.sub(r"[\x00-\x1f\x7f]+", "_", cleaned)
    cleaned = cleaned.replace("/", "_").replace("\\", "_")
    if not cleaned:
        raise HTTPException(status_code=400, detail=f"{field_name} cannot be empty")
    if len(cleaned) > MAX_NAME_CHARS:
        raise HTTPException(status_code=400, detail=f"{field_name} is too long")
    return cleaned


def validate_metadata_value(value: str | None, field_name: str, required: bool = True) -> str | None:
    if value is None:
        if required:
            raise HTTPException(status_code=400, detail=f"{field_name} is required")
        return None
    if required and not value:
        raise HTTPException(status_code=400, detail=f"{field_name} cannot be empty")
    if len(value) > MAX_METADATA_CHARS:
        raise HTTPException(status_code=400, detail=f"{field_name} is too long")
    return value


def sanitize_mime_type(value: str | None) -> str:
    candidate = (value or "application/octet-stream").strip()
    if not MIME_TYPE_RE.fullmatch(candidate):
        return "application/octet-stream"
    return candidate.lower()


def resolve_storage_path(raw_path: str) -> Path:
    storage_root = STORAGE_PATH.resolve()
    candidate = Path(raw_path).resolve()
    try:
        candidate.relative_to(storage_root)
    except ValueError:
        raise HTTPException(status_code=500, detail="Stored file path is outside the storage directory")
    return candidate


def safe_unlink_storage_path(raw_path: str) -> None:
    path = resolve_storage_path(raw_path)
    try:
        path.unlink()
    except FileNotFoundError:
        pass


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def as_ist(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(IST)


def convert_datetimes_to_ist(value):
    if isinstance(value, datetime):
        return as_ist(value)
    if isinstance(value, dict):
        return {key: convert_datetimes_to_ist(item) for key, item in value.items()}
    if isinstance(value, list):
        return [convert_datetimes_to_ist(item) for item in value]
    if isinstance(value, tuple):
        return tuple(convert_datetimes_to_ist(item) for item in value)
    if isinstance(value, set):
        return [convert_datetimes_to_ist(item) for item in value]
    return value


def new_session_expiry() -> datetime:
    return utcnow() + timedelta(hours=TOKEN_TTL_HOURS)


def ensure_not_expired(expires_at: datetime) -> None:
    expires = expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if expires <= utcnow():
        raise HTTPException(status_code=401, detail="Session expired")
