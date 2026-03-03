from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends, Header, Request
from uuid import uuid4
from .models import VaultItem, VaultItemType, Folder, File as VaultFile, EncryptedKey, User, AuthSession, Share, ShareAccessLog
from .database import Base, engine, SessionLocal
from .utils import STORAGE_PATH, generate_token, hash_token, new_session_expiry, ensure_not_expired
from .schemas import VaultItemResponse
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from werkzeug.security import generate_password_hash, check_password_hash
import os
import base64
from datetime import datetime, timezone, timedelta

Base.metadata.create_all(bind=engine)


def ensure_sqlite_column(table: str, column: str, ddl_type: str) -> None:
    with engine.begin() as conn:
        columns = conn.execute(text(f"PRAGMA table_info({table})")).fetchall()
        names = {row[1] for row in columns}
        if column not in names:
            conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {ddl_type}"))


ensure_sqlite_column("shares", "owner_id", "VARCHAR")
ensure_sqlite_column("shares", "token", "VARCHAR")
ensure_sqlite_column("shares", "key_iv", "VARCHAR")
ensure_sqlite_column("shares", "key_salt", "VARCHAR")
ensure_sqlite_column("shares", "max_views", "INTEGER")
ensure_sqlite_column("shares", "views", "INTEGER DEFAULT 0")
ensure_sqlite_column("shares", "is_active", "BOOLEAN DEFAULT 1")
ensure_sqlite_column("share_access_logs", "action", "VARCHAR")
ensure_sqlite_column("share_access_logs", "viewer_type", "VARCHAR")
ensure_sqlite_column("share_access_logs", "viewer_label", "VARCHAR")
ensure_sqlite_column("share_access_logs", "ip_address", "VARCHAR")
ensure_sqlite_column("share_access_logs", "user_agent", "VARCHAR")

app = FastAPI(title="DataGuard MVP")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


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


def ensure_item_owner(db, item_id: str, user_id: str) -> VaultItem:
    item = db.query(VaultItem).filter(VaultItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    if item.owner_id != user_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    return item


def delete_vault_item_tree(db, item_id: str, owner_id: str) -> None:
    item = ensure_item_owner(db, item_id, owner_id)

    if item.type == VaultItemType.folder:
        children = db.query(VaultItem).filter(VaultItem.parent_id == item.id).all()
        for child in children:
            delete_vault_item_tree(db, child.id, owner_id)
        db.query(Folder).filter(Folder.id == item.id).delete()
    else:
        file_row = db.query(VaultFile).filter(VaultFile.id == item.id).first()
        if file_row:
            try:
                os.remove(file_row.storage_path)
            except FileNotFoundError:
                pass
        db.query(VaultFile).filter(VaultFile.id == item.id).delete()
        db.query(EncryptedKey).filter(EncryptedKey.vault_item_id == item.id).delete()

    db.query(VaultItem).filter(VaultItem.id == item.id).delete()


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
    guest_id: str | None,
) -> tuple[str, str]:
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
                        return ("signed_user", f"User: {user.id} | {user.username}")
                except HTTPException:
                    pass

    token_prefix = token[:8]
    if guest_id and guest_id.strip():
        cleaned = guest_id.strip()[:48]
        return ("guest", f"Share: {cleaned} | Link: {token_prefix}")
    anon = f"guest-{token_prefix}-{str(uuid4())[:8]}"
    return ("guest", f"Share: {anon} | Link: {token_prefix}")


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


