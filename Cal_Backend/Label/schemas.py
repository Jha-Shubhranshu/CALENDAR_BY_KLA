from pydantic import BaseModel, EmailStr, Field
from pydantic import ConfigDict
from uuid import UUID as UUID
from datetime import datetime
from typing import Any, Dict, List, Optional
from Cal_Backend.Note.schemas import NoteResponse



class LabelCreate(BaseModel):
    """Schema for creating a label"""
    name: str = Field(..., min_length=1, max_length=100)
    color: Optional[str] = Field(None, pattern=r'^#[0-9A-Fa-f]{6}$')


class LabelUpdate(BaseModel):
    """Schema for updating a label"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    color: Optional[str] = Field(None, pattern=r'^#[0-9A-Fa-f]{6}$')


class LabelResponse(BaseModel):
    """Schema for label data in responses"""
    id: UUID
    user_id: UUID
    name: str
    color: Optional[str]
    created_at: datetime
    updated_at: datetime
    note_count: Optional[int] = None
    
    class Config:
        from_attributes = True


class LabelWithNotes(LabelResponse):
    """Schema for label with its notes"""
    notes: List[NoteResponse] = []
    
    class Config:
        from_attributes = True


class LabelListResponse(BaseModel):
    """Schema for label list"""
    labels: List[LabelResponse]
    total: int


class AddLabelToNote(BaseModel):
    """Schema for adding a label to note"""
    label_id: UUID


class RemoveLabelFromNote(BaseModel):
    """Schema for removing a label from note"""
    label_id: UUID



LabelWithNotes.model_rebuild()
