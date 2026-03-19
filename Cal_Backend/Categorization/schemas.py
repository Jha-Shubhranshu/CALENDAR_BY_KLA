from pydantic import BaseModel, EmailStr, Field
from pydantic import ConfigDict
from uuid import UUID
from datetime import datetime
from typing import Any, Dict, List, Optional
from Cal_Backend.Note.schemas import NoteWithRelations




class NoteCategorization(BaseModel):
    """Schema for categorizing a single note"""
    note_id: UUID
    project_id: Optional[UUID] = None
    label_ids: List[UUID] = Field(default_factory=list)


class BatchCategorizeRequest(BaseModel):
    """Schema for batch categorization"""
    categorizations: List[NoteCategorization]


class BatchCategorizeResponse(BaseModel):
    """Schema for batch categorization response"""
    success: bool
    categorized_count: int
    errors: List[Dict[str, Any]] = []


class UncategorizedNotesResponse(BaseModel):
    """Schema for uncategorized notes (reel view)"""
    notes: List[NoteWithRelations]
    total: int
    page: int
    page_size: int
