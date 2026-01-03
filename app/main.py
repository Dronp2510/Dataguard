from anyio.streams import file
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from uuid import uuid4
from cryptography.hazmat.primitives.asymmetric import rsa
# from fastapi import Depends
# from io import BytesIO

import io
import qrcode
import  secrets
from pathlib import Path

from .database import Base, engine, SessionLocal
from .models import Document, SharedLink
from .schemas import DocumentResponse, ShareResponse
from .utils import generate_token, STORAGE_PATH
from crypto_utils import  generate_aes_key_iv , encrypt_bytes , decrypt_bytes , encrypt_aes_key , decrypt_aes_key

Base.metadata.create_all(bind=engine)

app = FastAPI(title="DataGuard MVP")

# GLOBAL VARIABLES.
ALLOWED_TYPES = ["image/jpeg", "image/png", "application/pdf"]
IN_MEMORY_KEYS = {}
SERVER_PRIVATE_KEY = rsa.generate_private_key(
    public_exponent=65537,
    key_size=2048
)
SERVER_PUBLIC_KEY = SERVER_PRIVATE_KEY.public_key()



# -------------------------
# DOCUMENT UPLOAD
# -------------------------
@app.post("/documents/upload")
async def upload_document(
    file: UploadFile = File(...),
    category: str = Form(...)
):
    db: Session = SessionLocal()
    try:
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

        IN_MEMORY_KEYS[doc.id] = {
            "aes_key": aes_key,
            "iv": iv
        }

        return {"document_id": doc.id, "message": "Uploaded successfully"}
    finally:
        db.close()

# -------------------------
# LIST DOCUMENTS BY CATEGORY
# -------------------------
@app.get("/documents", response_model=list[DocumentResponse])
def list_documents(category: str):
    db: Session = SessionLocal()
    try:
        docs = db.query(Document).filter(Document.category == category).all()
        return docs
    finally:
        db.close()

@app.post("/share/{document_id}")
def share_document(document_id: str):
    db: Session = SessionLocal()
    try:

        document = db.query(Document).filter(Document.id == document_id).first()
        if not document:
            raise HTTPException(404)

        if document_id not in IN_MEMORY_KEYS:
            raise HTTPException(400, "Encryption key not found")

        aes_key = IN_MEMORY_KEYS[document_id]["aes_key"]
        iv = IN_MEMORY_KEYS[document_id]["iv"]

        token = secrets.token_urlsafe(32)

        encrypted_key = encrypt_aes_key(aes_key, SERVER_PUBLIC_KEY)

        link = SharedLink(
            document_id=document.id,
            token=token,
            encrypted_aes_key=encrypted_key,
            iv=iv,
            expires_at=datetime.utcnow() + timedelta(minutes=15)
        )

        db.add(link)
        db.commit()

        return {
            "share_url": f"http://127.0.0.1:8000/access/{token}"
        }
    finally:
        db.close()

@app.get("/access/{token}")
def access_document(token: str):  #, db: Session = Depends(get_db)
    db: Session = SessionLocal()
    try:
        link = db.query(SharedLink).filter_by(token=token, is_active=True).first()

        if not link or link.expires_at < datetime.utcnow():
            raise HTTPException(403, "Invalid or expired link")

        document = db.query(Document).get(link.document_id)

        file_path = STORAGE_PATH / document.stored_filename
        encrypted_file = file_path.read_bytes()

        aes_key = decrypt_aes_key(
            link.encrypted_aes_key,
            SERVER_PRIVATE_KEY
        )

        plaintext = decrypt_bytes(encrypted_file, aes_key, link.iv)

        return StreamingResponse(
            io.BytesIO(plaintext),
            media_type="application/octet-stream",
            headers={
                "Content-Disposition": f"attachment; filename={document.original_filename}"
            }
        )
    finally:
        db.close()
