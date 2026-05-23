# Cookie-based AND Header-based JWT authentication and authorization
from fastapi.security import HTTPBearer
from fastapi import Request, status, Depends
from .utils import decode_token
from fastapi.security.http import HTTPAuthorizationCredentials
from fastapi.exceptions import HTTPException
from Cal_Backend.db.redis import token_in_blocklist
from Cal_Backend.db.main import get_session
from sqlmodel.ext.asyncio.session import AsyncSession 
from .service import UserService
from typing import List, Any, Optional
from Cal_Backend.db.models import User

from Cal_Backend.errors import (InvalidToken, RefreshTokenRequired, AccessTokenRequired, InsufficientPermission)

user_service = UserService()

class TokenBearer(HTTPBearer):
    """
    Enhanced TokenBearer that supports both Authorization headers and HttpOnly cookies
    Priority: Cookies first, then fallback to Authorization header
    """
    
    def __init__(self, cookie_name: str, auto_error: bool = False):
        super().__init__(auto_error=auto_error)
        self.cookie_name = cookie_name

    async def __call__(self, request: Request) -> dict | None:
        token = None
        
        # Try to get token from cookie first (preferred method)
        cookie_token = request.cookies.get(self.cookie_name)
        if cookie_token:
            token = cookie_token
        else:
            # Fallback to Authorization header
            try:
                creds = await super().__call__(request)
                if creds:
                    token = creds.credentials
            except HTTPException:
                pass  # No authorization header found
        
        if not token:
            if self.auto_error:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail=f"Authentication required: {self.cookie_name} cookie or Authorization header missing"
                )
            return None
                
        # Decode and validate token
        token_data = decode_token(token)
        
        if not self.token_valid(token):
            raise InvalidToken() 
        
        # Check if token is blacklisted
        if await token_in_blocklist(token_data['jti']):
            raise InvalidToken() 
        
        # Verify token type
        self.verify_token_data(token_data) 

        return token_data
    
    def token_valid(self, token: str) -> bool:
        """Check if token can be decoded successfully"""
        token_data = decode_token(token)
        return True if token_data is not None else False
    
    def verify_token_data(self, token_data):
        """Override this method in child classes to verify token type"""
        raise NotImplementedError("Please override this method in child classes")

class CookieTokenBearer:
    """
    Base class for extracting and validating JWT tokens from HttpOnly cookies
    """
    
    def __init__(self, cookie_name: str, auto_error: bool = True):
        self.cookie_name = cookie_name
        self.auto_error = auto_error

    async def __call__(self, request: Request) -> dict | None:
        # Extract token from cookie
        token = request.cookies.get(self.cookie_name)
        
        if not token:
            if self.auto_error:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail=f"{self.cookie_name} cookie not found"
                )
            return None
                
        # Decode token
        token_data = decode_token(token)
        
        # Validate token
        if not self.token_valid(token):
            raise InvalidToken() 
        
        # Check if token is blacklisted
        if await token_in_blocklist(token_data['jti']):
            raise InvalidToken() 
        
        # Verify token type (access vs refresh)
        self.verify_token_data(token_data) 

        return token_data
    
    def token_valid(self, token: str) -> bool:
        """Check if token can be decoded successfully"""
        token_data = decode_token(token)
        return True if token_data is not None else False
    
    def verify_token_data(self, token_data):
        """Override this method in child classes to verify token type"""
        raise NotImplementedError("Please override this method in child classes")

class AccessTokenBearerC(TokenBearer):
    """
    Dependency for extracting and validating access tokens from both cookies and headers
    Priority: Cookie > Header
    """
    
    def __init__(self, auto_error: bool = True):
        super().__init__(cookie_name="access_token", auto_error=auto_error)
    
    def verify_token_data(self, token_data: dict) -> None: 
        """Ensure this is an access token (refresh=False)"""
        if token_data and token_data.get('refresh', False):
            raise AccessTokenRequired()

class RefreshTokenBearer(TokenBearer):
    """
    Dependency for extracting and validating refresh tokens from both cookies and headers
    """
    
    def __init__(self, auto_error: bool = True):
        super().__init__(cookie_name="refresh_token", auto_error=auto_error)
    
    def verify_token_data(self, token_data: dict) -> None: 
        """Ensure this is a refresh token (refresh=True)"""
        if token_data and not token_data.get('refresh', False):
            raise RefreshTokenRequired()

async def get_current_userC(token_details: dict = Depends(AccessTokenBearerC()), session: AsyncSession = Depends(get_session)):
    """
    Dependency to get current user from access token
    """
    user_email = token_details["user"]["email"]
    
    user = await user_service.get_user_by_email(user_email, session)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return user

class RoleChecker:
    """
    Dependency class for checking user roles/permissions
    """
    
    def __init__(self, allowed_roles: List[str]) -> None:
        self.allowed_roles = allowed_roles
        
    def __call__(self, current_user: User = Depends(get_current_userC)) -> Any:
        """
        Check if current user has required role
        """
        if current_user.role in self.allowed_roles:
            return True
        
        raise InsufficientPermission()