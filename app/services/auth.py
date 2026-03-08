from fastapi import Depends, Header, HTTPException

from ..database import SessionLocal
from ..models import AuthSession, DeviceIdentity, ShareAccessLog, User
from ..utils import ensure_not_expired, hash_token


def get_bearer_token(authorization: str | None = Header(default=None)) -> str:
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization header")
    parts = authorization.split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer" or not parts[1]:
        raise HTTPException(status_code=401, detail="Invalid Authorization header")
    return parts[1]


def get_current_user(token: str = Depends(get_bearer_token)) -> User:
    db = SessionLocal()
    try:
        token_hash = hash_token(token)
        session = db.query(AuthSession).filter(AuthSession.token_hash == token_hash).first()
        if not session:
            raise HTTPException(status_code=401, detail="Invalid session")
        ensure_not_expired(session.expires_at)
        user = db.query(User).filter(User.id == session.user_id).first()
        if not user:
            raise HTTPException(status_code=401, detail="Invalid session")
        return user
    finally:
        db.close()


def resolve_user_from_access_token(db, access_token: str) -> User:
    token_hash = hash_token(access_token)
    session = db.query(AuthSession).filter(AuthSession.token_hash == token_hash).first()
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    ensure_not_expired(session.expires_at)
    user = db.query(User).filter(User.id == session.user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid session")
    return user


def normalize_guest_id(raw_guest_id: str | None) -> str | None:
    if not raw_guest_id:
        return None
    guest_id = raw_guest_id.strip()
    if not guest_id:
        return None
    return guest_id[:80]


def user_watermark_label(user: User) -> str:
    return f"User: {user.id} | {user.username}"


def bind_guest_identity_to_user(db, raw_guest_id: str | None, user: User) -> None:
    guest_id = normalize_guest_id(raw_guest_id)
    if not guest_id:
        return

    binding = db.query(DeviceIdentity).filter(DeviceIdentity.guest_id == guest_id).first()
    if binding:
        binding.user_id = user.id
    else:
        db.add(DeviceIdentity(guest_id=guest_id, user_id=user.id))

    db.query(ShareAccessLog).filter(
        ShareAccessLog.viewer_type == "guest",
        ShareAccessLog.viewer_label.like(f"Guest: {guest_id} |%"),
    ).update(
        {
            "viewer_type": "signed_user",
            "viewer_label": user_watermark_label(user),
        },
        synchronize_session=False,
    )
