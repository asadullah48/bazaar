from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import decode_token
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/v1/auth/login")


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    err = HTTPException(status_code=401, detail="Could not validate credentials")
    try:
        claims = decode_token(token)
    except JWTError:
        raise err
    if claims.get("type") == "refresh":
        raise err
    user_id: str | None = claims.get("sub")
    if user_id is None:
        raise err
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise err
    return user


async def get_current_active_user(user: User = Depends(get_current_user)) -> User:
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Inactive user")
    return user


async def require_seller(user: User = Depends(get_current_active_user)) -> User:
    if user.role != "seller":
        raise HTTPException(status_code=403, detail="Seller role required")
    return user


async def require_admin(user: User = Depends(get_current_active_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin role required")
    return user


async def require_buyer(user: User = Depends(get_current_active_user)) -> User:
    if user.role not in ("consumer", "business_buyer"):
        raise HTTPException(status_code=403, detail="Buyer role required")
    return user
