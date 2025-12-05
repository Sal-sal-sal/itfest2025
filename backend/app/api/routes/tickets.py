"""API маршруты для тикетов Help Desk."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ...db.session import get_session
from ...schemas.ticket import (
    TicketCreate,
    TicketUpdate,
    TicketRead,
    TicketListRead,
    TicketWithMessages,
    MessageCreate,
    MessageRead,
    AIClassificationResult,
    DashboardStats,
    DepartmentCreate,
    DepartmentRead,
    CategoryCreate,
    CategoryRead,
    KnowledgeBaseCreate,
    KnowledgeBaseRead,
    TicketStatus,
    TicketPriority,
)
from ...services.ticket_service import (
    TicketService,
    DepartmentService,
    CategoryService,
    KnowledgeBaseService,
)
from ...services.AI import ai_service

router = APIRouter(prefix="/tickets", tags=["tickets"])


# Ticket endpoints
@router.post("", response_model=TicketRead, status_code=201)
async def create_ticket(
    payload: TicketCreate,
    session: AsyncSession = Depends(get_session),
) -> TicketRead:
    """
    Создает новый тикет.
    
    AI автоматически:
    - Классифицирует обращение
    - Определяет приоритет
    - Назначает департамент
    - Генерирует автоответ для типовых вопросов
    """
    service = TicketService(session)
    ticket, classification = await service.create_ticket(payload)
    return TicketRead.model_validate(ticket)


@router.get("", response_model=list[TicketListRead])
async def list_tickets(
    status: TicketStatus | None = None,
    priority: TicketPriority | None = None,
    department_id: uuid.UUID | None = None,
    search: Annotated[str | None, Query(max_length=100)] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
    session: AsyncSession = Depends(get_session),
) -> list[TicketListRead]:
    """Возвращает список тикетов с фильтрацией."""
    service = TicketService(session)
    tickets, total = await service.list_tickets(
        status=status,
        priority=priority,
        department_id=department_id,
        search=search,
        limit=limit,
        offset=offset,
    )
    return [TicketListRead.model_validate(t) for t in tickets]


@router.get("/{ticket_id}", response_model=TicketWithMessages)
async def get_ticket(
    ticket_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
) -> TicketWithMessages:
    """Возвращает тикет со всеми сообщениями."""
    service = TicketService(session)
    ticket = await service.get_ticket(ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Тикет не найден")
    return TicketWithMessages.model_validate(ticket)


@router.get("/by-number/{ticket_number}", response_model=TicketWithMessages)
async def get_ticket_by_number(
    ticket_number: str,
    session: AsyncSession = Depends(get_session),
) -> TicketWithMessages:
    """Возвращает тикет по номеру."""
    service = TicketService(session)
    ticket = await service.get_ticket_by_number(ticket_number)
    if not ticket:
        raise HTTPException(status_code=404, detail="Тикет не найден")
    return TicketWithMessages.model_validate(ticket)


@router.patch("/{ticket_id}", response_model=TicketRead)
async def update_ticket(
    ticket_id: uuid.UUID,
    payload: TicketUpdate,
    session: AsyncSession = Depends(get_session),
) -> TicketRead:
    """Обновляет тикет."""
    service = TicketService(session)
    ticket = await service.update_ticket(ticket_id, payload)
    if not ticket:
        raise HTTPException(status_code=404, detail="Тикет не найден")
    return TicketRead.model_validate(ticket)


@router.post("/{ticket_id}/messages", response_model=MessageRead, status_code=201)
async def add_message(
    ticket_id: uuid.UUID,
    payload: MessageCreate,
    is_from_client: bool = False,
    use_ai: bool = False,
    session: AsyncSession = Depends(get_session),
) -> MessageRead:
    """
    Добавляет сообщение в тикет.
    
    - is_from_client: сообщение от клиента
    - use_ai: сгенерировать ответ с помощью AI
    """
    service = TicketService(session)
    message = await service.add_message(
        ticket_id=ticket_id,
        data=payload,
        is_from_client=is_from_client,
        use_ai=use_ai,
    )
    if not message:
        raise HTTPException(status_code=404, detail="Тикет не найден")
    return MessageRead.model_validate(message)


@router.post("/{ticket_id}/escalate", response_model=TicketRead)
async def escalate_ticket(
    ticket_id: uuid.UUID,
    department_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
) -> TicketRead:
    """Эскалирует тикет в другой департамент."""
    service = TicketService(session)
    ticket = await service.escalate_ticket(ticket_id, department_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Тикет не найден")
    return TicketRead.model_validate(ticket)


@router.post("/{ticket_id}/summarize")
async def summarize_ticket(
    ticket_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
) -> dict[str, str]:
    """Создает AI-резюме переписки по тикету."""
    service = TicketService(session)
    summary = await service.summarize_ticket(ticket_id)
    return {"summary": summary}


# AI endpoints
@router.post("/ai/classify", response_model=AIClassificationResult)
async def classify_text(
    subject: str,
    description: str,
    language: str = "ru",
) -> AIClassificationResult:
    """Классифицирует текст без создания тикета (для preview)."""
    return await ai_service.classify_ticket(subject, description, language)


@router.post("/ai/generate-response")
async def generate_ai_response(
    subject: str,
    description: str,
    language: str = "ru",
) -> dict[str, str]:
    """Генерирует AI-ответ на обращение."""
    response = await ai_service.generate_response(
        ticket_subject=subject,
        ticket_description=description,
        conversation_history=[],
        language=language,
    )
    return {"response": response}


@router.post("/ai/translate")
async def translate_text(
    text: str,
    target_language: str,
) -> dict[str, str]:
    """Переводит текст на указанный язык (ru/kz)."""
    translated = await ai_service.translate_text(text, target_language)
    return {"translated": translated}


# Dashboard / Analytics
@router.get("/analytics/dashboard", response_model=DashboardStats)
async def get_dashboard_stats(
    session: AsyncSession = Depends(get_session),
) -> DashboardStats:
    """Возвращает статистику для дашборда."""
    service = TicketService(session)
    return await service.get_dashboard_stats()


# Department endpoints
departments_router = APIRouter(prefix="/departments", tags=["departments"])


@departments_router.post("", response_model=DepartmentRead, status_code=201)
async def create_department(
    payload: DepartmentCreate,
    session: AsyncSession = Depends(get_session),
) -> DepartmentRead:
    """Создает новый департамент."""
    service = DepartmentService(session)
    department = await service.create_department(payload)
    return DepartmentRead.model_validate(department)


@departments_router.get("", response_model=list[DepartmentRead])
async def list_departments(
    session: AsyncSession = Depends(get_session),
) -> list[DepartmentRead]:
    """Возвращает список департаментов."""
    service = DepartmentService(session)
    departments = await service.list_departments()
    return [DepartmentRead.model_validate(d) for d in departments]


# Category endpoints
categories_router = APIRouter(prefix="/categories", tags=["categories"])


@categories_router.post("", response_model=CategoryRead, status_code=201)
async def create_category(
    payload: CategoryCreate,
    session: AsyncSession = Depends(get_session),
) -> CategoryRead:
    """Создает новую категорию."""
    service = CategoryService(session)
    category = await service.create_category(payload)
    return CategoryRead.model_validate(category)


@categories_router.get("", response_model=list[CategoryRead])
async def list_categories(
    department_id: uuid.UUID | None = None,
    session: AsyncSession = Depends(get_session),
) -> list[CategoryRead]:
    """Возвращает список категорий."""
    service = CategoryService(session)
    categories = await service.list_categories(department_id)
    return [CategoryRead.model_validate(c) for c in categories]


# Knowledge Base endpoints  
kb_router = APIRouter(prefix="/knowledge-base", tags=["knowledge-base"])


@kb_router.post("", response_model=KnowledgeBaseRead, status_code=201)
async def create_kb_entry(
    payload: KnowledgeBaseCreate,
    session: AsyncSession = Depends(get_session),
) -> KnowledgeBaseRead:
    """Создает новую запись в базе знаний."""
    service = KnowledgeBaseService(session)
    entry = await service.create_entry(payload)
    return KnowledgeBaseRead.model_validate(entry)


@kb_router.get("/search", response_model=list[KnowledgeBaseRead])
async def search_knowledge_base(
    query: str,
    limit: int = 5,
    session: AsyncSession = Depends(get_session),
) -> list[KnowledgeBaseRead]:
    """Ищет в базе знаний."""
    service = KnowledgeBaseService(session)
    entries = await service.search(query, limit)
    return [KnowledgeBaseRead.model_validate(e) for e in entries]

