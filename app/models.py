from sqlalchemy import Column, String, DateTime, Boolean, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.dialects.sqlite import BLOB
from uuid import uuid4
from .database import Base

class Document(Base):
    __tablename__ = "documents"

    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    original_filename = Column(String)
    stored_filename = Column(String)
    category = Column(String)
    mime_type = Column(String)
    created_at = Column(DateTime, server_default=func.now())


class SharedLink(Base):
    __tablename__ = "shared_links"

    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    document_id = Column(String, ForeignKey("documents.id"))
    token = Column(String, unique=True, index=True)
    expires_at = Column(DateTime)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
