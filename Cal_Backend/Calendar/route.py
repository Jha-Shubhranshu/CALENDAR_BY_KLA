from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from datetime import datetime, date
from typing import List, Dict, Any, Optional
from uuid import UUID

from Cal_Backend.db.main import get_session
from Cal_Backend.db.models import Note, Conversation, Project, User, NotebookSource
from Cal_Backend.auth.dependencies import get_current_userC
from Cal_Backend.Calendar.schemas import CalendarDataResponse, DateActivity

calendar_router = APIRouter()

@calendar_router.get("/activity", response_model=CalendarDataResponse)
async def get_calendar_activity( start_date: date = Query(..., description="Start date for calendar range"), end_date: date = Query(..., description="End date for calendar range"), project_ids: Optional[List[UUID]] = Query(default=None, description="Filter by specific projects"), session: AsyncSession = Depends(get_session), current_user: User = Depends(get_current_userC)):
    """Get calendar activity data aggregated by date"""
    from sqlalchemy.orm import selectinload
    
    try:
        print(f"📅 Calendar API called:")
        print(f"   User: {current_user.email}")
        print(f"   Date range: {start_date} to {end_date}")
        print(f"   Project filter: {project_ids}")
        
        # Validate date range
        if start_date > end_date:
            raise HTTPException(
                status_code=400, 
                detail="start_date must be before end_date"
            )
        
        # Convert dates to datetime
        start_dt = datetime.combine(start_date, datetime.min.time())
        end_dt = datetime.combine(end_date, datetime.max.time())
        
        print(f"   Datetime range: {start_dt} to {end_dt}")
        
        # Get all notes in date range
        notes_query = select(Note).where(
            and_(
                Note.user_id == current_user.id,
                Note.timestamp >= start_dt,
                Note.timestamp <= end_dt
            )
        ).options(selectinload(Note.conversation), selectinload(Note.project))
        
        notes_result = await session.execute(notes_query)
        notes = notes_result.scalars().all()
        
        print(f"   Found {len(notes)} notes in range")
        
        # Aggregate by date
        activity_by_date: Dict[date, Dict[str, Any]] = {}
        
        for note in notes:
            note_date = note.timestamp.date()
            
            if note_date not in activity_by_date:
                activity_by_date[note_date] = {
                    "date": note_date.isoformat(),
                    "notebooks": {
                        "claude": {"count": 0, "conversations": set()},
                        "chatgpt": {"count": 0, "conversations": set()},
                        "notes": {"count": 0, "note_ids": set()}
                    },
                    "projects": {}
                }
            
            day_data = activity_by_date[note_date]
            
            # Categorize by source
            if note.conversation_id:
                if note.conversation and note.conversation.source == NotebookSource.CLAUDE:
                    day_data["notebooks"]["claude"]["conversations"].add((str(note.conversation_id), note.conversation.title))
                elif note.conversation and note.conversation.source == NotebookSource.CHATGPT:
                    day_data["notebooks"]["chatgpt"]["conversations"].add((str(note.conversation_id), note.conversation.title))
            else:
                day_data["notebooks"]["notes"]["note_ids"].add(str(note.id))
            
            # Track project activity
            if note.project_id:
                if project_ids is None or note.project_id in project_ids:
                    project_key = str(note.project_id)
                    if project_key not in day_data["projects"]:
                        day_data["projects"][project_key] = {
                            "project_id": project_key,
                            "project_name": note.project.title if note.project else "Unknown",
                            "project_color": note.project.color if note.project else "#3B82F6",
                            "message_count": 0,
                            "message_ids": set()
                        }
                    day_data["projects"][project_key]["message_ids"].add(str(note.id))
        
        # Convert sets to counts and lists
        calendar_data = []
        for day_date, day_data in sorted(activity_by_date.items()):
            # Calculate counts
            day_data["notebooks"]["claude"]["count"] = len(day_data["notebooks"]["claude"]["conversations"])
            day_data["notebooks"]["chatgpt"]["count"] = len(day_data["notebooks"]["chatgpt"]["conversations"])
            day_data["notebooks"]["notes"]["count"] = len(day_data["notebooks"]["notes"]["note_ids"])
            
            # Convert sets to lists of dicts
            day_data["notebooks"]["claude"]["conversations"] = [
                {"id": c[0], "title": c[1]} for c in day_data["notebooks"]["claude"]["conversations"]
            ]
            day_data["notebooks"]["chatgpt"]["conversations"] = [
                {"id": c[0], "title": c[1]} for c in day_data["notebooks"]["chatgpt"]["conversations"]
            ]
            day_data["notebooks"]["notes"]["note_ids"] = list(day_data["notebooks"]["notes"]["note_ids"])
            
            # Process projects
            for project_data in day_data["projects"].values():
                project_data["message_count"] = len(project_data["message_ids"])
                project_data["message_ids"] = list(project_data["message_ids"])
            
            day_data["projects"] = list(day_data["projects"].values())
            calendar_data.append(day_data)
        
        print(f"   Returning {len(calendar_data)} days with activity")
        
        return {
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "days": calendar_data
        }
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Calendar API error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
    
    
    
