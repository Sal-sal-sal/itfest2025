"""API роуты для WhatsApp интеграции через Twilio."""

import logging
import uuid as uuid_module
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, Request, Form, Header
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from ....db.session import get_session
from ....services.integrations.twilio_whatsapp import twilio_whatsapp_service
from ....services.ticket_service import TicketService
from ....services.AI import rag_service
from ....schemas.ticket import TicketCreate, TicketSource, TicketPriority
# Используем новое хранилище эскалаций с поддержкой Redis
from ....services.escalation_store import escalation_store

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/twilio-whatsapp", tags=["twilio-whatsapp"])

# In-memory хранилище сессий (номер телефона -> история и связь с эскалацией)
twilio_sessions: dict[str, dict[str, Any]] = {}
# Маппинг номер телефона -> ID эскалации (для связи с оператором)
phone_to_escalation: dict[str, str] = {}


@router.post("/webhook")
async def twilio_webhook(
    request: Request,
    session: AsyncSession = Depends(get_session),
    # Twilio form fields
    From: str = Form(default=""),
    To: str = Form(default=""),
    Body: str = Form(default=""),
    MessageSid: str = Form(default=""),
    ProfileName: str = Form(default="WhatsApp User"),
    NumMedia: int = Form(default=0),
    # Twilio signature for validation
    x_twilio_signature: str = Header(default="", alias="X-Twilio-Signature"),
) -> Response:
    """
    Webhook для приёма сообщений от Twilio WhatsApp.
    
    Twilio отправляет POST с form-urlencoded данными.
    Ответ должен быть TwiML (XML) или пустой.
    """
    try:
        # Парсим данные
        phone_number = From.replace("whatsapp:", "")
        text = Body.strip()
        
        logger.info(f"📱 WhatsApp message from {phone_number}: {text[:50]}...")
        
        if not text:
            logger.warning("Empty message received, skipping")
            return Response(content="", media_type="text/xml")
        
        # Получаем или создаём сессию
        if phone_number not in twilio_sessions:
            twilio_sessions[phone_number] = {
                "history": [],
                "client_name": ProfileName,
                "escalation_id": None,
            }
            logger.info(f"New session created for {phone_number}")
        
        # Добавляем сообщение в историю
        twilio_sessions[phone_number]["history"].append({
            "content": text,
            "is_user": True,
            "timestamp": datetime.now().isoformat(),
        })
        
        # ============================================================
        # Проверяем есть ли активная эскалация для этого номера
        # ============================================================
        active_escalation_id = phone_to_escalation.get(phone_number)
        
        if active_escalation_id:
            # Ищем эскалацию и добавляем сообщение клиента
            escalation = await escalation_store.get_by_id(active_escalation_id)
            if escalation:
                if escalation.get("status") not in ["resolved", "closed"]:
                    # Добавляем сообщение клиента в эскалацию
                    await escalation_store.add_client_message(active_escalation_id, text)
                    
                    logger.info(f"Message added to escalation {active_escalation_id}")
                    
                    # Уведомляем клиента что сообщение доставлено оператору
                    await twilio_whatsapp_service.send_message(
                        phone_number,
                        "📨 Ваше сообщение отправлено оператору. Ожидайте ответа."
                    )
                    return Response(content="", media_type="text/xml")
                else:
                    # Эскалация закрыта — убираем маппинг
                    del phone_to_escalation[phone_number]
        
        # ============================================================
        # Нет активной эскалации — обрабатываем через AI
        # ============================================================
        
        # Определяем язык
        language = "kz" if any(c in text for c in "әғқңөұүһі") else "ru"
        logger.info(f"Detected language: {language}")
        
        # Получаем историю для AI
        history = twilio_sessions[phone_number]["history"][-10:]
        
        # Обрабатываем через AI RAG
        logger.info("Calling AI RAG service...")
        ai_result = await rag_service.chat(
            message=text,
            conversation_history=[{"content": h["content"], "is_user": h["is_user"]} for h in history[:-1]],
            language=language,
        )
        
        response_text = ai_result["response"]
        tool_call = ai_result.get("tool_call")
        
        logger.info(f"AI response: {response_text[:100]}...")
        if tool_call:
            logger.info(f"AI tool call: {tool_call.get('name')}")
        
        # ============================================================
        # Если AI эскалировал — создаём тикет и эскалацию для оператора
        # ============================================================
        if tool_call:
            tool_name = tool_call.get("name")
            tool_result = tool_call.get("result", {})
            
            if tool_name in ["escalate_to_operator", "create_ticket"]:
                ticket_service = TicketService(session)
                
                subject = tool_result.get("summary") or tool_result.get("subject") or text[:100]
                priority_str = tool_result.get("priority", "medium")
                dept = tool_result.get("department", "it_support")
                
                # Маппинг департаментов
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
                
                ticket_data = TicketCreate(
                    subject=subject,
                    description=f"Обращение из WhatsApp:\n\n{text}",
                    client_name=ProfileName,
                    client_phone=phone_number,
                    source=TicketSource.WHATSAPP,
                    priority=TicketPriority(priority_str),
                    department_id=dept_mapping.get(dept),
                )
                
                db_ticket, classification = await ticket_service.create_ticket(ticket_data)
                ticket_number = db_ticket.ticket_number
                ticket_id = str(db_ticket.id)
                
                response_text += f"\n\n📋 Номер обращения: {ticket_number}"
                logger.info(f"Ticket created: {ticket_number}")
                
                # ============================================================
                # Создаём эскалацию в общем хранилище (с поддержкой Redis)
                # ============================================================
                escalation = {
                    "id": str(uuid_module.uuid4()),
                    "escalation_id": ticket_number,
                    "client_message": text,
                    "summary": subject,
                    "reason": tool_result.get("reason", "Запрос из WhatsApp"),
                    "department": dept,
                    "department_name": dept_name_mapping.get(dept, "IT Поддержка"),
                    "priority": priority_str,
                    "status": "pending",
                    "created_at": datetime.utcnow().isoformat() + "Z",
                    "conversation_history": [
                        {"content": h["content"], "is_user": h["is_user"]}
                        for h in twilio_sessions[phone_number]["history"]
                    ],
                    "client_messages": [],
                    "operator_messages": [],
                    "ticket_id": ticket_id,
                    # WhatsApp-специфичные поля
                    "source": "whatsapp",
                    "phone_number": phone_number,
                    "client_name": ProfileName,
                }
                await escalation_store.add(escalation)
                
                # Связываем номер телефона с эскалацией
                phone_to_escalation[phone_number] = ticket_number
                twilio_sessions[phone_number]["escalation_id"] = ticket_number
                
                logger.info(f"Escalation created for WhatsApp: {ticket_number}")
        
        # ============================================================
        # Если AI решил проблему сам — создаём авто-решённый тикет
        # ============================================================
        if tool_call and tool_call.get("name") == "mark_resolved_by_ai":
            tool_result = tool_call.get("result", {})
            
            ticket_service = TicketService(session)
            from ....models.ticket import TicketStatus
            
            ticket_data = TicketCreate(
                subject=text[:100],
                description=f"AI решено: {tool_result.get('resolution_summary', '')}\n\nИсходный запрос: {text}",
                client_name=ProfileName,
                client_phone=phone_number,
                source=TicketSource.WHATSAPP,
                priority=TicketPriority.LOW,
            )
            
            db_ticket, classification = await ticket_service.create_ticket(ticket_data)
            db_ticket.ai_auto_resolved = True
            db_ticket.status = TicketStatus.RESOLVED
            db_ticket.resolved_at = datetime.now()
            db_ticket.first_response_at = datetime.now()
            await session.commit()
            
            logger.info(f"AI-resolved WhatsApp ticket: {db_ticket.ticket_number}")
        
        # Сохраняем ответ AI в историю
        twilio_sessions[phone_number]["history"].append({
            "content": response_text,
            "is_user": False,
            "timestamp": datetime.now().isoformat(),
        })
        
        # Отправляем ответ через Twilio
        logger.info(f"Sending response to {phone_number}...")
        send_result = await twilio_whatsapp_service.send_message(phone_number, response_text)
        logger.info(f"Send result: {send_result}")
        
        # Возвращаем пустой TwiML (ответ уже отправлен через API)
        return Response(content="", media_type="text/xml")
        
    except Exception as e:
        logger.error(f"Twilio WhatsApp webhook error: {e}")
        import traceback
        traceback.print_exc()
        return Response(content="", media_type="text/xml")


