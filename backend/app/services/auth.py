"""Сервис аутентификации."""

import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from ..core import security
from ..core.config import get_settings
from ..models import User
from ..schemas.auth import LoginRequest, TokenPair
from ..schemas.user import UserCreate
from .redis import redis_client

settings = get_settings()


class AuthService:
    """Инкапсулирует бизнес-логику аутентификации."""

    def __init__(self, session: AsyncSession | None):
        self.session = session

    async def register(self, payload: UserCreate) -> tuple[User, TokenPair]:
        session = self._require_session()
        user = User(email=payload.email, hashed_password=security.hash_password(payload.password))
        session.add(user)
        try:
            await session.commit()
        except IntegrityError as exc:
            await session.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Пользователь с таким email уже существует",
            ) from exc
        await session.refresh(user)
        tokens = await self._issue_tokens(user.id)
        return user, tokens

    async def login(self, payload: LoginRequest) -> tuple[User, TokenPair]:
        session = self._require_session()
        stmt = select(User).where(User.email == payload.email)
        user = (await session.execute(stmt)).scalar_one_or_none()
        if not user or not security.verify_password(payload.password, user.hashed_password):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Неверные учетные данные")
        tokens = await self._issue_tokens(user.id)
        return user, tokens

    async def refresh(self, refresh_token: str) -> TokenPair:
        try:
            payload = security.decode_token(refresh_token)
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Невалидный refresh токен") from exc

        if payload.get("type") != "refresh":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Ожидался refresh токен")

        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Refresh токен поврежден")

        stored = await redis_client.get(self._refresh_key(user_id))
        if stored != refresh_token:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh токен не найден")

        return await self._issue_tokens(uuid.UUID(user_id))

    async def _issue_tokens(self, user_id: uuid.UUID) -> TokenPair:
        access_token = security.create_access_token(str(user_id))
        refresh_token = security.create_refresh_token(str(user_id))
        await redis_client.setex(
            self._refresh_key(str(user_id)),
            settings.refresh_token_exp_minutes * 60,
            refresh_token,
        )
        return TokenPair(access_token=access_token, refresh_token=refresh_token)

    @staticmethod
    def _refresh_key(user_id: str) -> str:
        return f"refresh:{user_id}"

    def _require_session(self) -> AsyncSession:
        if not self.session:
            raise RuntimeError("DB session is required for this operation")
        return self.session

