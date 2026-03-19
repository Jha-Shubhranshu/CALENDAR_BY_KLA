from pydantic import BaseModel, EmailStr, Field
from pydantic import ConfigDict
from uuid import UUID as UUID
from datetime import datetime
from typing import Any, Dict, List, Optional

class GoogleKeepAttachment(BaseModel):
    """Single attachment from Google Keep"""
    filePath: str
    mimetype: str

class GoogleKeepLabel(BaseModel):
    """Label from Google Keep"""
    name: str

class GoogleKeepListItem(BaseModel):
    """Checklist item from Google Keep"""
    text: str
    isChecked: bool
    textHtml: Optional[str] = None

class GoogleKeepNote(BaseModel):
    """
    Google Keep note structure.
    This matches the incoming JSON exactly.
    """
    color: str = "DEFAULT"
    isTrashed: bool = False
    isPinned: bool = False
    isArchived: bool = False
    
    # Content - one of these will be present
    textContent: Optional[str] = None
    listContent: Optional[List[GoogleKeepListItem]] = None
    
    title: Optional[str] = None
    
    # Timestamps in microseconds
    userEditedTimestampUsec: int
    createdTimestampUsec: int
    
    # Optional fields
    attachments: Optional[List[GoogleKeepAttachment]] = None
    labels: Optional[List[GoogleKeepLabel]] = None
    annotations: Optional[List[Dict[str, Any]]] = None
    textContentHtml: Optional[str] = None  # We ignore this but it's in the data

class GoogleKeepImportRequest(BaseModel):
    """Request body for importing Google Keep notes"""
    notes: List[GoogleKeepNote]

class ImportStatistics(BaseModel):
    """Statistics returned after import"""
    notes_created: int = 0
    notes_skipped: int = 0
    labels_created: int = 0
    labels_linked: int = 0
    media_created: int = 0
    checklist_items_created: int = 0
    errors: List[str] = []