@calendar_router.get("/{project_id}/activity", response_model=CalendarDataResponse)
async def get_project_activity(
    project_id: UUID,
    start_date: date = Query(..., description="Start date for calendar range"),
    end_date: date = Query(..., description="End date for calendar range"),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_userC)
):
    """
    Get calendar activity data for a specific project
    Returns only messages/notes that belong to this project, aggregated by date
    """
    from sqlalchemy.orm import selectinload
    
    try:
        print(f"📅 Project Calendar API called:")
        print(f"   User: {current_user.email}")
        print(f"   Project ID: {project_id}")
        print(f"   Date range: {start_date} to {end_date}")
        
        # Validate date range
        if start_date > end_date:
            raise HTTPException(
                status_code=400, 
                detail="start_date must be before end_date"
            )
        
        # Verify project exists and belongs to user
        project_query = select(Project).where(
            Project.id == project_id,
            Project.user_id == current_user.id
        )
        project_result = await session.execute(project_query)
        project = project_result.scalar_one_or_none()
        
        if not project:
            raise HTTPException(
                status_code=404,
                detail="Project not found"
            )
        
        # Convert dates to datetime
        start_dt = datetime.combine(start_date, datetime.min.time())
        end_dt = datetime.combine(end_date, datetime.max.time())
        
        print(f"   Datetime range: {start_dt} to {end_dt}")
        
        # Get all notes for this project in date range
        notes_query = select(Note).where(
            and_(
                Note.project_id == project_id,
                Note.user_id == current_user.id,
                Note.timestamp >= start_dt,
                Note.timestamp <= end_dt
            )
        ).options(selectinload(Note.conversation))
        
        notes_result = await session.execute(notes_query)
        notes = notes_result.scalars().all()
        
        print(f"   Found {len(notes)} notes in project")
        
        # Aggregate by date
        activity_by_date: Dict[date, Dict[str, Any]] = {}
        
        for note in notes:
            note_date = note.timestamp.date()
            
            if note_date not in activity_by_date:
                activity_by_date[note_date] = {
                    "date": note_date.isoformat(),
                    "notebooks": {
                        "claude": {"count": 0, "conversation_ids": set()},
                        "chatgpt": {"count": 0, "conversation_ids": set()},
                        "notes": {"count": 0, "note_ids": set()}
                    },
                    "projects": []
                }
            
            day_data = activity_by_date[note_date]
            
            # Categorize by source (where this message originally came from)
            if note.conversation_id:
                # It's from a conversation
                if note.conversation and note.conversation.source == NotebookSource.CLAUDE:
                    day_data["notebooks"]["claude"]["conversation_ids"].add(str(note.conversation_id))
                elif note.conversation and note.conversation.source == NotebookSource.CHATGPT:
                    day_data["notebooks"]["chatgpt"]["conversation_ids"].add(str(note.conversation_id))
            else:
                # It's a standalone note
                day_data["notebooks"]["notes"]["note_ids"].add(str(note.id))
        
        # Convert sets to counts and lists
        calendar_data = []
        for day_date, day_data in sorted(activity_by_date.items()):
            # Calculate counts
            day_data["notebooks"]["claude"]["count"] = len(day_data["notebooks"]["claude"]["conversation_ids"])
            day_data["notebooks"]["chatgpt"]["count"] = len(day_data["notebooks"]["chatgpt"]["conversation_ids"])
            day_data["notebooks"]["notes"]["count"] = len(day_data["notebooks"]["notes"]["note_ids"])
            
            # Convert sets to lists
            day_data["notebooks"]["claude"]["conversation_ids"] = list(day_data["notebooks"]["claude"]["conversation_ids"])
            day_data["notebooks"]["chatgpt"]["conversation_ids"] = list(day_data["notebooks"]["chatgpt"]["conversation_ids"])
            day_data["notebooks"]["notes"]["note_ids"] = list(day_data["notebooks"]["notes"]["note_ids"])
            
            # For project-specific view, we know all messages are from this project
            # So we add the project info to each day
            if (day_data["notebooks"]["claude"]["count"] > 0 or 
                day_data["notebooks"]["chatgpt"]["count"] > 0 or 
                day_data["notebooks"]["notes"]["count"] > 0):
                
                total_messages = (
                    day_data["notebooks"]["claude"]["count"] +
                    day_data["notebooks"]["chatgpt"]["count"] +
                    day_data["notebooks"]["notes"]["count"]
                )
                
                day_data["projects"] = [{
                    "project_id": str(project_id),
                    "project_name": project.title,
                    "project_color": project.color,
                    "message_count": total_messages,
                    "message_ids": []  # We don't need individual IDs for this view
                }]
            
            calendar_data.append(day_data)
        
        print(f"   Returning {len(calendar_data)} days with activity")
        
        return {
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "days": calendar_data
        }
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Project Calendar API error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))