# -------------------------
# DOCUMENT UPLOAD
# -------------------------
@app.post("/vault/files")
async def upload_encrypted_file(
    encrypted_file: UploadFile = File(...),
    filename: str = Form(...),
    mime_type: str = Form(...),
    parent_folder_id: str | None = Form(None),
    encrypted_key: str = Form(...),
    iv: str = Form(...),
    key_iv: str = Form(...),
    current_user: User = Depends(get_current_user)
):
    db = SessionLocal()
    try:
        if parent_folder_id:
            parent = ensure_item_owner(db, parent_folder_id, current_user.id)
            if parent.type != VaultItemType.folder:
                raise HTTPException(status_code=400, detail="Parent must be a folder")

        stored_name = str(uuid4())
        file_path = STORAGE_PATH / stored_name

        with open(file_path, "wb") as f:
            f.write(await encrypted_file.read())

        vault_item = VaultItem(
            type=VaultItemType.file,
            parent_id=parent_folder_id,
            owner_id=current_user.id
        )
        db.add(vault_item)
        db.flush()

        file = VaultFile(
            id=vault_item.id,
            filename=filename,
            mime_type=mime_type,
            storage_path=str(file_path),
            iv=iv
        )
        db.add(file)

        key = EncryptedKey(
            vault_item_id=vault_item.id,
            user_id=current_user.id,
            encrypted_key=encrypted_key,
            iv=key_iv
        )
        db.add(key)

        db.commit()
        return {"file_id": vault_item.id}
    finally:
        db.close()



@app.post("/vault/folders")
def create_folder(
    name: str = Form(...),
    parent_id: str | None = Form(None),
    current_user: User = Depends(get_current_user),
):
    db = SessionLocal()
    try:
        if parent_id:
            parent = ensure_item_owner(db, parent_id, current_user.id)
            if parent.type != VaultItemType.folder:
                raise HTTPException(status_code=400, detail="Parent must be a folder")

        vault_item = VaultItem(
            type=VaultItemType.folder,
            parent_id=parent_id,
            owner_id=current_user.id
        )
        db.add(vault_item)
        db.flush()

        folder = Folder(
            id=vault_item.id,
            name=name
        )
        db.add(folder)
        db.commit()

        return {"id": vault_item.id, "name": name}
    finally:
        db.close()

@app.get("/vault/files/{file_id}/download")
def download_encrypted_file(file_id: str, current_user: User = Depends(get_current_user)):
    db = SessionLocal()
    try:
        item = ensure_item_owner(db, file_id, current_user.id)
        if item.type != VaultItemType.file:
            raise HTTPException(status_code=400, detail="Not a file")
        file = db.query(VaultFile).filter_by(id=file_id).first()
        key = db.query(EncryptedKey).filter_by(vault_item_id=file_id, user_id=current_user.id).first()

        if not file or not key:
            raise HTTPException(404)

        return {
            "metadata": {
                "filename": file.filename,
                "mime_type": file.mime_type,
                "iv": file.iv,
                "encrypted_key": key.encrypted_key,
                "key_iv": key.iv,
            },
            "download_url": f"/vault/files/{file_id}/blob"
        }
    finally:
        db.close()

@app.get("/vault/files/{file_id}/blob")
def download_encrypted_blob(file_id: str, current_user: User = Depends(get_current_user)):
    db = SessionLocal()
    try:
        item = ensure_item_owner(db, file_id, current_user.id)
        if item.type != VaultItemType.file:
            raise HTTPException(status_code=400, detail="Not a file")
        file = db.query(VaultFile).filter_by(id=file_id).first()
        if not file:
            raise HTTPException(404)

        return FileResponse(
            path=file.storage_path,
            media_type=file.mime_type,
            filename=file.filename,
            headers={
                "Content-Disposition": f'inline; filename="{file.filename}"'
            }
        )
    finally:
        db.close()

@app.get("/vault/items", response_model=list[VaultItemResponse])
def list_vault_items(parent_id: str | None = None, current_user: User = Depends(get_current_user)):
    db = SessionLocal()
    try:
        if parent_id:
            parent = ensure_item_owner(db, parent_id, current_user.id)
            if parent.type != VaultItemType.folder:
                raise HTTPException(status_code=400, detail="Parent must be a folder")

        query = db.query(VaultItem).filter(
                VaultItem.owner_id == current_user.id
                )

        if parent_id is None:
            query = query.filter(VaultItem.parent_id.is_(None))
        else:
            query = query.filter(VaultItem.parent_id == parent_id)

        items = query.all()

        result = []

        for item in items:
            if item.type.value == "folder":
                folder = db.query(Folder).filter_by(id=item.id).first()
                name = folder.name if folder else "Unnamed Folder"

            else:  # file
                file = db.query(VaultFile).filter_by(id=item.id).first()
                name = file.filename if file else "Unnamed File"

            result.append({
                "id": item.id,
                "type": item.type.value,
                "name": name,
                "created_at": item.created_at,
                "parent_id": item.parent_id,
            })

        return result
    finally:
        db.close()


