"""API роуты для голосовой интеграции через Twilio Voice."""

import logging
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, Request, Form
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from twilio.twiml.voice_response import VoiceResponse, Gather, Dial

from ....db.session import get_session
from ....services.ticket_service import TicketService
from ....services.AI import rag_service
from ....schemas.ticket import TicketCreate, TicketSource, TicketPriority
from ....core.config import get_settings
from ..chat import escalations_store

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/twilio-voice", tags=["twilio-voice"])
settings = get_settings()

# In-memory хранилище голосовых сессий (CallSid -> данные)
voice_sessions: dict[str, dict[str, Any]] = {}


def get_operator_phone() -> str | None:
    """Получить номер телефона оператора из настроек."""
    return getattr(settings, 'OPERATOR_PHONE_NUMBER', None)


@router.post("/incoming")
async def handle_incoming_call(
    request: Request,
    CallSid: str = Form(default=""),
    From: str = Form(default=""),
    To: str = Form(default=""),
    CallerName: str = Form(default=""),
) -> Response:
    """
    Обработка входящего звонка.
    
    Twilio вызывает этот webhook когда кто-то звонит на наш номер.
    Возвращаем TwiML с приветствием и запросом голосового ввода.
    """
    logger.info(f"📞 Incoming call from {From} (CallSid: {CallSid})")
    
    # Создаём сессию для этого звонка
    voice_sessions[CallSid] = {
        "from_number": From,
        "to_number": To,
        "caller_name": CallerName or "Клиент",
        "started_at": datetime.now().isoformat(),
        "conversation": [],
        "language": "ru",
        "escalated": False,
    }
    
    # Создаём TwiML ответ
    response = VoiceResponse()
    
    # Приветствие
    response.say(
        "Здравствуйте! Вы позвонили в службу поддержки. "
        "Я виртуальный ассистент и постараюсь вам помочь. "
        "Пожалуйста, опишите вашу проблему после сигнала.",
        voice="alice",  # Русский женский голос
        language="ru-RU",
    )
    
    # Собираем голосовой ввод
    gather = Gather(
        input="speech",
        language="ru-RU",
        speech_timeout="auto",
        action="/api/v1/integrations/twilio-voice/process-speech",
        method="POST",
    )
    response.append(gather)
    
    # Если пользователь ничего не сказал
    response.say(
        "Извините, я вас не услышала. Попробуйте ещё раз.",
        voice="alice",
        language="ru-RU",
    )
    response.redirect("/api/v1/integrations/twilio-voice/incoming")
    
    return Response(content=str(response), media_type="application/xml")


