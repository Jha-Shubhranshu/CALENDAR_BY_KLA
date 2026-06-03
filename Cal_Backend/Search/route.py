from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, text
from sqlalchemy.orm import selectinload
from typing import List
import re

from Cal_Backend.db.main import get_session
from Cal_Backend.db.models import Note, Conversation, User, MessageRole
from Cal_Backend.auth.dependencies import get_current_userC
from Cal_Backend.Search.schemas import (
    SearchRequest, 
    SearchResponse, 
    ConversationSearchResult, 
    MessageSearchResult, 
    NoteSearchResult
)

search_router = APIRouter()

@search_router.post("/search", response_model=SearchResponse)
async def total_search(
    search_data: SearchRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_userC)
):
    query_str = search_data.query
    if not query_str:
        return SearchResponse(conversations=[], notes=[])

    # Construct the regex pattern if needed
    pattern = query_str
    if not search_data.use_regexp:
        # Escape special regex characters if not using regex mode
        pattern = re.escape(query_str)
    
    if search_data.match_whole_word:
        pattern = rf"\b{pattern}\b"

    # Postgres regex operators:
    # ~  : Case-sensitive regex
    # ~* : Case-insensitive regex
    regex_op = "~" if search_data.match_case else "~*"

    # Search in Notes (which includes both messages and manual notes)
    # We filter by content and title
    stmt_notes = select(Note).where(
        Note.user_id == current_user.id,
        or_(
            text(f"content {regex_op} :pattern").bindparams(pattern=pattern),
            text(f"title {regex_op} :pattern").bindparams(pattern=pattern)
        )
    ).order_by(Note.timestamp.desc())

    # Include conversation info if it's a message
    stmt_notes = stmt_notes.options(selectinload(Note.conversation))

    # Search in Conversations for title matches
    stmt_convs = select(Conversation).where(
        Conversation.user_id == current_user.id,
        text(f"title {regex_op} :pattern").bindparams(pattern=pattern)
    )

    # Execute both
    notes_result = await session.execute(stmt_notes)
    convs_result = await session.execute(stmt_convs)
    
    notes = notes_result.scalars().all()
    convs_with_matching_titles = convs_result.scalars().all()

    # Group results
    conversation_map = {}
    manual_notes = []

    # First, initialize map with conversations that have matching titles
    for conv in convs_with_matching_titles:
        conversation_map[conv.id] = {
            "id": conv.id,
            "title": conv.title,
            "messages": []
        }

    # Then, add matching messages
    for note in notes:
        if note.conversation_id:
            # It's a message in a conversation
            conv_id = note.conversation_id
            if conv_id not in conversation_map:
                conversation_map[conv_id] = {
                    "id": conv_id,
                    "title": note.conversation.title if note.conversation else "Unknown Conversation",
                    "messages": []
                }
            
            conversation_map[conv_id]["messages"].append(
                MessageSearchResult(
                    id=note.id,
                    content=note.content or "",
                    timestamp=note.timestamp,
                    role=note.role.value if hasattr(note.role, 'value') else str(note.role)
                )
            )
        else:
            # It's a manual note
            manual_notes.append(
                NoteSearchResult(
                    id=note.id,
                    title=note.title,
                    content=note.content or "",
                    timestamp=note.timestamp
                )
            )

    return SearchResponse(
        conversations=list(conversation_map.values()),
        notes=manual_notes
    )
