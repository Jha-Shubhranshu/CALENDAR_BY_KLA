from fastapi import APIRouter, Depends, status
from .schemas import UserCreateModel, UserCreatedModel, UserLoginModel, UserAfterCreationModel
from .service import UserService
from Cal_Backend.db.main import get_session
from sqlmodel.ext.asyncio.session import AsyncSession 
from fastapi.exceptions import HTTPException
from .utils import create_access_tokens, decode_token, verify_password, clear_auth_cookies, set_auth_cookies  
from fastapi.responses import JSONResponse
from datetime import timedelta, datetime
from .dependencies import RefreshTokenBearer, AccessTokenBearerC, get_current_userC, RoleChecker
from Cal_Backend.db.redis import add_jti_to_blocklist
from Cal_Backend.db.models import User
# from src.celery_tasks import send_email


from Cal_Backend.errors import UserAlreadyExists, UserNotFound, InvalidCredentials, InvalidToken

auth_router = APIRouter()
user_service = UserService()
Admin_role_checker = RoleChecker(['admin'])  
User_role_checker = RoleChecker(['user'])
Admin_User_role_checker = RoleChecker(['admin','user'])
# from src.emails import mail, create_message

REFRESH_TOKEN_EXPIRY = 2
ACCESS_TOKEN_EXPIRY = 3600  # 1 hour in seconds
REFRESH_EARLY_THRESHOLD = 6 * 3600  # 6 hours in seconds

@auth_router.post('/signup', response_model=UserAfterCreationModel, status_code=status.HTTP_201_CREATED)
async def create_user_Account(u_data: UserCreateModel, session: AsyncSession = Depends(get_session)):
    eemail = u_data.email
    
    user_exists = await user_service.does_user_exists(eemail, session)
    
    if user_exists:
        raise UserAlreadyExists()
    
    new_user = await user_service.create_user(u_data, session)
    
    return new_user

@auth_router.post('/login') # notice that jwt access and refresh tokens are not about tracking users created but login states of entities.
async def login_users(U_Creds: UserLoginModel, session: AsyncSession = Depends(get_session)):
    email = U_Creds.email
    password = U_Creds.password
    
    user = await user_service.get_user_by_email(email, session)
    
    if user is not None: 
        password_validity = verify_password(password, user.password_hash)
        
        if password_validity:
            # Create tokens
            access_token = create_access_tokens(
                user_data={
                    'email': user.email,
                    'user_uid': str(user.id),
                    "role": user.role,
                }
            )
            refresh_token = create_access_tokens(
                user_data={
                    'email': user.email,
                    'user_uid': str(user.id)
                },
                refresh=True,
                expiry=timedelta(days=REFRESH_TOKEN_EXPIRY)
            )
            
            # Create response
            response = JSONResponse(
                content={
                    "message": "Login Successful",
                    "user": {
                        "email": user.email,
                        "id": str(user.id),
                    }
                }
            )
            
            # Set HttpOnly cookies using helper function
            set_auth_cookies(response, access_token, refresh_token)
            
            return response
            
    raise InvalidCredentials()

@auth_router.post('/refresh_token')
async def get_new_access_token(token_details: dict = Depends(RefreshTokenBearer())):
    expiry_timestamp = token_details['exp']
    current_time = datetime.now().timestamp()
    
    if expiry_timestamp > current_time:
        # Calculate time remaining for refresh token
        time_remaining = expiry_timestamp - current_time
        
        # Always create new access token
        new_access_token = create_access_tokens(
            user_data=token_details['user']
        )
        
        response = JSONResponse(content={"message": "Tokens refreshed successfully"})
        
        # Set new tokens using helper function
        # Check if refresh token needs rotation (less than 6 hours remaining)
        new_refresh_token = None
        if time_remaining < REFRESH_EARLY_THRESHOLD:
            # Create new refresh token
            new_refresh_token = create_access_tokens(
                user_data=token_details['user'],
                refresh=True,
                expiry=timedelta(days=REFRESH_TOKEN_EXPIRY)
            )
            
            # Blacklist old refresh token
            await add_jti_to_blocklist(token_details['jti'], is_refresh=True)
            
        set_auth_cookies(response, new_access_token, new_refresh_token)
        
        return response
        
    raise InvalidToken()

@auth_router.get('/api_key')
async def get_permanent_api_key(user: User = Depends(get_current_userC)):
    """
    Generate a long-lived API key (10 years) for use in external extensions.
    """
    api_key = create_access_tokens(
        user_data={
            'email': user.email,
            'user_uid': str(user.id),
            "role": user.role,
        },
        expiry=timedelta(days=3650) # 10 years
    )
    return {"api_key": api_key}


@auth_router.get('/me', response_model=UserCreatedModel)
async def get_current_userrrr(user=Depends(get_current_userC), _: bool = Depends(User_role_checker)):
    return user

@auth_router.get('/health')
async def health_check():
    return {"status": "ok"}

@auth_router.post("/logout")
async def revoke_token(token_details: dict = Depends(AccessTokenBearerC())):
    jti = token_details['jti']
    
    # Blacklist current access token
    await add_jti_to_blocklist(jti)
    
    # Create response and clear cookies using helper function
    response = JSONResponse(
        content={
            "message": "Logged Out Successfully"
        },
        status_code=status.HTTP_200_OK
    )
    
    clear_auth_cookies(response)
    
    return response