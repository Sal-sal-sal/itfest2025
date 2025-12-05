"""API роуты для Email интеграции."""

import asyncio
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from ....db.session import get_session
from ....services.integrations.email_service import email_service
from ....services.ticket_service import TicketService
from ....services.AI import rag_service
from ....schemas.ticket import TicketCreate, TicketSource, TicketPriority

router = APIRouter(prefix="/email", tags=["email"])

# Хранилище обработанных email (чтобы не дублировать)
processed_emails: set[str] = set()

# Флаг работы поллинга
email_polling_active = False


class EmailWebhookPayload(BaseModel):
    """Payload для входящего email (от внешних сервисов типа SendGrid, Mailgun)."""
    from_email: str
    from_name: str | None = None
    subject: str
    body: str
    message_id: str | None = None
    timestamp: str | None = None


class ManualEmailRequest(BaseModel):
    """Ручное создание тикета из email."""
    from_email: str
    from_name: str | None = None
    subject: str
    body: str


@router.post("/webhook")
async def receive_email_webhook(
    payload: EmailWebhookPayload,
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    """
    Webhook для приёма входящих email.
    
    Используется с сервисами типа SendGrid Inbound Parse, Mailgun, etc.
    """
    try:
        # Проверяем, не обработано ли уже
        if payload.message_id and payload.message_id in processed_emails:
            return {"status": "duplicate", "message": "Email already processed"}
        
        # AI классификация и ответ
        language = "ru"  # По умолчанию русский
        
        # Определяем язык по тексту
        if any(c in payload.body for c in "әғқңөұүһі"):
            language = "kz"
        
        # Обрабатываем через AI
        ai_result = await rag_service.chat(
            message=f"Тема: {payload.subject}\n\n{payload.body}",
            conversation_history=None,
            language=language,
        )
        
        # Создаём тикет
        ticket_service = TicketService(session)
        
        # Определяем приоритет из AI
        priority = "medium"
        tool_call = ai_result.get("tool_call")
        if tool_call and tool_call.get("result", {}).get("priority"):
            priority = tool_call["result"]["priority"]
        
        ticket_data = TicketCreate(
            subject=payload.subject,
            description=payload.body,
            client_name=payload.from_name or payload.from_email.split("@")[0],
            client_email=payload.from_email,
            source=TicketSource.EMAIL,
            priority=TicketPriority(priority),
        )
        
        db_ticket, classification = await ticket_service.create_ticket(ticket_data)
        
        # Помечаем как обработанное
        if payload.message_id:
            processed_emails.add(payload.message_id)
        
        # Отправляем подтверждение
        await email_service.send_ticket_confirmation(
            to_email=payload.from_email,
            ticket_number=db_ticket.ticket_number,
            subject=payload.subject,
        )
        
        # Если AI может сразу ответить (авто-решение)
        if ai_result.get("can_auto_resolve") and not tool_call:
            await email_service.send_ticket_response(
                to_email=payload.from_email,
                ticket_number=db_ticket.ticket_number,
                original_subject=payload.subject,
                response=ai_result["response"],
                reply_to_message_id=payload.message_id,
            )
        
        return {
            "status": "ok",
            "ticket_number": db_ticket.ticket_number,
            "ai_can_resolve": ai_result.get("can_auto_resolve", False),
        }
        
    except Exception as e:
        print(f"Email webhook error: {e}")
        import traceback
        traceback.print_exc()
        return {"status": "error", "message": str(e)}


@router.post("/manual")
async def create_ticket_from_email(
    request: ManualEmailRequest,
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    """
    Ручное создание тикета из email (для интерфейса оператора).
    """
    payload = EmailWebhookPayload(
        from_email=request.from_email,
        from_name=request.from_name,
        subject=request.subject,
        body=request.body,
    )
    return await receive_email_webhook(payload, session)


@router.post("/fetch")
async def fetch_emails(
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_session),
    limit: int = 10,
) -> dict[str, Any]:
    """
    Ручной запуск проверки новых email через IMAP.
    """
    if not email_service.enabled:
        return {"status": "error", "message": "Email service not configured"}
    
    # Получаем новые письма
    emails = await email_service.fetch_new_emails(limit=limit)
    
    created_tickets = []
    
    for email_data in emails:
        # Проверяем, не обработано ли
        if email_data["message_id"] in processed_emails:
            continue
        
        try:
            # Создаём тикет через webhook handler
            payload = EmailWebhookPayload(
                from_email=email_data["from_email"],
                from_name=email_data["from_name"],
                subject=email_data["subject"],
                body=email_data["body"],
                message_id=email_data["message_id"],
                timestamp=email_data["timestamp"].isoformat(),
            )
            
            result = await receive_email_webhook(payload, session)
            
            if result.get("ticket_number"):
                created_tickets.append(result["ticket_number"])
                
                # Помечаем как прочитанное в IMAP
                await email_service.mark_as_read(email_data["imap_id"])
                
        except Exception as e:
            print(f"Error processing email: {e}")
            continue
    
    return {
        "status": "ok",
        "fetched": len(emails),
        "created_tickets": created_tickets,
    }


@router.get("/status")
async def get_status() -> dict[str, Any]:
    """Статус Email интеграции."""
    return {
        "enabled": email_service.enabled,
        "imap_server": email_service.imap_server,
        "smtp_server": email_service.smtp_server,
        "email_address": email_service.email_address[:5] + "***" if email_service.email_address else None,
        "processed_count": len(processed_emails),
        "polling_active": email_polling_active,
    }


@router.post("/polling/start")
async def start_polling(
    background_tasks: BackgroundTasks,
    interval_seconds: int = 60,
) -> dict[str, Any]:
    """
    Запуск автоматической проверки email.
    
    Args:
        interval_seconds: Интервал проверки в секундах
    """
    global email_polling_active
    
    if not email_service.enabled:
        return {"status": "error", "message": "Email service not configured"}
    
    if email_polling_active:
        return {"status": "already_running"}
    
    email_polling_active = True
    
    async def poll_emails():
        global email_polling_active
        while email_polling_active:
            try:
                # Здесь нужна новая сессия для каждой итерации
                # В реальном приложении использовать proper dependency injection
                print(f"[Email Polling] Checking for new emails...")
                emails = await email_service.fetch_new_emails(limit=10)
                print(f"[Email Polling] Found {len(emails)} new emails")
            except Exception as e:
                print(f"[Email Polling] Error: {e}")
            
            await asyncio.sleep(interval_seconds)
    
    background_tasks.add_task(poll_emails)
    
    return {"status": "started", "interval": interval_seconds}


@router.post("/polling/stop")
async def stop_polling() -> dict[str, Any]:
    """Остановка автоматической проверки email."""
    global email_polling_active
    email_polling_active = False
    return {"status": "stopped"}


@router.post("/test-send")
async def test_send_email(
    to_email: str,
    subject: str = "Test Email",
    body: str = "This is a test email from Help Desk.",
) -> dict[str, Any]:
    """Тестовая отправка email."""
    success = await email_service.send_email(to_email, subject, body)
    return {"success": success}



