from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from uuid import uuid4
from pathlib import Path
from .models import VaultItem, VaultItemType, Folder, File as VaultFile, EncryptedKey, User
from .database import Base, engine, SessionLocal
from .utils import generate_token, STORAGE_PATH
from .schemas import VaultItemResponse
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import joinedload
from werkzeug.security import generate_password_hash, check_password_hash
import os
import base64

Base.metadata.create_all(bind=engine)

app = FastAPI(title="DataGuard MVP")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # frontend dev server
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
    user_id: str = Form(...)
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
            owner_id=user_id
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
            user_id=user_id,
            encrypted_key=encrypted_key,
            iv=key_iv
        )
        db.add(key)

        db.commit()
        return {"file_id": vault_item.id}
    finally:
        db.close()



@app.post("/vault/folders")
def create_folder(name: str = Form(...), parent_id: str | None = Form(None), user_id: str = Form(...)):
    db = SessionLocal()
    try:
        vault_item = VaultItem(
            type=VaultItemType.folder,
            parent_id=parent_id,
            owner_id=user_id
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
        file = db.query(VaultFile).get(file_id)
        key = db.query(EncryptedKey).filter_by(vault_item_id=file_id).first()

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
def download_encrypted_blob(file_id: str):
    db = SessionLocal()
    try:
        file = db.query(VaultFile).get(file_id)
        if not file:
            raise HTTPException(404)

        return FileResponse(
            path=file.storage_path,
            media_type=file.filename,
            filename=file.filename,
            headers={
                "Content-Disposition": f'inline; filename="{file.filename}"'
            }
        )
    finally:
        db.close()

@app.get("/vault/items", response_model=list[VaultItemResponse])
def list_vault_items(parent_id: str | None = None, user_id: str | None = None):
    db = SessionLocal()
    try:
        query = db.query(VaultItem).filter(
                VaultItem.owner_id == user_id
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

        return {
            "message": "Login success",
            "user_id": user.id,
            "salt": user.salt
        }
    finally:
        db.close()
