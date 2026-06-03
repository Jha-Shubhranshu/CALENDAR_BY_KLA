import json
import uuid
import os
import base64
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import UUID
from uuid import uuid4
from pydantic import BaseModel
from fastapi import Query


import logging
logger = logging.getLogger(__name__)


from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from Cal_Backend.db.main import get_session
from Cal_Backend.db.models import ImportJob, ImportJobStatus, User
from Cal_Backend.db.redis import get_job_status, set_job_status
from Cal_Backend.auth.dependencies import get_current_userC, AccessTokenBearerC, TokenBearer
from Cal_Backend.Conversations.schemas import ConversationResponse

from .notesimportschemas import GoogleKeepImportRequest
from .service import validate_import_data, ImportService
from .schemas import ExtensionIngestSchema, ImportConversationSchema, ClaudeNativeConversation, ChatGPTConversation

from Cal_Backend.storage.s3 import (
    presign_import_upload,
    import_object_exists,
)

class ChatGPTUploadProcessRequest(BaseModel):
    """Body for /chatgpt/upload/process — points at a freshly-PUT ZIP in S3."""
    s3_key: str
    file_size: Optional[int] = None  # browser-reported, informational only


class ClaudeUploadProcessRequest(BaseModel):
    """Body for /claude/upload/process — points at a freshly-PUT JSON in S3."""
    s3_key: str
    file_size: Optional[int] = None


Json_router = APIRouter()
ACCESS_TOKEN_BEARER = AccessTokenBearerC()
HEADER_TOKEN_BEARER = TokenBearer(cookie_name="access_token", auto_error=True)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _save_to_local_disk(data: List[ClaudeNativeConversation]):
    """
    Local-dev debugging: dump each conversation as JSON, plus decode any
    extension-attached image bytes into actual image files.
    """
    try:
        base_path = r"C:\Users\shubh\Desktop\Calendar_By_Kla\extension feeds"
        os.makedirs(base_path, exist_ok=True)
        
        for conv in data:
            timestamp_str = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
            short_id = (conv.uuid[:8] if conv.uuid else uuid.uuid4().hex[:8])
            feed_dir = os.path.join(base_path, f"feed_{timestamp_str}_{short_id}")
            os.makedirs(feed_dir, exist_ok=True)
            
            # 1. Full JSON dump
            with open(os.path.join(feed_dir, "data.txt"), "w", encoding="utf-8") as f:
                f.write(conv.model_dump_json(indent=2))
            
            # 2. Decode any extension-attached image bytes
            images_saved = 0
            for i, msg in enumerate(conv.chat_messages):
                all_atts = list(msg.attachments) + list(msg.files)
                for j, att in enumerate(all_atts):
                    if not att.extension_data or not att.extension_data.data:
                        continue
                    
                    raw = att.extension_data.data
                    # Handle "data:image/png;base64,..." prefix
                    prefix, b64 = ("", raw)
                    if "," in raw:
                        prefix, b64 = raw.split(",", 1)
                    
                    try:
                        binary = base64.b64decode(b64)
                    except Exception as e:
                        print(f">>> [DEBUG] base64 decode failed for msg {i} att {j}: {e}")
                        continue
                    
                    # Pick an extension
                    ext = "bin"
                    if att.file_type:
                        if "png" in att.file_type: ext = "png"
                        elif "jpeg" in att.file_type or "jpg" in att.file_type: ext = "jpg"
                        elif "webp" in att.file_type: ext = "webp"
                        elif "gif" in att.file_type: ext = "gif"
                    elif "png" in prefix: ext = "png"
                    elif "jpeg" in prefix or "jpg" in prefix: ext = "jpg"
                    elif "webp" in prefix: ext = "webp"
                    elif "gif" in prefix: ext = "gif"
                    
                    images_dir = os.path.join(feed_dir, "images")
                    os.makedirs(images_dir, exist_ok=True)
                    
                    base_name = (att.file_name or f"msg_{i}_att_{j}").rsplit(".", 1)[0]
                    out_path = os.path.join(images_dir, f"{base_name}.{ext}")
                    with open(out_path, "wb") as f:
                        f.write(binary)
                    images_saved += 1
            
            print(f">>> [DEBUG] SAVED EXTENSION FEED: {feed_dir} (Images: {images_saved})")
    except Exception as e:
        print(f">>> [DEBUG] ERROR saving extension feed to disk: {e}")
        import traceback; traceback.print_exc()

