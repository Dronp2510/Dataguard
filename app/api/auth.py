import base64
import os
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Form, Header, HTTPException, Request
from werkzeug.security import check_password_hash, generate_password_hash

from ..core.rate_limit import client_identity, enforce_rate_limit
from ..database import SessionLocal
from ..models import AuthSession, EncryptedKey, File as VaultFile, User, VaultItem
from ..schemas import PasswordChangeRequest
from ..services.auth import bind_guest_identity_to_user, get_bearer_token, get_current_user
from ..services.vault import get_storage_summary
from ..utils import (
    convert_datetimes_to_ist,
    generate_token,
    hash_token,
    new_session_expiry,
    sanitize_display_name,
    validate_metadata_value,
)

router = APIRouter()


@router.post("/auth/signup")
def signup(
    request: Request,
    username: str = Form(...),
    email: str = Form(...),
    password: str = Form(...),
):
    db = SessionLocal()
    try:
        username = sanitize_display_name(username, "Username")
        email = email.strip().lower()

        if "@" not in email:
            raise HTTPException(status_code=400, detail="Email must contain '@'")
        if len(password) < 8:
            raise HTTPException(status_code=400, detail="Password must be at least 8 characters long")

        client = client_identity(request)
        enforce_rate_limit("signup_ip", client, 10, 60)
        enforce_rate_limit("signup_email", email, 5, 300)
        existing = db.query(User).filter((User.email == email) | (User.username == username)).first()
        if existing:
            raise HTTPException(status_code=409, detail="User already exists")

        salt = base64.b64encode(os.urandom(16)).decode("utf-8")
        password_hash = generate_password_hash(password)

        user = User(username=username, email=email, password_hash=password_hash, salt=salt)
        db.add(user)
        db.commit()

        return {"message": "User created successfully"}
    finally:
        db.close()


@router.post("/auth/login")
def login(
    request: Request,
    email: str = Form(...),
    password: str = Form(...),
    x_guest_id: str | None = Header(default=None),
):
    db = SessionLocal()
    try:
        client = client_identity(request)
        enforce_rate_limit("login_ip", client, 20, 60)
        normalized_email = email.strip().lower()
        enforce_rate_limit("login_email", normalized_email, 10, 60)
        user = db.query(User).filter(User.email == normalized_email).first()

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
        bind_guest_identity_to_user(db, x_guest_id, user)
        db.commit()

        return convert_datetimes_to_ist({
            "message": "Login success",
            "user_id": user.id,
            "username": user.username,
            "email": user.email,
            "salt": user.salt,
            "last_login": user.last_login,
            "expires_at": session.expires_at,
            "access_token": raw_token,
        })
    finally:
        db.close()


@router.post("/auth/logout")
def logout(token: str = Depends(get_bearer_token)):
    db = SessionLocal()
    try:
        token_hash = hash_token(token)
        db.query(AuthSession).filter(AuthSession.token_hash == token_hash).delete()
        db.commit()
        return {"message": "Logged out"}
    finally:
        db.close()


@router.get("/auth/me")
def current_profile(current_user: User = Depends(get_current_user)):
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == current_user.id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        total_documents = (
            db.query(VaultFile)
            .join(VaultItem, VaultItem.id == VaultFile.id)
            .filter(VaultItem.owner_id == user.id)
            .count()
        )
        return convert_datetimes_to_ist({
            "user_id": user.id,
            "username": user.username,
            "email": user.email,
            "last_login": user.last_login,
            "created_at": user.created_at,
            "total_documents": total_documents,
            **get_storage_summary(db, user.id),
        })
    finally:
        db.close()


@router.get("/auth/key-wrappings")
def get_key_wrappings(current_user: User = Depends(get_current_user)):
    db = SessionLocal()
    try:
        key_rows = (
            db.query(EncryptedKey)
            .filter(EncryptedKey.user_id == current_user.id)
            .order_by(EncryptedKey.vault_item_id.asc())
            .all()
        )
        return {
            "items": [
                {
                    "vault_item_id": row.vault_item_id,
                    "encrypted_key": row.encrypted_key,
                    "key_iv": row.iv,
                }
                for row in key_rows
            ]
        }
    finally:
        db.close()


@router.post("/auth/change-password")
def change_password(payload: PasswordChangeRequest, current_user: User = Depends(get_current_user)):
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == current_user.id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        if not check_password_hash(user.password_hash, payload.current_password):
            raise HTTPException(status_code=401, detail="Current password is incorrect")

        if len(payload.new_password) < 8:
            raise HTTPException(status_code=400, detail="New password must be at least 8 characters long")

        if payload.current_password == payload.new_password:
            raise HTTPException(status_code=400, detail="New password must be different from the current password")
        validate_metadata_value(payload.new_salt, "new_salt")

        existing_rows = db.query(EncryptedKey).filter(EncryptedKey.user_id == user.id).all()
        existing_ids = {row.vault_item_id for row in existing_rows}
        submitted_ids = {row.vault_item_id for row in payload.wrapped_keys}

        if existing_ids != submitted_ids:
            raise HTTPException(
                status_code=400,
                detail="Password rotation requires a fresh wrapped key for every stored file",
            )

        updates_by_item_id = {}
        for row in payload.wrapped_keys:
            validate_metadata_value(row.encrypted_key, "encrypted_key")
            validate_metadata_value(row.key_iv, "key_iv")
            updates_by_item_id[row.vault_item_id] = row

        user.password_hash = generate_password_hash(payload.new_password)
        user.salt = payload.new_salt

        for key_row in existing_rows:
            updated = updates_by_item_id[key_row.vault_item_id]
            key_row.encrypted_key = updated.encrypted_key
            key_row.iv = updated.key_iv

        db.commit()
        return {"message": "Password changed successfully", "salt": user.salt}
    finally:
        db.close()
