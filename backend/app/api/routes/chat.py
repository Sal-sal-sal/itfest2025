"""API маршруты для AI чата с RAG."""

from datetime import datetime
from typing import Any
from pydantic import BaseModel

from fastapi import APIRouter

from ...services.AI import rag_service


router = APIRouter(prefix="/chat", tags=["chat"])


# ============================================================================
# In-memory storage для эскалаций (в продакшене - база данных)
# ============================================================================
escalations_store: list[dict[str, Any]] = []


class ChatMessage(BaseModel):
    content: str
    is_user: bool


class ChatRequest(BaseModel):
    message: str
    conversation_history: list[ChatMessage] | None = None
    language: str = "ru"


class ToolCallResult(BaseModel):
    name: str
    args: dict[str, Any]
    result: dict[str, Any]


class ChatResponse(BaseModel):
    response: str
    sources: list[dict[str, Any]]
    can_auto_resolve: bool
    suggested_priority: str
    tool_call: ToolCallResult | None = None  # Информация об эскалации/тикете


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
    4. Сохранение эскалаций для операторов
    """
    history = None
    if request.conversation_history:
        history = [{"content": m.content, "is_user": m.is_user} for m in request.conversation_history]
    
    result = await rag_service.chat(
        message=request.message,
        conversation_history=history,
        language=request.language,
    )
    
    # Если был tool_call с эскалацией - сохраняем для оператора
    if result.get("tool_call") and result["tool_call"].get("name") == "escalate_to_operator":
        tool_result = result["tool_call"]["result"]
        escalation = {
            "id": str(len(escalations_store) + 1),
            "escalation_id": tool_result.get("escalation_id"),
            "client_message": request.message,
            "summary": tool_result.get("summary", ""),
            "reason": tool_result.get("reason", ""),
            "department": tool_result.get("department", "it_support"),
            "department_name": tool_result.get("department_name", "IT Поддержка"),
            "priority": tool_result.get("priority", "medium"),
            "status": "pending",
            "created_at": datetime.now().isoformat(),
            "conversation_history": [
                {"content": m.content, "is_user": m.is_user}
                for m in (request.conversation_history or [])
            ] + [{"content": request.message, "is_user": True}],
        }
        escalations_store.append(escalation)
    
    # Если был tool_call с созданием тикета - тоже сохраняем
    if result.get("tool_call") and result["tool_call"].get("name") == "create_ticket":
        tool_result = result["tool_call"]["result"]
        escalation = {
            "id": str(len(escalations_store) + 1),
            "escalation_id": tool_result.get("ticket_number"),
            "client_message": request.message,
            "summary": tool_result.get("subject", ""),
            "reason": "Клиент создал тикет",
            "department": tool_result.get("department", "it_support"),
            "department_name": "IT Поддержка",
            "priority": tool_result.get("priority", "medium"),
            "status": "pending",
            "created_at": datetime.now().isoformat(),
            "conversation_history": [
                {"content": m.content, "is_user": m.is_user}
                for m in (request.conversation_history or [])
            ] + [{"content": request.message, "is_user": True}],
        }
        escalations_store.append(escalation)
    
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


# ============================================================================
# API для операторов - управление эскалациями
# ============================================================================

@router.get("/escalations")
async def get_escalations(status: str | None = None) -> list[dict[str, Any]]:
    """
    Получить список эскалированных обращений.
    
    Args:
        status: Фильтр по статусу (pending, in_progress, resolved)
    """
    if status:
        return [e for e in escalations_store if e["status"] == status]
    return escalations_store


@router.get("/escalations/{escalation_id}")
async def get_escalation(escalation_id: str) -> dict[str, Any]:
    """Получить детали эскалации по ID."""
    for escalation in escalations_store:
        if escalation["escalation_id"] == escalation_id or escalation["id"] == escalation_id:
            return escalation
    return {"error": "Эскалация не найдена"}


class UpdateEscalationRequest(BaseModel):
    status: str | None = None
    operator_response: str | None = None


@router.patch("/escalations/{escalation_id}")
async def update_escalation(
    escalation_id: str,
    request: UpdateEscalationRequest,
) -> dict[str, Any]:
    """
    Обновить статус эскалации (для оператора).
    
    Позволяет:
    - Изменить статус (pending -> in_progress -> resolved)
    - Добавить ответ оператора
    """
    for i, escalation in enumerate(escalations_store):
        if escalation["escalation_id"] == escalation_id or escalation["id"] == escalation_id:
            if request.status:
                escalations_store[i]["status"] = request.status
            if request.operator_response:
                escalations_store[i]["operator_response"] = request.operator_response
                escalations_store[i]["resolved_at"] = datetime.now().isoformat()
            return {"success": True, "escalation": escalations_store[i]}
    
    return {"success": False, "error": "Эскалация не найдена"}


@router.delete("/escalations/{escalation_id}")
async def delete_escalation(escalation_id: str) -> dict[str, Any]:
    """Удалить эскалацию (после решения)."""
    global escalations_store
    initial_len = len(escalations_store)
    escalations_store = [
        e for e in escalations_store
        if e["escalation_id"] != escalation_id and e["id"] != escalation_id
    ]
    
    if len(escalations_store) < initial_len:
        return {"success": True, "message": "Эскалация удалена"}
    return {"success": False, "error": "Эскалация не найдена"}