async def _dispatch_import(
    session: AsyncSession,
    background_tasks: BackgroundTasks,
    user: User,
    job_type: str,
    data: list,
    account_override: str | None = None,        # ← NEW
) -> dict:
    """
    Creates an ImportJob record and dispatches work.
    If account_override is set, it is injected into every item so the
    worker/service uses it as the conversation's account field.
    """
    from Cal_Backend.config import get_settings
    settings = get_settings()
 
    total = len(data)
    job_id = str(uuid.uuid4())
 
    job = ImportJob(
        id=UUID(job_id),
        user_id=user.id,
        job_type=job_type,
        status=ImportJobStatus.PENDING,
        total_items=total,
    )
    session.add(job)
    await session.commit()
 
    await set_job_status(job_id, {
        "job_id": job_id,
        "status": "pending",
        "total_items": total,
        "processed_items": 0,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    })
 
    # Serialise items to plain dicts
    serialisable = [
        item if isinstance(item, dict) else item.model_dump()
        for item in data
    ]
 
    # ── Inject account override ──────────────────────────────────────
    if account_override:
        for item in serialisable:
            if job_type == "extension_ingest":
                # Claude native shape: account is a dict {"email_address": ..., "uuid": ...}
                item["account"] = {"email_address": account_override}
            elif job_type in ("chatgpt_ingest", "json", "chatgpt_zip_normalize", "claude_json_normalize"):
                # Clean/ChatGPT shape: account is a plain string
                # For normalize jobs, this travels in the job metadata dict
                item["account"] = account_override
            # google_keep jobs don't use account — skip
 
    if settings.SQS_IMPORT_QUEUE_URL and settings.S3_BUCKET_NAME:
        from Cal_Backend.storage.s3 import upload_import_data
        from Cal_Backend.queue.sqs import enqueue_import_job
 
        s3_key = f"imports/{user.id}/{job_id}/data.json"
        payload = json.dumps({"data": serialisable}).encode()
 
        await upload_import_data(payload, s3_key)
 
        result = await session.execute(
            select(ImportJob).where(ImportJob.id == UUID(job_id))
        )
        job_rec = result.scalar_one_or_none()
        if job_rec:
            job_rec.s3_key = s3_key
            session.add(job_rec)
            await session.commit()
 
        await enqueue_import_job(job_id, s3_key, str(user.id), job_type)
    else:
        from Cal_Backend.user_data_import.worker import process_import_job
        background_tasks.add_task(
            process_import_job,
            job_id, str(user.id), job_type,
            in_memory_data=serialisable,
        )
 
    return {
        "job_id": job_id,
        "status": "pending",
        "total_items": total,
        "message": f"Import queued. {total} items to process.",
        "poll_url": f"/api/v1/ArjunJson/import/status/{job_id}",
    }
 


# ---------------------------------------------------------------------------
# Status / listing endpoints
# ---------------------------------------------------------------------------

