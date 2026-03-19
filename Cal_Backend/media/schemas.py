from pydantic import BaseModel, EmailStr, Field
from pydantic import ConfigDict
from uuid import UUID as UUID
from datetime import datetime
from typing import Any, Dict, List, Optional

from Cal_Backend.db.models import MediaType

class MediaCreate(BaseModel):
    """Schema for creating media (internal use)"""
    note_id: UUID
    file_type: MediaType
    position_index: int = 0


class MediaResponse(BaseModel):
    """Schema for media data in responses"""
    id: UUID
    note_id: UUID
    user_id: UUID
    file_path: str
    file_type: MediaType
    file_size: int
    mime_type: str
    original_filename: str
    position_index: int
    created_at: datetime
    
    class Config:
        from_attributes = True


class MediaUploadResponse(BaseModel):
    """Schema for media upload response"""
    media_id: UUID
    file_path: str
    file_url: str
    file_size: int
    mime_type: str
