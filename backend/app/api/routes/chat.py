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


@router.get("/stats")
async def get_ai_stats() -> dict[str, Any]:
    """
    Статистика AI для Dashboard.
    
    Возвращает метрики работы AI системы.
    """
    total_escalations = len(escalations_store)
    pending = len([e for e in escalations_store if e["status"] == "pending"])
    in_progress = len([e for e in escalations_store if e["status"] == "in_progress"])
    resolved = len([e for e in escalations_store if e["status"] == "resolved"])
    
    # Статистика по департаментам
    by_department: dict[str, int] = {}
    by_priority: dict[str, int] = {"low": 0, "medium": 0, "high": 0, "critical": 0}
    
    for e in escalations_store:
        dept = e.get("department", "unknown")
        by_department[dept] = by_department.get(dept, 0) + 1
        priority = e.get("priority", "medium")
        by_priority[priority] = by_priority.get(priority, 0) + 1
    
    return {
        "total_escalations": total_escalations,
        "pending_escalations": pending,
        "in_progress_escalations": in_progress,
        "resolved_escalations": resolved,
        "resolution_rate": resolved / total_escalations if total_escalations > 0 else 0,
        "by_department": by_department,
        "by_priority": by_priority,
        "ai_enabled": rag_service.use_openai,
        "ai_model": rag_service.model,
        "knowledge_base_categories": len(rag_service.knowledge_base),
        "knowledge_base_articles": sum(
            len(sub.get("articles", []))
            for cat in rag_service.knowledge_base.values()
            for sub in cat.get("subcategories", {}).values()
        ),
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


class CSATRatingRequest(BaseModel):
    escalation_id: str
    rating: int  # 1-5 stars
    feedback: str | None = None


class SummarizeRequest(BaseModel):
    text: str
    language: str = "ru"


class TranslateRequest(BaseModel):
    text: str
    target_language: str  # "ru" or "kz"


class GenerateSuggestionRequest(BaseModel):
    client_message: str
    context: str | None = None
    language: str = "ru"


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


# ============================================================================
# AI Tools для операторов
# ============================================================================

@router.post("/summarize")
async def summarize_text(request: SummarizeRequest) -> dict[str, Any]:
    """
    Резюмирование текста с помощью AI.
    
    Полезно для операторов чтобы быстро понять суть длинной переписки.
    """
    summary = await rag_service.summarize(request.text, request.language)
    return {"summary": summary}


@router.post("/translate")
async def translate_text(request: TranslateRequest) -> dict[str, Any]:
    """
    Перевод текста между русским и казахским.
    
    Поддерживает:
    - ru -> kz
    - kz -> ru
    """
    translated = await rag_service.translate(request.text, request.target_language)
    return {"translated": translated, "target_language": request.target_language}


@router.post("/suggest-response")
async def suggest_response(request: GenerateSuggestionRequest) -> dict[str, Any]:
    """
    Генерация подсказки ответа для оператора.
    
    AI анализирует сообщение клиента и предлагает готовый ответ.
    """
    suggestion = await rag_service.generate_response_suggestion(
        request.client_message,
        request.context,
        request.language,
    )
    return {"suggestion": suggestion}


# ============================================================================
# CSAT (Customer Satisfaction Score)
# ============================================================================

@router.post("/csat")
async def submit_csat(request: CSATRatingRequest) -> dict[str, Any]:
    """
    Отправка оценки удовлетворённости клиента (CSAT).
    
    Rating: 1-5 звёзд
    """
    # Найти эскалацию и добавить оценку
    for escalation in escalations_store:
        if escalation["escalation_id"] == request.escalation_id:
            escalation["csat_rating"] = request.rating
            escalation["csat_feedback"] = request.feedback
            escalation["csat_submitted_at"] = datetime.now().isoformat()
            return {
                "success": True,
                "message": "Спасибо за вашу оценку!",
            }
    
    return {"success": False, "error": "Эскалация не найдена"}


@router.get("/csat/stats")
async def get_csat_stats() -> dict[str, Any]:
    """
    Статистика CSAT.
    
    Возвращает средний балл и распределение оценок.
    """
    ratings = [e.get("csat_rating") for e in escalations_store if e.get("csat_rating")]
    
    if not ratings:
        return {
            "average": 0,
            "total_responses": 0,
            "distribution": {1: 0, 2: 0, 3: 0, 4: 0, 5: 0},
            "satisfaction_rate": 0,
        }
    
    distribution = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
    for r in ratings:
        distribution[r] = distribution.get(r, 0) + 1
    
    # Satisfaction rate = % оценок 4-5
    satisfied = sum(1 for r in ratings if r >= 4)
    satisfaction_rate = satisfied / len(ratings) if ratings else 0
    
    return {
        "average": sum(ratings) / len(ratings),
        "total_responses": len(ratings),
        "distribution": distribution,
        "satisfaction_rate": satisfaction_rate,
    }

