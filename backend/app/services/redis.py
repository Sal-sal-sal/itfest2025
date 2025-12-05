"""Redis клиент и вспомогательные функции."""

from collections.abc import AsyncIterator

import redis.asyncio as redis

from ..core.config import get_settings

settings = get_settings()


def create_redis_client() -> redis.Redis:
    return redis.from_url(
        settings.redis_url,
        encoding="utf-8",
        decode_responses=True,
    )


redis_client = create_redis_client()


async def get_redis() -> AsyncIterator[redis.Redis]:
    try:
        yield redis_client
    finally:
        # соединение управляется соединительным пулом, явное закрытие не требуется
        ...

