from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, status
from sqlmodel import Session
from typing import List, Dict, Any
import json
from sqlmodel.ext.asyncio.session import AsyncSession 
import os
from fastapi.responses import FileResponse

from Cal_Backend.db.main import get_session
from Cal_Backend.db.models import User
from Cal_Backend.auth.dependencies import get_current_userC
from .service import ImportService, validate_import_data
from Cal_Backend.Conversations.schemas import ConversationResponse

from .schemas import ImportResponse

from Cal_Backend.auth.dependencies import AccessTokenBearerC

# Add to existing router.py
from .notesimportschemas import GoogleKeepImportRequest, ImportStatistics
from .keep_service import GoogleKeepImportService

from .bulkimportservice import BulkImportService
from .bulkimportschemas import BulkImportResponse, BulkImportStatistics


Json_router = APIRouter()
ACCESS_TOKEN_BEARER = AccessTokenBearerC()


@Json_router.post("/json", response_model=Dict[str, Any])
async def import_from_json(data: List[Dict[str, Any]],current_user: User = Depends(get_current_userC),session: AsyncSession = Depends(get_session)):
    """Import conversations from cleaned JSON data"""
    
    try:
        print(f"=== IMPORT STARTED ===")
        print(f"User: {current_user.email}")
        print(f"Data received: {len(data)} conversations")
        print(f"First conversation: {data[0].get('title') if data else 'None'}")
        
        # Validate data structure
        validated_data = validate_import_data(data)
        print("Data validation passed")
        
        # Create import service - use sync session for now
        # You'll need to make ImportService async or run in executor
        import_service = ImportService(session, current_user)
        
        # Import conversations
        stats =  await import_service.import_conversations(validated_data)
        
        print(f"=== IMPORT COMPLETED ===")
        print(f"Stats: {stats}")
        
        return {
            "success": True,
            "statistics": stats,
            "message": f"Imported {stats['conversations_created']} conversations and {stats['notes_created']} notes"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"=== IMPORT ERROR ===")
        print(f"Error type: {type(e).__name__}")
        print(f"Error message: {str(e)}")
        import traceback
        traceback.print_exc()
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Import failed: {str(e)}"
        )


@Json_router.post("/upload", response_model=Dict[str, Any])
async def import_from_file( file: UploadFile = File(...), current_user: User = Depends(get_current_userC), session: Session = Depends(get_session)):
    """
    Import conversations from uploaded JSON file
    
    Upload a .json file containing the cleaned conversation data
    """
    # Validate file type
    if not file.filename.endswith('.json'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only JSON files are accepted"
        )
    
    # Read and parse file
    try:
        content = await file.read()
        data = json.loads(content.decode('utf-8'))
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid JSON file"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error reading file: {str(e)}"
        )
    
    # Validate data structure
    validated_data = validate_import_data(data)
    
    # Create import service
    import_service = ImportService(session, current_user)
    
    # Import conversations
    stats = import_service.import_conversations(validated_data)
    
    return {
        "success": True,
        "filename": file.filename,
        "statistics": stats,
        "message": f"Imported {stats['conversations_created']} new conversations and {stats['notes_created']} notes"
    }


@Json_router.post("/source/{source}", response_model=Dict[str, Any])
async def import_by_source( source: str, data: List[Dict[str, Any]], current_user: User = Depends(get_current_userC), session: Session = Depends(get_session)):
    """
    Import conversations for a specific source (claude, chatgpt, etc.)
    
    Automatically sets the source field for all conversations
    """
    # Validate source
    valid_sources = ["claude", "chatgpt", "perplexity", "google_keep", "manual"]
    if source.lower() not in valid_sources:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid source. Must be one of: {', '.join(valid_sources)}"
        )
    
    # Set source for all conversations
    for conv in data:
        conv["source"] = source.lower()
    
    # Validate data structure
    validated_data = validate_import_data(data)
    
    # Create import service
    import_service = ImportService(session, current_user)
    
    # Import conversations
    stats = import_service.import_conversations(validated_data)
    
    return {
        "success": True,
        "source": source,
        "statistics": stats,
        "message": f"Imported {stats['conversations_created']} new {source} conversations and {stats['notes_created']} notes"
    }


