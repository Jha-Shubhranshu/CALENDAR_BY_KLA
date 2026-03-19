# from pydantic import BaseModel, EmailStr, Field
# from pydantic import ConfigDict
# from uuid import UUID as UUID
# from datetime import datetime
# from typing import Any, Dict, List, Optional


# from Cal_Backend.Note.schemas import NoteResponse






# class ProjectCreate(BaseModel):
#     """Schema for creating a project"""
#     title: str = Field(..., min_length=1, max_length=200)
#     description: Optional[str] = Field(None, max_length=1000)
#     color: str = Field(default="#3B82F6", pattern=r'^#[0-9A-Fa-f]{6}$')


# class ProjectUpdate(BaseModel):
#     """Schema for updating a project"""
#     title: Optional[str] = Field(None, min_length=1, max_length=200)
#     description: Optional[str] = Field(None, max_length=1000)
#     color: Optional[str] = Field(None, pattern=r'^#[0-9A-Fa-f]{6}$')


# class ProjectResponse(BaseModel):
#     """Schema for project data in responses"""
#     id: UUID
#     user_id: UUID
#     title: str
#     description: Optional[str]
#     color: str
#     created_at: datetime
#     updated_at: datetime
#     note_count: Optional[int] = None
    
#     class Config:
#         from_attributes = True


# class ProjectWithNotes(ProjectResponse):
#     """Schema for project with its notes"""
#     notes: List[NoteResponse] = []
    
#     class Config:
#         from_attributes = True


# class ProjectListResponse(BaseModel):
#     """Schema for paginated project list"""
#     projects: List[ProjectResponse]
#     total: int


# class AddNoteToProject(BaseModel):
#     """Schema for adding a note to project"""
#     note_id: UUID


# class RemoveNoteFromProject(BaseModel):
#     """Schema for removing a note from project"""
#     note_id: UUID



# ProjectWithNotes.model_rebuild()





from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from typing import Optional, List
from Cal_Backend.Conversations.schemas import MessageResponse

class ProjectCreate(BaseModel):
    title: str
    description: Optional[str] = None
    color: Optional[str] = "#3B82F6"

class ProjectUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None

class ProjectResponse(BaseModel):
    id: UUID
    user_id: UUID
    title: str
    description: Optional[str]
    color: str
    created_at: datetime
    updated_at: datetime
    message_count: int

class ProjectWithMessagesResponse(BaseModel):
    id: UUID
    user_id: UUID
    title: str
    description: Optional[str]
    color: str
    created_at: datetime
    updated_at: datetime
    messages: List[MessageResponse]

class ProjectListResponse(BaseModel):
    projects: List[ProjectResponse]
    total: int
    skip: int
    limit: int