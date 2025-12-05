"""Корневой роутер API."""

from fastapi import APIRouter

from .routes import auth
from .routes.tickets import router as tickets_router, departments_router, categories_router, kb_router
from .routes.chat import router as chat_router
from .routes.integrations import router as integrations_router

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth.router)
api_router.include_router(tickets_router)
api_router.include_router(departments_router)
api_router.include_router(categories_router)
api_router.include_router(kb_router)
api_router.include_router(chat_router)
api_router.include_router(integrations_router)

