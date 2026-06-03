import base64
import re
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from Cal_Backend.storage.s3 import upload_media
from uuid import UUID as UUID  # Fix the alias conflict
from sqlmodel.ext.asyncio.session import AsyncSession  # Changed import

from sqlmodel import Session, select, and_
from sqlalchemy.orm import aliased
from fastapi import HTTPException, status

from Cal_Backend.db.models import (
    User,
    Conversation,
    Note,
    NotebookSource,
    ContentType,
    MessageRole,
    Media,
    MediaType
)


class ImportService:
    """Service for importing conversation data into the database"""
    
    def __init__(self, session: AsyncSession, user: User):
        self.session = session
        self.user = user
    
    async def import_conversations(self, data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Import conversations from cleaned JSON format
        """
        print(f">>> SERVICE: import_conversations starting for {len(data)} items")
        stats = {
            "conversations_created": 0,
            "conversations_updated": 0,
            "notes_created": 0,
            "notes_skipped": 0,
            "errors": []
        }
        
        for conv_data in data:
            try:
                res = await self.ingest_conversation(conv_data)
                if res["conversation_created"]:
                    stats["conversations_created"] += 1
                if res["conversation_updated"]:
                    stats["conversations_updated"] += 1
                stats["notes_created"] += res["notes_created"]
                stats["notes_skipped"] += res["notes_skipped"]
            except Exception as e:
                import traceback
                print(f">>> SERVICE: Error ingesting conversation: {str(e)}")
                traceback.print_exc()
                stats["errors"].append({
                    "conversation_id": conv_data.get("id"),
                    "title": conv_data.get("title"),
                    "error": str(e)
                })
                # Rollback current conversation to avoid "PendingRollbackError" for next one
                await self.session.rollback()
                continue
        
        # Final commit
        try:
            await self.session.commit()
            print(">>> SERVICE: Database commit successful")
        except Exception as e:
            print(f">>> SERVICE: Database commit failed: {str(e)}")
            await self.session.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Database error: {str(e)}"
            )
        
        return stats

    async def ingest_conversation(self, conv_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Ingest a conversation with deduplication based on first prompt/response pair.
        Used by extension and import pathways.
        """
        print(f">>> SERVICE: ingest_conversation for '{conv_data.get('title', 'Untitled')}'")
        stats = {
            "conversation_created": False,
            "conversation_updated": False,
            "notes_created": 0,
            "notes_skipped": 0
        }

        # Handle nested extension payload or flat import payload
        if "conversation" in conv_data:
            # Extension payload
            ext_conv = conv_data["conversation"]
            title = ext_conv.get("title", "Untitled Conversation")
            
            # Intelligent source detection for extension
            source_raw = conv_data.get("source", "manual").lower()
            url = ext_conv.get("url", "")
            
            if "claude.ai" in url:
                source = "claude"
            elif "chatgpt.com" in url or "openai.com" in url:
                source = "chatgpt"
            elif "perplexity.ai" in url:
                source = "perplexity"
            else:
                source = source_raw if source_raw != "extension" else "manual"

            account = conv_data.get("account_email", "NA")
            messages = ext_conv.get("messages", [])
            original_id = ext_conv.get("conversation_id")
            
            # Extension metadata might be useful
            ext_metadata = conv_data.get("metadata", {})
            scraped_at = conv_data.get("scraped_at")
            if isinstance(scraped_at, datetime):
                ext_metadata["scraped_at"] = scraped_at.isoformat()
            else:
                ext_metadata["scraped_at"] = scraped_at
            ext_metadata["url"] = url
        else:
            # Flat import payload
            title = conv_data.get("title", "Untitled Conversation")
            source = conv_data.get("source", "manual")
            account = conv_data.get("account", "NA")
            messages = conv_data.get("messages", [])
            original_id = conv_data.get("id") or conv_data.get("original_conversation_id")
            ext_metadata = conv_data.get("metadata", {})
        
        if not messages:
            return stats

        existing_conv = None
        
        # 1. Try matching by original_conversation_id if present
        if original_id:
            result = await self.session.execute(
                select(Conversation).where(
                    Conversation.user_id == self.user.id,
                    Conversation.original_conversation_id == original_id
                )
            )
            existing_conv = result.scalar_one_or_none()

        # 2. Fallback to matching by first prompt/response pair
        if not existing_conv:
            # Find first prompt/response pair in incoming data
            first_prompt = next((m for m in messages if m.get("role") == MessageRole.USER), None)
            first_response = None
            if first_prompt:
                prompt_idx = messages.index(first_prompt)
                first_response = next((m for m in messages[prompt_idx+1:] if m.get("role") == MessageRole.ASSISTANT), None)

            if first_prompt and first_response:
                # Optimized matching: find conversation where BOTH first prompt and first response match
                # using aliased Note tables to join twice
                N1 = aliased(Note)
                N2 = aliased(Note)
                
                stmt = (
                    select(Conversation)
                    .join(N1, Conversation.id == N1.conversation_id)
                    .join(N2, Conversation.id == N2.conversation_id)
                    .where(
                        Conversation.user_id == self.user.id,
                        N1.role == MessageRole.USER,
                        N1.content == first_prompt.get("content"),
                        N2.role == MessageRole.ASSISTANT,
                        N2.content == first_response.get("content")
                    )
                    .limit(1)
                )
                
                result = await self.session.execute(stmt)
                existing_conv = result.scalar_one_or_none()

        if existing_conv:
            # Update title, account, and SOURCE if changed
            if title and title != "Untitled Conversation":
                existing_conv.title = title
            if account and account != "NA":
                existing_conv.account = account
            
            # Use latest message timestamp as updated_at for chronological ordering
            if messages:
                # Find the maximum timestamp among all messages
                timestamps = [self._parse_datetime(m.get("timestamp")) for m in messages if m.get("timestamp")]
                if timestamps:
                    latest_msg_time = max(timestamps)
                    # Strip timezone for naive TIMESTAMP column
                    existing_conv.updated_at = latest_msg_time.replace(tzinfo=None) if latest_msg_time.tzinfo else latest_msg_time

            # CRITICAL: Force update the source to the detected one
            try:
                source_enum = NotebookSource(source.lower())
                existing_conv.source = source_enum
            except ValueError:
                pass
            
            # Deduplicate messages
            # Get existing notes for this conversation
            notes_stmt = select(Note).where(Note.conversation_id == existing_conv.id).order_by(Note.timestamp.asc())
            notes_result = await self.session.execute(notes_stmt)
            existing_notes = notes_result.scalars().all()
            
            existing_contents = {(n.role, n.content) for n in existing_notes}
            
            # If the conversation exists but has NO notes (failed previous run), 
            # we should import everything
            force_import = len(existing_notes) == 0
            
            for msg_data in messages:
                role = msg_data.get("role")
                content = msg_data.get("content")
                
                if force_import or (role, content) not in existing_contents:
                    await self._import_message(msg_data, existing_conv)
                    stats["notes_created"] += 1
                else:
                    stats["notes_skipped"] += 1
            
            # Update metadata if extension provided new info
            if ext_metadata:
                if not existing_conv.convmetadata:
                    existing_conv.convmetadata = ext_metadata
                else:
                    existing_conv.convmetadata.update(ext_metadata)
            
            self.session.add(existing_conv)
            stats["conversation_updated"] = True
        else:
            # Create new conversation
            try:
                source_enum = NotebookSource(source.lower())
            except ValueError:
                source_enum = NotebookSource.MANUAL

            # Use latest message timestamp as updated_at, first as created_at
            now_naive = datetime.now(timezone.utc).replace(tzinfo=None)
            created_at = now_naive
            updated_at = now_naive
            
            if messages:
                timestamps = [self._parse_datetime(m.get("timestamp")) for m in messages if m.get("timestamp")]
                if timestamps:
                    first_time = min(timestamps)
                    latest_time = max(timestamps)
                    created_at = first_time.replace(tzinfo=None) if first_time.tzinfo else first_time
                    updated_at = latest_time.replace(tzinfo=None) if latest_time.tzinfo else latest_time

            conversation = Conversation(
                user_id=self.user.id,
                title=title,
                source=source_enum,
                account=account,
                original_conversation_id=original_id,
                convmetadata=ext_metadata,
                import_date=datetime.now(timezone.utc).replace(tzinfo=None), # Consistent naive
                created_at=created_at,
                updated_at=updated_at
            )
            self.session.add(conversation)
            await self.session.flush()
            
            for msg_data in messages:
                await self._import_message(msg_data, conversation)
                stats["notes_created"] += 1
            
            stats["conversation_created"] = True

        await self.session.commit()
        return stats

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
        
        # Merge extension images into metadata if they exist
        # Extension puts them in metadata.images OR msg_data.images
        metadata = msg_data.get("metadata", {})
        
        # Ensure images list is preserved in metadata
        images = msg_data.get("images") or metadata.get("images")
        if images:
            metadata["images"] = images
            
        parent_id = msg_data.get("parent_id")
        
        # Validate enums - Force user/assistant roles for extension/import data
        role_lower = role.lower()
        if "user" in role_lower or "human" in role_lower:
            role_enum = MessageRole.USER
        elif "assistant" in role_lower or "ai" in role_lower or "model" in role_lower:
            role_enum = MessageRole.ASSISTANT
        else:
            # Default to USER for unknown extension roles to ensure visibility 
            # as a conversation message, but ideally this shouldn't happen.
            role_enum = MessageRole.USER
        
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
            notemetadata=metadata,
            is_categorized=False,  # Newly imported notes are uncategorized
            # CRITICAL: Prevent these from showing up as general "Notes" in calendar/grid
            is_archived=True,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc)
        )
        
        self.session.add(note)
        await self.session.flush()

        # Handle images -> Media table (S3 storage)
        if images:
            for idx, img in enumerate(images):
                img_data = img.get("data")
                if not img_data:
                    continue

                try:
                    # Decode base64
                    if "," in img_data:
                        prefix, img_data = img_data.split(",", 1)
                    else:
                        prefix = ""
                    
                    binary_content = base64.b64decode(img_data)
                    
                    # Determine mime type from prefix or default
                    mime_type = "image/png"
                    if "image/" in prefix:
                        # Extract from 'data:image/png;base64'
                        mime_type = prefix.split(":")[1].split(";")[0]
                    
                    # Generate S3 Key
                    filename = img.get("filename") or f"image_{idx}.png"
                    # Clean filename
                    safe_filename = "".join([c if c.isalnum() or c in "._-" else "_" for c in filename])
                    s3_key = f"media/{self.user.id}/{note.id}/{idx}_{safe_filename}"
                    
                    # Upload to S3
                    success = await upload_media(binary_content, s3_key, content_type=mime_type)
                    
                    if success:
                        media = Media(
                            note_id=note.id,
                            user_id=self.user.id,
                            file_path=s3_key,
                            file_type=MediaType.IMAGE,
                            file_size=len(binary_content),
                            mime_type=mime_type,
                            original_filename=filename,
                            position_index=idx
                        )
                        self.session.add(media)
                    else:
                        print(f">>> SERVICE: Failed to upload image to S3 for note {note.id}")
                except Exception as e:
                    print(f">>> SERVICE: Error processing image for S3: {e}")
    
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


