# from pydantic import BaseModel, EmailStr, Field
# from pydantic import ConfigDict
# from uuid import UUID as UUID
# from datetime import datetime
# from typing import Any, Dict, List, Optional

# from Cal_Backend.Note.schemas import NoteResponse, NotebookSource



# class CalendarNoteGroup(BaseModel):
#     """Schema for grouped notes by source"""
#     conversation_id: UUID
#     conversation_title: str
#     source: NotebookSource
#     note_count: int
#     notes: List[NoteResponse]


# class CalendarProjectActivity(BaseModel):
#     """Schema for project activity on a date"""
#     project_id: UUID
#     project_title: str
#     color: str
#     note_count: int


# class CalendarDayActivity(BaseModel):
#     """Schema for calendar day activity"""
#     date: str
#     total_notes: int
#     note_groups: List[CalendarNoteGroup]
#     projects: List[CalendarProjectActivity]


# class CalendarMonthSummary(BaseModel):
#     """Schema for calendar month summary"""
#     year: int
#     month: int
#     daily_counts: Dict[str, int]
#     project_activity: Dict[str, List[str]]
#     source_indicators: Dict[str, List[str]]


# class CalendarRangeQuery(BaseModel):
#     """Schema for calendar range query"""
#     start_date: str = Field(..., pattern=r'^\d{4}-\d{2}-\d{2}$')
#     end_date: str = Field(..., pattern=r'^\d{4}-\d{2}-\d{2}$')


# class CalendarRangeResponse(BaseModel):
#     """Schema for calendar range response"""
#     start_date: str
#     end_date: str
#     total_notes: int
#     daily_activities: List[CalendarDayActivity]



from pydantic import BaseModel
from typing import List, Dict, Any
from datetime import date

class NotebookActivity(BaseModel):
    claude: Dict[str, Any]
    chatgpt: Dict[str, Any]
    notes: Dict[str, Any]

class ProjectActivity(BaseModel):
    project_id: str
    project_name: str
    project_color: str
    message_count: int
    message_ids: List[str]

class DateActivity(BaseModel):
    date: str
    notebooks: NotebookActivity
    projects: List[ProjectActivity]

class CalendarDataResponse(BaseModel):
    start_date: str
    end_date: str
    days: List[DateActivity]