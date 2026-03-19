# routes/projects.py
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from typing import List, Optional
from datetime import datetime, timezone

from Cal_Backend.db.main import get_session
from Cal_Backend.db.models import Project, Note, User
from Cal_Backend.auth.dependencies import get_current_userC
from Cal_Backend.Project.schemas import (
    ProjectCreate,
    ProjectUpdate,
    ProjectResponse,
    ProjectListResponse,
    ProjectWithMessagesResponse
)

project_router = APIRouter()

# ✅ Get all projects
@project_router.get("", response_model=ProjectListResponse)
async def get_projects(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_userC)
):
    """Get all projects for current user"""
    from sqlalchemy import select, func
    
    query = select(Project).where(
        Project.user_id == current_user.id
    ).order_by(Project.updated_at.desc())
    query = query.offset(skip).limit(limit)
    
    result = await session.execute(query)
    projects = result.scalars().all()
    
    serialized_projects = []
    for project in projects:
        # Count messages in this project
        count_query = select(func.count(Note.id)).where(
            Note.project_id == project.id
        )
        count_result = await session.execute(count_query)
        message_count = count_result.scalar_one()
        
        project_dict = {
            "id": project.id,
            "user_id": project.user_id,
            "title": project.title,
            "description": project.description,
            "color": project.color,
            "created_at": project.created_at,
            "updated_at": project.updated_at,
            "message_count": message_count
        }
        serialized_projects.append(project_dict)
    
    # Total count
    count_query = select(func.count(Project.id)).where(
        Project.user_id == current_user.id
    )
    total_result = await session.execute(count_query)
    total = total_result.scalar_one()
    
    return {
        "projects": serialized_projects,
        "total": total,
        "skip": skip,
        "limit": limit
    }

# ✅ Get specific project with all its messages
@project_router.get("/{project_id}", response_model=ProjectWithMessagesResponse)
async def get_project(
    project_id: UUID,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_userC)
):
    """Get a specific project with all its messages in chronological order"""
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload
    
    query = select(Project).where(
        Project.id == project_id,
        Project.user_id == current_user.id
    ).options(selectinload(Project.notes).selectinload(Note.conversation))
    
    result = await session.execute(query)
    project = result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Serialize messages sorted by timestamp
    messages = []
    for note in sorted(project.notes, key=lambda n: n.timestamp):
        msg_dict = {
            "id": note.id,
            "conversation_id": note.conversation_id,
            "project_id": note.project_id,
            "content": note.content,
            "title": note.title,
            "role": note.role,
            "timestamp": note.timestamp,
            "created_at": note.created_at,
            "background_color": note.background_color,
            "metadata": note.notemetadata if isinstance(note.notemetadata, dict) else {},
            "conversation_title": note.conversation.title if note.conversation else None,
            "original_source": note.conversation.source if note.conversation else None
        }
        messages.append(msg_dict)
    
    project_dict = {
        "id": project.id,
        "user_id": project.user_id,
        "title": project.title,
        "description": project.description,
        "color": project.color,
        "created_at": project.created_at,
        "updated_at": project.updated_at,
        "messages": messages
    }
    
    return project_dict

# ✅ Create a new project
@project_router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    project_data: ProjectCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_userC)
):
    """Create a new project"""
    
    project = Project(
        user_id=current_user.id,
        title=project_data.title,
        description=project_data.description,
        color=project_data.color or "#3B82F6"
    )
    
    session.add(project)
    await session.commit()
    await session.refresh(project)
    
    return {
        "id": project.id,
        "user_id": project.user_id,
        "title": project.title,
        "description": project.description,
        "color": project.color,
        "created_at": project.created_at,
        "updated_at": project.updated_at,
        "message_count": 0
    }

# ✅ Update project
@project_router.patch("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: UUID,
    project_data: ProjectUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_userC)
):
    """Update a project"""
    from sqlalchemy import select, func
    
    query = select(Project).where(
        Project.id == project_id,
        Project.user_id == current_user.id
    )
    
    result = await session.execute(query)
    project = result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    if project_data.title is not None:
        project.title = project_data.title
    if project_data.description is not None:
        project.description = project_data.description
    if project_data.color is not None:
        project.color = project_data.color
    
    project.updated_at = datetime.now(timezone.utc)
    
    await session.commit()
    await session.refresh(project)
    
    # Count messages
    count_query = select(func.count(Note.id)).where(Note.project_id == project.id)
    count_result = await session.execute(count_query)
    message_count = count_result.scalar_one()
    
    return {
        "id": project.id,
        "user_id": project.user_id,
        "title": project.title,
        "description": project.description,
        "color": project.color,
        "created_at": project.created_at,
        "updated_at": project.updated_at,
        "message_count": message_count
    }

# ✅ Delete project
@project_router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: UUID,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_userC)
):
    """Delete a project (notes remain but project_id set to NULL)"""
    from sqlalchemy import select
    
    query = select(Project).where(
        Project.id == project_id,
        Project.user_id == current_user.id
    )
    
    result = await session.execute(query)
    project = result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    await session.delete(project)
    await session.commit()
    
    return None

# ✅ Add message to project
@project_router.post("/{project_id}/messages/{note_id}", status_code=status.HTTP_200_OK)
async def add_message_to_project(
    project_id: UUID,
    note_id: UUID,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_userC)
):
    """Add a message/note to a project"""
    from sqlalchemy import select
    
    # Verify project exists and belongs to user
    project_query = select(Project).where(
        Project.id == project_id,
        Project.user_id == current_user.id
    )
    project_result = await session.execute(project_query)
    project = project_result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Get the note
    note_query = select(Note).where(
        Note.id == note_id,
        Note.user_id == current_user.id
    )
    note_result = await session.execute(note_query)
    note = note_result.scalar_one_or_none()
    
    if not note:
        raise HTTPException(status_code=404, detail="Note/Message not found")
    
    # Add to project
    note.project_id = project_id
    project.updated_at = datetime.now(timezone.utc)
    
    await session.commit()
    
    return {"message": "Note added to project successfully"}

# ✅ Remove message from project
@project_router.delete("/{project_id}/messages/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_message_from_project(
    project_id: UUID,
    note_id: UUID,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_userC)
):
    """Remove a message/note from a project"""
    from sqlalchemy import select
    
    note_query = select(Note).where(
        Note.id == note_id,
        Note.user_id == current_user.id,
        Note.project_id == project_id
    )
    note_result = await session.execute(note_query)
    note = note_result.scalar_one_or_none()
    
    if not note:
        raise HTTPException(status_code=404, detail="Note not found in this project")
    
    note.project_id = None
    await session.commit()
    
    return None