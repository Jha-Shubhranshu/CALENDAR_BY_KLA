# routes/notes.py
from sqlalchemy import select
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from typing import List, Optional
from datetime import datetime, timezone
from Cal_Backend.db.main import get_session
from Cal_Backend.db.models import Note, NoteLabel, Label, User, ContentType,MessageRole
from Cal_Backend.auth.dependencies import get_current_userC
from Cal_Backend.Note.schemas import NoteCreate, NoteUpdate, NoteResponse, NoteListResponse

note_router = APIRouter()

@note_router.post(
    "/note_create",
    response_model=NoteResponse,
    status_code=status.HTTP_201_CREATED
)
async def create_note(
    note_data: NoteCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_userC)
):
    """Create a new note"""

    note = Note(
        user_id=current_user.id,
        title=note_data.title,
        content=note_data.content,
        content_type=ContentType.TEXT,
        role=MessageRole.NOTE,
        background_color=note_data.background_color,
        is_pinned=note_data.is_pinned,
        project_id=note_data.project_id,
        is_archived=note_data.is_archived,
        is_categorized=note_data.is_categorized,
    )

    session.add(note)
    await session.flush()  # ✅ get note.id without committing

    # 🔹 Handle labels (extract ID only)
    if note_data.labels:
        for label in note_data.labels:
            stmt = select(NoteLabel).where(
                NoteLabel.note_id == note.id,
                NoteLabel.label_id == label.id
            )
            result = await session.execute(stmt)
            exists = result.scalar_one_or_none()

            if not exists:
                session.add(
                    NoteLabel(
                        note_id=note.id,
                        label_id=label.id
                    )
                )

    await session.commit()
    await session.refresh(note)

    # 🔹 Build response
    note_dict = {
        "id": note.id,
        "user_id": note.user_id,
        "conversation_id": note.conversation_id,
        "project_id": note.project_id,
        "content": note.content,
        "title": note.title,
        "content_type": note.content_type,
        "role": note.role,
        "timestamp": note.timestamp,
        "created_at": note.created_at,
        "updated_at": note.updated_at,
        "is_pinned": note.is_pinned,
        "is_archived": note.is_archived,
        "is_categorized": note.is_categorized,
        "background_color": note.background_color,
        "parent_message_id": note.parent_message_id,
        "metadata": note.notemetadata if isinstance(note.notemetadata, dict) else {},
    }

    return note_dict

@note_router.get("/note_get", response_model=NoteListResponse)
async def get_notes( skip: int = 0, limit: int = 1000, is_archived: bool = False, is_pinned: Optional[bool] = None, project_id: Optional[UUID] = None, session: AsyncSession = Depends(get_session), current_user: User = Depends(get_current_userC)):
    """Get all notes for the current user"""
    from sqlalchemy import select, func
    from sqlalchemy.orm import selectinload
    
    query = select(Note).where(
        Note.user_id == current_user.id,
        Note.is_archived == is_archived,
        Note.role == MessageRole.NOTE
    )
    
    if is_pinned is not None:
        query = query.where(Note.is_pinned == is_pinned)
    
    if project_id:
        query = query.where(Note.project_id == project_id)
    
    query = query.order_by(Note.is_pinned.desc(), Note.updated_at.desc())
    query = query.offset(skip).limit(limit)
    query = query.options(selectinload(Note.media))
    query = query.options(selectinload(Note.labels))

    result = await session.execute(query)
    notes = result.scalars().all()
    
# Manually serialize notes
    serialized_notes = []
    for note in notes:
        note_dict = {
            "id": note.id,
            "user_id": note.user_id,
            "conversation_id": note.conversation_id,
            "project_id": note.project_id,
            "content": note.content,
            "title": note.title,
            "content_type": note.content_type,
            "role": note.role,
            "timestamp": note.timestamp,
            "created_at": note.created_at,
            "updated_at": note.updated_at,
            "is_pinned": note.is_pinned,
            "is_archived": note.is_archived,
            "is_categorized": note.is_categorized,
            "background_color": note.background_color,
            "parent_message_id": note.parent_message_id,
            "metadata": note.notemetadata if isinstance(note.notemetadata, dict) else {},
            "labels": [
                {
                    "id": str(label.id),
                    "name": label.name,
                    "color": label.color,
                    "created_at": label.created_at,
                    "updated_at": label.updated_at,
                    "user_id": str(label.user_id)
                }
                for label in note.labels
            ]
        }
        serialized_notes.append(note_dict)    
    
    # Get total count
    count_query = select(func.count(Note.id)).where(
        Note.user_id == current_user.id,
        Note.is_archived == is_archived
    )
    if is_pinned is not None:
        count_query = count_query.where(Note.is_pinned == is_pinned)
    if project_id:
        count_query = count_query.where(Note.project_id == project_id)
    
    total_result = await session.execute(count_query)
    total = total_result.scalar_one()
    
    return {"notes": serialized_notes, "total": total, "skip": skip, "limit": limit}

