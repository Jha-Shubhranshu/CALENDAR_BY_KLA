"""
Cal_Backend/accounts/route.py

CRUD for user email-accounts. Wire into main app:
    from Cal_Backend.accounts.route import accounts_router
    app.include_router(accounts_router, prefix="/api/v1/accounts", tags=["accounts"])
"""
from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlmodel.ext.asyncio.session import AsyncSession

from Cal_Backend.auth.dependencies import get_current_userC
from Cal_Backend.db.main import get_session
from Cal_Backend.db.models import User, UserAccount

accounts_router = APIRouter()


# ── Schemas ─────────────────────────────────────────────────────────────────

class AccountCreate(BaseModel):
    email_address: str          # EmailStr if you want strict validation
    label: Optional[str] = None


class AccountResponse(BaseModel):
    id: UUID
    email_address: str
    label: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# ── Endpoints ───────────────────────────────────────────────────────────────

@accounts_router.get("", response_model=List[AccountResponse])
async def list_accounts(
    current_user: User = Depends(get_current_userC),
    session: AsyncSession = Depends(get_session),
):
    """Return every saved email-account for the current user."""
    result = await session.execute(
        select(UserAccount)
        .where(UserAccount.user_id == current_user.id)
        .order_by(UserAccount.created_at.asc())
    )
    return result.scalars().all()


@accounts_router.post("", response_model=AccountResponse, status_code=status.HTTP_201_CREATED)
async def create_account(
    body: AccountCreate,
    current_user: User = Depends(get_current_userC),
    session: AsyncSession = Depends(get_session),
):
    """Add a new email-account. Duplicates (same user + email) are rejected."""
    existing = await session.execute(
        select(UserAccount).where(
            UserAccount.user_id == current_user.id,
            UserAccount.email_address == body.email_address,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This email account already exists.",
        )

    account = UserAccount(
        id=uuid4(),
        user_id=current_user.id,
        email_address=body.email_address,
        label=body.label,
        created_at=datetime.now(timezone.utc),
    )
    session.add(account)
    await session.commit()
    await session.refresh(account)
    return account


@accounts_router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account(
    account_id: UUID,
    current_user: User = Depends(get_current_userC),
    session: AsyncSession = Depends(get_session),
):
    """Remove a saved email-account. Does NOT touch existing conversations."""
    result = await session.execute(
        select(UserAccount).where(
            UserAccount.id == account_id,
            UserAccount.user_id == current_user.id,
        )
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    await session.delete(account)
    await session.commit()
    return None