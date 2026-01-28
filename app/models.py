from sqlalchemy import LargeBinary, Column, String, DateTime, Boolean, ForeignKey, Enum
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


class Share(Base):
    __tablename__ = "shares"

    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    vault_item_id = Column(String, ForeignKey("vault_items.id"))
    encrypted_key = Column(String, nullable=False)  # file_key encrypted with share_key
    expiry_time = Column(DateTime, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
