# routes/conversations.py
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from typing import List, Optional
from datetime import datetime, timezone

from Cal_Backend.db.main import get_session
from Cal_Backend.db.models import Conversation, Note, User, NotebookSource, MessageRole
from Cal_Backend.auth.dependencies import get_current_userC
from Cal_Backend.Conversations.schemas import (
    ConversationCreate, 
    ConversationResponse, 
    ConversationListResponse,
    MessageResponse
)

conversation_router = APIRouter()

# ✅ Get all conversations for current user, optionally filtered by source
@conversation_router.get("", response_model=ConversationListResponse)
async def get_conversations(source: Optional[NotebookSource] = None,skip: int = Query(0, ge=0),limit: int = Query(2000, ge=1, le=5000),session: AsyncSession = Depends(get_session),current_user: User = Depends(get_current_userC)):
    """Get all conversations, optionally filtered by source (claude, chatgpt, etc.)"""
    from sqlalchemy import select, func
    
    query = select(Conversation).where(
        Conversation.user_id == current_user.id
    )
    
    if source:
        query = query.where(Conversation.source == source)
    
    query = query.order_by(Conversation.updated_at.desc())
    query = query.offset(skip).limit(limit)
    
    result = await session.execute(query)
    conversations = result.scalars().all()
    
    # Serialize
    serialized_convos = []
    for convo in conversations:
        convo_dict = {
            "id": convo.id,
            "user_id": convo.user_id,
            "title": convo.title,
            "source": convo.source,
            "original_conversation_id": convo.original_conversation_id,
            "import_date": convo.import_date,
            "original_filename": convo.original_filename,
            "metadata": convo.convmetadata if isinstance(convo.convmetadata, dict) else {},
            "created_at": convo.created_at,
            "updated_at": convo.updated_at,
            "account": convo.account,
        }
        serialized_convos.append(convo_dict)
    
    # Get total count
    count_query = select(func.count(Conversation.id)).where(
        Conversation.user_id == current_user.id
    )
    if source:
        count_query = count_query.where(Conversation.source == source)
    
    total_result = await session.execute(count_query)
    total = total_result.scalar_one()
    
    return {
        "conversations": serialized_convos,
        "total": total,
        "skip": skip,
        "limit": limit
    }

# ✅ Get specific conversation with all its messages
@conversation_router.get("/{conversation_id}", response_model=ConversationResponse)
async def get_conversation(
    conversation_id: UUID,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_userC)
):
    """Get a specific conversation with all its messages"""
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload
    
    query = select(Conversation).where(
        Conversation.id == conversation_id,
        Conversation.user_id == current_user.id
    ).options(selectinload(Conversation.notes))
    
    result = await session.execute(query)
    conversation = result.scalar_one_or_none()
    
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    # Serialize messages (notes in this conversation)
    messages = []
    for note in sorted(conversation.notes, key=lambda n: n.timestamp):
        msg_dict = {
            "id": note.id,
            "conversation_id": note.conversation_id,
            "project_id": note.project_id,
            "content": note.content,
            "role": note.role,
            "timestamp": note.timestamp,
            "created_at": note.created_at,
            "background_color": note.background_color,
            "metadata": note.notemetadata if isinstance(note.notemetadata, dict) else {}
        }
        messages.append(msg_dict)
    
    convo_dict = {
        "id": conversation.id,
        "user_id": conversation.user_id,
        "title": conversation.title,
        "source": conversation.source,
        "account": conversation.account,
        "original_conversation_id": conversation.original_conversation_id,
        "import_date": conversation.import_date,
        "original_filename": conversation.original_filename,
        "metadata": conversation.convmetadata if isinstance(conversation.convmetadata, dict) else {},
        "created_at": conversation.created_at,
        "updated_at": conversation.updated_at,
        "messages": messages
    }
    
    return convo_dict

# ✅ Create a new conversation (for imports)
@conversation_router.post("", response_model=ConversationResponse, status_code=status.HTTP_201_CREATED)
async def create_conversation(
    convo_data: ConversationCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_userC)
):
    """Create a new conversation (typically from import)"""
    
    conversation = Conversation(
        user_id=current_user.id,
        title=convo_data.title,
        source=convo_data.source,
        account=convo_data.account,
        original_conversation_id=convo_data.original_conversation_id,
        original_filename=convo_data.original_filename,
        convmetadata=convo_data.metadata or {}
    )
    
    session.add(conversation)
    await session.commit()
    await session.refresh(conversation)
    
    return {
        "id": conversation.id,
        "user_id": conversation.user_id,
        "title": conversation.title,
        "source": conversation.source,
        "account": conversation.account,
        "original_conversation_id": conversation.original_conversation_id,
        "import_date": conversation.import_date,
        "original_filename": conversation.original_filename,
        "metadata": conversation.convmetadata,
        "created_at": conversation.created_at,
        "updated_at": conversation.updated_at,
        "messages": []
    }