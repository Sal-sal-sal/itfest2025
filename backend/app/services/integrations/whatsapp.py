"""Сервис интеграции с WhatsApp Business API."""

import httpx
from datetime import datetime
from typing import Any

from ...core.config import get_settings

settings = get_settings()


class WhatsAppService:
    """
    Сервис для работы с WhatsApp Business API.
    
    Поддерживает:
    - Приём входящих сообщений через webhook
    - Отправку ответов пользователям
    - Верификацию webhook от Meta
    """
    
    def __init__(self):
        self.api_url = "https://graph.facebook.com/v18.0"
        self.phone_number_id = getattr(settings, 'WHATSAPP_PHONE_NUMBER_ID', None)
        self.access_token = getattr(settings, 'WHATSAPP_ACCESS_TOKEN', None)
        self.verify_token = getattr(settings, 'WHATSAPP_VERIFY_TOKEN', 'helpdesk_verify_token')
        self.enabled = bool(self.phone_number_id and self.access_token)
    
    def verify_webhook(self, mode: str, token: str, challenge: str) -> str | None:
        """
        Верификация webhook от Meta.
        
        Args:
            mode: Должен быть 'subscribe'
            token: Токен верификации
            challenge: Challenge строка от Meta
            
        Returns:
            Challenge строка если верификация успешна, иначе None
        """
        if mode == "subscribe" and token == self.verify_token:
            return challenge
        return None
    
    def parse_incoming_message(self, payload: dict) -> dict[str, Any] | None:
        """
        Парсинг входящего сообщения от WhatsApp.
        
        Args:
            payload: Webhook payload от Meta
            
        Returns:
            Словарь с данными сообщения или None
        """
        try:
            entry = payload.get("entry", [{}])[0]
            changes = entry.get("changes", [{}])[0]
            value = changes.get("value", {})
            
            # Проверяем, есть ли сообщения
            messages = value.get("messages", [])
            if not messages:
                return None
            
            message = messages[0]
            contact = value.get("contacts", [{}])[0]
            
            # Получаем текст сообщения
            message_type = message.get("type")
            text = ""
            
            if message_type == "text":
                text = message.get("text", {}).get("body", "")
            elif message_type == "button":
                text = message.get("button", {}).get("text", "")
            elif message_type == "interactive":
                interactive = message.get("interactive", {})
                if interactive.get("type") == "button_reply":
                    text = interactive.get("button_reply", {}).get("title", "")
                elif interactive.get("type") == "list_reply":
                    text = interactive.get("list_reply", {}).get("title", "")
            else:
                text = f"[{message_type} message]"
            
            return {
                "message_id": message.get("id"),
                "from_number": message.get("from"),
                "contact_name": contact.get("profile", {}).get("name", "WhatsApp User"),
                "text": text,
                "timestamp": datetime.fromtimestamp(int(message.get("timestamp", 0))),
                "type": message_type,
            }
            
        except Exception as e:
            print(f"Error parsing WhatsApp message: {e}")
            return None
    
    async def send_message(self, to_number: str, text: str) -> bool:
        """
        Отправка сообщения в WhatsApp.
        
        Args:
            to_number: Номер телефона получателя
            text: Текст сообщения
            
        Returns:
            True если успешно
        """
        if not self.enabled:
            print("WhatsApp not configured")
            return False
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.api_url}/{self.phone_number_id}/messages",
                    headers={
                        "Authorization": f"Bearer {self.access_token}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "messaging_product": "whatsapp",
                        "recipient_type": "individual",
                        "to": to_number,
                        "type": "text",
                        "text": {"body": text},
                    },
                    timeout=30.0,
                )
                response.raise_for_status()
                return True
        except Exception as e:
            print(f"Error sending WhatsApp message: {e}")
            return False
    
    async def send_template_message(
        self,
        to_number: str,
        template_name: str,
        language_code: str = "ru",
        components: list[dict] | None = None,
    ) -> bool:
        """
        Отправка шаблонного сообщения.
        
        Args:
            to_number: Номер телефона
            template_name: Название шаблона
            language_code: Код языка
            components: Компоненты шаблона
        """
        if not self.enabled:
            return False
        
        try:
            payload = {
                "messaging_product": "whatsapp",
                "to": to_number,
                "type": "template",
                "template": {
                    "name": template_name,
                    "language": {"code": language_code},
                },
            }
            
            if components:
                payload["template"]["components"] = components
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.api_url}/{self.phone_number_id}/messages",
                    headers={
                        "Authorization": f"Bearer {self.access_token}",
                        "Content-Type": "application/json",
                    },
                    json=payload,
                    timeout=30.0,
                )
                response.raise_for_status()
                return True
        except Exception as e:
            print(f"Error sending WhatsApp template: {e}")
            return False
    
    async def mark_as_read(self, message_id: str) -> bool:
        """Пометить сообщение как прочитанное."""
        if not self.enabled:
            return False
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.api_url}/{self.phone_number_id}/messages",
                    headers={
                        "Authorization": f"Bearer {self.access_token}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "messaging_product": "whatsapp",
                        "status": "read",
                        "message_id": message_id,
                    },
                    timeout=30.0,
                )
                response.raise_for_status()
                return True
        except Exception as e:
            print(f"Error marking message as read: {e}")
            return False


# Singleton instance
whatsapp_service = WhatsAppService()





