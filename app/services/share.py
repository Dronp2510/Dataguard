import hashlib
from datetime import datetime, timezone

from fastapi import HTTPException, Request

from ..models import AuthSession, DeviceIdentity, Share, ShareAccessLog, User
from ..utils import ensure_not_expired, hash_token
from .auth import bind_guest_identity_to_user, normalize_guest_id, user_watermark_label


def get_share_or_410(db, token: str) -> Share:
    share = db.query(Share).filter(Share.token == token).first()
    if not share or not share.is_active:
        raise HTTPException(status_code=410, detail="Share link is invalid")

    expires = share.expiry_time
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if expires <= datetime.now(timezone.utc):
        raise HTTPException(status_code=410, detail="Share link has expired")

    if share.max_views is not None and share.views >= share.max_views:
        raise HTTPException(status_code=410, detail="Share link view limit reached")

    return share


def resolve_viewer_identity(
    db,
    token: str,
    authorization: str | None,
    x_guest_id: str | None,
    request: Request | None,
) -> tuple[str, str]:
    normalized_guest = normalize_guest_id(x_guest_id)

    if authorization:
        parts = authorization.split(" ", 1)
        if len(parts) == 2 and parts[0].lower() == "bearer" and parts[1]:
            token_hash = hash_token(parts[1])
            session = db.query(AuthSession).filter(AuthSession.token_hash == token_hash).first()
            if session:
                try:
                    ensure_not_expired(session.expires_at)
                    user = db.query(User).filter(User.id == session.user_id).first()
                    if user:
                        if normalized_guest:
                            bind_guest_identity_to_user(db, normalized_guest, user)
                        return ("signed_user", user_watermark_label(user))
                except HTTPException:
                    pass

    token_prefix = token[:8]
    if normalized_guest:
        binding = db.query(DeviceIdentity).filter(DeviceIdentity.guest_id == normalized_guest).first()
        if binding:
            user = db.query(User).filter(User.id == binding.user_id).first()
            if user:
                return ("signed_user", user_watermark_label(user))
        return ("guest", f"Guest: {normalized_guest} | Link: {token_prefix}")

    ip_part = request.client.host if request and request.client and request.client.host else "unknown"
    ua_part = (request.headers.get("user-agent") or "")[:160] if request else ""
    fingerprint_src = f"{token}|{ip_part}|{ua_part}"
    guest_fp = hashlib.sha256(fingerprint_src.encode("utf-8")).hexdigest()[:12]
    return ("guest", f"Guest: {guest_fp} | Link: {token_prefix}")


def create_share_access_log(
    db,
    share_id: str,
    action: str,
    viewer_type: str,
    viewer_label: str,
    request: Request | None,
) -> None:
    ip_address = request.client.host if request and request.client else None
    user_agent = request.headers.get("user-agent") if request else None
    db.add(
        ShareAccessLog(
            share_id=share_id,
            action=action,
            viewer_type=viewer_type,
            viewer_label=viewer_label,
            ip_address=ip_address,
            user_agent=user_agent,
        )
    )


def build_notification_payload(log: ShareAccessLog, share: Share, filename: str) -> dict:
    action = log.action if log.action in {"preview", "download"} else "preview"
    viewer = log.viewer_label or "Unknown viewer"
    action_label = "downloaded" if action == "download" else "accessed"
    created_at = log.created_at
    if created_at and created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
    return {
        "id": log.id,
        "share_id": share.id,
        "file_id": share.vault_item_id,
        "file_name": filename,
        "viewer_label": viewer,
        "action": action,
        "type": "shared_file_downloaded" if action == "download" else "shared_link_accessed",
        "message": f"{viewer} {action_label} {filename}",
        "created_at": created_at,
    }