def normalize_claude_native(conversation: Dict[str, Any]) -> Dict[str, Any]:
    """
    Normalizes a Claude native export conversation object to the internal format.
    Matches logic from claude2json.py.
    """
    # 1. Basic fields
    normalized = {
        "id": conversation.get("uuid", ""),
        "title": conversation.get("name") or conversation.get("summary") or "Untitled Claude Conversation",
        "source": "claude",
        "created_at": conversation.get("created_at", ""),
        "updated_at": conversation.get("updated_at", ""),
        "messages": []
    }

    # 2. Account field
    account_raw = conversation.get("account")
    if isinstance(account_raw, dict):
        normalized["account"] = account_raw.get("email_address") or account_raw.get("uuid") or "NA"
    else:
        normalized["account"] = account_raw or "NA"

    # 3. Process chat messages
    for msg in conversation.get("chat_messages", []):
        # Skip if no meaningful content
        if not msg.get("text") and not msg.get("content"):
            continue
            
        sender = msg.get("sender", "")
        # Normalize role
        role = "user" if sender == "human" else "assistant"
        
        # Extract main content and detect type
        message_obj = {
            "id": msg.get("uuid", ""),
            "role": role,
            "content": "",
            "content_type": "text",
            "timestamp": msg.get("created_at", ""),
            "metadata": {},
            "parent_id": msg.get("parent_message_uuid")
        }
        
        # Process content blocks
        content_parts = []
        has_artifact = False
        artifact_info = {}
        citations = []
        
        content_blocks = msg.get("content", [])
        if not content_blocks and msg.get("text"):
            # Fallback if content list is missing but text field exists
            content_parts.append(msg.get("text"))
        else:
            for block in content_blocks:
                block_type = block.get("type", "")
                
                if block_type == "text":
                    text_content = block.get("text", "")
                    if text_content:
                        content_parts.append(text_content)
                    
                    # Collect citations if present
                    block_citations = block.get("citations", [])
                    if block_citations:
                        citations.extend(block_citations)
                
                elif block_type == "tool_use":
                    # Check if it's an artifact
                    tool_name = block.get("name", "")
                    if tool_name == "artifacts":
                        has_artifact = True
                        tool_input = block.get("input", {})
                        
                        artifact_info = {
                            "title": tool_input.get("title", ""),
                            "language": tool_input.get("language", ""),
                            "artifact_type": tool_input.get("type", "")
                        }
                        
                        # Add artifact content
                        artifact_content = tool_input.get("content", "")
                        if artifact_content:
                            content_parts.append(f"\n\n```{artifact_info.get('language', '')}\n{artifact_content}\n```")
        
        # Combine all content parts
        message_obj["content"] = "\n".join(content_parts)
        
        # Determine content type
        if has_artifact:
            if artifact_info.get("artifact_type") == "application/vnd.ant.code":
                message_obj["content_type"] = "code"
            else:
                message_obj["content_type"] = "artifact"
            
            # Add metadata
            if artifact_info.get("language"):
                message_obj["metadata"]["language"] = artifact_info["language"]
            if artifact_info.get("title"):
                message_obj["metadata"]["title"] = artifact_info["title"]
        elif "```" in message_obj["content"]:
            message_obj["content_type"] = "code"
            # Try to extract language from code block
            match = re.search(r'```(\w+)', message_obj["content"])
            if match:
                message_obj["metadata"]["language"] = match.group(1)
        
        # Add citations if any
        if citations:
            message_obj["metadata"]["citations"] = citations
        
        # Only add if has content
        if message_obj["content"].strip():
            normalized["messages"].append(message_obj)
    
    return normalized


