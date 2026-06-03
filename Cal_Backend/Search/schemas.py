from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from typing import List, Optional

class SearchRequest(BaseModel):
    query: str
    match_case: bool = False
    match_whole_word: bool = False
    use_regexp: bool = False

class MessageSearchResult(BaseModel):
    id: UUID
    content: str
    timestamp: datetime
    role: str

class ConversationSearchResult(BaseModel):
    id: UUID
    title: str
    messages: List[MessageSearchResult]

class NoteSearchResult(BaseModel):
    id: UUID
    title: Optional[str]
    content: str
    timestamp: datetime

class SearchResponse(BaseModel):
    conversations: List[ConversationSearchResult]
    notes: List[NoteSearchResult]
