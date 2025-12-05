"""API роуты для WhatsApp интеграции."""

from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, Query, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from ....db.session import get_session
from ....services.integrations.whatsapp import whatsapp_service
from ....services.ticket_service import TicketService
from ....services.AI import rag_service
from ....schemas.ticket import TicketCreate, TicketSource, TicketPriority

router = APIRouter(prefix="/whatsapp", tags=["whatsapp"])

# In-memory хранилище сессий WhatsApp (номер телефона -> история сообщений)
whatsapp_sessions: dict[str, list[dict[str, Any]]] = {}


@router.get("/webhook")
async def verify_webhook(
    hub_mode: str = Query(None, alias="hub.mode"),
    hub_verify_token: str = Query(None, alias="hub.verify_token"),
    hub_challenge: str = Query(None, alias="hub.challenge"),
) -> Response:
    """
    Верификация webhook от Meta (WhatsApp Business API).
    
    Meta отправляет GET запрос для подтверждения webhook URL.
    """
    result = whatsapp_service.verify_webhook(hub_mode, hub_verify_token, hub_challenge)
    
    if result:
        return Response(content=result, media_type="text/plain")
    
    return Response(content="Verification failed", status_code=403)


@router.post("/webhook")
async def receive_webhook(
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> dict[str, str]:
    """
    Приём входящих сообщений от WhatsApp.
    
    Обрабатывает сообщения и создаёт тикеты / отвечает через AI.
    """
    try:
        payload = await request.json()
        
        # Парсим сообщение
        message_data = whatsapp_service.parse_incoming_message(payload)
        
        if not message_data:
            return {"status": "no_message"}
        
        phone_number = message_data["from_number"]
        contact_name = message_data["contact_name"]
        text = message_data["text"]
        message_id = message_data["message_id"]
        
        # Помечаем как прочитанное
        await whatsapp_service.mark_as_read(message_id)
        
        # Получаем или создаём сессию
        if phone_number not in whatsapp_sessions:
            whatsapp_sessions[phone_number] = []
        
        # Добавляем сообщение в историю
        whatsapp_sessions[phone_number].append({
            "content": text,
            "is_user": True,
            "timestamp": datetime.now().isoformat(),
        })
        
        # Определяем язык (простая проверка на казахский)
        language = "kz" if any(c in text for c in "әғқңөұүһі") else "ru"
        
        # Получаем историю для AI
        history = whatsapp_sessions[phone_number][-10:]  # Последние 10 сообщений
        
        # Обрабатываем через AI RAG
        ai_result = await rag_service.chat(
            message=text,
            conversation_history=history[:-1],  # Без текущего сообщения
            language=language,
        )
        
        response_text = ai_result["response"]
        tool_call = ai_result.get("tool_call")
        
        # Если AI создал тикет или эскалировал
        if tool_call:
            tool_name = tool_call.get("name")
            tool_result = tool_call.get("result", {})
            
            if tool_name in ["escalate_to_operator", "create_ticket"]:
                # Создаём тикет в БД
                ticket_service = TicketService(session)
                
                subject = tool_result.get("summary") or tool_result.get("subject") or text[:100]
                
                ticket_data = TicketCreate(
                    subject=subject,
                    description=f"Обращение из WhatsApp:\n\n{text}",
                    client_name=contact_name,
                    client_phone=phone_number,
                    source=TicketSource.WHATSAPP,
                    priority=TicketPriority(tool_result.get("priority", "medium")),
                )
                
                db_ticket, classification = await ticket_service.create_ticket(ticket_data)
                
                # Добавляем номер тикета в ответ
                response_text += f"\n\n📋 Номер обращения: {db_ticket.ticket_number}"
        
        # Сохраняем ответ AI в историю
        whatsapp_sessions[phone_number].append({
            "content": response_text,
            "is_user": False,
            "timestamp": datetime.now().isoformat(),
        })
        
        # Отправляем ответ в WhatsApp
        await whatsapp_service.send_message(phone_number, response_text)
        
        return {"status": "ok"}
        
    except Exception as e:
        print(f"WhatsApp webhook error: {e}")
        import traceback
        traceback.print_exc()
        return {"status": "error", "message": str(e)}


@router.get("/status")
async def get_status() -> dict[str, Any]:
    """Статус интеграции WhatsApp."""
    return {
        "enabled": whatsapp_service.enabled,
        "active_sessions": len(whatsapp_sessions),
        "phone_number_id": whatsapp_service.phone_number_id[:10] + "..." if whatsapp_service.phone_number_id else None,
    }


@router.post("/send")
async def send_message(
    phone_number: str,
    message: str,
) -> dict[str, Any]:
    """
    Отправка сообщения в WhatsApp (для тестирования / ручной отправки).
    """
    success = await whatsapp_service.send_message(phone_number, message)
    return {"success": success}


@router.delete("/sessions/{phone_number}")
async def clear_session(phone_number: str) -> dict[str, Any]:
    """Очистка сессии пользователя."""
    if phone_number in whatsapp_sessions:
        del whatsapp_sessions[phone_number]
        return {"success": True, "message": "Session cleared"}
    return {"success": False, "message": "Session not found"}

