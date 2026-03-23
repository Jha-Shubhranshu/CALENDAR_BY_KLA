from fastapi import APIRouter, Depends, status
from .schemas import UserCreateModel, UserCreatedModel, UserLoginModel, UserAfterCreationModel
from .service import UserService
from Cal_Backend.db.main import get_session
from sqlmodel.ext.asyncio.session import AsyncSession 
from fastapi.exceptions import HTTPException
from .utils import create_access_tokens, decode_token, verify_password, clear_auth_cookies  
from fastapi.responses import JSONResponse
from datetime import timedelta, datetime
from .dependencies import RefreshTokenBearer, AccessTokenBearerC, get_current_userC, RoleChecker
from Cal_Backend.db.redis import add_jti_to_blocklist
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
                        "Accesstoken for dev":access_token               # this is only a jugaad, strictly for development purposes only fix the auth flow, or the app will be compromised.
                    }
                }
            )
            
            # Set HttpOnly cookies
            response.set_cookie(
                key="access_token",
                value=access_token,
                max_age=ACCESS_TOKEN_EXPIRY,
                httponly=True,
                secure=False,  # Set to False for localhost development if needed
                samesite="none",
                path="/",
                domain=None
            )
            
            response.set_cookie(
                key="refresh_token", 
                value=refresh_token,
                max_age=REFRESH_TOKEN_EXPIRY * 24 * 3600,  # Convert days to seconds
                httponly=True,
                secure=False,  # Set to False for localhost development if needed
                samesite="none",
                path="/",
                domain=None
            )
            
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
        
        # Set new access token cookie
        response.set_cookie(
            key="access_token",
            value=new_access_token,
            max_age=ACCESS_TOKEN_EXPIRY,
            httponly=True,
            secure=False,  # False for localhost development
            samesite="none",
            path="/"
        )
        
        # Check if refresh token needs rotation (less than 6 hours remaining)
        if time_remaining < REFRESH_EARLY_THRESHOLD:
            # Create new refresh token
            new_refresh_token = create_access_tokens(
                user_data=token_details['user'],
                refresh=True,
                expiry=timedelta(days=REFRESH_TOKEN_EXPIRY)
            )
            
            # Blacklist old refresh token
            await add_jti_to_blocklist(token_details['jti'], is_refresh=True)
            
            # Set new refresh token cookie
            response.set_cookie(
                key="refresh_token",
                value=new_refresh_token,
                max_age=REFRESH_TOKEN_EXPIRY * 24 * 3600,
                httponly=True,
                secure=False,  # False for localhost development
                samesite="none", 
                path="/"
            )
        
        return response
        
    raise InvalidToken()

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