@Json_router.get("/history", response_model=List[ConversationResponse])
async def get_import_history( source: str = None, limit: int = 50, offset: int = 0, current_user: User = Depends(get_current_userC), session: Session = Depends(get_session)):
    """
    Get import history for the current user
    
    Optionally filter by source
    """
    from sqlmodel import select, func
    from Cal_Backend.db.models import Conversation, Note
    
    # Build query
    statement = select(Conversation).where(Conversation.user_id == current_user.id)
    
    if source:
        from Cal_Backend.db.models import NotebookSource
        try:
            source_enum = NotebookSource(source.lower())
            statement = statement.where(Conversation.source == source_enum)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid source: {source}"
            )
    
    # Order by import date descending
    statement = statement.order_by(Conversation.import_date.desc())
    statement = statement.offset(offset).limit(limit)
    
    # Execute query
    conversations = session.exec(statement).all()
    
    # Add note count to each conversation
    result = []
    for conv in conversations:
        note_count = session.exec(
            select(func.count(Note.id)).where(Note.conversation_id == conv.id)
        ).one()
        
        conv_dict = ConversationResponse.model_validate(conv).model_dump()
        conv_dict["note_count"] = note_count
        result.append(ConversationResponse(**conv_dict))
    
    return result


@Json_router.post("/google-keep", response_model=ImportStatistics)
async def import_google_keep( request: GoogleKeepImportRequest, current_user: User = Depends(get_current_userC), session: AsyncSession = Depends(get_session)):
    """
    Import notes from Google Keep export JSON
    
    Upload the takeout JSON file from Google Keep
    """
    try:
        print(f"=== GOOGLE KEEP IMPORT STARTED ===")
        print(f"User: {current_user.email}")
        print(f"Notes to import: {len(request.notes)}")
        
        # Create service
        service = GoogleKeepImportService(session, current_user)
        
        # Import notes
        stats = await service.import_notes(request.notes)
        
        print(f"=== IMPORT COMPLETED ===")
        return stats
        
    except Exception as e:
        print(f"=== IMPORT ERROR ===")
        print(f"Error: {str(e)}")
        import traceback
        traceback.print_exc()
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Import failed: {str(e)}"
        )

@Json_router.post("/google-keep/file", response_model=ImportStatistics)
async def import_google_keep_file( file: UploadFile = File(...), current_user: User = Depends(get_current_userC), session: AsyncSession = Depends(get_session)):
    """
    Import Google Keep notes from uploaded JSON file
    """
    # Validate file type
    if not file.filename.endswith('.json'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only JSON files are accepted"
        )
    
    try:
        # Read and parse file
        content = await file.read()
        data = json.loads(content.decode('utf-8'))
        
        # Validate structure
        request = GoogleKeepImportRequest(notes=data)
        
        # Create service and import
        service = GoogleKeepImportService(session, current_user)
        stats = await service.import_notes(request.notes)
        
        return stats
        
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid JSON file"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Import failed: {str(e)}"
        )









#-----------------bulk-----------------