def validate_import_data(data: Any) -> List[Dict[str, Any]]:
    """
    Validate import data structure. 
    Strictly requires Claude native schema (uuid, name, chat_messages).
    
    Args:
        data: Data to validate
        
    Returns:
        Normalized data as list of dicts
        
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
    
    normalized_list = []

    # Validate each conversation
    for idx, conv in enumerate(data):
        if not isinstance(conv, dict):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Conversation at index {idx} is not a valid object"
            )
        
        # STRICT REQUIREMENT: Claude Native Format
        # Indicators: has 'chat_messages' AND 'uuid' AND 'name'
        is_claude_native = "chat_messages" in conv and "uuid" in conv and "name" in conv
        
        if not is_claude_native:
            missing_fields = []
            if "uuid" not in conv: missing_fields.append("'uuid'")
            if "name" not in conv: missing_fields.append("'name'")
            if "chat_messages" not in conv: missing_fields.append("'chat_messages'")
            
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Conversation at index {idx} rejected. Missing required Claude native fields: {', '.join(missing_fields)}"
            )

        try:
            # Transform Claude native to internal format
            conv = normalize_claude_native(conv)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to normalize Claude native format at index {idx}: {str(e)}"
            )

        # Final check on normalized output
        if "messages" not in conv or not isinstance(conv["messages"], list):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Conversation at index {idx} resulted in empty or invalid messages after normalization"
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
                    detail=f"Message at index {msg_idx} in conversation '{conv.get('title')}' missing 'content' after normalization"
                )
        
        normalized_list.append(conv)
    
    return normalized_list