from Cal_Backend.db.models import User
from .schemas import  UserCreateModel
from .utils import generate_passwd_hash
from sqlmodel.ext.asyncio.session import AsyncSession
from  sqlmodel import select




class UserService:
    async def get_user_by_email(self, eemail: str, session: AsyncSession):
        statement = select(User).where(User.email == eemail)
        result = await session.execute(statement)
        user1 = result.scalars().first()
        return user1
    
    async def does_user_exists(self, eemail: str, session: AsyncSession):
        user2 =  await self.get_user_by_email(eemail, session)
        return True if user2 is not None else False
    
    async def create_user(self, u_data:UserCreateModel, session: AsyncSession):
        user_data_dict = u_data.model_dump()
        
        new_user = User(
            **user_data_dict
        )
        
        new_user.password_hash = generate_passwd_hash(user_data_dict['password'])
        
        
        session.add(new_user)
        await session.commit()
        
        return new_user