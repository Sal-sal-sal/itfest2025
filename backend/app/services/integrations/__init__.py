"""Сервисы интеграций с внешними каналами."""

from .whatsapp import WhatsAppService
from .email_service import EmailService

__all__ = ["WhatsAppService", "EmailService"]





