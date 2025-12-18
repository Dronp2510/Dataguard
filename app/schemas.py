from pydantic import BaseModel
from datetime import datetime

class DocumentResponse(BaseModel):
    id: str
    original_filename: str
    category: str
    created_at: datetime

class ShareResponse(BaseModel):
    share_url: str
