from typing import List, Dict, Optional, Tuple
from uuid import UUID
import uuid
from datetime import datetime, timezone
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select

from Cal_Backend.db.models import (
    User, Note, Label, NoteLabel, Media, ChecklistItem,
    ContentType, MessageRole, MediaType
)
from .notesimportschemas import (
    GoogleKeepNote, GoogleKeepAttachment, GoogleKeepLabel,
    GoogleKeepListItem, ImportStatistics
)

class GoogleKeepImportService:
    """Service for importing Google Keep notes"""
    
    def __init__(self, session: AsyncSession, user: User):
        self.session = session
        self.user = user
        self.user_id = user.id  
        self.stats = ImportStatistics()
        
        # Cache for labels to avoid repeated DB queries
        self._label_cache: Dict[str, UUID] = {}
    
    async def import_notes(self, keep_notes: List[GoogleKeepNote]) -> ImportStatistics:
        """
        Main entry point for importing Google Keep notes.
        
        Returns statistics about the import operation.
        """
        print(f"Starting import of {len(keep_notes)} Google Keep notes")
        
        for idx, keep_note in enumerate(keep_notes):
            try:
                print(f"\n--- Processing note {idx + 1}/{len(keep_notes)}: {keep_note.title} ---")
                
                # Skip trashed notes
                if keep_note.isTrashed:
                    print(f"Skipping trashed note: {keep_note.title}")
                    self.stats.notes_skipped += 1
                    continue
                
                # Create the note
                await self._import_single_note(keep_note)
                
            except Exception as e:
                # Get the full error details
                import traceback
                error_traceback = traceback.format_exc()
                
                error_msg = f"Failed to import note '{keep_note.title}': {type(e).__name__}: {str(e)}"
                print(f"ERROR: {error_msg}")
                print(f"Full traceback:\n{error_traceback}")
                
                self.stats.errors.append(error_msg)
                
                # Rollback the transaction for this note
                await self.session.rollback()
                continue
            
        # Commit all successful changes
        try:
            await self.session.commit()
            print(f"\n=== Import Complete ===")
            print(f"Notes created: {self.stats.notes_created}")
            print(f"Labels created: {self.stats.labels_created}")
            print(f"Media created: {self.stats.media_created}")
            print(f"Checklist items created: {self.stats.checklist_items_created}")
            print(f"Errors: {len(self.stats.errors)}")
        except Exception as e:
            print(f"ERROR during final commit: {str(e)}")
            import traceback
            traceback.print_exc()
            await self.session.rollback()
            raise
        
        return self.stats
    
    async def _import_single_note(self, keep_note: GoogleKeepNote) -> Note:
        """Import a single Google Keep note"""
        
        # 1. Create the base Note
        note = await self._create_note_from_keep(keep_note)
        self.session.add(note)
        await self.session.flush()  # Get the note.id
        
        print(f"Created note with ID: {note.id}")
        
        # 2. Handle labels
        if keep_note.labels:
            await self._handle_labels(note, keep_note.labels)
        
        # 3. Handle attachments
        if keep_note.attachments:
            await self._handle_attachments(note, keep_note.attachments)
        
        # 4. Handle checklist items
        if keep_note.listContent:
            await self._handle_checklist_items(note, keep_note.listContent)
        
        # 5. Handle other metadata (annotations, etc.)
        await self._handle_metadata(note, keep_note)
        
        self.stats.notes_created += 1
        return note
    
    async def _create_note_from_keep(self, keep_note: GoogleKeepNote) -> Note:
        """Convert Google Keep note to our Note model"""
        
        # Convert microseconds to datetime
        created_timestamp = datetime.fromtimestamp(
            keep_note.createdTimestampUsec / 1_000_000,
            tz=timezone.utc
        )
        updated_timestamp = datetime.fromtimestamp(
            keep_note.userEditedTimestampUsec / 1_000_000,
            tz=timezone.utc
        )
        
        # Determine content
        content = keep_note.textContent or ""
        
        # If it's a list note, we'll store list items separately
        # but we can put a summary in content
        if keep_note.listContent:
            content = f"Checklist with {len(keep_note.listContent)} items"
        
        note = Note(
            id=uuid.uuid4(),
            user_id=self.user_id,
            
            # Content
            content=content,
            title=keep_note.title,
            content_type=ContentType.TEXT,
            role=MessageRole.NOTE,
            
            # Keep-specific fields
            is_pinned=keep_note.isPinned,
            is_archived=keep_note.isArchived,
            background_color=keep_note.color if keep_note.color != "DEFAULT" else None,
            
            # Timestamps
            timestamp=created_timestamp,
            created_at=datetime.now(timezone.utc),
            updated_at=updated_timestamp,
            
            # Defaults
            conversation_id=None,
            project_id=None,
            is_categorized=False,
            parent_message_id=None,
            notemetadata={}
        )
        
        return note
    
    async def _handle_labels(self, note: Note, keep_labels: List[GoogleKeepLabel]):
        """Handle label creation and linking"""
        
        for keep_label in keep_labels:
            label_name = keep_label.name
            
            # Check cache first
            if label_name in self._label_cache:
                label_id = self._label_cache[label_name]
                print(f"Using cached label: {label_name}")
            else:
                # Check if label exists in DB
                label_id = await self._get_or_create_label(label_name)
                self._label_cache[label_name] = label_id
            
            # Create the link
            await self._link_note_to_label(note.id, label_id)
    
    async def _get_or_create_label(self, label_name: str) -> UUID:
        """Get existing label or create new one"""

        # Try to find existing label using SQLModel's exec
        statement = select(Label).where(
            Label.user_id == self.user_id,
            Label.name == label_name
        )

        result = await self.session.execute(statement)
        existing_label = result.scalar_one_or_none()

        if existing_label:
            print(f"Found existing label: {label_name} (ID: {existing_label.id})")
            return existing_label.id

        # Create new label
        new_label = Label(
            id=uuid.uuid4(),
            user_id=self.user_id,
            name=label_name,
            color=None,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc)
        )

        self.session.add(new_label)
        await self.session.flush()

        print(f"Created new label: {label_name} (ID: {new_label.id})")
        self.stats.labels_created += 1

        return new_label.id

    
    async def _link_note_to_label(self, note_id: UUID, label_id: UUID):
        """Create NoteLabel junction record"""

        print(f"Attempting to link note {note_id} to label {label_id}")

        try:
            # Check if link already exists
            statement = select(NoteLabel).where(
                NoteLabel.note_id == note_id,
                NoteLabel.label_id == label_id
            )
            result = await self.session.execute(statement)
            existing_link = result.first()

            if existing_link:
                print(f"Label link already exists")
                return

            print(f"Creating new NoteLabel with id...")
            new_id = uuid.uuid4()
            print(f"Generated UUID: {new_id}")

            note_label = NoteLabel(
                id=new_id,
                note_id=note_id,
                label_id=label_id,
                created_at=datetime.now(timezone.utc)
            )

            print(f"NoteLabel object created: {note_label}")

            self.session.add(note_label)
            print(f"Added to session")

            await self.session.flush()
            print(f"Flushed successfully")

            self.stats.labels_linked += 1
            print(f"Linked note to label successfully")

        except Exception as e:
            print(f"ERROR in _link_note_to_label:")
            print(f"  Exception type: {type(e).__name__}")
            print(f"  Exception message: {str(e)}")
            print(f"  note_id: {note_id} (type: {type(note_id)})")
            print(f"  label_id: {label_id} (type: {type(label_id)})")

            import traceback
            traceback.print_exc()
            raise
    
    async def _handle_attachments(
        self, 
        note: Note, 
        attachments: List[GoogleKeepAttachment]
    ):
        """Handle media attachments"""
        
        # Store attachment info in notemetadata
        if note.notemetadata is None:
            note.notemetadata = {}
        
        note.notemetadata["attachments"] = [
            {
                "filePath": att.filePath,
                "mimetype": att.mimetype
            }
            for att in attachments
        ]
        
        # Create Media records
        for idx, attachment in enumerate(attachments):
            await self._create_media_record(note, attachment, idx)
    
    async def _create_media_record(
        self,
        note: Note,
        attachment: GoogleKeepAttachment,
        position: int
    ):
        """Create a Media record for an attachment"""
        
        # Determine media type from mimetype
        mime = attachment.mimetype.lower()
        if mime.startswith('image/'):
            media_type = MediaType.IMAGE
        elif mime.startswith('audio/'):
            media_type = MediaType.AUDIO
        elif mime.startswith('video/'):
            media_type = MediaType.VIDEO
        else:
            media_type = MediaType.DOCUMENT
        
        # Extract filename from path
        filename = attachment.filePath.split('/')[-1]
        
        media = Media(
            id=uuid.uuid4(),
            note_id=note.id,
            user_id=self.user_id,
            file_path=attachment.filePath,
            file_type=media_type,
            file_size=0,  # We don't have this info from Keep export
            mime_type=attachment.mimetype,
            original_filename=filename,
            position_index=position,
            created_at=datetime.now(timezone.utc)
        )
        
        self.session.add(media)
        self.stats.media_created += 1
        print(f"Created media record: {filename}")
    
    async def _handle_checklist_items(
        self,
        note: Note,
        list_content: List[GoogleKeepListItem]
    ):
        """Create ChecklistItem records"""
        
        for idx, item in enumerate(list_content):
            checklist_item = ChecklistItem(
                id=uuid.uuid4(),
                note_id=note.id,
                text=item.text,
                is_checked=item.isChecked,
                position_index=idx,
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc)
            )
            
            self.session.add(checklist_item)
            self.stats.checklist_items_created += 1
        
        print(f"Created {len(list_content)} checklist items")
    
    async def _handle_metadata(self, note: Note, keep_note: GoogleKeepNote):
        """Store additional metadata that doesn't fit elsewhere"""
        
        if note.notemetadata is None:
            note.notemetadata = {}
        
        # Store annotations if present
        if keep_note.annotations:
            note.notemetadata["annotations"] = keep_note.annotations
            print(f"Stored {len(keep_note.annotations)} annotations in metadata")
        
        # Store original Keep color for reference
        note.notemetadata["original_keep_color"] = keep_note.color
        
        # Flag this as imported from Keep
        note.notemetadata["import_source"] = "google_keep"
        note.notemetadata["import_date"] = datetime.now(timezone.utc).isoformat()