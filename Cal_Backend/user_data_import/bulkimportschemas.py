from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime


class FileImportFailure(BaseModel):
    """Detailed failure information for a single file"""
    filename: str
    error_type: str
    error_message: str
    note_title: Optional[str] = None
    timestamp: datetime
    traceback: Optional[str] = None


class FileImportResult(BaseModel):
    """Result of importing a single file"""
    filename: str
    success: bool
    notes_imported: int = 0
    error: Optional[str] = None


class BulkImportStatistics(BaseModel):
    """Statistics for bulk import operation"""
    total_files: int
    successful_files: int
    failed_files: int
    
    # Aggregated stats across all successful imports
    total_notes_created: int = 0
    total_notes_skipped: int = 0
    total_labels_created: int = 0
    total_labels_linked: int = 0
    total_media_created: int = 0
    total_checklist_items_created: int = 0
    
    # Individual file results
    file_results: List[FileImportResult]
    
    # Detailed failures
    failures: List[FileImportFailure]
    
    # Failure report info
    failure_report_available: bool
    failure_report_filename: Optional[str] = None
    
    # Processing info
    processing_started_at: datetime
    processing_completed_at: datetime
    processing_duration_seconds: float


class BulkImportResponse(BaseModel):
    """Response for bulk import endpoint"""
    success: bool
    message: str
    statistics: BulkImportStatistics
    failure_report_url: Optional[str] = None