@app.get("/vault/recent", response_model=list[VaultItemResponse])
def recent_items(limit: int = 3, current_user: User = Depends(get_current_user)):
    db = SessionLocal()
    try:
        safe_limit = max(1, min(limit, 50))
        items = (
            db.query(VaultItem)
            .filter(VaultItem.owner_id == current_user.id)
            .order_by(VaultItem.created_at.desc())
            .limit(safe_limit)
            .all()
        )
        result = []
        for item in items:
            if item.type.value == "folder":
                folder = db.query(Folder).filter_by(id=item.id).first()
                name = folder.name if folder else "Unnamed Folder"
            else:
                file = db.query(VaultFile).filter_by(id=item.id).first()
                name = file.filename if file else "Unnamed File"
            result.append(
                {
                    "id": item.id,
                    "type": item.type.value,
                    "name": name,
                    "created_at": item.created_at,
                    "parent_id": item.parent_id,
                }
            )
        return result
    finally:
        db.close()


@app.put("/vault/items/{item_id}/rename")
def rename_item(
    item_id: str,
    new_name: str = Form(...),
    current_user: User = Depends(get_current_user),
):
    db = SessionLocal()
    try:
        item = ensure_item_owner(db, item_id, current_user.id)
        clean_name = new_name.strip()
        if not clean_name:
            raise HTTPException(status_code=400, detail="Name cannot be empty")

        if item.type == VaultItemType.folder:
            row = db.query(Folder).filter(Folder.id == item_id).first()
            if not row:
                raise HTTPException(status_code=404, detail="Folder not found")
            row.name = clean_name
        else:
            row = db.query(VaultFile).filter(VaultFile.id == item_id).first()
            if not row:
                raise HTTPException(status_code=404, detail="File not found")
            row.filename = clean_name

        db.commit()
        return {"message": "Renamed successfully"}
    finally:
        db.close()


@app.delete("/vault/items/{item_id}")
def delete_item(item_id: str, current_user: User = Depends(get_current_user)):
    db = SessionLocal()
    try:
        delete_vault_item_tree(db, item_id, current_user.id)
        db.commit()
        return {"message": "Deleted successfully"}
    finally:
        db.close()