@note_router.get("/{note_id}", response_model=NoteResponse)
async def get_note( note_id: UUID, session: AsyncSession = Depends(get_session), current_user: User = Depends(get_current_userC)):
    """Get a specific note"""
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload
    
    query = select(Note).where(
        Note.id == note_id,
        Note.user_id == current_user.id
    ).options(selectinload(Note.media))
    
    result = await session.execute(query)
    note = result.scalar_one_or_none()
    
    note_dict = {
        "id": note.id,
        "user_id": note.user_id,
        "conversation_id": note.conversation_id,
        "project_id": note.project_id,
        "content": note.content,
        "title": note.title,
        "content_type": note.content_type,
        "role": note.role,
        "timestamp": note.timestamp,
        "created_at": note.created_at,
        "updated_at": note.updated_at,
        "is_pinned": note.is_pinned,
        "is_archived": note.is_archived,
        "is_categorized": note.is_categorized,
        "background_color": note.background_color,
        "parent_message_id": note.parent_message_id,
        "metadata": note.notemetadata if isinstance(note.notemetadata, dict) else {},
                    "labels": [
                {
                    "id": str(label.id),
                    "name": label.name,
                    "color": label.color,
                    "created_at": label.created_at,
                    "updated_at": label.updated_at,
                    "user_id": str(label.user_id)
                }
                for label in note.labels
            ]

    }

    
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    return note_dict

@note_router.patch("/update/{note_id}", response_model=NoteResponse)
async def update_note(
    note_id: UUID, 
    note_data: NoteUpdate, 
    session: AsyncSession = Depends(get_session), 
    current_user: User = Depends(get_current_userC)
):
    """Update a note"""
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload
    
    query = select(Note).where(
        Note.id == note_id,
        Note.user_id == current_user.id
    ).options(selectinload(Note.labels))
    
    result = await session.execute(query)
    note = result.scalar_one_or_none()
    
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    # Update fields
    if note_data.content is not None:
        note.content = note_data.content
    if note_data.title is not None:
        note.title = note_data.title
    if note_data.background_color is not None:
        note.background_color = note_data.background_color
    
    # ✅ Handle label updates - validator already extracted UUIDs
    if note_data.labels is not None:
        result = await session.execute(
            select(Label).where(
                Label.id.in_(note_data.labels),  # Now these are guaranteed to be UUIDs
                Label.user_id == current_user.id
            )
        )
        labels = result.scalars().all()
        note.labels = labels   
        
    if note_data.is_pinned is not None:
        note.is_pinned = note_data.is_pinned
    if note_data.is_archived is not None:
        note.is_archived = note_data.is_archived
    if note_data.project_id is not None:
        note.project_id = note_data.project_id
    
    note.updated_at = datetime.now(timezone.utc)
    
    await session.commit()
    await session.refresh(note, ['labels'])
    
    # Return with full label objects
    note_dict = {
        "id": note.id,
        "user_id": note.user_id,
        "conversation_id": note.conversation_id,
        "project_id": note.project_id,
        "content": note.content,
        "title": note.title,
        "content_type": note.content_type,
        "role": note.role,
        "timestamp": note.timestamp,
        "created_at": note.created_at,
        "updated_at": note.updated_at,
        "is_pinned": note.is_pinned,
        "is_archived": note.is_archived,
        "is_categorized": note.is_categorized,
        "background_color": note.background_color,
        "parent_message_id": note.parent_message_id,
        "metadata": note.notemetadata if isinstance(note.notemetadata, dict) else {},
        "labels": [
            {
                "id": str(label.id),
                "name": label.name,
                "color": label.color,
                "created_at": label.created_at,
                "updated_at": label.updated_at,
                "user_id": str(label.user_id)
            }
            for label in note.labels
        ]
    }
    
    return note_dict

@note_router.delete("/delnote/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_note( note_id: UUID, session: AsyncSession = Depends(get_session), current_user: User = Depends(get_current_userC)):
    """Delete a note"""
    from sqlalchemy import select, delete
    
    query = select(Note).where(
        Note.id == note_id,
        Note.user_id == current_user.id
    )
    
    result = await session.execute(query)
    note = result.scalar_one_or_none()
    
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    await session.delete(note)
    await session.commit()
    
    return None