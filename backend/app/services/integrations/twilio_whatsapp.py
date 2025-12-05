"""Сервис интеграции с WhatsApp через Twilio."""

from datetime import datetime
from typing import Any

from twilio.rest import Client
from twilio.request_validator import RequestValidator

from ...core.config import get_settings

settings = get_settings()


class TwilioWhatsAppService:
    """
    Сервис для работы с WhatsApp через Twilio.
    
    Проще настроить чем официальный Meta API.
    Есть Sandbox для тестирования без верификации.
    
    Настройка Sandbox:
    1. Зайдите на https://console.twilio.com/
    2. Messaging -> Try it out -> Send a WhatsApp message
    3. Отправьте код подключения на указанный номер
    4. Настройте webhook URL в консоли Twilio
    """
    
    def __init__(self):
        self.account_sid = getattr(settings, 'TWILIO_ACCOUNT_SID', None)
        self.auth_token = getattr(settings, 'TWILIO_AUTH_TOKEN', None)
        self.whatsapp_number = getattr(settings, 'TWILIO_WHATSAPP_NUMBER', None)
        
        self.enabled = bool(
            self.account_sid and 
            self.auth_token and 
            self.whatsapp_number
        )
        
        if self.enabled:
            self.client = Client(self.account_sid, self.auth_token)
            self.validator = RequestValidator(self.auth_token)
        else:
            self.client = None
            self.validator = None
    
    def validate_request(self, url: str, params: dict, signature: str) -> bool:
        """Проверка подлинности webhook от Twilio."""
        if not self.validator:
            return False
        return self.validator.validate(url, params, signature)
    
    def parse_incoming_message(self, form_data: dict) -> dict[str, Any] | None:
        """
        Парсинг входящего сообщения от Twilio WhatsApp.
        
        Args:
            form_data: Form данные от Twilio webhook
            
        Returns:
            Словарь с данными сообщения
        """
        try:
            # Twilio отправляет данные как form-urlencoded
            from_number = form_data.get("From", "").replace("whatsapp:", "")
            to_number = form_data.get("To", "").replace("whatsapp:", "")
            body = form_data.get("Body", "")
            message_sid = form_data.get("MessageSid", "")
            profile_name = form_data.get("ProfileName", "WhatsApp User")
            
            # Медиа-файлы (если есть)
            num_media = int(form_data.get("NumMedia", 0))
            media_urls = []
            for i in range(num_media):
                media_url = form_data.get(f"MediaUrl{i}")
                if media_url:
                    media_urls.append(media_url)
            
            return {
                "message_id": message_sid,
                "from_number": from_number,
                "to_number": to_number,
                "contact_name": profile_name,
                "text": body,
                "timestamp": datetime.now(),
                "media_urls": media_urls,
            }
            
        except Exception as e:
            print(f"Error parsing Twilio WhatsApp message: {e}")
            return None
    
    async def send_message(self, to_number: str, text: str) -> dict[str, Any]:
        """
        Отправка сообщения в WhatsApp через Twilio.
        
        Args:
            to_number: Номер телефона (без whatsapp: префикса)
            text: Текст сообщения
            
        Returns:
            Результат отправки
        """
        if not self.enabled:
            return {"success": False, "error": "Twilio not configured"}
        
        try:
            # Добавляем префикс whatsapp: если нет
            if not to_number.startswith("whatsapp:"):
                to_number = f"whatsapp:{to_number}"
            
            from_number = self.whatsapp_number
            if not from_number.startswith("whatsapp:"):
                from_number = f"whatsapp:{from_number}"
            
            message = self.client.messages.create(
                body=text,
                from_=from_number,
                to=to_number,
            )
            
            return {
                "success": True,
                "message_sid": message.sid,
                "status": message.status,
            }
            
        except Exception as e:
            print(f"Error sending Twilio WhatsApp message: {e}")
            return {"success": False, "error": str(e)}
    
    async def send_template_message(
        self,
        to_number: str,
        template_sid: str,
        variables: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        """
        Отправка шаблонного сообщения.
        
        Для начала разговора с новым пользователем требуется
        одобренный шаблон (Content Template).
        """
        if not self.enabled:
            return {"success": False, "error": "Twilio not configured"}
        
        try:
            if not to_number.startswith("whatsapp:"):
                to_number = f"whatsapp:{to_number}"
            
            from_number = self.whatsapp_number
            if not from_number.startswith("whatsapp:"):
                from_number = f"whatsapp:{from_number}"
            
            message = self.client.messages.create(
                content_sid=template_sid,
                content_variables=variables or {},
                from_=from_number,
                to=to_number,
            )
            
            return {
                "success": True,
                "message_sid": message.sid,
                "status": message.status,
            }
            
        except Exception as e:
            print(f"Error sending Twilio template: {e}")
            return {"success": False, "error": str(e)}


# Singleton instance
twilio_whatsapp_service = TwilioWhatsAppService()




