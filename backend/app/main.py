from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.router import api_router
from .core.config import get_settings
from .core.redis import redis_service
from .services.redis import redis_client

settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Startup
    await redis_service.connect()
    
    try:
        yield
    finally:
        # Shutdown
        await redis_service.disconnect()
        await redis_client.close()


app = FastAPI(
    title=settings.app_name,
    debug=settings.debug,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.get("/health", tags=["health"])
async def health_check() -> dict[str, str]:
    return {"status": "ok"}

