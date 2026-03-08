import asyncio
import json
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse

from ..database import SessionLocal
from ..models import File as VaultFile, Share, ShareAccessLog, User
from ..services.auth import get_current_user, resolve_user_from_access_token
from ..services.share import build_notification_payload

router = APIRouter()


@router.get("/notifications")
def list_notifications(
    limit: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
):
    db = SessionLocal()
    try:
        shares = db.query(Share).filter(Share.owner_id == current_user.id).all()
        if not shares:
            return {"items": []}

        share_map = {share.id: share for share in shares}
        share_ids = list(share_map.keys())
        logs = (
            db.query(ShareAccessLog)
            .filter(ShareAccessLog.share_id.in_(share_ids))
            .filter(ShareAccessLog.action.in_(["preview", "download"]))
            .order_by(ShareAccessLog.created_at.desc())
            .limit(limit)
            .all()
        )
        file_cache: dict[str, str] = {}
        items = []
        for log in logs:
            share = share_map.get(log.share_id)
            if not share:
                continue
            filename = file_cache.get(share.vault_item_id)
            if filename is None:
                file_row = db.query(VaultFile).filter(VaultFile.id == share.vault_item_id).first()
                filename = file_row.filename if file_row else "Unknown File"
                file_cache[share.vault_item_id] = filename
            items.append(build_notification_payload(log, share, filename))
        seen_at = current_user.notifications_seen_at
        unread_query = (
            db.query(ShareAccessLog)
            .filter(ShareAccessLog.share_id.in_(share_ids))
            .filter(ShareAccessLog.action.in_(["preview", "download"]))
        )
        if seen_at is not None:
            unread_query = unread_query.filter(ShareAccessLog.created_at > seen_at)
        unread_count = unread_query.count()
        return {"items": items, "unread_count": unread_count, "seen_at": seen_at}
    finally:
        db.close()


@router.post("/notifications/read-all")
def mark_all_notifications_read(current_user: User = Depends(get_current_user)):
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == current_user.id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        user.notifications_seen_at = datetime.now(timezone.utc)
        db.commit()
        return {"message": "Notifications marked as read", "seen_at": user.notifications_seen_at}
    finally:
        db.close()


@router.get("/notifications/stream")
async def notification_stream(access_token: str = Query(...)):
    db = SessionLocal()
    try:
        user = resolve_user_from_access_token(db, access_token)
    finally:
        db.close()

    async def event_generator():
        stream_db = SessionLocal()
        last_seen_at = datetime.utcnow() - timedelta(seconds=2)
        try:
            yield "event: ready\ndata: {\"ok\": true}\n\n"
            while True:
                shares = stream_db.query(Share).filter(Share.owner_id == user.id).all()
                if shares:
                    share_map = {share.id: share for share in shares}
                    share_ids = list(share_map.keys())
                    logs = (
                        stream_db.query(ShareAccessLog)
                        .filter(ShareAccessLog.share_id.in_(share_ids))
                        .filter(ShareAccessLog.action.in_(["preview", "download"]))
                        .filter(ShareAccessLog.created_at > last_seen_at)
                        .order_by(ShareAccessLog.created_at.asc())
                        .all()
                    )
                    if logs:
                        file_cache: dict[str, str] = {}
                        for log in logs:
                            share = share_map.get(log.share_id)
                            if not share:
                                continue
                            filename = file_cache.get(share.vault_item_id)
                            if filename is None:
                                file_row = stream_db.query(VaultFile).filter(VaultFile.id == share.vault_item_id).first()
                                filename = file_row.filename if file_row else "Unknown File"
                                file_cache[share.vault_item_id] = filename

                            payload = build_notification_payload(log, share, filename)
                            yield f"event: notification\ndata: {json.dumps(payload, default=str)}\n\n"
                            created = log.created_at
                            if created:
                                normalized_created = created.replace(tzinfo=None) if created.tzinfo else created
                                if normalized_created > last_seen_at:
                                    last_seen_at = normalized_created

                yield "event: heartbeat\ndata: {}\n\n"
                await asyncio.sleep(2)
        finally:
            stream_db.close()

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
