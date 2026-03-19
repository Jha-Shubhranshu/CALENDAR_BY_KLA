from pydantic import BaseModel, EmailStr, Field
from pydantic import ConfigDict
from uuid import UUID
from datetime import datetime
from typing import Any, Dict, List, Optional



class ErrorResponse(BaseModel):
    """Schema for error responses"""
    detail: str
    message: Optional[str] = None


class ValidationError(BaseModel):
    """Schema for validation errors"""
    field: str
    message: str


class ValidationErrorResponse(BaseModel):
    """Schema for validation error response"""
    detail: str
    errors: List[ValidationError]




class PaginationParams(BaseModel):
    """Schema for pagination parameters"""
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)


class SortParams(BaseModel):
    """Schema for sorting parameters"""
    sort_by: str = "created_at"
    sort_order: str = Field(default="desc", pattern=r'^(asc|desc)$')

