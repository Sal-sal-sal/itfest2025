"""Маршруты аутентификации."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ...db.session import get_session
from ...schemas.auth import AuthResponse, LoginRequest, RefreshRequest, TokenPair
from ...schemas.user import UserCreate
from ...services.auth import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=AuthResponse, status_code=201)
async def register_user(
    payload: UserCreate,
    session: AsyncSession = Depends(get_session),
) -> AuthResponse:
    service = AuthService(session)
    user, tokens = await service.register(payload)
    return AuthResponse(user=user, tokens=tokens)


@router.post("/login", response_model=AuthResponse)
async def login_user(
    payload: LoginRequest,
    session: AsyncSession = Depends(get_session),
) -> AuthResponse:
    service = AuthService(session)
    user, tokens = await service.login(payload)
    return AuthResponse(user=user, tokens=tokens)


@router.post("/refresh", response_model=TokenPair)
async def refresh_tokens(
    payload: RefreshRequest,
    session: AsyncSession = Depends(get_session),
) -> TokenPair:
    service = AuthService(session)
    return await service.refresh(payload.refresh_token)

