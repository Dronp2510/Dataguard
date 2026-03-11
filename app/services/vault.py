import os

from fastapi import HTTPException

from ..models import EncryptedKey, File as VaultFile, Folder, VaultItem, VaultItemType
from ..utils import MAX_UPLOAD_BYTES, MAX_USER_STORAGE_BYTES


def ensure_item_owner(db, item_id: str, user_id: str) -> VaultItem:
    item = db.query(VaultItem).filter(VaultItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    if item.owner_id != user_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    return item


def delete_vault_item_tree(db, item_id: str, owner_id: str) -> None:
    item = ensure_item_owner(db, item_id, owner_id)

    if item.type == VaultItemType.folder:
        children = db.query(VaultItem).filter(VaultItem.parent_id == item.id).all()
        for child in children:
            delete_vault_item_tree(db, child.id, owner_id)
        db.query(Folder).filter(Folder.id == item.id).delete()
    else:
        file_row = db.query(VaultFile).filter(VaultFile.id == item.id).first()
        if file_row:
            try:
                os.remove(file_row.storage_path)
            except FileNotFoundError:
                pass
        db.query(VaultFile).filter(VaultFile.id == item.id).delete()
        db.query(EncryptedKey).filter(EncryptedKey.vault_item_id == item.id).delete()

    db.query(VaultItem).filter(VaultItem.id == item.id).delete()


def stored_bytes_for_file(file_row: VaultFile | None) -> int:
    if not file_row:
        return 0
    if file_row.stored_size is not None and file_row.stored_size >= 0:
        return int(file_row.stored_size)
    if bool(file_row.is_compressed) and file_row.compressed_size is not None and file_row.compressed_size >= 0:
        return int(file_row.compressed_size)
    if file_row.original_size is not None and file_row.original_size >= 0:
        return int(file_row.original_size)
    try:
        return os.path.getsize(file_row.storage_path)
    except OSError:
        return 0


def get_user_storage_usage_bytes(db, user_id: str) -> int:
    file_rows = (
        db.query(VaultFile)
        .join(VaultItem, VaultItem.id == VaultFile.id)
        .filter(VaultItem.owner_id == user_id)
        .all()
    )
    return sum(stored_bytes_for_file(file_row) for file_row in file_rows)


def get_storage_summary(db, user_id: str) -> dict[str, int]:
    used = get_user_storage_usage_bytes(db, user_id)
    remaining = max(0, MAX_USER_STORAGE_BYTES - used)
    return {
        "used_storage_bytes": used,
        "storage_quota_bytes": MAX_USER_STORAGE_BYTES,
        "remaining_storage_bytes": remaining,
        "max_upload_bytes": MAX_UPLOAD_BYTES,
    }
