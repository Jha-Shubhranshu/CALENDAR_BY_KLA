from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from typing import List, Optional
from datetime import datetime, timezone
from Cal_Backend.db.main import get_session
from Cal_Backend.db.models import Label, NoteLabel, Label, User, ContentType,MessageRole
from Cal_Backend.auth.dependencies import get_current_userC

from Cal_Backend.Label.schemas import LabelCreate, LabelResponse, LabelListResponse, LabelUpdate, AddLabelToNote, LabelWithNotes, RemoveLabelFromNote


label_router = APIRouter()

@label_router.post("/label_create", response_model=LabelResponse, status_code=status.HTTP_201_CREATED)
async def create_label( label_data: LabelCreate, session: AsyncSession = Depends(get_session), current_user: User = Depends(get_current_userC)):
    """Create a new label"""
    label = Label(
        user_id=current_user.id,
        name=label_data.name,
        color=label_data.color
    )
    
    session.add(label)
    await session.commit()
    await session.refresh(label)
    
    # label_dict = {
    #     "id": label.id,
    #     "user_id": label.user_id,
    #     "conversation_id": label.conversation_id,
    #     "project_id": label.project_id,
    #     "content": label.content,
    #     "title": label.title,
    #     "content_type": label.content_type,
    #     "role": label.role,
    #     "timestamp": label.timestamp,
    #     "created_at": label.created_at,
    #     "updated_at": label.updated_at,
    #     "is_pinned": label.is_pinned,
    #     "is_archived": label.is_archived,
    #     "is_categorized": label.is_categorized,
    #     "background_color": label.background_color,
    #     "parent_message_id": label.parent_message_id,
    #     "metadata": label.labelmetadata if isinstance(label.labelmetadata, dict) else {}
    # }


    
    return label

@label_router.get("/label_get", response_model=LabelListResponse)
async def get_labels( skip: int = 0, limit: int = 50, session: AsyncSession = Depends(get_session), current_user: User = Depends(get_current_userC)):
    """Get all labels for the current user"""
    from sqlalchemy import select, func
    from sqlalchemy.orm import selectinload
    
    query = select(Label).where(
        Label.user_id == current_user.id,
    )
        
    query = query.order_by(Label.updated_at.desc())
    query = query.offset(skip).limit(limit)
    
    result = await session.execute(query)
    labels = result.scalars().all()
    
# Manually serialize labels
    # serialized_labels = []
    # for label in labels:
    #     label_dict = {
    #         "id": label.id,
    #         "user_id": label.user_id,
    #         "conversation_id": label.conversation_id,
    #         "project_id": label.project_id,
    #         "content": label.content,
    #         "title": label.title,
    #         "content_type": label.content_type,
    #         "role": label.role,
    #         "timestamp": label.timestamp,
    #         "created_at": label.created_at,
    #         "updated_at": label.updated_at,
    #         "is_pinned": label.is_pinned,
    #         "is_archived": label.is_archived,
    #         "is_categorized": label.is_categorized,
    #         "background_color": label.background_color,
    #         "parent_message_id": label.parent_message_id,
    #         "metadata": label.labelmetadata if isinstance(label.labelmetadata, dict) else {}
    #     }
    #     serialized_labels.append(label_dict)    
    
    # Get total count
    count_query = select(func.count(Label.id)).where(
        Label.user_id == current_user.id
    )    
    total_result = await session.execute(count_query)
    total = total_result.scalar_one()
    
    return {"labels": labels, "total": total, "skip": skip, "limit": limit}




