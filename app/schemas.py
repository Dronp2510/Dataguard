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

    class Config:
        orm_mode = True