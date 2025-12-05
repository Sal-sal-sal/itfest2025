"""API маршруты для AI чата с RAG."""

from datetime import datetime
from typing import Any
from pydantic import BaseModel

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ...services.AI import rag_service
from ...services.ticket_service import TicketService
from ...schemas.ticket import TicketCreate, TicketPriority, TicketSource
from ...db.session import get_session
from ...services.integrations.twilio_whatsapp import twilio_whatsapp_service
from ...services.escalation_store import escalation_store
from ...core.redis import redis_service


router = APIRouter(prefix="/chat", tags=["chat"])


# ============================================================================
# Deprecated: In-memory fallback (используется escalation_store с Redis)
# ============================================================================
escalations_store: list[dict[str, Any]] = []  # Kept for backward compatibility


class ChatMessage(BaseModel):
    content: str
    is_user: bool


class ChatRequest(BaseModel):
    message: str
    conversation_history: list[ChatMessage] | None = None
    language: str = "ru"
    active_escalation_id: str | None = None  # ID активной эскалации (если общаемся с оператором)


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


class ClientMessageRequest(BaseModel):
    """Сообщение клиента в эскалацию."""
    escalation_id: str
    message: str


@router.post("/escalations/{escalation_id}/messages")
async def add_client_message(
    escalation_id: str,
    request: ClientMessageRequest,
) -> dict[str, Any]:
    """
    Добавить сообщение клиента в эскалацию.
    Используется когда клиент уже общается с оператором.
    """
    result = await escalation_store.add_client_message(escalation_id, request.message)
    if result:
        return {"success": True, "escalation": result}
    
    return {"success": False, "error": "Эскалация не найдена"}