@Json_router.get("/import/status/{job_id}")
async def get_import_status(
    job_id: str,
    current_user: User = Depends(get_current_userC),
    session: AsyncSession = Depends(get_session),
):
    """Poll the status of an async import job."""
    cached = await get_job_status(job_id)
    if cached:
        return cached

    result = await session.execute(
        select(ImportJob).where(
            ImportJob.id == UUID(job_id),
            ImportJob.user_id == current_user.id,
        )
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Import job not found")

    return {
        "job_id": str(job.id),
        "status": job.status.value,
        "total_items": job.total_items,
        "processed_items": job.processed_items,
        "result_stats": job.result_stats,
        "error": job.error_message,
        "updated_at": job.updated_at.isoformat(),
    }


@Json_router.get("/import/jobs")
async def list_import_jobs(
    current_user: User = Depends(get_current_userC),
    session: AsyncSession = Depends(get_session),
):
    """List the 20 most recent import jobs for the current user."""
    result = await session.execute(
        select(ImportJob)
        .where(ImportJob.user_id == current_user.id)
        .order_by(ImportJob.created_at.desc())
        .limit(20)
    )
    jobs = result.scalars().all()
    return [
        {
            "job_id": str(j.id),
            "status": j.status.value,
            "job_type": j.job_type,
            "total_items": j.total_items,
            "processed_items": j.processed_items,
            "created_at": j.created_at.isoformat(),
            "updated_at": j.updated_at.isoformat(),
            "result_stats": j.result_stats,
        }
        for j in jobs
    ]


# ---------------------------------------------------------------------------
# Import endpoints — all return 202 immediately
# ---------------------------------------------------------------------------

@Json_router.post("/extension/ingest", status_code=status.HTTP_202_ACCEPTED)
async def ingest_from_extension(
    data: List[ClaudeNativeConversation],
    background_tasks: BackgroundTasks,
    account: Optional[str] = Query(None, description="Override account email for all conversations"),  # ← NEW
    current_user: User = Depends(get_current_userC),
    session: AsyncSession = Depends(get_session),
):
    """Ingest conversations from the browser extension in Claude's native export format."""
    print(f">>> [DEBUG] Extension ingest received for {len(data)} conversations")
    
    _save_to_local_disk(data)
    
    serialisable = [conv.model_dump(by_alias=True) for conv in data]
    
    return await _dispatch_import(
        session, background_tasks, current_user,
        "extension_ingest", serialisable, account_override=account,          # ← NEW

    )





@Json_router.post("/chatgpt/ingest", status_code=status.HTTP_202_ACCEPTED)
async def ingest_chatgpt(
    data: List[ChatGPTConversation],
    background_tasks: BackgroundTasks,
    account: Optional[str] = Query(None, description="Override account email for all conversations"),  # ← NEW
    current_user: User = Depends(get_current_userC),
    session: AsyncSession = Depends(get_session),
):
    if not data:
        raise HTTPException(status_code=400, detail="No conversations provided")
    serialisable = [conv.model_dump() for conv in data]
    return await _dispatch_import(
        session, background_tasks, current_user,
        "chatgpt_ingest", serialisable,
        account_override=account,          # ← NEW
    )
 
 
 
@Json_router.post("/chatgpt/upload/presign", status_code=status.HTTP_200_OK)
async def presign_chatgpt_upload(
    current_user: User = Depends(get_current_userC),
):
    """
    Step 1 of the large-export upload flow. Returns a presigned PUT URL the
    browser can use to upload a ZIP directly to S3, bypassing the 10 MB API
    Gateway request-body cap. The key is scoped to the calling user so they
    cannot overwrite anyone else's pending upload.
 
    The key returned here is what the browser must POST back to
    /chatgpt/upload/process once the PUT completes.
    """
    s3_key = f"chatgpt-uploads/{current_user.id}/{uuid4().hex}.zip"
    url = await presign_import_upload(s3_key, content_type="application/zip")
    return {
        "s3_key":       s3_key,
        "upload_url":   url,
        "content_type": "application/zip",
        "expires_in":   900,
    }
 
 
@Json_router.post("/chatgpt/upload/process", status_code=status.HTTP_202_ACCEPTED)
async def process_chatgpt_upload(
    body: ChatGPTUploadProcessRequest,
    background_tasks: BackgroundTasks,
    account: Optional[str] = Query(None, description="Override account email for all conversations"),  # ← NEW
    current_user: User = Depends(get_current_userC),
    session: AsyncSession = Depends(get_session),
):
    s3_key = body.s3_key or ""
    expected_prefix = f"chatgpt-uploads/{current_user.id}/"
    if not s3_key.startswith(expected_prefix):
        raise HTTPException(status_code=403, detail="s3_key is outside your upload namespace.")
    if not s3_key.endswith(".zip"):
        raise HTTPException(status_code=400, detail="s3_key must point at a .zip file")
    if not await import_object_exists(s3_key):
        raise HTTPException(status_code=404, detail="ZIP not found at that key — was the PUT successful?")
 
    return await _dispatch_import(
        session, background_tasks, current_user,
        "chatgpt_zip_normalize",
        [{"s3_key": s3_key, "account": account}],   # ← account travels with the zip ref
        account_override=account,                     # ← NEW
    )








@Json_router.post("/json", status_code=status.HTTP_202_ACCEPTED)
async def import_from_json(
    data: List[Dict[str, Any]],
    background_tasks: BackgroundTasks,
    account: Optional[str] = Query(None, description="Override account email for all conversations"),  # ← NEW
    current_user: User = Depends(get_current_userC),
    session: AsyncSession = Depends(get_session),
):
    validated = validate_import_data(data)
    return await _dispatch_import(
        session, background_tasks, current_user,
        "json", validated,
        account_override=account,          # ← NEW
    )

@Json_router.post("/upload", status_code=status.HTTP_202_ACCEPTED)
async def import_from_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_userC),
    session: AsyncSession = Depends(get_session),
):
    """Queue an import from an uploaded JSON file."""
    if not file.filename.endswith(".json"):
        raise HTTPException(status_code=400, detail="Only JSON files are accepted")

    try:
        content = await file.read()
        data = json.loads(content.decode("utf-8"))
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON file")

    validated = validate_import_data(data)
    return await _dispatch_import(session, background_tasks, current_user, "json", validated)


