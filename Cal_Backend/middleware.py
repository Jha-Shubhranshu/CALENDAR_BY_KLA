from fastapi import FastAPI
from fastapi.requests import Request
import time
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
#Added by claude for AI Chat feature implementation
from fastapi import HTTPException, status
from typing import Callable, Optional, Union
from collections import defaultdict
import asyncio
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
import logging










def register_middleware(app: FastAPI):
    
    @app.middleware('http')
    async def custom_logging(request: Request, call_next):
        start_time = time.time()
        
        response = await call_next(request)
        processing_time = time.time() - start_time
        
        client_host = request.client.host if request.client else "unknown"
        client_port = request.client.port if request.client else "0"
        
        message = f"{client_host}:{client_port}-{request.method}-{request.url.path}-{response.status_code} completed after {processing_time}s"
        
        print(message)
        return response
    
    @app.middleware('http')
    async def authorization(request: Request, call_next):
        # Define paths that don't require authorization
        public_paths = [
            "/api/v1/auth/signup",
            "/api/v1/auth/login",
            "http://localhost:8004/api/v1/auth/login", 
            # "http://localhost:8004/api/v1/ArjunJson/api/import/json", 
            "/api/v1/ArjunJson/api/import/json",  # Add this for testing
            "/api/v1/auth/register",
            "/docs",
            "/redoc",
            "/openapi.json"
        ]
        
        # IMPORTANT: Allow all OPTIONS requests (preflight) to pass through
        if request.method == "OPTIONS":
            response = await call_next(request)
            return response
        
        # Check if the current path is in public paths
        if request.url.path in public_paths:
            response = await call_next(request)
            return response
        
        # Check for authorization in either header or cookies
        has_auth_header = "authorization" in request.headers
        # Adjust these cookie names based on what your login endpoint sets
        has_auth_cookie = "access_token" in request.cookies
        
        # if not has_auth_header and not has_auth_cookie:
        #     return JSONResponse(
        #         status_code=401,
        #         content={
        #             "message": "Authentication required",
        #             "resolution": "Please provide authorization header or valid session cookie"
        #         }
        #     )
            
        response = await call_next(request)
        return response

    origins = [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "https://calendar-by-kla.vercel.app",
        "https://calendar-by-kla-shubham.vercel.app",
    ]

    # Add CORS middleware FIRST (which means it wraps everything else)
    app.add_middleware( 
        CORSMiddleware,
        allow_origins=origins,
        allow_origin_regex=r"https://calendar-by-kla.*\.vercel\.app",
        allow_methods=["*"],
        allow_headers=["*"],
        allow_credentials=True,
        expose_headers=["*"]
    )
    
    # app.add_middleware(
    #     TrustedHostMiddleware,
    #     allowed_hosts=["localhost", "127.0.0.1", "bookly-api-dc03.onrender.com", "0.0.0.0", "calendar-by-kla.onrender.com", "*.onrender.com"],
    # )
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
#Added by claude for AI Chat feature implementation
class RateLimiter:
    """
    Simple in-memory rate limiter
    In production, use Redis for distributed rate limiting
    """
    
    def __init__(self):
        self.requests = defaultdict(list)
        self.lock = asyncio.Lock()
    
    async def check_rate_limit(
        self,
        key: str,
        max_requests: int,
        window_seconds: int
    ) -> bool:
        """
        Check if request is within rate limit
        
        Args:
            key: Identifier (user_id, IP, etc.)
            max_requests: Maximum requests allowed
            window_seconds: Time window in seconds
            
        Returns:
            True if allowed
            
        Raises:
            HTTPException: If rate limit exceeded
        """
        async with self.lock:
            now = time.time()
            cutoff = now - window_seconds
            
            # Remove old requests
            self.requests[key] = [
                req_time for req_time in self.requests[key]
                if req_time > cutoff
            ]
            
            # Check limit
            if len(self.requests[key]) >= max_requests:
                retry_after = int(self.requests[key][0] - cutoff)
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Rate limit exceeded. Try again in {retry_after} seconds.",
                    headers={"Retry-After": str(retry_after)}
                )
            
            # Record this request
            self.requests[key].append(now)
            return True


# Global rate limiter instance
rate_limiter = RateLimiter()


async def rate_limit_dependency(
    request: Request,
    max_requests: int = 60,
    window_seconds: int = 60
):
    """
    FastAPI dependency for rate limiting
    
    Args:
        request: FastAPI request
        max_requests: Max requests per window
        window_seconds: Time window in seconds
    """
    # Use user ID if authenticated, otherwise IP address
    user_id = None
    if hasattr(request.state, "user"):
        user_id = str(request.state.user.uid)
    
    key = user_id or request.client.host
    
    await rate_limiter.check_rate_limit(
        key=f"api:{key}",
        max_requests=max_requests,
        window_seconds=window_seconds
    )


async def chat_rate_limit(request: Request):
    """Stricter rate limit for chat endpoints"""
    await rate_limit_dependency(request, max_requests=20, window_seconds=60)


async def upload_rate_limit(request: Request):
    """Rate limit for file uploads"""
    await rate_limit_dependency(request, max_requests=10, window_seconds=60)







logger = logging.getLogger(__name__)


async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    """
    Handle HTTP exceptions with consistent format
    """
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "message": exc.detail,
                "status_code": exc.status_code,
                "path": str(request.url.path)
            }
        },
        headers=exc.headers
    )


async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """
    Handle validation errors with detailed field information
    """
    errors = []
    for error in exc.errors():
        errors.append({
            "field": " -> ".join(str(loc) for loc in error["loc"]),
            "message": error["msg"],
            "type": error["type"]
        })
    
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": {
                "message": "Validation error",
                "status_code": status.HTTP_422_UNPROCESSABLE_ENTITY,
                "details": errors,
                "path": str(request.url.path)
            }
        }
    )


async def general_exception_handler(request: Request, exc: Exception):
    """
    Handle unexpected exceptions
    """
    # Log the full exception
    logger.error(
        f"Unexpected error: {str(exc)}",
        exc_info=True,
        extra={
            "path": str(request.url.path),
            "method": request.method,
            "client": request.client.host if request.client else None
        }
    )
    
    # Return generic error to user
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": {
                "message": "An unexpected error occurred. Please try again later.",
                "status_code": status.HTTP_500_INTERNAL_SERVER_ERROR,
                "path": str(request.url.path)
            }
        }
    )



def register_exception_handlers(app: FastAPI):
    """
    Register all exception handlers with FastAPI app
    
    Call this in your main.py:
    ```python
        from app.middleware.error_handler import register_exception_handlers
        register_exception_handlers(app)
    """
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(Exception, general_exception_handler)
    
