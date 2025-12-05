"""Инициализация асинхронного движка SQLAlchemy и фабрики сессий."""

from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine

from ..core.config import get_settings

settings = get_settings()

engine: AsyncEngine = create_async_engine(
    settings.sqlalchemy_database_uri,
    echo=settings.debug,
    pool_pre_ping=True,  # Проверять соединение перед использованием
    pool_size=5,  # Минимум соединений в пуле
    max_overflow=10,  # Дополнительные соединения при нагрузке
    pool_recycle=300,  # Переподключаться каждые 5 минут
    pool_timeout=30,  # Таймаут ожидания соединения
    future=True,
)

async_session_factory = async_sessionmaker(
    engine,
    expire_on_commit=False,
    class_=AsyncSession,
)


async def get_session() -> AsyncIterator[AsyncSession]:
    """Dependency-инжектор для FastAPI."""
    async with async_session_factory() as session:
        yield session

