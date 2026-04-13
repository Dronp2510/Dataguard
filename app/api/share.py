from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Form, Header, HTTPException, Request
from fastapi.responses import FileResponse

from ..core.rate_limit import client_identity, enforce_rate_limit
from ..database import SessionLocal
from ..models import File as VaultFile, Share, ShareAccessLog, User, VaultItemType
from ..services.auth import get_current_user
from ..services.share import create_share_access_log, get_share_or_410, resolve_viewer_identity
from ..services.vault import ensure_item_owner
from ..utils import convert_datetimes_to_ist, generate_token

router = APIRouter()


@router.post("/share/create")
def create_share_link(
    request: Request,
    file_id: str = Form(...),
    encrypted_key: str = Form(...),
    key_iv: str = Form(...),
    key_salt: str = Form(...),
    expiry_option: str = Form("10"),
    max_views: int | None = Form(None),
    current_user: User = Depends(get_current_user),
):
    db = SessionLocal()
    try:
        enforce_rate_limit("share_create", f"{current_user.id}:{client_identity(request)}", 30, 60)

        item = ensure_item_owner(db, file_id, current_user.id)
        if item.type != VaultItemType.file:
            raise HTTPException(status_code=400, detail="Only files can be shared")

        expiry_map = {"5": 5, "10": 10, "30": 30, "forever": None}
        if expiry_option not in expiry_map:
            raise HTTPException(status_code=400, detail="Invalid expiry option")
        minutes = expiry_map[expiry_option]
        expiry_time = (
            datetime(9999, 12, 31, tzinfo=timezone.utc)
            if minutes is None
            else datetime.now(timezone.utc) + timedelta(minutes=minutes)
        )

        safe_max_views = None
        if max_views is not None:
            safe_max_views = max(1, min(max_views, 1000))

        token = generate_token()
        share = Share(
            vault_item_id=file_id,
            owner_id=current_user.id,
            token=token,
            encrypted_key=encrypted_key,
            key_iv=key_iv,
            key_salt=key_salt,
            expiry_time=expiry_time,
            max_views=safe_max_views,
        )
        db.add(share)
        db.commit()

        return convert_datetimes_to_ist({
            "share_id": share.id,
            "share_url": f"/share/{token}",
            "expires_at": share.expiry_time,
            "expiry_option": expiry_option,
            "max_views": share.max_views,
        })
    finally:
        db.close()


@router.get("/share/list")
def list_my_shares(current_user: User = Depends(get_current_user)):
    db = SessionLocal()
    try:
        rows = db.query(Share).filter(Share.owner_id == current_user.id).order_by(Share.created_at.desc()).all()
        return convert_datetimes_to_ist([
            {
                "id": s.id,
                "file_id": s.vault_item_id,
                "token": s.token,
                "is_active": s.is_active,
                "views": s.views,
                "max_views": s.max_views,
                "expiry_time": s.expiry_time,
                "created_at": s.created_at,
            }
            for s in rows
        ])
    finally:
        db.close()


@router.delete("/share/{share_id}")
def revoke_share(share_id: str, current_user: User = Depends(get_current_user)):
    db = SessionLocal()
    try:
        row = db.query(Share).filter(Share.id == share_id).first()
        if not row:
            raise HTTPException(status_code=404, detail="Share not found")
        if row.owner_id != current_user.id:
            raise HTTPException(status_code=403, detail="Forbidden")
        row.is_active = False
        db.commit()
        return {"message": "Share revoked"}
    finally:
        db.close()


@router.get("/share/{token}")
def share_metadata(
    token: str,
    request: Request,
    authorization: str | None = Header(default=None),
    x_guest_id: str | None = Header(default=None),
):
    db = SessionLocal()
    try:
        enforce_rate_limit("share_meta", f"{token}:{client_identity(request)}", 60, 60)
        share = get_share_or_410(db, token)
        file = db.query(VaultFile).filter(VaultFile.id == share.vault_item_id).first()
        if not file:
            raise HTTPException(status_code=404, detail="File not found")
        viewer_type, viewer_label = resolve_viewer_identity(db, token, authorization, x_guest_id, request)
        create_share_access_log(db, share.id, "metadata", viewer_type, viewer_label, request)
        db.commit()

        return convert_datetimes_to_ist({
            "metadata": {
                "filename": file.filename,
                "mime_type": file.mime_type,
                "iv": file.iv,
                "encrypted_key": share.encrypted_key,
                "key_iv": share.key_iv,
                "key_salt": share.key_salt,
                "is_compressed": bool(file.is_compressed),
                "compression_algo": file.compression_algo,
                "original_filename": file.original_filename or file.filename,
                "original_size": file.original_size,
                "compressed_size": file.compressed_size,
            },
            "download_url": f"/share/{token}/blob",
            "remaining_views": None if share.max_views is None else (share.max_views - share.views),
            "expires_at": share.expiry_time,
            "is_forever": share.expiry_time.year >= 9999,
            "watermark_text": viewer_label,
        })
    finally:
        db.close()


