from pydantic import BaseModel, EmailStr, Field
from pydantic import ConfigDict
from uuid import UUID as UUID
from datetime import datetime
from typing import Any, Dict, List, Optional
from Cal_Backend.db.models import NotebookSource


class OverviewStats(BaseModel):
    """Schema for overview statistics"""
    total_conversations: int
    total_notes: int
    total_projects: int
    total_labels: int
    uncategorized_notes: int
    pinned_notes: int
    archived_notes: int
    sources_breakdown: Dict[str, int]


class ActivityHeatmapData(BaseModel):
    """Schema for activity heatmap data"""
    date: str
    count: int
    intensity: int


class ActivityHeatmapResponse(BaseModel):
    """Schema for activity heatmap response"""
    year: int
    data: List[ActivityHeatmapData]


class SourceBreakdown(BaseModel):
    """Schema for source breakdown"""
    source: NotebookSource
    conversation_count: int
    note_count: int
    percentage: float


class SourceBreakdownResponse(BaseModel):
    """Schema for source breakdown response"""
    breakdown: List[SourceBreakdown]
    total_conversations: int
    total_notes: int


class ProjectProgress(BaseModel):
    """Schema for project progress"""
    project_id: UUID
    project_title: str
    color: str
    total_notes: int
    dates: List[str]
    daily_counts: Dict[str, int]


class ProjectProgressResponse(BaseModel):
    """Schema for project progress response"""
    projects: List[ProjectProgress]
