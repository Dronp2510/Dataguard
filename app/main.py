from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from uuid import uuid4
from pathlib import Path
from .models import VaultItem, VaultItemType, Folder, File, EncryptedKey
from .database import Base, engine, SessionLocal
from .utils import generate_token, STORAGE_PATH
from fastapi.responses import FileResponse

Base.metadata.create_all(bind=engine)

app = FastAPI(title="DataGuard MVP")

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
    iv: str = Form(...)
):
    db = SessionLocal()
    try:
        stored_name = str(uuid4())
        file_path = STORAGE_PATH / stored_name

        with open(file_path, "wb") as f:
            f.write(await encrypted_file.read())

        vault_item = VaultItem(
            type=VaultItemType.file,
            parent_id=parent_folder_id,
            owner_id="demo-user"
        )
        db.add(vault_item)
        db.flush()

        file = File(
            id=vault_item.id,
            filename=filename,
            mime_type=mime_type,
            storage_path=str(file_path),
            iv=iv
        )
        db.add(file)

        key = EncryptedKey(
            vault_item_id=vault_item.id,
            user_id="demo-user",
            encrypted_key=encrypted_key
        )
        db.add(key)

        db.commit()
        return {"file_id": vault_item.id}
    finally:
        db.close()



@app.post("/vault/folders")
def create_folder(name: str = Form(...), parent_id: str | None = Form(None)):
    db = SessionLocal()
    try:
        vault_item = VaultItem(
            type=VaultItemType.folder,
            parent_id=parent_id,
            owner_id="demo-user"
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
def download_encrypted_file(file_id: str):
    db = SessionLocal()
    try:
        file = db.query(File).get(file_id)
        key = db.query(EncryptedKey).filter_by(vault_item_id=file_id).first()

        if not file or not key:
            raise HTTPException(404)

        return {
            "metadata": {
                "filename": file.filename,
                "mime_type": file.mime_type,
                "iv": file.iv,
                "encrypted_key": key.encrypted_key,
            },
            "download_url": f"/vault/files/{file_id}/blob"
        }
    finally:
        db.close()

@app.get("/vault/files/{file_id}/blob")
def download_encrypted_blob(file_id: str):
    db = SessionLocal()
    try:
        file = db.query(File).get(file_id)
        if not file:
            raise HTTPException(404)

        return FileResponse(
            path=file.storage_path,
            media_type="application/octet-stream",
            filename=file.filename
        )
    finally:
        db.close()

@app.get("/vault/items")
def list_vault_items(parent_id: str | None = None):
    db = SessionLocal()
    try:
        return db.query(VaultItem).filter(
            VaultItem.parent_id == parent_id
        ).all()
    finally:
        db.close()