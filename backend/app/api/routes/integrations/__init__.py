"""API роуты для интеграций с внешними каналами."""

from fastapi import APIRouter

from .whatsapp import router as whatsapp_router
from .twilio_whatsapp import router as twilio_whatsapp_router
from .email import router as email_router
from .twilio_voice import router as twilio_voice_router

router = APIRouter(prefix="/integrations", tags=["integrations"])

router.include_router(whatsapp_router)
router.include_router(twilio_whatsapp_router)
router.include_router(email_router)
router.include_router(twilio_voice_router)

