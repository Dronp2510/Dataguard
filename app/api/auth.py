import base64
import os
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Form, Header, HTTPException, Request
from werkzeug.security import check_password_hash, generate_password_hash

from ..core.rate_limit import client_identity, enforce_rate_limit
from ..database import SessionLocal
from ..models import AuthSession, File as VaultFile, User, VaultItem
from ..services.auth import bind_guest_identity_to_user, get_bearer_token, get_current_user
from ..utils import generate_token, hash_token, new_session_expiry

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
        client = client_identity(request)
        enforce_rate_limit("signup_ip", client, 10, 60)
        enforce_rate_limit("signup_email", email.lower(), 5, 300)
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
        enforce_rate_limit("login_email", email.lower(), 10, 60)
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
        bind_guest_identity_to_user(db, x_guest_id, user)
        db.commit()

        return {
            "message": "Login success",
            "user_id": user.id,
            "username": user.username,
            "email": user.email,
            "salt": user.salt,
            "last_login": user.last_login,
            "expires_at": session.expires_at,
            "access_token": raw_token,
        }
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
        return {
            "user_id": user.id,
            "username": user.username,
            "email": user.email,
            "last_login": user.last_login,
            "created_at": user.created_at,
            "total_documents": total_documents,
        }
    finally:
        db.close()
