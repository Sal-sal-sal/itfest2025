"""AI сервисы для Help Desk."""

from .ai_service import AIService, ai_service
from .rag_service import RAGService, rag_service

__all__ = [
    "AIService",
    "ai_service",
    "RAGService", 
    "rag_service",
]