@Json_router.post("/google-keep", status_code=status.HTTP_202_ACCEPTED)
async def import_google_keep(
    request: GoogleKeepImportRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_userC),
    session: AsyncSession = Depends(get_session),
):
    """Queue a Google Keep import from a JSON request body."""
    return await _dispatch_import(
        session, background_tasks, current_user,
        "google_keep", request.notes,
    )


@Json_router.post("/google-keep/file", status_code=status.HTTP_202_ACCEPTED)
async def import_google_keep_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_userC),
    session: AsyncSession = Depends(get_session),
):
    """Queue a Google Keep import from an uploaded JSON file."""
    if not file.filename.endswith(".json"):
        raise HTTPException(status_code=400, detail="Only JSON files are accepted")

    try:
        content = await file.read()
        data = json.loads(content.decode("utf-8"))
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON file")

    request = GoogleKeepImportRequest(notes=data)
    return await _dispatch_import(
        session, background_tasks, current_user,
        "google_keep", request.notes,
    )


@Json_router.post("/google-keep/bulk", status_code=status.HTTP_202_ACCEPTED)
async def bulk_import_google_keep(
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
    current_user: User = Depends(get_current_userC),
    session: AsyncSession = Depends(get_session),
):
    """
    Queue a bulk Google Keep import from multiple JSON files.
    All files are normalised and merged into a single job.
    """
    if not files:
        raise HTTPException(status_code=400, detail="No files provided")

    invalid = [f.filename for f in files if not f.filename.endswith(".json")]
    if invalid:
        raise HTTPException(
            status_code=400,
            detail=f"Non-JSON files rejected: {', '.join(invalid)}",
        )

    combined_notes = []
    for file in files:
        try:
            content = await file.read()
            data = json.loads(content.decode("utf-8"))
        except json.JSONDecodeError:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid JSON in file: {file.filename}",
            )

        if isinstance(data, dict) and "notes" in data:
            notes_raw = data["notes"]
        elif isinstance(data, list):
            notes_raw = data
        elif isinstance(data, dict):
            notes_raw = [data]
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Unrecognised structure in {file.filename}",
            )

        from .notesimportschemas import GoogleKeepNote
        for raw_note in notes_raw:
            try:
                combined_notes.append(GoogleKeepNote(**raw_note))
            except Exception as exc:
                raise HTTPException(
                    status_code=422,
                    detail=f"Invalid note in {file.filename}: {exc}",
                )

    if not combined_notes:
        raise HTTPException(status_code=400, detail="No notes found across all files")

    return await _dispatch_import(
        session, background_tasks, current_user,
        "google_keep_bulk", combined_notes,
    )


# ---------------------------------------------------------------------------
# Read-only / utility endpoints (unchanged)
# ---------------------------------------------------------------------------