@Json_router.post("/google-keep/bulk", response_model=BulkImportResponse)
async def bulk_import_google_keep(
    files: List[UploadFile] = File(..., description="Multiple JSON files from Google Keep export"),
    current_user: User = Depends(get_current_userC),
    session: AsyncSession = Depends(get_session)
):
    """
    Bulk import Google Keep notes from multiple JSON files.
    
    - Accepts multiple .json files simultaneously
    - Processes each file independently
    - Returns aggregated statistics and failure report
    - Failed files don't block successful imports
    
    Example usage:
    ```python
    files = [
        ('files', open('notes1.json', 'rb')),
        ('files', open('notes2.json', 'rb')),
        ('files', open('notes3.json', 'rb'))
    ]
    response = requests.post(url, files=files)
    ```
    """
    # Validate that files were uploaded
    if not files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No files provided. Please upload at least one JSON file."
        )
    
    # Validate file types
    invalid_files = [f.filename for f in files if not f.filename.endswith('.json')]
    if invalid_files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file types: {', '.join(invalid_files)}. Only .json files are accepted."
        )
    
    try:
        print(f"\n{'='*70}")
        print(f"BULK IMPORT API CALLED")
        print(f"{'='*70}")
        print(f"User: {current_user.email}")
        print(f"Files received: {len(files)}")
        print(f"Filenames: {[f.filename for f in files]}")
        
        # Create bulk import service
        service = BulkImportService(session, current_user)
        
        # Process all files
        stats, report_path = await service.import_multiple_files(files)
        
        # Determine success based on whether any files succeeded
        overall_success = stats.successful_files > 0
        
        # Create response message
        if stats.failed_files == 0:
            message = f"All {stats.total_files} files imported successfully! Created {stats.total_notes_created} notes."
        elif stats.successful_files == 0:
            message = f"All {stats.total_files} files failed to import. See failure report for details."
        else:
            message = (
                f"Partial success: {stats.successful_files}/{stats.total_files} files imported. "
                f"Created {stats.total_notes_created} notes. "
                f"{stats.failed_files} files failed - see failure report."
            )
        
        # Generate failure report URL if available
        failure_report_url = None
        if report_path and os.path.exists(report_path):
            # Create download URL
            report_filename = os.path.basename(report_path)
            failure_report_url = f"/api/v1/ArjunJson/google-keep/bulk/download-report/{report_filename}"
        
        response = BulkImportResponse(
            success=overall_success,
            message=message,
            statistics=stats,
            failure_report_url=failure_report_url
        )
        
        print(f"\n{'='*70}")
        print(f"BULK IMPORT API RESPONSE")
        print(f"{'='*70}")
        print(f"Overall success: {overall_success}")
        print(f"Message: {message}")
        print(f"Report URL: {failure_report_url}")
        print(f"{'='*70}\n")
        
        return response
        
    except Exception as e:
        print(f"\n{'='*70}")
        print(f"BULK IMPORT ERROR")
        print(f"{'='*70}")
        print(f"Error type: {type(e).__name__}")
        print(f"Error message: {str(e)}")
        
        import traceback
        traceback.print_exc()
        
        # Rollback any pending transactions
        await session.rollback()
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Bulk import failed: {str(e)}"
        )


@Json_router.get("/google-keep/bulk/download-report/{filename}")
async def download_failure_report(
    filename: str,
    current_user: User = Depends(get_current_userC)
):
    """
    Download the failure report for a bulk import.
    
    The report contains:
    - Summary of failures
    - Numbered list of failed files
    - Detailed error messages
    - Full tracebacks for debugging
    """
    import tempfile
    
    # Security: validate filename format
    if not filename.startswith("import_failures_") or not filename.endswith(".txt"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid report filename"
        )
    
    # Get report path
    temp_dir = tempfile.gettempdir()
    report_path = os.path.join(temp_dir, filename)
    
    # Check if file exists
    if not os.path.exists(report_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report file not found. It may have expired."
        )
    
    # Return file for download
    return FileResponse(
        path=report_path,
        media_type="text/plain",
        filename=filename,
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )


@Json_router.get("/google-keep/bulk/status")
async def get_bulk_import_status(
    current_user: User = Depends(get_current_userC),
    session: AsyncSession = Depends(get_session)
):
    """
    Get statistics about bulk imports for the current user.
    
    Returns aggregated stats across all bulk imports.
    """
    from sqlmodel import select, func
    from Cal_Backend.db.models import Note
    
    # Get total notes count for user
    statement = select(func.count(Note.id)).where(Note.user_id == current_user.id)
    result = await session.execute(statement)
    total_notes = result.scalar_one()
    
    # Get notes imported from Google Keep
    statement = select(func.count(Note.id)).where(
        Note.user_id == current_user.id,
        Note.notemetadata["import_source"].astext == "google_keep"
    )
    result = await session.execute(statement)
    keep_notes = result.scalar_one()
    
    return {
        "total_notes": total_notes,
        "google_keep_notes": keep_notes,
        "other_notes": total_notes - keep_notes
    }