@router.get("/share/{token}/blob")
def share_blob(
    token: str,
    request: Request,
    action: str = "preview",
    authorization: str | None = Header(default=None),
    x_guest_id: str | None = Header(default=None),
):
    db = SessionLocal()
    try:
        enforce_rate_limit("share_blob", f"{token}:{client_identity(request)}", 90, 60)
        share = get_share_or_410(db, token)
        file = db.query(VaultFile).filter(VaultFile.id == share.vault_item_id).first()
        if not file:
            raise HTTPException(status_code=404, detail="File not found")

        viewer_type, viewer_label = resolve_viewer_identity(db, token, authorization, x_guest_id, request)
        normalized_action = action if action in {"preview", "download"} else "preview"
        create_share_access_log(db, share.id, normalized_action, viewer_type, viewer_label, request)
        share.views = (share.views or 0) + 1
        db.commit()

        return FileResponse(
            path=file.storage_path,
            media_type=file.mime_type,
            filename=file.filename,
            headers={"Content-Disposition": f'inline; filename="{file.filename}"'},
        )
    finally:
        db.close()


@router.get("/share/{share_id}/logs")
def share_logs(share_id: str, current_user: User = Depends(get_current_user)):
    db = SessionLocal()
    try:
        share = db.query(Share).filter(Share.id == share_id).first()
        if not share:
            raise HTTPException(status_code=404, detail="Share not found")
        if share.owner_id != current_user.id:
            raise HTTPException(status_code=403, detail="Forbidden")
        logs = db.query(ShareAccessLog).filter(ShareAccessLog.share_id == share_id).order_by(ShareAccessLog.created_at.desc()).all()
        return convert_datetimes_to_ist([
            {
                "id": log.id,
                "action": log.action,
                "viewer_type": log.viewer_type,
                "viewer_label": log.viewer_label,
                "ip_address": log.ip_address,
                "user_agent": log.user_agent,
                "created_at": log.created_at,
            }
            for log in logs
        ])
    finally:
        db.close()


@router.get("/activity/logs")
def activity_logs(current_user: User = Depends(get_current_user)):
    db = SessionLocal()
    try:
        def as_utc(dt: datetime | None) -> datetime | None:
            if dt is None:
                return None
            if dt.tzinfo is None:
                return dt.replace(tzinfo=timezone.utc)
            return dt

        now = datetime.now(timezone.utc)
        shares = db.query(Share).filter(Share.owner_id == current_user.id).order_by(Share.created_at.desc()).all()
        share_ids = [share.id for share in shares]
        file_ids = {share.vault_item_id for share in shares}
        file_map = {
            file_row.id: file_row.filename
            for file_row in db.query(VaultFile).filter(VaultFile.id.in_(file_ids)).all()
        } if file_ids else {}
        logs_by_share_id: dict[str, list[ShareAccessLog]] = {}
        if share_ids:
            all_logs = (
                db.query(ShareAccessLog)
                .filter(ShareAccessLog.share_id.in_(share_ids))
                .order_by(ShareAccessLog.created_at.desc())
                .all()
            )
            for log in all_logs:
                logs_by_share_id.setdefault(log.share_id, []).append(log)

        result = []
        for share in shares:
            logs = logs_by_share_id.get(share.id, [])
            access_logs = [log for log in logs if log.action in {"preview", "download"}]
            download_count = sum(1 for log in access_logs if log.action == "download")

            latest_log = access_logs[0] if access_logs else None
            expires = share.expiry_time
            if expires.tzinfo is None:
                expires = expires.replace(tzinfo=timezone.utc)

            if not share.is_active:
                status = "revoked"
            elif share.max_views is not None and (share.views or 0) >= share.max_views:
                status = "view_limit_reached"
            elif expires <= now:
                status = "expired"
            else:
                status = "active"

            viewer_latest: dict[str, dict] = {}
            for log in access_logs:
                entry = viewer_latest.get(log.viewer_label)
                if entry is None:
                    viewer_latest[log.viewer_label] = {
                        "viewer_type": log.viewer_type,
                        "viewer_label": log.viewer_label,
                        "latest_time_accessed": as_utc(log.created_at),
                        "access_count": 1,
                    }
                else:
                    entry["access_count"] += 1

            viewer_entries = sorted(
                viewer_latest.values(),
                key=lambda row: row["latest_time_accessed"] or datetime.min.replace(tzinfo=timezone.utc),
                reverse=True,
            )

            result.append(
                {
                    "share_id": share.id,
                    "file_id": share.vault_item_id,
                    "name": file_map.get(share.vault_item_id, "Unknown File"),
                    "accessed_by": latest_log.viewer_label if latest_log else "No access yet",
                    "unique_viewer_count": len(viewer_entries),
                    "viewer_entries": viewer_entries,
                    "number_of_time_accessed": share.views or 0,
                    "download_count": download_count,
                    "is_downloaded": download_count > 0,
                    "latest_action": latest_log.action if latest_log else None,
                    "latest_time_accessed": as_utc(latest_log.created_at) if latest_log else None,
                    "all_access_times": [as_utc(log.created_at) for log in access_logs],
                    "all_access_entries": [
                        {
                            "viewer_type": log.viewer_type,
                            "viewer_label": log.viewer_label,
                            "action": log.action,
                            "time_accessed": as_utc(log.created_at),
                        }
                        for log in access_logs
                    ],
                    "status": status,
                    "expiry_time": share.expiry_time,
                }
            )

        return convert_datetimes_to_ist(result)
    finally:
        db.close()
