# Redis for token revoking functionality with support for different token types
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
    expiry_time = REFRESH_TOKEN_EXPIRY if is_refresh else ACCESS_TOKEN_EXPIRY
    
    await token_blocklist.set(name=jti, value="", ex=expiry_time)

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
    result = await token_blocklist.get(jti)
    return result is not None

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
