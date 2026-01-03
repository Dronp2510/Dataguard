from anyio.streams import file
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from uuid import uuid4
import qrcode
from io import BytesIO
from pathlib import Path

from .database import Base, engine, SessionLocal
from .models import Document, SharedLink
from .schemas import DocumentResponse, ShareResponse
from .utils import generate_token, STORAGE_PATH
from crypto_utils import  generate_aes_key_iv , encrypt_bytes

Base.metadata.create_all(bind=engine)

app = FastAPI(title="DataGuard MVP")

ALLOWED_TYPES = ["image/jpeg", "image/png", "application/pdf"]

# -------------------------
# DOCUMENT UPLOAD
# -------------------------
@app.post("/documents/upload")
async def upload_document(
    file: UploadFile = File(...),
    category: str = Form(...)
):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(400, "Unsupported file type")

    db: Session = SessionLocal()

    stored_name = str(uuid4())
    file_path = STORAGE_PATH / stored_name
    file_bytes = await file.read()
    aes_key, iv = generate_aes_key_iv()
    encrypted_bytes = encrypt_bytes(file_bytes, aes_key, iv)

    with open(file_path, "wb") as f:
        f.write(encrypted_bytes)

    doc = Document(
        original_filename=file.filename,
        stored_filename=stored_name,
        category=category,
        mime_type=file.content_type
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    return {"document_id": doc.id, "message": "Uploaded successfully"}

# -------------------------
# LIST DOCUMENTS BY CATEGORY
# -------------------------
@app.get("/documents", response_model=list[DocumentResponse])
def list_documents(category: str):
    db: Session = SessionLocal()
    docs = db.query(Document).filter(Document.category == category).all()
    return docs

# -------------------------
# CREATE TEMP SHARE LINK
# -------------------------
@app.post("/share/create", response_model=ShareResponse)
def create_share_link(document_id: str, expiry_minutes: int = 10):
    db: Session = SessionLocal()

    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(404, "Document not found")

    token = generate_token()
    expires_at = datetime.utcnow() + timedelta(minutes=expiry_minutes)

    link = SharedLink(
        document_id=document_id,
        token=token,
        expires_at=expires_at
    )
    db.add(link)
    db.commit()

    return {"share_url": f"/share/{token}"}

# -------------------------
# QR CODE GENERATION
# -------------------------
@app.get("/share/{token}/qr")
def generate_qr(token: str):
    qr = qrcode.make(f"http://localhost:8000/share/{token}")
    buf = BytesIO()
    qr.save(buf)
    buf.seek(0)
    return StreamingResponse(buf, media_type="image/png")

# -------------------------
# SECURE STREAMING
# -------------------------
@app.get("/share/{token}")
def access_shared_document(token: str):
    db: Session = SessionLocal()
    link = db.query(SharedLink).filter(
        SharedLink.token == token,
        SharedLink.is_active == True
    ).first()

    if not link or link.expires_at < datetime.utcnow():
        raise HTTPException(410, "Link expired or invalid")

    doc = db.query(Document).filter(Document.id == link.document_id).first()
    file_path = STORAGE_PATH / doc.stored_filename

    def file_iterator():
        with open(file_path, "rb") as f:
            yield from f

    return StreamingResponse(
        file_iterator(),
        media_type=doc.mime_type,
        headers={
            "Content-Disposition": "inline",
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff"
        }
    )
