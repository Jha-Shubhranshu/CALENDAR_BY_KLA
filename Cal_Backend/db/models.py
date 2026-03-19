from datetime import datetime, timezone
from typing import Optional, List
from enum import Enum
import uuid
from sqlmodel import SQLModel, Field, Relationship, Column, JSON
# from uuid import UUID, uuid4
from uuid import UUID
import sqlalchemy.dialects.postgresql as pg # what else can this special "one instance of use" import of "dialect as pg" do? 
from sqlalchemy import text, UniqueConstraint














# Enums
class NotebookSource(str, Enum):
    CLAUDE = "claude"
    CHATGPT = "chatgpt"
    PERPLEXITY = "perplexity"
    GOOGLE_KEEP = "google_keep"
    MANUAL = "manual"


class ContentType(str, Enum):
    TEXT = "text"
    CODE = "code"
    ARTIFACT = "artifact"
    IMAGE = "image"
    CHECKLIST = "checklist"


class MessageRole(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"
    NOTE = "note"


class MediaType(str, Enum):
    IMAGE = "image"
    VIDEO = "video"
    AUDIO = "audio"
    DOCUMENT = "document"


# Junction Tables
class NoteLabel(SQLModel, table=True):
    __tablename__ = "note_labels"
    
    id: UUID = Field(
    default_factory=uuid.uuid4,
    sa_column=Column(
        pg.UUID,
        nullable=False,
        primary_key=True
        )
    )
    note_id: UUID = Field(foreign_key="notes.id", ondelete="CASCADE")
    label_id: UUID = Field(foreign_key="labels.id", ondelete="CASCADE")
    created_at: datetime = Field(
        sa_column=Column(pg.TIMESTAMP(timezone=True), nullable=False),
        default_factory=lambda: datetime.now(timezone.utc)
    )
        
    # Unique constraint on note_id + label_id
    __table_args__ = (
        UniqueConstraint('note_id', 'label_id', name='uix_note_label'),
    )



# Main Models
class User(SQLModel, table=True):
    __tablename__ = "users"
    
    id: UUID = Field(
    default_factory=uuid.uuid4,
    sa_column=Column(
        pg.UUID,
        nullable=False,
        primary_key=True
        )
    )
    email: str = Field(unique=True, index=True, nullable=False)
    username: str = Field(unique=True, index=True, nullable=False)
    first_name: str
    last_name: str

    password_hash: str = Field(nullable=False)
    role: str =Field(sa_column=Column(pg.VARCHAR, nullable=False, server_default="user"))
    is_verified: bool = Field(default=False)
    created_at: datetime = Field(
        sa_column=Column(pg.TIMESTAMP(timezone=True), nullable=False),
        default_factory=lambda: datetime.now(timezone.utc)
    )
    updated_at: datetime = Field(
        sa_column=Column(pg.TIMESTAMP(timezone=True), nullable=False),
        default_factory=lambda: datetime.now(timezone.utc)
    )
    
    # Relationships
    conversations: List["Conversation"] = Relationship(back_populates="user")
    notes: List["Note"] = Relationship(back_populates="user")
    projects: List["Project"] = Relationship(back_populates="user")
    labels: List["Label"] = Relationship(back_populates="user")
    media: List["Media"] = Relationship(back_populates="user")


class Conversation(SQLModel, table=True):
    __tablename__ = "conversations"
    
    id: UUID = Field(
    default_factory=uuid.uuid4,
    sa_column=Column(
        pg.UUID,
        nullable=False,
        primary_key=True
        )
    )
    user_id: UUID = Field(foreign_key="users.id", ondelete="CASCADE", index=True)
    
    # Conversation metadata
    title: str = Field(nullable=False)
    source: NotebookSource = Field(nullable=False, index=True)
    account: str
    
    # Original import data
    original_conversation_id: str = Field(nullable=True)  # ID from source platform
    import_date: datetime = Field(
        sa_column=Column(pg.TIMESTAMP(timezone=True), nullable=False),
        default_factory=lambda: datetime.now(timezone.utc)
    )
    original_filename: Optional[str] = Field(default=None)
    
    # Metadata from original export (JSON field)
    convmetadata: dict = Field(default={}, sa_column=Column(JSON))
    
    created_at: datetime = Field(
        sa_column=Column(pg.TIMESTAMP(timezone=True), nullable=False),
        default_factory=lambda: datetime.now(timezone.utc)
    )
    updated_at: datetime = Field(
        sa_column=Column(pg.TIMESTAMP(timezone=True), nullable=False),
        default_factory=lambda: datetime.now(timezone.utc)
    )
    
    # Relationships
    user: User = Relationship(back_populates="conversations")
    notes: List["Note"] = Relationship(back_populates="conversation")


class Project(SQLModel, table=True):
    __tablename__ = "projects"
    
    id: UUID = Field(
    default_factory=uuid.uuid4,
    sa_column=Column(
        pg.UUID,
        nullable=False,
        primary_key=True
        )
    )
    user_id: UUID = Field(foreign_key="users.id", ondelete="CASCADE", index=True)
    
    title: str = Field(nullable=False)
    description: Optional[str] = Field(default=None)
    color: str = Field(default="#3B82F6")  # Default blue color
    
    created_at: datetime = Field(
        sa_column=Column(pg.TIMESTAMP(timezone=True), nullable=False),
        default_factory=lambda: datetime.now(timezone.utc)
    )
    updated_at: datetime = Field(
        sa_column=Column(pg.TIMESTAMP(timezone=True), nullable=False),
        default_factory=lambda: datetime.now(timezone.utc)
    )
    
    # Relationships
    user: User = Relationship(back_populates="projects")
    notes: List["Note"] = Relationship(back_populates="project")


class Label(SQLModel, table=True):
    __tablename__ = "labels"
    
    id: UUID = Field(
    default_factory=uuid.uuid4,
    sa_column=Column(
        pg.UUID,
        nullable=False,
        primary_key=True
        )
    )
    user_id: UUID = Field(foreign_key="users.id", ondelete="CASCADE", index=True)
    
    name: str = Field(nullable=False)
    color: Optional[str] = Field(default=None)
    
    created_at: datetime = Field(
        sa_column=Column(pg.TIMESTAMP(timezone=True), nullable=False),
        default_factory=lambda: datetime.now(timezone.utc)
    )
    updated_at: datetime = Field(
        sa_column=Column(pg.TIMESTAMP(timezone=True), nullable=False),
        default_factory=lambda: datetime.now(timezone.utc)
    )
    
    notes: List["Note"] = Relationship(
        back_populates="labels",
        link_model=NoteLabel
    )
    
    # Relationships
    user: User = Relationship(back_populates="labels")


class Note(SQLModel, table=True):
    __tablename__ = "notes"
    
    id: UUID = Field(
    default_factory=uuid.uuid4,
    sa_column=Column(
        pg.UUID,
        nullable=False,
        primary_key=True
        )
    )
    user_id: UUID = Field(foreign_key="users.id", ondelete="CASCADE", index=True)
    conversation_id: Optional[UUID] = Field(
        foreign_key="conversations.id", 
        ondelete="CASCADE", 
        index=True,
        default=None
    )
    project_id: Optional[UUID] = Field(
        foreign_key="projects.id", 
        ondelete="SET NULL",
        index=True,
        default=None
    )
    
    # Content
    content: str = Field(nullable=True)
    content_type: ContentType = Field(default=ContentType.TEXT)
    role: MessageRole = Field(default=MessageRole.NOTE)
    
    # ✅ CORRECT - index is inside Column()
    timestamp: datetime = Field(
        sa_column=Column(
            pg.TIMESTAMP(timezone=True), 
            nullable=False,
            index=True  # ← Move index here
        ),
        default_factory=lambda: datetime.now(timezone.utc)
    )
    
    created_at: datetime = Field(
        sa_column=Column(pg.TIMESTAMP(timezone=True), nullable=False),
        default_factory=lambda: datetime.now(timezone.utc)
    )  # When imported/created
    updated_at: datetime = Field(
        sa_column=Column(pg.TIMESTAMP(timezone=True), nullable=False),
        default_factory=lambda: datetime.now(timezone.utc)
    )
    
    # Note properties
    is_pinned: bool = Field(default=False)
    is_archived: bool = Field(default=False)
    is_categorized: bool = Field(default=False, index=True)
    background_color: Optional[str] = Field(default=None)
    
    # Threading for conversations
    parent_message_id: Optional[UUID] = Field(default=None)
    
    # Metadata (language, citations, image_url, etc.)
    notemetadata: dict = Field(default={}, sa_column=Column(JSON))
    
    title: str = Field(nullable=True)
    
    # Relationships
    user: User = Relationship(back_populates="notes")
    conversation: Optional[Conversation] = Relationship(back_populates="notes")
    project: Optional[Project] = Relationship(back_populates="notes")
    media: List["Media"] = Relationship(back_populates="note")
    checklist_items: List["ChecklistItem"] = Relationship(back_populates="note")
    labels: List["Label"] = Relationship(
        back_populates="notes",
        link_model=NoteLabel
    )
    
    
    
    # Indexes will be created via Alembic migrations
    # Index on (user_id, timestamp) composite
    # Index on (user_id, is_categorized)
    # Full-text search index on content


class Media(SQLModel, table=True):
    __tablename__ = "media"
    
    id: UUID = Field(
    default_factory=uuid.uuid4,
    sa_column=Column(
        pg.UUID,
        nullable=False,
        primary_key=True
        )
    )
    note_id: UUID = Field(foreign_key="notes.id", ondelete="CASCADE", index=True)
    user_id: UUID = Field(foreign_key="users.id", ondelete="CASCADE")
    
    file_path: str = Field(nullable=False)
    file_type: MediaType = Field(nullable=False)
    file_size: int = Field(nullable=False)  # in bytes
    mime_type: str = Field(nullable=False)
    original_filename: str = Field(nullable=False)
    position_index: int = Field(default=0)
    
    created_at: datetime = Field(
        sa_column=Column(pg.TIMESTAMP(timezone=True), nullable=False),
        default_factory=lambda: datetime.now(timezone.utc)
    )
    
    # Relationships
    note: Note = Relationship(back_populates="media")
    user: User = Relationship(back_populates="media")


class ChecklistItem(SQLModel, table=True):
    __tablename__ = "checklist_items"
    
    id: UUID = Field(
    default_factory=uuid.uuid4,
    sa_column=Column(
        pg.UUID,
        nullable=False,
        primary_key=True
        )
    )
    note_id: UUID = Field(foreign_key="notes.id", ondelete="CASCADE", index=True)
    
    text: str = Field(nullable=False)
    is_checked: bool = Field(default=False)
    position_index: int = Field(default=0)
    
    created_at: datetime = Field(
        sa_column=Column(pg.TIMESTAMP(timezone=True), nullable=False),
        default_factory=lambda: datetime.now(timezone.utc)
    )
    updated_at: datetime = Field(
        sa_column=Column(pg.TIMESTAMP(timezone=True), nullable=False),
        default_factory=lambda: datetime.now(timezone.utc)
    )
    
    # Relationships
    note: Note = Relationship(back_populates="checklist_items")
    
    
    
    
    
    
    
    
    
