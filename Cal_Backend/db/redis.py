# Redis for token revoking functionality with support for different token types
import json
import redis.asyncio as redis
from Cal_Backend.config import Config

# TTL Constants
ACCESS_TOKEN_EXPIRY = 3600  # 1 hour
REFRESH_TOKEN_EXPIRY = 2 * 24 * 3600  # 2 days in seconds

# Legacy constant for backward compatibility
JTI_EXPIRY = ACCESS_TOKEN_EXPIRY

token_blocklist = redis.Redis(
    host=Config.REDIS_HOST,
    port=Config.REDIS_PORT,
    password=Config.REDIS_PASSWORD,  # ← add this line
    db=0
)

async def add_jti_to_blocklist(jti: str, is_refresh: bool = False) -> None:
    """
    Add JWT ID to blocklist with appropriate TTL
    
    Args:
        jti: JWT ID to blacklist
        is_refresh: True if this is a refresh token, False for access token
    """
    try:
        expiry_time = REFRESH_TOKEN_EXPIRY if is_refresh else ACCESS_TOKEN_EXPIRY
        await token_blocklist.set(name=jti, value="", ex=expiry_time)
    except Exception as e:
        print(f"Redis error in add_jti_to_blocklist: {e}")
        # Log error but don't crash the application
        pass

async def add_access_jti_to_blocklist(jti: str) -> None:
    """
    Convenience function for blacklisting access tokens
    """
    await add_jti_to_blocklist(jti, is_refresh=False)

async def add_refresh_jti_to_blocklist(jti: str) -> None:
    """
    Convenience function for blacklisting refresh tokens
    """
    await add_jti_to_blocklist(jti, is_refresh=True)

async def token_in_blocklist(jti: str) -> bool:
    """
    Check if a JWT ID is in the blocklist
    
    Args:
        jti: JWT ID to check
        
    Returns:
        True if token is blacklisted, False otherwise
    """
    try:
        result = await token_blocklist.get(jti)
        return result is not None
    except Exception as e:
        print(f"Redis error in token_in_blocklist: {e}")
        # If Redis is down, we fail open (allow the token) to keep the app working
        return False

async def get_blocklist_stats() -> dict:
    """
    Get statistics about current blocklist (useful for monitoring)
    
    Returns:
        Dictionary with blocklist statistics
    """
    try:
        info = await token_blocklist.info()
        key_count = await token_blocklist.dbsize()
        
        return {
            "total_keys": key_count,
            "used_memory": info.get("used_memory_human", "N/A"),
            "connected_clients": info.get("connected_clients", 0)
        }
    except Exception:
        return {"error": "Could not retrieve stats"}

IMPORT_JOB_TTL = 24 * 3600  # 24 hours


async def set_job_status(job_id: str, status_data: dict) -> None:
    try:
        await token_blocklist.set(
            f"import_job:{job_id}",
            json.dumps(status_data),
            ex=IMPORT_JOB_TTL
        )
    except Exception as e:
        print(f"Redis error in set_job_status: {e}")


async def get_job_status(job_id: str) -> dict | None:
    try:
        result = await token_blocklist.get(f"import_job:{job_id}")
        if result:
            return json.loads(result)
        return None
    except Exception as e:
        print(f"Redis error in get_job_status: {e}")
        return None


async def clear_expired_tokens() -> int:
    """
    Manually clear expired tokens (Redis handles this automatically, 
    but this function can be useful for cleanup scripts)
    
    Returns:
        Number of keys that were manually cleared
    """
    try:
        # Get all keys with our pattern (if you want to add a prefix later)
        keys = await token_blocklist.keys("*")
        cleared = 0
        
        for key in keys:
            ttl = await token_blocklist.ttl(key)
            if ttl == -1:  # No expiry set (shouldn't happen, but safety check)
                await token_blocklist.delete(key)
                cleared += 1
                
        return cleared
    except Exception:
        return 0
