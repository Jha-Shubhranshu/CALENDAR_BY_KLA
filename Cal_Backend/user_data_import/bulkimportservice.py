from typing import List, Tuple
from datetime import datetime, timezone
from sqlmodel.ext.asyncio.session import AsyncSession
from fastapi import UploadFile
import json
import traceback
from io import StringIO
import tempfile
import os

from Cal_Backend.db.models import User
from .keep_service import GoogleKeepImportService
from .notesimportschemas import GoogleKeepNote, ImportStatistics
from .bulkimportschemas import (
    BulkImportStatistics,
    FileImportResult,
    FileImportFailure
)


class BulkImportService:
    """Service for bulk importing Google Keep notes from multiple JSON files"""
    
    def __init__(self, session: AsyncSession, user: User):
        self.session = session
        self.user = user
        self.user_id = user.id  
        self.bulk_stats = None
        self.start_time = None
        self.end_time = None
    
    async def import_multiple_files(
        self, 
        files: List[UploadFile]
    ) -> Tuple[BulkImportStatistics, str]:
        """
        Import notes from multiple JSON files.
        
        Returns:
            - BulkImportStatistics with aggregated results
            - Path to failure report file (if any failures occurred)
        """
        self.start_time = datetime.now(timezone.utc)
        
        print(f"\n{'='*60}")
        print(f"BULK IMPORT STARTED")
        print(f"{'='*60}")
        print(f"User: {self.user.email}")
        print(f"Total files: {len(files)}")
        print(f"Started at: {self.start_time.isoformat()}")
        
        # Initialize statistics
        file_results: List[FileImportResult] = []
        failures: List[FileImportFailure] = []
        
        # Aggregated counters
        total_notes_created = 0
        total_notes_skipped = 0
        total_labels_created = 0
        total_labels_linked = 0
        total_media_created = 0
        total_checklist_items_created = 0
        
        successful_files = 0
        failed_files = 0
        
        # Process each file independently
        for idx, file in enumerate(files, 1):
            print(f"\n{'-'*60}")
            print(f"Processing file {idx}/{len(files)}: {file.filename}")
            print(f"{'-'*60}")
            
            try:
                # Process single file
                result, stats = await self._process_single_file(file)
                
                file_results.append(result)
                
                if result.success:
                    successful_files += 1
                    
                    # Aggregate statistics
                    total_notes_created += stats.notes_created
                    total_notes_skipped += stats.notes_skipped
                    total_labels_created += stats.labels_created
                    total_labels_linked += stats.labels_linked
                    total_media_created += stats.media_created
                    total_checklist_items_created += stats.checklist_items_created
                    
                    print(f"✓ SUCCESS: Imported {stats.notes_created} notes")
                else:
                    failed_files += 1
                    print(f"✗ FAILED: {result.error}")
                    
            except Exception as e:
                # Catch any unexpected errors
                failed_files += 1
                error_msg = str(e)
                tb = traceback.format_exc()
                
                print(f"✗ UNEXPECTED ERROR: {error_msg}")
                print(f"Traceback:\n{tb}")
                
                # Record failure
                file_results.append(FileImportResult(
                    filename=file.filename,
                    success=False,
                    error=f"Unexpected error: {error_msg}"
                ))
                
                failures.append(FileImportFailure(
                    filename=file.filename,
                    error_type=type(e).__name__,
                    error_message=error_msg,
                    timestamp=datetime.now(timezone.utc),
                    traceback=tb
                ))
                
                # Rollback this file's transaction
                await self.session.rollback()
                continue
        
        self.end_time = datetime.now(timezone.utc)
        duration = (self.end_time - self.start_time).total_seconds()
        
        # Create bulk statistics
        bulk_stats = BulkImportStatistics(
            total_files=len(files),
            successful_files=successful_files,
            failed_files=failed_files,
            total_notes_created=total_notes_created,
            total_notes_skipped=total_notes_skipped,
            total_labels_created=total_labels_created,
            total_labels_linked=total_labels_linked,
            total_media_created=total_media_created,
            total_checklist_items_created=total_checklist_items_created,
            file_results=file_results,
            failures=failures,
            failure_report_available=len(failures) > 0,
            processing_started_at=self.start_time,
            processing_completed_at=self.end_time,
            processing_duration_seconds=duration
        )
        
        print(f"\n{'='*60}")
        print(f"BULK IMPORT COMPLETED")
        print(f"{'='*60}")
        print(f"Duration: {duration:.2f} seconds")
        print(f"Successful: {successful_files}/{len(files)}")
        print(f"Failed: {failed_files}/{len(files)}")
        print(f"Total notes created: {total_notes_created}")
        print(f"{'='*60}\n")
        
        # Generate failure report if there were failures
        report_path = None
        if failures:
            report_path = await self._generate_failure_report(bulk_stats)
            bulk_stats.failure_report_filename = os.path.basename(report_path)
        
        self.bulk_stats = bulk_stats
        return bulk_stats, report_path
    
    async def _process_single_file(
        self, 
        file: UploadFile
    ) -> Tuple[FileImportResult, ImportStatistics]:
        """
        Process a single JSON file.
        
        Returns:
            - FileImportResult with success/failure info
            - ImportStatistics from the import service
        """
        filename = file.filename
        
        try:
            # Read file content
            content = await file.read()
            
            # Parse JSON
            try:
                data = json.loads(content.decode('utf-8'))
            except json.JSONDecodeError as e:
                raise ValueError(f"Invalid JSON format: {str(e)}")
            
            # Normalize data format (handle different structures)
            notes_data = self._normalize_json_structure(data)
            
            # Validate that we have notes
            if not notes_data:
                raise ValueError("No notes found in JSON file")
            
            # Parse into GoogleKeepNote objects
            keep_notes = [GoogleKeepNote(**note) for note in notes_data]
            
            print(f"Parsed {len(keep_notes)} notes from {filename}")
            
            # Create import service for this file
            import_service = GoogleKeepImportService(self.session, self.user)
            
            # Import notes
            stats = await import_service.import_notes(keep_notes)
            
            # Create success result
            result = FileImportResult(
                filename=filename,
                success=True,
                notes_imported=stats.notes_created
            )
            
            return result, stats
            
        except Exception as e:
            # Record failure
            error_msg = str(e)
            tb = traceback.format_exc()
            
            result = FileImportResult(
                filename=filename,
                success=False,
                error=error_msg
            )
            
            # Add to failures list
            failure = FileImportFailure(
                filename=filename,
                error_type=type(e).__name__,
                error_message=error_msg,
                timestamp=datetime.now(timezone.utc),
                traceback=tb
            )
            
            # Create empty stats for failed import
            empty_stats = ImportStatistics()
            
            return result, empty_stats
    
    def _normalize_json_structure(self, data) -> List[dict]:
        """
        Normalize different JSON structures to a list of note dictionaries.
        
        Handles:
        - {"notes": [...]} - Wrapped format
        - [...] - Array of notes
        - {...} - Single note object
        """
        if isinstance(data, dict):
            if "notes" in data and isinstance(data["notes"], list):
                # Already wrapped format
                return data["notes"]
            else:
                # Single note object - wrap in array
                return [data]
        elif isinstance(data, list):
            # Array of notes
            return data
        else:
            raise ValueError(f"Unexpected JSON structure: {type(data)}")
    
    async def _generate_failure_report(
        self, 
        stats: BulkImportStatistics
    ) -> str:
        """
        Generate a downloadable failure report.
        
        Returns path to the generated report file.
        """
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        filename = f"import_failures_{timestamp}.txt"
        
        # Create temporary file
        temp_dir = tempfile.gettempdir()
        report_path = os.path.join(temp_dir, filename)
        
        with open(report_path, 'w', encoding='utf-8') as f:
            # Header
            f.write("="*70 + "\n")
            f.write("GOOGLE KEEP IMPORT - FAILURE REPORT\n")
            f.write("="*70 + "\n\n")
            
            f.write(f"Generated: {datetime.now(timezone.utc).isoformat()}\n")
            f.write(f"User: {self.user.email}\n\n")
            
            # Summary
            f.write("-"*70 + "\n")
            f.write("SUMMARY\n")
            f.write("-"*70 + "\n")
            f.write(f"Total Files Processed: {stats.total_files}\n")
            f.write(f"Successful: {stats.successful_files}\n")
            f.write(f"Failed: {stats.failed_files}\n")
            f.write(f"Success Rate: {(stats.successful_files/stats.total_files*100):.1f}%\n\n")
            
            # Failed files list
            f.write("-"*70 + "\n")
            f.write("FAILED FILES\n")
            f.write("-"*70 + "\n\n")
            
            for idx, failure in enumerate(stats.failures, 1):
                f.write(f"{idx}. {failure.filename}\n")
                f.write(f"   Error Type: {failure.error_type}\n")
                f.write(f"   Error Message: {failure.error_message}\n")
                if failure.note_title:
                    f.write(f"   Note Title: {failure.note_title}\n")
                f.write(f"   Timestamp: {failure.timestamp.isoformat()}\n")
                f.write("\n")
            
            # Detailed tracebacks
            if any(f.traceback for f in stats.failures):
                f.write("="*70 + "\n")
                f.write("DETAILED TRACEBACKS\n")
                f.write("="*70 + "\n\n")
                
                for idx, failure in enumerate(stats.failures, 1):
                    if failure.traceback:
                        f.write(f"{idx}. {failure.filename}\n")
                        f.write("-"*70 + "\n")
                        f.write(failure.traceback)
                        f.write("\n" + "="*70 + "\n\n")
            
            # Footer
            f.write("\n")
            f.write("="*70 + "\n")
            f.write("END OF REPORT\n")
            f.write("="*70 + "\n")
        
        print(f"Failure report generated: {report_path}")
        return report_path