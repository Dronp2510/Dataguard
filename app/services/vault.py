import os

from fastapi import HTTPException

from ..models import EncryptedKey, File as VaultFile, Folder, VaultItem, VaultItemType


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