@router.get("/status")
async def get_status() -> dict[str, Any]:
    """Статус интеграции Twilio WhatsApp."""
    return {
        "enabled": twilio_whatsapp_service.enabled,
        "active_sessions": len(twilio_sessions),
        "whatsapp_number": twilio_whatsapp_service.whatsapp_number,
    }


@router.post("/send")
async def send_message(
    phone_number: str,
    message: str,
) -> dict[str, Any]:
    """Отправка сообщения в WhatsApp через Twilio."""
    result = await twilio_whatsapp_service.send_message(phone_number, message)
    return result


@router.delete("/sessions/{phone_number}")
async def clear_session(phone_number: str) -> dict[str, Any]:
    """Очистка сессии пользователя."""
    # Убираем whatsapp: префикс если есть
    phone_number = phone_number.replace("whatsapp:", "")
    
    if phone_number in twilio_sessions:
        del twilio_sessions[phone_number]
        # Также убираем связь с эскалацией
        if phone_number in phone_to_escalation:
            del phone_to_escalation[phone_number]
        return {"success": True, "message": "Session cleared"}
    return {"success": False, "message": "Session not found"}


@router.get("/sessions")
async def list_sessions() -> dict[str, Any]:
    """Список активных сессий."""
    return {
        "count": len(twilio_sessions),
        "sessions": [
            {
                "phone": phone,
                "client_name": session_data.get("client_name", "Unknown"),
                "messages_count": len(session_data.get("history", [])),
                "last_message": session_data["history"][-1]["timestamp"] if session_data.get("history") else None,
                "escalation_id": session_data.get("escalation_id"),
                "has_active_escalation": phone in phone_to_escalation,
            }
            for phone, session_data in twilio_sessions.items()
        ]
    }


