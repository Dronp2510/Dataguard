# -------------------------
# CREATE TEMP SHARE LINK
# -------------------------
# @app.post("/share/create", response_model=ShareResponse)
# def create_share_link(document_id: str, expiry_minutes: int = 10):
#     db: Session = SessionLocal()
#
#     doc = db.query(Document).filter(Document.id == document_id).first()
#     if not doc:
#         raise HTTPException(404, "Document not found")
#
#     token = generate_token()
#     expires_at = datetime.utcnow() + timedelta(minutes=expiry_minutes)
#
#     link = SharedLink(
#         document_id=document_id,
#         token=token,
#         expires_at=expires_at
#     )
#     db.add(link)
#     db.commit()
#
#     return {"share_url": f"/share/{token}"}

# -------------------------
# QR CODE GENERATION
# -------------------------
# @app.get("/share/{token}/qr")
# def generate_qr(token: str):
#     qr = qrcode.make(f"http://localhost:8000/share/{token}")
#     buf = BytesIO()
#     qr.save(buf)
#     buf.seek(0)
#     return StreamingResponse(buf, media_type="image/png")

# -------------------------
# SECURE STREAMING
# -------------------------
# @app.get("/share/{token}")
# def access_shared_document(token: str):
#     db: Session = SessionLocal()
#     link = db.query(SharedLink).filter(
#         SharedLink.token == token,
#         SharedLink.is_active == True
#     ).first()
#
#     if not link or link.expires_at < datetime.utcnow():
#         raise HTTPException(410, "Link expired or invalid")
#
#     doc = db.query(Document).filter(Document.id == link.document_id).first()
#     file_path = STORAGE_PATH / doc.stored_filename
#
#     def file_iterator():
#         with open(file_path, "rb") as f:
#             yield from f
#
#     return StreamingResponse(
#         file_iterator(),
#         media_type=doc.mime_type,
#         headers={
#             "Content-Disposition": "inline",
#             "Cache-Control": "no-store",
#             "X-Content-Type-Options": "nosniff"
#         }
#     )

# encrypted_file = open(document.storage_path, "rb").read()
