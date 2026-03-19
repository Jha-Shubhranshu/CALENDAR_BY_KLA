from pydantic import BaseModel, EmailStr, Field, field_validator
from pydantic import ConfigDict
from uuid import UUID
from datetime import datetime
from typing import Any, Dict, List, Optional, Union


from Cal_Backend.db.models import NotebookSource
from Cal_Backend.db.models import ContentType,MessageRole



class NoteCreate(BaseModel):
    """Schema for creating a note"""
    # conversation_id: Optional[UUID] = None
    project_id: Optional[UUID] = None
    title: Optional[str] = ""
    content: Optional[str] = ""
    # content_type: ContentType = ContentType.TEXT
    # role: MessageRole = MessageRole.NOTE
    # timestamp: Optional[datetime] = None
    # parent_message_id: Optional[UUID] = None
    background_color: Optional[str] = '#ffffff'
    # metadata: Dict[str, Any] = Field(default_factory=dict)
    is_pinned: Optional[bool] = None
    is_archived: Optional[bool] = False
    is_categorized: Optional[bool] = False
    labels: Optional[List[Union[UUID, dict]]] = None  # ✅ Accept both UUID and dict

    # label_ids: Optional[List[UUID]] = None




class NoteUpdate(BaseModel):
    """Schema for updating a note"""
    content: Optional[str] = ""
    title: Optional[str] = ""
    background_color: Optional[str] = "#ffffff"
    is_pinned: Optional[bool] = None
    is_archived: Optional[bool] = None
    project_id: Optional[UUID] = None
    is_categorized: Optional[bool] = None
    labels: Optional[List[Union[UUID, dict]]] = None  # ✅ Accept both UUID and dict
    
    @field_validator('labels', mode='before')
    @classmethod
    def extract_label_ids(cls, v):
        """Extract UUIDs from label objects if full objects are sent"""
        if v is None:
            return v
        
        result = []
        for item in v:
            if isinstance(item, dict):
                # If it's a dict, extract the 'id'
                result.append(item.get('id'))
            elif isinstance(item, str):
                # If it's a string UUID, convert to UUID
                result.append(UUID(item))
            elif hasattr(item, 'id'):
                # If it's a Pydantic model with 'id' attribute
                result.append(item.id)
            else:
                # Assume it's already a UUID
                result.append(item)
        
        return result

class NoteResponse(BaseModel):
    """Schema for note data in responses"""
    id: UUID
    user_id: UUID
    conversation_id: Optional[UUID]
    project_id: Optional[UUID]
    content: Optional[str]
    title: Optional[str]
    labels: List["LabelResponse"] = []
    content_type: ContentType
    role: MessageRole
    timestamp: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    is_pinned: bool
    is_archived: bool
    is_categorized: bool
    background_color: Optional[str]
    parent_message_id: Optional[UUID]
    metadata: Dict[str, Any] = Field(default_factory=dict)
    
    class Config:
        from_attributes = True


class NoteWithRelations(NoteResponse):
    """Schema for note with labels and media"""
    labels: List["LabelResponse"] = []
    media: List["MediaResponse"] = []
    checklist_items: List["ChecklistItemResponse"] = []
    
    class Config:
        from_attributes = True


class NoteListResponse(BaseModel):
    """Schema for paginated note list"""
    notes: List[NoteResponse]
    total: int
    # page: int
    # page_size: int


class NotePinToggle(BaseModel):
    """Schema for toggling note pin status"""
    is_pinned: bool


class NoteArchiveToggle(BaseModel):
    """Schema for toggling note archive status"""
    is_archived: bool


class ChecklistItemCreate(BaseModel):
    """Schema for creating a checklist item"""
    text: str = Field(..., min_length=1, max_length=500)
    position_index: int = 0


class ChecklistItemUpdate(BaseModel):
    """Schema for updating a checklist item"""
    text: Optional[str] = Field(None, min_length=1, max_length=500)
    is_checked: Optional[bool] = None
    position_index: Optional[int] = None


class ChecklistItemResponse(BaseModel):
    """Schema for checklist item data in responses"""
    id: UUID
    note_id: UUID
    text: str
    is_checked: bool
    position_index: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class ChecklistToggle(BaseModel):
    """Schema for toggling checklist item"""
    is_checked: bool
    
    
    
class SearchQuery(BaseModel):
    """Schema for search query"""
    query: str = Field(..., min_length=1)
    sources: Optional[List[NotebookSource]] = None
    content_types: Optional[List[ContentType]] = None
    date_from: Optional[str] = Field(None, pattern=r'^\d{4}-\d{2}-\d{2}$')
    date_to: Optional[str] = Field(None, pattern=r'^\d{4}-\d{2}-\d{2}$')
    project_id: Optional[UUID] = None
    label_ids: Optional[List[UUID]] = None
    include_archived: bool = False
    # page: int = Field(default=1, ge=1)
    # page_size: int = Field(default=20, ge=1, le=100)


class SearchResponse(BaseModel):
    """Schema for search results"""
    notes: List[NoteWithRelations]
    total: int
    # page: int
    # page_size: int
    query: str

class NoteFilterParams(BaseModel):
    """Schema for note filtering parameters"""
    conversation_id: Optional[UUID] = None
    project_id: Optional[UUID] = None
    label_ids: Optional[List[UUID]] = None
    sources: Optional[List[NotebookSource]] = None
    content_types: Optional[List[ContentType]] = None
    roles: Optional[List[MessageRole]] = None
    is_pinned: Optional[bool] = None
    is_archived: Optional[bool] = None
    is_categorized: Optional[bool] = None
    date_from: Optional[str] = Field(None, pattern=r'^\d{4}-\d{2}-\d{2}$')
    date_to: Optional[str] = Field(None, pattern=r'^\d{4}-\d{2}-\d{2}$')


class ConversationFilterParams(BaseModel):
    """Schema for conversation filtering parameters"""
    sources: Optional[List[NotebookSource]] = None
    date_from: Optional[str] = Field(None, pattern=r'^\d{4}-\d{2}-\d{2}$')
    date_to: Optional[str] = Field(None, pattern=r'^\d{4}-\d{2}-\d{2}$')





# Move imports to end
from Cal_Backend.Label.schemas import LabelResponse
from Cal_Backend.media.schemas import MediaResponse
# Add if ChecklistItemResponse is elsewhere
from Cal_Backend.Note.schemas import ChecklistItemResponse





# Update forward references
NoteWithRelations.model_rebuild()