@router.post("", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    session: AsyncSession = Depends(get_session),
) -> ChatResponse:
    """
    AI чат с иерархическим RAG.
    
    Выполняет:
    1. Проверка активных эскалаций (если есть - сообщение идет оператору)
    2. Поиск по иерархической базе знаний
    3. Формирование контекста
    4. Генерация ответа через OpenAI (или fallback)
    5. Сохранение эскалаций для операторов
    6. Создание тикетов в базе данных
    """
    # Check if there's an active escalation for this conversation
    # We check by looking at conversation history for escalation IDs
    active_escalation_id = request.active_escalation_id if hasattr(request, 'active_escalation_id') else None
    
    if active_escalation_id:
        # Find the escalation and add message
        result = await escalation_store.add_client_message(active_escalation_id, request.message)
        if result:
            # Return a waiting message
            return ChatResponse(
                response="📨 Ваше сообщение отправлено оператору. Ожидайте ответа.",
                sources=[],
                can_auto_resolve=False,
                suggested_priority="medium",
                tool_call=None,
            )
    
    history = None
    if request.conversation_history:
        history = [{"content": m.content, "is_user": m.is_user} for m in request.conversation_history]
    
    result = await rag_service.chat(
        message=request.message,
        conversation_history=history,
        language=request.language,
    )
    
    # Если был tool_call с эскалацией - создаём тикет в БД и сохраняем для оператора
    if result.get("tool_call") and result["tool_call"].get("name") == "escalate_to_operator":
        tool_result = result["tool_call"]["result"]
        
        # Определяем department_id для эскалации
        dept_mapping = {
            "it_support": "11111111-1111-1111-1111-111111111111",
            "hr": "22222222-2222-2222-2222-222222222222",
            "finance": "33333333-3333-3333-3333-333333333333",
            "facilities": "44444444-4444-4444-4444-444444444444",
        }
        
        dept = tool_result.get("department", "it_support")
        priority_str = tool_result.get("priority", "medium")
        
        # Создаём тикет в базе данных для эскалации
        ticket_number = tool_result.get("escalation_id")
        ticket_id = None
        try:
            ticket_service = TicketService(session)
            ticket_data = TicketCreate(
                subject=tool_result.get("summary", "Эскалированное обращение"),
                description=request.message,
                priority=TicketPriority(priority_str),
                source=TicketSource.CHAT,
                department_id=dept_mapping.get(dept),
            )
            # create_ticket returns tuple (Ticket, AIClassificationResult)
            db_ticket, classification = await ticket_service.create_ticket(ticket_data)
            ticket_number = db_ticket.ticket_number
            ticket_id = str(db_ticket.id)
            
            # Обновляем результат с реальным номером тикета
            tool_result["escalation_id"] = ticket_number
            tool_result["ticket_id"] = ticket_id
            result["tool_call"]["result"] = tool_result
        except Exception as e:
            print(f"Error creating escalation ticket in DB: {e}")
            import traceback
            traceback.print_exc()
        
        # Генерируем уникальный ID для Redis
        import uuid as uuid_module
        escalation = {
            "id": str(uuid_module.uuid4()),
            "escalation_id": ticket_number,
            "client_message": request.message,
            "summary": tool_result.get("summary", ""),
            "reason": tool_result.get("reason", ""),
            "department": dept,
            "department_name": tool_result.get("department_name", "IT Поддержка"),
            "priority": priority_str,
            "status": "pending",
            "created_at": datetime.utcnow().isoformat() + "Z",
            "conversation_history": [
                {"content": m.content, "is_user": m.is_user}
                for m in (request.conversation_history or [])
            ] + [{"content": request.message, "is_user": True}],
            "client_messages": [],
            "operator_messages": [],
            "ticket_id": ticket_id,  # Связь с БД тикетом
        }
        await escalation_store.add(escalation)
    
    # Если был tool_call с созданием тикета - сохраняем в базу данных
    if result.get("tool_call") and result["tool_call"].get("name") == "create_ticket":
        tool_result = result["tool_call"]["result"]
        
        # Определяем department_id
        dept_mapping = {
            "it_support": "11111111-1111-1111-1111-111111111111",
            "hr": "22222222-2222-2222-2222-222222222222",
            "finance": "33333333-3333-3333-3333-333333333333",
            "facilities": "44444444-4444-4444-4444-444444444444",
        }
        dept_name_mapping = {
            "it_support": "IT Поддержка",
            "hr": "HR / Кадры",
            "finance": "Финансы",
            "facilities": "АХО",
        }
        
        dept = tool_result.get("department", "it_support")
        priority_str = tool_result.get("priority", "medium")
        
        # Создаём тикет в базе данных
        ticket_number = None
        ticket_id = None
        try:
            ticket_service = TicketService(session)
            ticket_data = TicketCreate(
                subject=tool_result.get("subject", "Новое обращение"),
                description=tool_result.get("description", request.message),
                client_email=tool_result.get("client_email"),
                priority=TicketPriority(priority_str),
                source=TicketSource.CHAT,
                department_id=dept_mapping.get(dept),
            )
            # create_ticket returns tuple (Ticket, AIClassificationResult)
            db_ticket, classification = await ticket_service.create_ticket(ticket_data)
            
            # Обновляем номер тикета в результате
            ticket_number = db_ticket.ticket_number
            ticket_id = str(db_ticket.id)
            tool_result["ticket_number"] = ticket_number
            tool_result["ticket_id"] = ticket_id
            tool_result["ai_auto_resolved"] = db_ticket.ai_auto_resolved
            result["tool_call"]["result"] = tool_result
        except Exception as e:
            print(f"Error creating ticket in DB: {e}")
            import traceback
            traceback.print_exc()
        
        # Также сохраняем для оператора (Redis/memory)
        import uuid as uuid_module
        escalation = {
            "id": str(uuid_module.uuid4()),
            "escalation_id": ticket_number or tool_result.get("ticket_number"),
            "client_message": request.message,
            "summary": tool_result.get("subject", ""),
            "reason": "Клиент создал тикет",
            "department": dept,
            "department_name": dept_name_mapping.get(dept, "IT Поддержка"),
            "priority": priority_str,
            "status": "pending",
            "created_at": datetime.utcnow().isoformat() + "Z",
            "conversation_history": [
                {"content": m.content, "is_user": m.is_user}
                for m in (request.conversation_history or [])
            ] + [{"content": request.message, "is_user": True}],
            "client_messages": [],
            "operator_messages": [],
            "ticket_id": ticket_id,  # Связь с БД тикетом
        }
        await escalation_store.add(escalation)
    
    # Если был tool_call с отметкой "решено AI" - создаём/обновляем тикет как авто-решённый
    if result.get("tool_call") and result["tool_call"].get("name") == "mark_resolved_by_ai":
        tool_result = result["tool_call"]["result"]
        
        try:
            ticket_service = TicketService(session)
            from ...models.ticket import TicketStatus
            
            # Определяем тему из истории разговора
            subject = "Запрос решён AI"
            if request.conversation_history and len(request.conversation_history) > 0:
                first_message = request.conversation_history[0].content
                subject = first_message[:100] + ("..." if len(first_message) > 100 else "")
            
            # Создаём новый тикет как авто-решённый
            ticket_data = TicketCreate(
                subject=subject,
                description=f"Решение: {tool_result.get('resolution_summary', '')}\n\nИсходный запрос: {request.message}",
                priority=TicketPriority.LOW,
                source=TicketSource.CHAT,
            )
            
            db_ticket, classification = await ticket_service.create_ticket(ticket_data)
            
            # Принудительно помечаем как авто-решённый AI
            db_ticket.ai_auto_resolved = True
            db_ticket.status = TicketStatus.RESOLVED
            db_ticket.resolved_at = datetime.now()
            db_ticket.first_response_at = datetime.now()
            await session.commit()
            await session.refresh(db_ticket)
            
            # Обновляем результат
            tool_result["ticket_number"] = db_ticket.ticket_number
            tool_result["ticket_id"] = str(db_ticket.id)
            result["tool_call"]["result"] = tool_result
            
            # Добавляем в escalations_store для отслеживания
            escalation = {
                "id": str(len(escalations_store) + 1),
                "escalation_id": db_ticket.ticket_number,
                "client_message": request.message,
                "summary": subject,
                "reason": f"AI решено: {tool_result.get('resolution_summary', '')}",
                "department": "it_support",
                "department_name": "AI Поддержка",
                "priority": "low",
                "status": "resolved",  # Уже решено!
                "created_at": datetime.utcnow().isoformat() + "Z",
                "resolved_at": datetime.now().isoformat(),
                "conversation_history": [
                    {"content": m.content, "is_user": m.is_user}
                    for m in (request.conversation_history or [])
                ] + [{"content": request.message, "is_user": True}],
                "client_messages": [],
                "operator_messages": [],
                "ticket_id": str(db_ticket.id),
                "ai_auto_resolved": True,
            }
            escalations_store.append(escalation)
            
        except Exception as e:
            print(f"Error creating AI-resolved ticket in DB: {e}")
            import traceback
            traceback.print_exc()
    
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
    # Получаем статистику из escalation_store
    stats = await escalation_store.get_stats()
    
    return {
        "total_escalations": stats["total"],
        "pending_escalations": stats["pending"],
        "in_progress_escalations": stats["in_progress"],
        "resolved_escalations": stats["resolved"],
        "resolution_rate": stats["resolved"] / stats["total"] if stats["total"] > 0 else 0,
        "by_department": stats["by_department"],
        "by_priority": stats["by_priority"],
        "ai_enabled": rag_service.use_openai,
        "ai_model": rag_service.model,
        "knowledge_base_categories": len(rag_service.knowledge_base),
        "knowledge_base_articles": sum(
            len(sub.get("articles", []))
            for cat in rag_service.knowledge_base.values()
            for sub in cat.get("subcategories", {}).values()
        ),
        "storage_backend": stats["storage"],
        "redis_connected": redis_service.is_connected,
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
    return await escalation_store.get_all(status)


@router.get("/escalations/{escalation_id}")
async def get_escalation(escalation_id: str) -> dict[str, Any]:
    """Получить детали эскалации по ID."""
    result = await escalation_store.get_by_id(escalation_id)
    if result:
        return result
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


class AnalyzeConversationRequest(BaseModel):
    escalation_id: str
    language: str = "ru"


@router.patch("/escalations/{escalation_id}")
async def update_escalation(
    escalation_id: str,
    request: UpdateEscalationRequest,
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    """
    Обновить статус эскалации (для оператора).
    
    Позволяет:
    - Изменить статус (pending -> in_progress -> resolved)
    - Добавить ответ оператора (добавляется в список сообщений)
    
    Также синхронизирует статус с тикетом в базе данных.
    """
    from ...models.ticket import Ticket, TicketStatus
    from sqlalchemy import select
    import uuid
    
    # Получаем эскалацию
    escalation = await escalation_store.get_by_id(escalation_id)
    if not escalation:
        return {"success": False, "error": "Эскалация не найдена"}
    
    if request.status:
        # Обновляем статус
        await escalation_store.set_status(escalation_id, request.status)
        escalation["status"] = request.status
        
        # Синхронизируем статус с тикетом в БД
        ticket_id = escalation.get("ticket_id")
        if ticket_id:
            try:
                result = await session.execute(
                    select(Ticket).where(Ticket.id == uuid.UUID(ticket_id))
                )
                db_ticket = result.scalar_one_or_none()
                
                if db_ticket:
                    if request.status == "in_progress":
                        db_ticket.status = TicketStatus.PROCESSING
                        db_ticket.first_response_at = db_ticket.first_response_at or datetime.now()
                    elif request.status == "resolved":
                        db_ticket.status = TicketStatus.RESOLVED
                        db_ticket.resolved_at = datetime.now()
                    elif request.status == "pending":
                        db_ticket.status = TicketStatus.NEW
                    
                    await session.commit()
            except Exception as e:
                print(f"Error updating ticket status in DB: {e}")
                import traceback
                traceback.print_exc()
        
        # Если resolved и WhatsApp эскалация — уведомляем клиента
        if request.status == "resolved" and escalation.get("source") == "whatsapp":
            phone_number = escalation.get("phone_number")
            if phone_number:
                try:
                    await twilio_whatsapp_service.send_message(
                        phone_number,
                        "✅ Ваше обращение решено. Спасибо за обращение!\n\nЕсли у вас есть новые вопросы, просто напишите нам."
                    )
                    from .integrations.twilio_whatsapp import phone_to_escalation
                    if phone_number in phone_to_escalation:
                        del phone_to_escalation[phone_number]
                except Exception as e:
                    print(f"Error notifying WhatsApp client about resolution: {e}")
    
    if request.operator_response:
        # Добавляем ответ оператора
        updated = await escalation_store.add_operator_message(escalation_id, request.operator_response)
        if updated:
            escalation = updated
        
        # Если WhatsApp эскалация — отправляем ответ
        if escalation.get("source") == "whatsapp":
            phone_number = escalation.get("phone_number")
            if phone_number:
                try:
                    operator_message = f"👨‍💼 Оператор:\n\n{request.operator_response}"
                    await twilio_whatsapp_service.send_message(phone_number, operator_message)
                    print(f"Operator response sent to WhatsApp: {phone_number}")
                except Exception as e:
                    print(f"Error sending operator response to WhatsApp: {e}")
        
        # Обновляем first_response_at в БД если это первый ответ
        ticket_id = escalation.get("ticket_id")
        if ticket_id:
            try:
                result = await session.execute(
                    select(Ticket).where(Ticket.id == uuid.UUID(ticket_id))
                )
                db_ticket = result.scalar_one_or_none()
                if db_ticket and not db_ticket.first_response_at:
                    db_ticket.first_response_at = datetime.now()
                    if db_ticket.status == TicketStatus.NEW:
                        db_ticket.status = TicketStatus.PROCESSING
                    await session.commit()
            except Exception as e:
                print(f"Error updating ticket first_response_at: {e}")
    
    # Получаем обновлённую эскалацию
    updated_escalation = await escalation_store.get_by_id(escalation_id)
    return {"success": True, "escalation": updated_escalation or escalation}


@router.delete("/escalations/{escalation_id}")
async def delete_escalation(escalation_id: str) -> dict[str, Any]:
    """Удалить эскалацию (после решения)."""
    success = await escalation_store.delete(escalation_id)
    
    if success:
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


@router.post("/analyze-conversation")
async def analyze_conversation(request: AnalyzeConversationRequest) -> dict[str, Any]:
    """
    AI анализирует переписку клиента с оператором и извлекает:
    - Проблему клиента
    - Решение, которое предоставил оператор
    - Предложение для добавления в базу знаний
    """
    # Найти эскалацию
    escalation = await escalation_store.get_by_id(request.escalation_id)
    
    if not escalation:
        return {"success": False, "error": "Эскалация не найдена"}
    
    # Собрать всю переписку
    conversation_text = ""
    
    # Добавляем историю разговора
    for msg in escalation.get("conversation_history", []):
        role = "Клиент" if msg.get("is_user") else ("Оператор" if msg.get("is_operator") else "AI")
        conversation_text += f"{role}: {msg['content']}\n\n"
    
    # Добавляем сообщения клиента
    for msg in escalation.get("client_messages", []):
        conversation_text += f"Клиент: {msg['content']}\n\n"
    
    # Добавляем ответы оператора
    for msg in escalation.get("operator_messages", []):
        conversation_text += f"Оператор: {msg['content']}\n\n"
    
    if not conversation_text.strip():
        return {"success": False, "error": "Нет переписки для анализа"}
    
    # Анализируем с помощью AI
    analysis = await rag_service.analyze_conversation_for_kb(
        conversation_text,
        escalation.get("summary", ""),
        request.language,
    )
    
    return {
        "success": True,
        "analysis": analysis,
        "escalation_id": request.escalation_id,
    }


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
    updated = await escalation_store.update(request.escalation_id, {
        "csat_rating": request.rating,
        "csat_feedback": request.feedback,
        "csat_submitted_at": datetime.utcnow().isoformat() + "Z",
    })
    
    if updated:
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
    all_escalations = await escalation_store.get_all()
    ratings = [e.get("csat_rating") for e in all_escalations if e.get("csat_rating")]
    
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


@router.get("/csat/reviews")
async def get_csat_reviews() -> list[dict[str, Any]]:
    """
    Получить все CSAT отзывы с комментариями.
    
    Возвращает список отзывов, отсортированных по дате.
    """
    all_escalations = await escalation_store.get_all()
    reviews = []
    for e in all_escalations:
        if e.get("csat_rating"):
            reviews.append({
                "escalation_id": e.get("escalation_id"),
                "rating": e.get("csat_rating"),
                "feedback": e.get("csat_feedback"),
                "submitted_at": e.get("csat_submitted_at"),
                "summary": e.get("summary"),
                "department_name": e.get("department_name"),
                "resolved_at": e.get("resolved_at"),
            })
    
    # Sort by submission date (newest first)
    reviews.sort(key=lambda x: x.get("submitted_at", ""), reverse=True)
    return reviews


# ============================================================================
# Redis Stats
# ============================================================================

@router.get("/redis/stats")
async def get_redis_stats() -> dict[str, Any]:
    """
    Получить статистику Redis.
    
    Показывает:
    - Статус подключения
    - Количество эскалаций
    - Количество кешированных RAG ответов
    - Количество сессий
    """
    return await redis_service.get_stats()


@router.post("/redis/invalidate-cache")
async def invalidate_rag_cache() -> dict[str, Any]:
    """
    Инвалидировать кеш RAG.
    
    Используется после добавления новых статей в базу знаний.
    """
    count = await redis_service.invalidate_rag_cache()
    return {
        "success": True,
        "invalidated_entries": count,
        "message": f"Инвалидировано {count} записей кеша",
    }

