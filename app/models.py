from sqlalchemy import Column, String, DateTime, ForeignKey, Enum, Integer, Boolean
from sqlalchemy.sql import func
from uuid import uuid4
from .database import Base
import enum


class VaultItemType(enum.Enum):
    file = "file"
    folder = "folder"


class VaultItem(Base):
    __tablename__ = "vault_items"

    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    type = Column(Enum(VaultItemType), nullable=False)
    parent_id = Column(String, ForeignKey("vault_items.id"), nullable=True)
    owner_id = Column(String, nullable=False)
    created_at = Column(DateTime, server_default=func.now())


class Folder(Base):
    __tablename__ = "folders"

    id = Column(String, ForeignKey("vault_items.id"), primary_key=True)
    name = Column(String, nullable=False)


class File(Base):
    __tablename__ = "files"

    id = Column(String, ForeignKey("vault_items.id"), primary_key=True)
    filename = Column(String, nullable=False)
    mime_type = Column(String, nullable=False)
    storage_path = Column(String, nullable=False)
    iv = Column(String, nullable=False)


class EncryptedKey(Base):
    __tablename__ = "encrypted_keys"

    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    vault_item_id = Column(String, ForeignKey("vault_items.id"))
    user_id = Column(String)
    encrypted_key = Column(String)
    iv = Column(String, nullable=False) 

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    username = Column(String, unique=True, nullable=False)
    email = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=False)
    salt = Column(String, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    last_login = Column(DateTime, nullable=True)
    notifications_seen_at = Column(DateTime, nullable=True)


class Share(Base):
    __tablename__ = "shares"

    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    vault_item_id = Column(String, ForeignKey("vault_items.id"))
    owner_id = Column(String, ForeignKey("users.id"), nullable=False)
    token = Column(String, unique=True, nullable=False)
    encrypted_key = Column(String, nullable=False)  # file_key encrypted with share_key
    key_iv = Column(String, nullable=False)
    key_salt = Column(String, nullable=False)
    expiry_time = Column(DateTime, nullable=False)
    max_views = Column(Integer, nullable=True)
    views = Column(Integer, nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, server_default=func.now())


class AuthSession(Base):
    __tablename__ = "auth_sessions"

    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    token_hash = Column(String, unique=True, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, server_default=func.now())


class ShareAccessLog(Base):
    __tablename__ = "share_access_logs"

    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    share_id = Column(String, ForeignKey("shares.id"), nullable=False)
    action = Column(String, nullable=False)
    viewer_type = Column(String, nullable=False)
    viewer_label = Column(String, nullable=False)
    ip_address = Column(String, nullable=True)
    user_agent = Column(String, nullable=True)
    created_at = Column(DateTime, server_default=func.now())


class DeviceIdentity(Base):
    __tablename__ = "device_identities"

    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    guest_id = Column(String, unique=True, nullable=False)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
