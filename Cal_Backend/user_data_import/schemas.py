from pydantic import BaseModel, EmailStr, Field
from pydantic import ConfigDict
from uuid import UUID as UUID
from datetime import datetime
from typing import Any, Dict, List, Optional



class ImportMessageSchema(BaseModel):
    """Schema for a message in import data"""
    id: str
    role: str
    content: str
    content_type: str = "text"
    timestamp: str
    metadata: Dict[str, Any] = Field(default_factory=dict)
    parent_id: Optional[str] = None


class ImportConversationSchema(BaseModel):
    """Schema for a conversation in import data"""
    id: str
    title: str
    source: str
    account: Optional[str]
    created_at: str
    updated_at: str
    messages: List[ImportMessageSchema]


class ImportRequest(BaseModel):
    """Schema for import request"""
    conversations: List[ImportConversationSchema]


class ImportStatistics(BaseModel):
    """Schema for import statistics"""
    conversations_created: int
    conversations_updated: int
    notes_created: int
    errors: List[Dict[str, Any]] = []


class ExtensionMessageSchema(BaseModel):
    """Schema for a message sent from the browser extension"""
    role: str
    content: str
    timestamp: Optional[datetime] = None
    images: Optional[List[Dict[str, Any]]] = Field(default_factory=list) # Support for base64 images
    metadata: Dict[str, Any] = Field(default_factory=dict)


class ExtensionConversationSchema(BaseModel):
    """Schema for the nested conversation object in extension payload"""
    conversation_id: Optional[str] = None
    title: str
    url: Optional[str] = None
    message_count: int
    messages: List[ExtensionMessageSchema]


class ExtensionIngestSchema(BaseModel):
    """Schema for conversation data sent from the browser extension"""
    source: str
    scraped_at: datetime
    account_email: str
    conversation: ExtensionConversationSchema
    metadata: Dict[str, Any] = Field(default_factory=dict)


class ImportResponse(BaseModel):
    """Schema for import response"""
    success: bool
    statistics: ImportStatistics
    message: str
