from pydantic import BaseModel, EmailStr, Field
from pydantic import ConfigDict
from uuid import UUID
from datetime import datetime
from typing import List, Optional


# class UserCreate(BaseModel):
#     """Schema for user registration"""
#     email: EmailStr
#     username: str = Field(..., min_length=3, max_length=50)
#     password: str = Field(..., min_length=8)


# class UserLogin(BaseModel):
#     """Schema for user login"""
#     email: EmailStr
#     password: str


# class UserResponse(BaseModel):
#     """Schema for user data in responses"""
#     id: UUID
#     email: str
#     username: str
#     created_at: datetime
#     updated_at: datetime
    
#     class Config:
#         from_attributes = True

class UserCreateModel(BaseModel):
    first_name: str =Field(max_length=25)
    last_name: str =Field(max_length=25)
    username: str = Field(max_length=18)
    email: str = Field(max_length=40)
    password: str = Field(max_length=16)
    
    

class UserAfterCreationModel(BaseModel):
    id : UUID
    username: str
    email: str
    first_name: str
    last_name: str
    is_verified: bool 
    password_hash: str = Field(exclude=False)
    created_at: datetime
    updated_at: datetime
    
    
        
class UserCreatedModel(BaseModel): 
    id : UUID
    username: str
    email: str
    first_name: str
    last_name: str
    is_verified: bool 
    password_hash: str = Field(exclude=False)
    created_at: datetime
    updated_at: datetime
    
    
class UserLoginModel(BaseModel):
    email: str = Field(max_length=40)
    password: str = Field(max_length=16)



class Token(BaseModel):
    """Schema for JWT token response"""
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    """Schema for decoded JWT token data"""
    user_id: Optional[str] = None
