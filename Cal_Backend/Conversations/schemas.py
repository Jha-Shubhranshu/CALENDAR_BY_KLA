# from pydantic import BaseModel, EmailStr, Field
# from pydantic import ConfigDict
# from uuid import UUID
# from datetime import datetime
# from typing import Any, Dict, List, Optional
# from Cal_Backend.db.models import NotebookSource

# from Cal_Backend.Note.schemas import NoteResponse

# # class ConversationResponse(BaseModel):
    
    
# class ConversationCreate(BaseModel):
#     """Schema for creating a conversation"""
#     title: str = Field(..., min_length=1, max_length=500)
#     source: NotebookSource
#     original_conversation_id: Optional[str] = None
#     metadata: Dict[str, Any] = Field(default_factory=dict)


# class ConversationUpdate(BaseModel):
#     """Schema for updating a conversation"""
#     title: Optional[str] = Field(None, min_length=1, max_length=500)


# class ConversationResponse(BaseModel):
#     """Schema for conversation data in responses"""
#     id: UUID
#     user_id: UUID
#     title: str
#     source: NotebookSource
#     original_conversation_id: Optional[str]
#     import_date: datetime
#     original_filename: Optional[str]
#     metadata: Dict[str, Any]
#     created_at: datetime
#     updated_at: datetime
#     note_count: Optional[int] = None
    
#     class Config:
#         from_attributes = True


# class ConversationListResponse(BaseModel):
#     """Schema for paginated conversation list"""
#     conversations: List[ConversationResponse]
#     total: int
#     page: int
#     page_size: int


# class ConversationWithNotes(ConversationResponse):
#     """Schema for conversation with its notes"""
#     notes: List["NoteResponse"] = []
    
#     class Config:
#         from_attributes = True

# ConversationWithNotes.model_rebuild()



from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from typing import Optional, List, Dict, Any
from Cal_Backend.db.models import NotebookSource, MessageRole

class ConversationCreate(BaseModel):
    title: str
    source: NotebookSource
    account: Optional[str] = None
    original_conversation_id: Optional[str] = None
    original_filename: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = {}
    account: str

class MessageResponse(BaseModel):
    id: UUID
    conversation_id: Optional[UUID]
    project_id: Optional[UUID]
    content: str
    role: MessageRole
    timestamp: datetime
    created_at: datetime
    background_color: Optional[str]
    metadata: Dict[str, Any]
    title: Optional[str] = None
    conversation_title: Optional[str] = None
    original_source: Optional[str] = None

class ConversationResponse(BaseModel):
    id: UUID
    user_id: UUID
    title: str
    source: NotebookSource
    account: Optional[str] = None
    original_conversation_id: Optional[str]
    import_date: datetime
    original_filename: Optional[str]
    metadata: Dict[str, Any]
    created_at: datetime
    updated_at: datetime
    messages: List[MessageResponse]

class ConversationListItem(BaseModel):
    id: UUID
    user_id: UUID
    title: str
    source: NotebookSource
    account: Optional[str]
    original_conversation_id: Optional[str]
    import_date: datetime
    original_filename: Optional[str]
    metadata: Dict[str, Any]
    created_at: datetime
    updated_at: datetime

class ConversationListResponse(BaseModel):
    conversations: List[ConversationListItem]
    total: int
    skip: int
    limit: int