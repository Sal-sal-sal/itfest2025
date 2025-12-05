"""API маршруты для AI чата с RAG."""

from typing import Any
from pydantic import BaseModel

from fastapi import APIRouter

from ...services.AI import rag_service


router = APIRouter(prefix="/chat", tags=["chat"])


class ChatMessage(BaseModel):
    content: str
    is_user: bool


class ChatRequest(BaseModel):
    message: str
    conversation_history: list[ChatMessage] | None = None
    language: str = "ru"


class ChatResponse(BaseModel):
    response: str
    sources: list[dict[str, Any]]
    can_auto_resolve: bool
    suggested_priority: str


class KBSearchRequest(BaseModel):
    query: str
    top_k: int = 3


class AddArticleRequest(BaseModel):
    category_key: str
    subcategory_key: str
    question: str
    answer: str
    question_kz: str | None = None
    answer_kz: str | None = None
    can_auto_resolve: bool = False
    priority: str = "medium"


@router.post("", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
    """
    AI чат с иерархическим RAG.
    
    Выполняет:
    1. Поиск по иерархической базе знаний
    2. Формирование контекста
    3. Генерация ответа через OpenAI (или fallback)
    """
    history = None
    if request.conversation_history:
        history = [{"content": m.content, "is_user": m.is_user} for m in request.conversation_history]
    
    result = await rag_service.chat(
        message=request.message,
        conversation_history=history,
        language=request.language,
    )
    
    return ChatResponse(**result)


@router.get("/search")
async def search_knowledge_base(query: str, top_k: int = 3) -> list[dict[str, Any]]:
    """
    Поиск по иерархической базе знаний.
    
    Возвращает топ-K релевантных статей.
    """
    results = rag_service.search_knowledge_base(query, top_k)
    return results


@router.get("/categories")
async def get_categories() -> list[dict[str, Any]]:
    """
    Возвращает структуру категорий базы знаний.
    
    Полезно для построения навигации в UI.
    """
    return rag_service.get_categories()


@router.post("/knowledge-base/add")
async def add_article(request: AddArticleRequest) -> dict[str, Any]:
    """
    Добавляет новую статью в базу знаний.
    
    Позволяет динамически расширять RAG.
    """
    article = {
        "question": request.question,
        "answer": request.answer,
        "can_auto_resolve": request.can_auto_resolve,
        "priority": request.priority,
    }
    
    if request.question_kz:
        article["question_kz"] = request.question_kz
    if request.answer_kz:
        article["answer_kz"] = request.answer_kz
    
    success = rag_service.add_to_knowledge_base(
        category_key=request.category_key,
        subcategory_key=request.subcategory_key,
        article=article,
    )
    
    return {
        "success": success,
        "message": "Статья добавлена" if success else "Ошибка: категория не найдена",
    }


@router.get("/health")
async def health_check() -> dict[str, Any]:
    """Проверка состояния RAG сервиса."""
    return {
        "status": "ok",
        "openai_enabled": rag_service.use_openai,
        "model": rag_service.model,
        "categories_count": len(rag_service.knowledge_base),
    }

