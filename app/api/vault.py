import os
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse

from ..core.rate_limit import client_identity, enforce_rate_limit
from ..database import SessionLocal
from ..models import EncryptedKey, File as VaultFile, Folder, User, VaultItem, VaultItemType
from ..schemas import VaultItemResponse
from ..services.auth import get_current_user
from ..services.vault import delete_vault_item_tree, ensure_item_owner
from ..utils import STORAGE_PATH

router = APIRouter()
MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_BYTES", str(25 * 1024 * 1024)))


@router.post("/vault/files")
async def upload_encrypted_file(
    request: Request,
    encrypted_file: UploadFile = File(...),
    filename: str = Form(...),
    mime_type: str = Form(...),
    parent_folder_id: str | None = Form(None),
    encrypted_key: str = Form(...),
    iv: str = Form(...),
    key_iv: str = Form(...),
    is_compressed: bool = Form(False),
    compression_algo: str | None = Form(None),
    original_filename: str | None = Form(None),
    original_size: int | None = Form(None),
    compressed_size: int | None = Form(None),
    current_user: User = Depends(get_current_user),
):
    db = SessionLocal()
    try:
        enforce_rate_limit("upload", f"{current_user.id}:{client_identity(request)}", 20, 60)

        if parent_folder_id:
            parent = ensure_item_owner(db, parent_folder_id, current_user.id)
            if parent.type != VaultItemType.folder:
                raise HTTPException(status_code=400, detail="Parent must be a folder")

        if is_compressed and compression_algo not in {"gzip"}:
            raise HTTPException(status_code=400, detail="Unsupported compression algorithm")
        if original_size is not None and original_size < 0:
            raise HTTPException(status_code=400, detail="Invalid original_size")
        if compressed_size is not None and compressed_size < 0:
            raise HTTPException(status_code=400, detail="Invalid compressed_size")

        stored_name = str(uuid4())
        file_path = STORAGE_PATH / stored_name

        size_read = 0
        chunk_size = 1024 * 1024
        try:
            with open(file_path, "wb") as f:
                while True:
                    chunk = await encrypted_file.read(chunk_size)
                    if not chunk:
                        break
                    size_read += len(chunk)
                    if size_read > MAX_UPLOAD_BYTES:
                        raise HTTPException(status_code=413, detail="File exceeds upload size limit")
                    f.write(chunk)
        except HTTPException:
            if file_path.exists():
                file_path.unlink(missing_ok=True)
            raise

        vault_item = VaultItem(type=VaultItemType.file, parent_id=parent_folder_id, owner_id=current_user.id)
        db.add(vault_item)
        db.flush()

        file = VaultFile(
            id=vault_item.id,
            filename=filename,
            mime_type=mime_type,
            storage_path=str(file_path),
            iv=iv,
            is_compressed=is_compressed,
            compression_algo=compression_algo if is_compressed else None,
            original_filename=(original_filename or filename),
            original_size=original_size,
            compressed_size=compressed_size,
        )
        db.add(file)

        key = EncryptedKey(
            vault_item_id=vault_item.id,
            user_id=current_user.id,
            encrypted_key=encrypted_key,
            iv=key_iv,
        )
        db.add(key)

        db.commit()
        return {"file_id": vault_item.id}
    finally:
        db.close()


@router.post("/vault/folders")
def create_folder(
    name: str = Form(...),
    parent_id: str | None = Form(None),
    current_user: User = Depends(get_current_user),
):
    db = SessionLocal()
    try:
        if parent_id:
            parent = ensure_item_owner(db, parent_id, current_user.id)
            if parent.type != VaultItemType.folder:
                raise HTTPException(status_code=400, detail="Parent must be a folder")

        vault_item = VaultItem(type=VaultItemType.folder, parent_id=parent_id, owner_id=current_user.id)
        db.add(vault_item)
        db.flush()

        folder = Folder(id=vault_item.id, name=name)
        db.add(folder)
        db.commit()

        return {"id": vault_item.id, "name": name}
    finally:
        db.close()