@app.post("/share/create")
def create_share_link(
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

        return {
            "share_id": share.id,
            "share_url": f"/share/{token}",
            "expires_at": share.expiry_time,
            "expiry_option": expiry_option,
            "max_views": share.max_views,
        }
    finally:
        db.close()


@app.get("/share/list")
def list_my_shares(current_user: User = Depends(get_current_user)):
    db = SessionLocal()
    try:
        rows = (
            db.query(Share)
            .filter(Share.owner_id == current_user.id)
            .order_by(Share.created_at.desc())
            .all()
        )
        return [
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
        ]
    finally:
        db.close()


@app.delete("/share/{share_id}")
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


@app.get("/share/{token}")
def share_metadata(
    token: str,
    request: Request,
    authorization: str | None = Header(default=None),
    x_guest_id: str | None = Header(default=None),
):
    db = SessionLocal()
    try:
        share = get_share_or_410(db, token)
        file = db.query(VaultFile).filter(VaultFile.id == share.vault_item_id).first()
        if not file:
            raise HTTPException(status_code=404, detail="File not found")
        viewer_type, viewer_label = resolve_viewer_identity(db, token, authorization, x_guest_id)
        create_share_access_log(db, share.id, "metadata", viewer_type, viewer_label, request)
        db.commit()

        return {
            "metadata": {
                "filename": file.filename,
                "mime_type": file.mime_type,
                "iv": file.iv,
                "encrypted_key": share.encrypted_key,
                "key_iv": share.key_iv,
                "key_salt": share.key_salt,
            },
            "download_url": f"/share/{token}/blob",
            "remaining_views": None if share.max_views is None else (share.max_views - share.views),
            "expires_at": share.expiry_time,
            "is_forever": share.expiry_time.year >= 9999,
            "watermark_text": viewer_label,
        }
    finally:
        db.close()


@app.get("/share/{token}/blob")
def share_blob(
    token: str,
    request: Request,
    action: str = "preview",
    authorization: str | None = Header(default=None),
    x_guest_id: str | None = Header(default=None),
):
    db = SessionLocal()
    try:
        share = get_share_or_410(db, token)
        file = db.query(VaultFile).filter(VaultFile.id == share.vault_item_id).first()
        if not file:
            raise HTTPException(status_code=404, detail="File not found")

        viewer_type, viewer_label = resolve_viewer_identity(db, token, authorization, x_guest_id)
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


@app.get("/share/{share_id}/logs")
def share_logs(share_id: str, current_user: User = Depends(get_current_user)):
    db = SessionLocal()
    try:
        share = db.query(Share).filter(Share.id == share_id).first()
        if not share:
            raise HTTPException(status_code=404, detail="Share not found")
        if share.owner_id != current_user.id:
            raise HTTPException(status_code=403, detail="Forbidden")
        logs = (
            db.query(ShareAccessLog)
            .filter(ShareAccessLog.share_id == share_id)
            .order_by(ShareAccessLog.created_at.desc())
            .all()
        )
        return [
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
        ]
    finally:
        db.close()


@app.get("/activity/logs")
def activity_logs(current_user: User = Depends(get_current_user)):
    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        shares = (
            db.query(Share)
            .filter(Share.owner_id == current_user.id)
            .order_by(Share.created_at.desc())
            .all()
        )

        result = []
        for share in shares:
            file = db.query(VaultFile).filter(VaultFile.id == share.vault_item_id).first()
            logs = (
                db.query(ShareAccessLog)
                .filter(ShareAccessLog.share_id == share.id)
                .order_by(ShareAccessLog.created_at.desc())
                .all()
            )

            latest_log = logs[0] if logs else None
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

            result.append(
                {
                    "share_id": share.id,
                    "file_id": share.vault_item_id,
                    "name": file.filename if file else "Unknown File",
                    "accessed_by": latest_log.viewer_label if latest_log else "No access yet",
                    "number_of_time_accessed": share.views or 0,
                    "latest_time_accessed": latest_log.created_at if latest_log else None,
                    "all_access_times": [log.created_at for log in logs],
                    "status": status,
                    "expiry_time": share.expiry_time,
                }
            )

        return result
    finally:
        db.close()

# -------------------------
# AUTH - SIGNUP
# -------------------------
@app.post("/auth/signup")
def signup(username: str = Form(...), email: str = Form(...), password: str = Form(...)):
    db = SessionLocal()
    try:
        # check if user exists
        existing = db.query(User).filter((User.email == email) | (User.username == username)).first()
        if existing:
            raise HTTPException(status_code=409, detail="User already exists")

        salt = base64.b64encode(os.urandom(16)).decode("utf-8")
        password_hash = generate_password_hash(password)

        user = User(
            username=username,
            email=email,
            password_hash=password_hash,
            salt=salt
        )

        db.add(user)
        db.commit()

        return {"message": "User created successfully"}
    finally:
        db.close()

# -------------------------
# AUTH - LOGIN
# -------------------------
@app.post("/auth/login")
def login(email: str = Form(...), password: str = Form(...)):
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()

        if not user or not check_password_hash(user.password_hash, password):
            raise HTTPException(status_code=401, detail="Invalid credentials")
        user.last_login = datetime.now(timezone.utc)
        raw_token = generate_token()
        session = AuthSession(
            user_id=user.id,
            token_hash=hash_token(raw_token),
            expires_at=new_session_expiry(),
        )
        db.add(session)
        db.commit()

        return {
            "message": "Login success",
            "user_id": user.id,
            "username": user.username,
            "email": user.email,
            "salt": user.salt,
            "last_login": user.last_login,
            "access_token": raw_token
        }
    finally:
        db.close()


@app.post("/auth/logout")
def logout(token: str = Depends(get_bearer_token)):
    db = SessionLocal()
    try:
        token_hash = hash_token(token)
        db.query(AuthSession).filter(AuthSession.token_hash == token_hash).delete()
        db.commit()
        return {"message": "Logged out"}
    finally:
        db.close()