@router.post("/process-speech")
async def process_speech(
    request: Request,
    session: AsyncSession = Depends(get_session),
    CallSid: str = Form(default=""),
    SpeechResult: str = Form(default=""),
    Confidence: float = Form(default=0.0),
    From: str = Form(default=""),
) -> Response:
    """
    Обработка распознанной речи.
    
    Twilio отправляет сюда результат распознавания речи.
    Мы обрабатываем через AI и отвечаем голосом.
    """
    logger.info(f"🎤 Speech from {From}: '{SpeechResult}' (confidence: {Confidence})")
    
    # Получаем сессию
    call_session = voice_sessions.get(CallSid, {
        "from_number": From,
        "conversation": [],
        "language": "ru",
        "escalated": False,
    })
    
    user_text = SpeechResult.strip()
    
    if not user_text:
        response = VoiceResponse()
        response.say(
            "Извините, я не расслышала. Повторите, пожалуйста.",
            voice="alice",
            language="ru-RU",
        )
        gather = Gather(
            input="speech",
            language="ru-RU",
            speech_timeout="auto",
            action="/api/v1/integrations/twilio-voice/process-speech",
            method="POST",
        )
        response.append(gather)
        return Response(content=str(response), media_type="application/xml")
    
    # Добавляем в историю
    call_session["conversation"].append({
        "content": user_text,
        "is_user": True,
        "timestamp": datetime.now().isoformat(),
    })
    
    # Определяем язык (казахский или русский)
    language = "kz" if any(c in user_text for c in "әғқңөұүһі") else "ru"
    call_session["language"] = language
    
    # Обрабатываем через AI
    try:
        history = [
            {"content": msg["content"], "is_user": msg["is_user"]}
            for msg in call_session["conversation"][:-1]
        ]
        
        ai_result = await rag_service.chat(
            message=user_text,
            conversation_history=history,
            language=language,
        )
        
        response_text = ai_result["response"]
        tool_call = ai_result.get("tool_call")
        
        logger.info(f"🤖 AI response: {response_text[:100]}...")
        
    except Exception as e:
        logger.error(f"AI error: {e}")
        response_text = "Извините, произошла ошибка. Сейчас переведу вас на оператора."
        tool_call = {"name": "escalate_to_operator"}
    
    # Добавляем ответ AI в историю
    call_session["conversation"].append({
        "content": response_text,
        "is_user": False,
        "timestamp": datetime.now().isoformat(),
    })
    
    # Сохраняем сессию
    voice_sessions[CallSid] = call_session
    
    # Создаём TwiML ответ
    response = VoiceResponse()
    
    # Проверяем нужна ли эскалация на оператора
    if tool_call and tool_call.get("name") == "escalate_to_operator":
        return await _transfer_to_operator(
            response, CallSid, call_session, session, user_text, tool_call.get("result", {})
        )
    
    # Озвучиваем ответ AI
    # Очищаем от эмодзи и markdown для голоса
    clean_response = _clean_for_speech(response_text)
    response.say(clean_response, voice="alice", language="ru-RU")
    
    # Спрашиваем есть ли ещё вопросы
    response.say(
        "Могу ли я ещё чем-то помочь?",
        voice="alice",
        language="ru-RU",
    )
    
    # Собираем следующий голосовой ввод
    gather = Gather(
        input="speech",
        language="ru-RU",
        speech_timeout="auto",
        action="/api/v1/integrations/twilio-voice/process-speech",
        method="POST",
    )
    response.append(gather)
    
    # Если молчание - завершаем
    response.say(
        "Спасибо за звонок. До свидания!",
        voice="alice",
        language="ru-RU",
    )
    response.hangup()
    
    return Response(content=str(response), media_type="application/xml")


async def _transfer_to_operator(
    response: VoiceResponse,
    call_sid: str,
    call_session: dict,
    session: AsyncSession,
    user_text: str,
    tool_result: dict,
) -> Response:
    """Перевод звонка на оператора."""
    
    operator_phone = get_operator_phone()
    
    if not operator_phone:
        response.say(
            "К сожалению, сейчас все операторы заняты. "
            "Пожалуйста, перезвоните позже или оставьте сообщение на нашем сайте.",
            voice="alice",
            language="ru-RU",
        )
        response.hangup()
        return Response(content=str(response), media_type="application/xml")
    
    # Создаём тикет в базе данных
    try:
        ticket_service = TicketService(session)
        
        subject = tool_result.get("summary") or user_text[:100]
        priority_str = tool_result.get("priority", "medium")
        
        ticket_data = TicketCreate(
            subject=subject,
            description=f"Голосовое обращение:\n\n{user_text}",
            client_phone=call_session.get("from_number", ""),
            source=TicketSource.PHONE,
            priority=TicketPriority(priority_str),
        )
        
        db_ticket, classification = await ticket_service.create_ticket(ticket_data)
        ticket_number = db_ticket.ticket_number
        
        logger.info(f"📋 Voice ticket created: {ticket_number}")
        
        # Создаём эскалацию
        escalation = {
            "id": str(len(escalations_store) + 1),
            "escalation_id": ticket_number,
            "client_message": user_text,
            "summary": subject,
            "reason": tool_result.get("reason", "Голосовое обращение"),
            "department": tool_result.get("department", "it_support"),
            "department_name": "IT Поддержка",
            "priority": priority_str,
            "status": "pending",
            "created_at": datetime.now().isoformat(),
            "conversation_history": call_session.get("conversation", []),
            "client_messages": [],
            "operator_messages": [],
            "ticket_id": str(db_ticket.id),
            "source": "phone",
            "phone_number": call_session.get("from_number", ""),
            "call_sid": call_sid,
        }
        escalations_store.append(escalation)
        
    except Exception as e:
        logger.error(f"Error creating voice ticket: {e}")
    
    # Отмечаем что звонок эскалирован
    call_session["escalated"] = True
    voice_sessions[call_sid] = call_session
    
    # Говорим клиенту что переводим
    response.say(
        "Сейчас переведу вас на оператора. Пожалуйста, оставайтесь на линии.",
        voice="alice",
        language="ru-RU",
    )
    
    # Переводим звонок на оператора
    dial = Dial(
        caller_id=call_session.get("from_number", ""),
        timeout=30,
        action="/api/v1/integrations/twilio-voice/dial-status",
    )
    dial.number(operator_phone)
    response.append(dial)
    
    # Если оператор не ответил
    response.say(
        "К сожалению, оператор не ответил. Мы свяжемся с вами в ближайшее время.",
        voice="alice",
        language="ru-RU",
    )
    response.hangup()
    
    return Response(content=str(response), media_type="application/xml")


