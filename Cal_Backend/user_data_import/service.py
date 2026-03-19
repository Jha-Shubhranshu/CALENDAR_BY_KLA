from typing import List, Dict, Any
from datetime import datetime, timezone
from uuid import UUID as UUID  # Fix the alias conflict
from sqlmodel.ext.asyncio.session import AsyncSession  # Changed import

from sqlmodel import Session, select
from fastapi import HTTPException, status

from Cal_Backend.db.models import (
    User,
    Conversation,
    Note,
    NotebookSource,
    ContentType,
    MessageRole
)


class ImportService:
    """Service for importing conversation data into the database"""
    
    def __init__(self, session: AsyncSession, user: User):
        self.session = session
        self.user = user
    
    async def import_conversations(self, data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Import conversations from cleaned JSON format
        
        Args:
            data: List of conversation objects with messages
            
        Returns:
            Dictionary with import statistics
        """
        stats = {
            "conversations_created": 0,
            "conversations_updated": 0,
            "notes_created": 0,
            "errors": []
        }
        
        for conv_data in data:
            try:
                await self._import_single_conversation(conv_data, stats)
            except Exception as e:
                stats["errors"].append({
                    "conversation_id": conv_data.get("id"),
                    "title": conv_data.get("title"),
                    "error": str(e)
                })
                continue
        
        # Commit all changes
        try:
            await self.session.commit()
        except Exception as e:
            await self.session.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Database error: {str(e)}"
            )
        
        return stats
    
    async def _import_single_conversation(
        self, 
        conv_data: Dict[str, Any], 
        stats: Dict[str, Any]
    ) -> None:
        """Import a single conversation with its messages"""
        
        # Extract conversation metadata
        original_id = conv_data.get("id")
        title = conv_data.get("title", "Untitled Conversation")
        source = conv_data.get("source", "manual")
        account = conv_data.get("account", "NA")
        created_at = self._parse_datetime(conv_data.get("created_at"))
        updated_at = self._parse_datetime(conv_data.get("updated_at"))
        messages = conv_data.get("messages", [])
        
        # Validate source
        try:
            source_enum = NotebookSource(source.lower())
        except ValueError:
            raise ValueError(f"Invalid source: {source}")
        
        # Check if conversation already exists (by original_id and user)
        result = await self.session.execute(
            select(Conversation).where(
                Conversation.user_id == self.user.id,
                Conversation.original_conversation_id == original_id
            )
        )
        
        existing_conv = result.scalar_one_or_none()  # Changed to scalar_one_or_none()

        
        if existing_conv:
            # Update existing conversation
            existing_conv.title = title
            existing_conv.account = account
            existing_conv.updated_at = updated_at or datetime.now(timezone.utc)
            self.session.add(existing_conv)
            conversation = existing_conv
            stats["conversations_updated"] += 1
            
            # Delete old notes to replace with new ones
            result = await self.session.execute(
                select(Note).where(Note.conversation_id == existing_conv.id)
            ).all()
            old_notes = result.scalars().all()  # Changed to scalars().all()
            for note in old_notes:
                await self.session.delete(note)
        else:
            # Create new conversation
            conversation = Conversation(
                user_id=self.user.id,
                title=title,
                source=source_enum,
                account=account,
                original_conversation_id=original_id,
                import_date=datetime.now(timezone.utc),
                created_at=created_at or datetime.now(timezone.utc),
                updated_at=updated_at or datetime.now(timezone.utc)
            )
            self.session.add(conversation)
            await self.session.flush()  # Get conversation.id
            stats["conversations_created"] += 1
        
        # Import messages
        for msg_data in messages:
            await  self._import_message(msg_data, conversation)
            stats["notes_created"] += 1
    
    async  def _import_message(
        self, 
        msg_data: Dict[str, Any], 
        conversation: Conversation
    ) -> None:
        """Import a single message as a Note"""
        
        # Extract message data
        original_msg_id = msg_data.get("id")
        role = msg_data.get("role", "note")
        content = msg_data.get("content", "")
        content_type = msg_data.get("content_type", "text")
        timestamp = self._parse_datetime(msg_data.get("timestamp"))
        metadata = msg_data.get("metadata", {})
        parent_id = msg_data.get("parent_id")
        
        # Validate enums
        try:
            role_enum = MessageRole(role.lower())
        except ValueError:
            role_enum = MessageRole.NOTE
        
        try:
            content_type_enum = ContentType(content_type.lower())
        except ValueError:
            content_type_enum = ContentType.TEXT
        
        # Create note
        now = datetime.now(timezone.utc)
        
        # Strip timezone from timestamp to match TIMESTAMP WITHOUT TIME ZONE column
        timestamp_naive = timestamp.replace(tzinfo=None) if timestamp.tzinfo else timestamp

        note = Note(
            user_id=self.user.id,
            conversation_id=conversation.id,
            content=content,
            content_type=content_type_enum,
            role=role_enum,
            timestamp=timestamp_naive,
            parent_message_id=self._parse_uuid(parent_id) if parent_id else None,
            metadata=metadata,
            is_categorized=False,  # Newly imported notes are uncategorized
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc)
        )
        
        self.session.add(note)
    
    @staticmethod
    def _parse_datetime(dt_string: Any) -> datetime:
        """Parse datetime string to datetime object"""
        if not dt_string:
            return datetime.now(timezone.utc)
        
        if isinstance(dt_string, datetime):
            return dt_string
        
        try:
            # Try ISO format with Z
            if dt_string.endswith('Z'):
                return datetime.fromisoformat(dt_string.replace('Z', '+00:00'))
            return datetime.fromisoformat(dt_string)
        except (ValueError, AttributeError):
            return datetime.now(timezone.utc)
    
    @staticmethod
    def _parse_uuid(uuid_string: Any) -> UUID:
        """Parse UUID string to UUID object"""
        if not uuid_string:
            return None
        
        if isinstance(uuid_string, UUID):
            return uuid_string
        
        try:
            return UUID(uuid_string)
        except (ValueError, AttributeError):
            return None


def validate_import_data(data: Any) -> List[Dict[str, Any]]:
    """
    Validate import data structure
    
    Args:
        data: Data to validate
        
    Returns:
        Validated data as list of dicts
        
    Raises:
        HTTPException if validation fails
    """
    if not isinstance(data, list):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Import data must be a list of conversations"
        )
    
    if len(data) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Import data is empty"
        )
    
    # Validate each conversation
    for idx, conv in enumerate(data):
        if not isinstance(conv, dict):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Conversation at index {idx} is not a valid object"
            )
        
        # Required fields
        if "title" not in conv:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Conversation at index {idx} missing 'title' field"
            )
        
        if "source" not in conv:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Conversation at index {idx} missing 'source' field"
            )
        
        if "messages" not in conv or not isinstance(conv["messages"], list):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Conversation at index {idx} missing or invalid 'messages' field"
            )
        if "account" not in conv:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Conversation at index {idx} missing 'account' field"
            )
        
        # Validate messages
        for msg_idx, msg in enumerate(conv["messages"]):
            if not isinstance(msg, dict):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Message at index {msg_idx} in conversation '{conv.get('title')}' is not valid"
                )
            
            if "content" not in msg:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Message at index {msg_idx} in conversation '{conv.get('title')}' missing 'content'"
                )
    
    return data