@Json_router.get("/history", response_model=List[ConversationResponse])
async def get_import_history(
    source: str = None,
    limit: int = 50,
    offset: int = 0,
    current_user: User = Depends(get_current_userC),
    session: AsyncSession = Depends(get_session),
):
    from sqlmodel import select, func
    from Cal_Backend.db.models import Conversation, Note

    statement = select(Conversation).where(Conversation.user_id == current_user.id)

    if source:
        from Cal_Backend.db.models import NotebookSource
        try:
            source_enum = NotebookSource(source.lower())
            statement = statement.where(Conversation.source == source_enum)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid source: {source}")

    statement = statement.order_by(Conversation.import_date.desc()).offset(offset).limit(limit)
    result = await session.execute(statement)
    conversations = result.scalars().all()

    output = []
    for conv in conversations:
        count_result = await session.execute(
            select(func.count(Note.id)).where(Note.conversation_id == conv.id)
        )
        note_count = count_result.scalar_one()
        conv_dict = ConversationResponse.model_validate(conv).model_dump()
        conv_dict["note_count"] = note_count
        output.append(ConversationResponse(**conv_dict))

    return output


@Json_router.get("/google-keep/bulk/status")
async def get_bulk_import_status(
    current_user: User = Depends(get_current_userC),
    session: AsyncSession = Depends(get_session),
):
    from sqlmodel import select, func
    from Cal_Backend.db.models import Note

    total_result = await session.execute(
        select(func.count(Note.id)).where(Note.user_id == current_user.id)
    )
    total_notes = total_result.scalar_one()

    keep_result = await session.execute(
        select(func.count(Note.id)).where(
            Note.user_id == current_user.id,
            Note.notemetadata["import_source"].astext == "google_keep",
        )
    )
    keep_notes = keep_result.scalar_one()

    return {
        "total_notes": total_notes,
        "google_keep_notes": keep_notes,
        "other_notes": total_notes - keep_notes,
    }


@Json_router.get("/google-keep/bulk/download-report/{filename}")
async def download_failure_report(
    filename: str,
    current_user: User = Depends(get_current_userC),
):
    import tempfile

    if not filename.startswith("import_failures_") or not filename.endswith(".txt"):
        raise HTTPException(status_code=400, detail="Invalid report filename")

    report_path = os.path.join(tempfile.gettempdir(), filename)
    if not os.path.exists(report_path):
        raise HTTPException(status_code=404, detail="Report file not found or expired")

    return FileResponse(
        path=report_path,
        media_type="text/plain",
        filename=filename,
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@Json_router.post("/claude/upload/presign", status_code=status.HTTP_200_OK)
async def presign_claude_upload(
    current_user: User = Depends(get_current_userC),
):
    """
    Step 1 of the large-Claude-export upload flow. Browser uses the returned
    URL to PUT the JSON directly to S3, bypassing API Gateway\\'s 10 MB body cap.
    Key is namespaced to the calling user.
    """
    s3_key = f"claude-uploads/{current_user.id}/{uuid4().hex}.json"
    url = await presign_import_upload(s3_key, content_type="application/json")
    return {
        "s3_key":       s3_key,
        "upload_url":   url,
        "content_type": "application/json",
        "expires_in":   900,
    }
 
 
@Json_router.post("/claude/upload/process", status_code=status.HTTP_202_ACCEPTED)
async def process_claude_upload(
    body: ClaudeUploadProcessRequest,
    background_tasks: BackgroundTasks,
    account: Optional[str] = Query(None, description="Override account email for all conversations"),
    current_user: User = Depends(get_current_userC),
    session: AsyncSession = Depends(get_session),
):
    """
    Step 3 of the flow. Verify the key is in this user\\'s namespace and that
    the object actually landed; dispatch a claude_json_normalize job. The
    worker downloads, parses, and runs ClaudeExtensionImportService.
    """
    s3_key = body.s3_key or ""
    expected_prefix = f"claude-uploads/{current_user.id}/"
    if not s3_key.startswith(expected_prefix):
        raise HTTPException(
            status_code=403,
            detail="s3_key is outside your upload namespace.",
        )
    if not s3_key.endswith(".json"):
        raise HTTPException(status_code=400, detail="s3_key must point at a .json file")
 
    if not await import_object_exists(s3_key):
        raise HTTPException(
            status_code=404,
            detail="JSON not found at that key — was the PUT successful?",
        )
 
    return await _dispatch_import(
        session, background_tasks, current_user,
        "claude_json_normalize",
        [{"s3_key": s3_key}],
        account_override=account,
    )