@router.post("/dial-status")
async def dial_status(
    CallSid: str = Form(default=""),
    DialCallStatus: str = Form(default=""),
    DialCallDuration: int = Form(default=0),
) -> Response:
    """Статус перевода звонка."""
    logger.info(f"📞 Dial status for {CallSid}: {DialCallStatus} (duration: {DialCallDuration}s)")
    
    response = VoiceResponse()
    
    if DialCallStatus == "completed":
        # Звонок успешно завершён
        response.say(
            "Спасибо за звонок. До свидания!",
            voice="alice",
            language="ru-RU",
        )
    elif DialCallStatus in ["busy", "no-answer", "failed"]:
        # Оператор не ответил
        response.say(
            "Оператор сейчас недоступен. Мы перезвоним вам в ближайшее время.",
            voice="alice",
            language="ru-RU",
        )
    
    response.hangup()
    return Response(content=str(response), media_type="application/xml")


@router.get("/status")
async def get_voice_status() -> dict[str, Any]:
    """Статус голосовой интеграции."""
    operator_phone = get_operator_phone()
    
    return {
        "enabled": bool(operator_phone),
        "operator_phone": operator_phone[:4] + "****" + operator_phone[-2:] if operator_phone else None,
        "active_calls": len([s for s in voice_sessions.values() if not s.get("escalated")]),
        "total_calls_today": len(voice_sessions),
    }


@router.get("/calls")
async def list_calls() -> dict[str, Any]:
    """Список звонков."""
    return {
        "count": len(voice_sessions),
        "calls": [
            {
                "call_sid": sid,
                "from": session.get("from_number"),
                "started_at": session.get("started_at"),
                "messages_count": len(session.get("conversation", [])),
                "escalated": session.get("escalated", False),
            }
            for sid, session in voice_sessions.items()
        ]
    }


def _clean_for_speech(text: str) -> str:
    """Очистка текста для синтеза речи."""
    import re
    
    # Убираем эмодзи
    emoji_pattern = re.compile(
        "["
        "\U0001F600-\U0001F64F"  # emoticons
        "\U0001F300-\U0001F5FF"  # symbols & pictographs
        "\U0001F680-\U0001F6FF"  # transport & map symbols
        "\U0001F1E0-\U0001F1FF"  # flags
        "\U00002702-\U000027B0"
        "\U000024C2-\U0001F251"
        "]+",
        flags=re.UNICODE,
    )
    text = emoji_pattern.sub("", text)
    
    # Убираем markdown
    text = re.sub(r'\*\*(.+?)\*\*', r'\1', text)  # **bold**
    text = re.sub(r'\*(.+?)\*', r'\1', text)       # *italic*
    text = re.sub(r'`(.+?)`', r'\1', text)         # `code`
    text = re.sub(r'#+\s*', '', text)               # ### headers
    text = re.sub(r'\[(.+?)\]\(.+?\)', r'\1', text) # [link](url)
    
    # Убираем лишние пробелы
    text = re.sub(r'\s+', ' ', text).strip()
    
    return text

