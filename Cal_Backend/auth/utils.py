# To hash user passwords and help with JWT authentication and authorization
# Now includes cookie helper functions for HttpOnly cookie management

from passlib.context import CryptContext
from datetime import timedelta, datetime
import jwt
from Cal_Backend.config import Config
from uuid import UUID
import uuid
import logging
from fastapi import Request, status, Response
from fastapi.exceptions import HTTPException

passwd_context = CryptContext(
    schemes=['bcrypt']
)

ACCESS_TOKEN_EXPIRY = 3600

def generate_passwd_hash(password: str) -> str:
    hash = passwd_context.hash(password)
    return hash

def verify_password(password: str, hash: str) -> bool:
    return passwd_context.verify(password, hash)

def create_access_tokens(user_data: dict, expiry: timedelta = None, refresh: bool = False):
    payload = {}
    
    EXPIRY_TIME = datetime.now() + expiry if expiry else datetime.now() + timedelta(seconds=ACCESS_TOKEN_EXPIRY)
    
    payload['user'] = user_data
    payload['exp'] = int(EXPIRY_TIME.timestamp()) 
    payload['jti'] = str(uuid.uuid4())
    payload['refresh'] = refresh
    
    token = jwt.encode(
        payload=payload,
        key=Config.JWT_SECRET,
        algorithm=Config.JWT_ALGORITHM
    )

    return token

def decode_token(token: str) -> dict:
    """
    Decode JWT token and return payload as dict
    Used by dependencies.py for token validation
    """
    try:
        token_data = jwt.decode(
            jwt=token,
            key=Config.JWT_SECRET,
            algorithms=[Config.JWT_ALGORITHM]
        )
        
        return token_data
    
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired"
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )

# Cookie Helper Functions

def set_auth_cookies(response: Response, access_token: str, refresh_token: str = None) -> None:
    """
    Set authentication cookies on response object
    
    Args:
        response: FastAPI Response object
        access_token: JWT access token
        refresh_token: JWT refresh token (optional)
    """
    # Set access token cookie
    response.set_cookie(
        key="access_token",
        value=access_token,
        max_age=ACCESS_TOKEN_EXPIRY,
        httponly=True,
        secure=False,  # False for localhost development
        samesite="lax",
        path="/"
    )
    
    # Set refresh token cookie if provided
    if refresh_token:
        response.set_cookie(
            key="refresh_token", 
            value=refresh_token,
            max_age=2 * 24 * 3600,  # 2 days in seconds
            httponly=True,
            secure=False,  # False for localhost development
            samesite="lax",
            path="/"
        )

def clear_auth_cookies(response: Response) -> None:
    """
    Clear authentication cookies from response
    
    Args:
        response: FastAPI Response object
    """
    response.delete_cookie(
        key="access_token",
        path="/",
        samesite="lax"
    )
    
    response.delete_cookie(
        key="refresh_token", 
        path="/",
        samesite="lax"
    )

def get_token_time_remaining(token_data: dict) -> int:
    """
    Calculate remaining time for a token in seconds
    
    Args:
        token_data: Decoded JWT payload
        
    Returns:
        Remaining time in seconds, 0 if expired
    """
    expiry_timestamp = token_data.get('exp', 0)
    current_time = datetime.now().timestamp()
    
    time_remaining = expiry_timestamp - current_time
    return max(0, int(time_remaining))

def should_rotate_refresh_token(token_data: dict, threshold_hours: int = 6) -> bool:
    """
    Check if refresh token should be rotated based on remaining time
    
    Args:
        token_data: Decoded refresh token payload
        threshold_hours: Minimum hours remaining before rotation
        
    Returns:
        True if token should be rotated, False otherwise
    """
    time_remaining = get_token_time_remaining(token_data)
    threshold_seconds = threshold_hours * 3600
    
    return time_remaining < threshold_seconds