@label_router.get("/{label_id}", response_model=LabelResponse)
async def get_label( label_id: UUID, session: AsyncSession = Depends(get_session), current_user: User = Depends(get_current_userC)):
    """Get a specific label"""
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload
    
    query = select(Label).where(
        Label.id == label_id,
        Label.user_id == current_user.id
    ).options(selectinload(Label.media))
    
    result = await session.execute(query)
    label = result.scalar_one_or_none()
    
    # label_dict = {
    #     "id": label.id,
    #     "user_id": label.user_id,
    #     "conversation_id": label.conversation_id,
    #     "project_id": label.project_id,
    #     "content": label.content,
    #     "title": label.title,
    #     "content_type": label.content_type,
    #     "role": label.role,
    #     "timestamp": label.timestamp,
    #     "created_at": label.created_at,
    #     "updated_at": label.updated_at,
    #     "is_pinned": label.is_pinned,
    #     "is_archived": label.is_archived,
    #     "is_categorized": label.is_categorized,
    #     "background_color": label.background_color,
    #     "parent_message_id": label.parent_message_id,
    #     "metadata": label.labelmetadata if isinstance(label.labelmetadata, dict) else {}
    # }

    
    if not label:
        raise HTTPException(status_code=404, detail="Label not found")
    
    return label

@label_router.patch("/update/{label_id}", response_model=LabelResponse)
async def update_label( label_id: UUID, label_data: LabelUpdate, session: AsyncSession = Depends(get_session), current_user: User = Depends(get_current_userC)):
    """Update a label"""
    from sqlalchemy import select
    
    query = select(Label).where(
        Label.id == label_id,
        Label.user_id == current_user.id
    )
    
    result = await session.execute(query)
    label = result.scalar_one_or_none()
    
    if not label:
        raise HTTPException(status_code=404, detail="Label not found")
    
    # Update fields
    if label_data.name is not None:
        label.name = label_data.name
    if label_data.color is not None:
        label.color = label_data.color
    # if label_data.metadata is not None:
    #     label.labelmetadata = label_data.metadata
    
    label.updated_at = datetime.now(timezone.utc)
    
    await session.commit()
    await session.refresh(label)
    
    # label_dict = {
    # "id": label.id,
    # "user_id": label.user_id,
    # "conversation_id": label.conversation_id,
    # "project_id": label.project_id,
    # "content": label.content,
    # "title": label.title,
    # "content_type": label.content_type,
    # "role": label.role,
    # "timestamp": label.timestamp,
    # "created_at": label.created_at,
    # "updated_at": label.updated_at,
    # "is_pinned": label.is_pinned,
    # "is_archived": label.is_archived,
    # "is_categorized": label.is_categorized,
    # "background_color": label.background_color,
    # "parent_message_id": label.parent_message_id,
    # "metadata": label.labelmetadata if isinstance(label.labelmetadata, dict) else {}
    # }
    
    return label

@label_router.delete("/dellabel/{label_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_label( label_id: UUID, session: AsyncSession = Depends(get_session), current_user: User = Depends(get_current_userC)):
    """Delete a label"""
    from sqlalchemy import select, delete
    
    query = select(Label).where(
        Label.id == label_id,
        Label.user_id == current_user.id
    )
    
    result = await session.execute(query)
    label = result.scalar_one_or_none()
    
    if not label:
        raise HTTPException(status_code=404, detail="Label not found")
    
    await session.delete(label)
    await session.commit()
    
    return None








@label_router.post("/note/{noteId}/label/{labelId}", response_model=AddLabelToNote, status_code=status.HTTP_201_CREATED)
async def add_label_to_note(noteId: UUID, labelId: UUID, session: AsyncSession = Depends(get_session), current_user: User = Depends(get_current_userC)):
    """Create a new entry in the note-label junction table"""
    
    notelabel = NoteLabel(
        user_id=current_user.id,
        note_id=noteId,
        label_id=labelId
    )
    
    session.add(notelabel)
    await session.commit()
    await session.refresh(notelabel)

    return {"label_id": labelId}


@label_router.delete("/note/{noteId}/label/{labelId}", status_code=status.HTTP_204_NO_CONTENT)
async def del_label_from_note(noteId: UUID, labelId: UUID, session: AsyncSession = Depends(get_session), current_user: User = Depends(get_current_userC)):
    """delete an entry in the note-label junction table"""
    
    from sqlalchemy import select, delete
    
    query = select(NoteLabel).where(
        NoteLabel.label_id == labelId,
        NoteLabel.note_id == noteId
    )
    
    result = await session.execute(query)
    label = result.scalar_one_or_none()
    
    if not label:
        raise HTTPException(status_code=404, detail="Label not found")
    
    await session.delete(label)
    await session.commit()
    
    return None