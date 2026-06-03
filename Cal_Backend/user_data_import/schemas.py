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



class ClaudeContentBlock(BaseModel):
    """One content block inside a Claude chat message."""
    type: str
    text: Optional[str] = None
    start_timestamp: Optional[str] = None
    stop_timestamp: Optional[str] = None
    flags: Optional[Any] = None
    citations: List[Any] = Field(default_factory=list)
    
    model_config = {"extra": "allow"}


class ClaudeExtensionImageData(BaseModel):
    """Image bytes the extension fetched on the browser side before posting."""
    data: str           # base64 data URL: "data:image/png;base64,..."
    fetched_at: Optional[str] = None
    
    model_config = {"extra": "allow"}


class ClaudeAttachment(BaseModel):
    """An attachment/file reference. The extension may enrich with base64 bytes."""
    file_name: Optional[str] = None
    file_type: Optional[str] = None
    file_url: Optional[str] = None
    file_size: Optional[int] = None
    extracted_content: Optional[str] = None
    # Extension-side enrichment with the actual image bytes (base64 data URL)
    extension_data: Optional[ClaudeExtensionImageData] = Field(default=None, alias="_extension_data")
    
    model_config = {"extra": "allow", "populate_by_name": True}


class ClaudeChatMessage(BaseModel):
    """One message in a Claude conversation, native export shape."""
    uuid: Optional[str] = None
    text: Optional[str] = ""
    content: List[ClaudeContentBlock] = Field(default_factory=list)
    sender: str  # "human" or "assistant"
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    attachments: List[ClaudeAttachment] = Field(default_factory=list)
    files: List[ClaudeAttachment] = Field(default_factory=list)
    parent_message_uuid: Optional[str] = None
    
    model_config = {"extra": "allow"}


class ClaudeAccountRef(BaseModel):
    """Account reference embedded in a conversation."""
    uuid: Optional[str] = None
    email_address: Optional[str] = None
    
    model_config = {"extra": "allow"}


class ClaudeNativeConversation(BaseModel):
    """
    A single conversation in Claude's native export format.
    Matches the shape returned by Claude's /api/organizations/{org}/chat_conversations/{id}.
    """
    uuid: str
    name: Optional[str] = ""
    summary: Optional[str] = ""
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    account: Optional[ClaudeAccountRef] = None
    chat_messages: List[ClaudeChatMessage] = Field(default_factory=list)
    
    model_config = {"extra": "allow"}
    
    
    
    
    
    
class ChatGPTMessageMetadata(BaseModel):
    """
    Per-message metadata in the clean ChatGPT schema.
    
    `image_url` is the canonical singular field from the original schema spec.
    `images` is the extended multi-image form used after server-side normalization
    of raw OpenAI exports — each entry carries enough info for the import service
    to either trust an existing S3 key (already_in_s3=True) or fetch/decode bytes.
    """
    language: Optional[str] = None
    image_url: Optional[str] = None
    images: Optional[List[Dict[str, Any]]] = None
 
    # Pass-through fields the normalizer attaches for traceability
    model: Optional[str] = None
    chatgpt_request_id: Optional[str] = None
 
    model_config = {"extra": "allow"}
 
 
class ChatGPTMessage(BaseModel):
    """One message in the clean ChatGPT conversation schema."""
    id: str
    role: str  # "user" | "assistant" | "system"
    content: str = ""
    content_type: str = "text"  # "text" | "code" | "image" | other
    timestamp: Optional[str] = None
    parent_id: Optional[str] = None
    metadata: ChatGPTMessageMetadata = Field(default_factory=ChatGPTMessageMetadata)
 
    model_config = {"extra": "allow"}
 
 
class ChatGPTConversation(BaseModel):
    """
    Clean ChatGPT conversation schema. This is what /chatgpt/ingest accepts,
    what /chatgpt/upload produces after normalizing a raw export, and what
    the future ChatGPT browser extension should send.
    """
    id: str
    title: Optional[str] = ""
    source: Optional[str] = "chatgpt"
    account: Optional[str] = ""
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    messages: List[ChatGPTMessage] = Field(default_factory=list)
 
    model_config = {"extra": "allow"}