@router.get("/vault/files/{file_id}/download")
def download_encrypted_file(file_id: str, current_user: User = Depends(get_current_user)):
    db = SessionLocal()
    try:
        item = ensure_item_owner(db, file_id, current_user.id)
        if item.type != VaultItemType.file:
            raise HTTPException(status_code=400, detail="Not a file")
        file = db.query(VaultFile).filter_by(id=file_id).first()
        key = db.query(EncryptedKey).filter_by(vault_item_id=file_id, user_id=current_user.id).first()

        if not file or not key:
            raise HTTPException(status_code=404, detail="File not found")

        return {
            "metadata": {
                "filename": file.filename,
                "mime_type": file.mime_type,
                "iv": file.iv,
                "encrypted_key": key.encrypted_key,
                "key_iv": key.iv,
                "is_compressed": bool(file.is_compressed),
                "compression_algo": file.compression_algo,
                "original_filename": file.original_filename or file.filename,
                "original_size": file.original_size,
                "compressed_size": file.compressed_size,
            },
            "download_url": f"/vault/files/{file_id}/blob",
        }
    finally:
        db.close()


@router.get("/vault/files/{file_id}/blob")
def download_encrypted_blob(file_id: str, current_user: User = Depends(get_current_user)):
    db = SessionLocal()
    try:
        item = ensure_item_owner(db, file_id, current_user.id)
        if item.type != VaultItemType.file:
            raise HTTPException(status_code=400, detail="Not a file")
        file = db.query(VaultFile).filter_by(id=file_id).first()
        if not file:
            raise HTTPException(status_code=404, detail="File not found")

        return FileResponse(
            path=file.storage_path,
            media_type=file.mime_type,
            filename=file.filename,
            headers={"Content-Disposition": f'inline; filename="{file.filename}"'},
        )
    finally:
        db.close()


@router.get("/vault/items", response_model=list[VaultItemResponse])
def list_vault_items(parent_id: str | None = None, current_user: User = Depends(get_current_user)):
    db = SessionLocal()
    try:
        if parent_id:
            parent = ensure_item_owner(db, parent_id, current_user.id)
            if parent.type != VaultItemType.folder:
                raise HTTPException(status_code=400, detail="Parent must be a folder")

        query = db.query(VaultItem).filter(VaultItem.owner_id == current_user.id)

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
            else:
                file = db.query(VaultFile).filter_by(id=item.id).first()
                name = file.filename if file else "Unnamed File"

            result.append(
                {
                    "id": item.id,
                    "type": item.type.value,
                    "name": name,
                    "created_at": item.created_at,
                    "parent_id": item.parent_id,
                }
            )

        return result
    finally:
        db.close()


@router.get("/vault/recent", response_model=list[VaultItemResponse])
def recent_items(limit: int = 3, current_user: User = Depends(get_current_user)):
    db = SessionLocal()
    try:
        safe_limit = max(1, min(limit, 50))
        items = (
            db.query(VaultItem)
            .filter(VaultItem.owner_id == current_user.id)
            .order_by(VaultItem.created_at.desc())
            .limit(safe_limit)
            .all()
        )
        result = []
        for item in items:
            if item.type.value == "folder":
                folder = db.query(Folder).filter_by(id=item.id).first()
                name = folder.name if folder else "Unnamed Folder"
            else:
                file = db.query(VaultFile).filter_by(id=item.id).first()
                name = file.filename if file else "Unnamed File"
            result.append(
                {
                    "id": item.id,
                    "type": item.type.value,
                    "name": name,
                    "created_at": item.created_at,
                    "parent_id": item.parent_id,
                }
            )
        return result
    finally:
        db.close()


@router.put("/vault/items/{item_id}/rename")
def rename_item(
    item_id: str,
    new_name: str = Form(...),
    current_user: User = Depends(get_current_user),
):
    db = SessionLocal()
    try:
        item = ensure_item_owner(db, item_id, current_user.id)
        clean_name = new_name.strip()
        if not clean_name:
            raise HTTPException(status_code=400, detail="Name cannot be empty")

        if item.type == VaultItemType.folder:
            row = db.query(Folder).filter(Folder.id == item_id).first()
            if not row:
                raise HTTPException(status_code=404, detail="Folder not found")
            row.name = clean_name
        else:
            row = db.query(VaultFile).filter(VaultFile.id == item_id).first()
            if not row:
                raise HTTPException(status_code=404, detail="File not found")
            row.filename = clean_name

        db.commit()
        return {"message": "Renamed successfully"}
    finally:
        db.close()


@router.delete("/vault/items/{item_id}")
def delete_item(item_id: str, current_user: User = Depends(get_current_user)):
    db = SessionLocal()
    try:
        delete_vault_item_tree(db, item_id, current_user.id)
        db.commit()
        return {"message": "Deleted successfully"}
    finally:
        db.close()
