from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class DocumentResponse(BaseModel):
    id: str
    original_filename: str
    category: str
    created_at: datetime

class ShareResponse(BaseModel):
    share_url: str

class VaultItemResponse(BaseModel):
    id: str
    type: str
    name: str
    created_at: datetime
    parent_id: Optional[str]

    model_config = {
        "from_attributes": True
    }


class PasswordWrappedKeyUpdate(BaseModel):
    vault_item_id: str
    encrypted_key: str
    key_iv: str


class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str
    new_salt: str
    wrapped_keys: list[PasswordWrappedKeyUpdate]
