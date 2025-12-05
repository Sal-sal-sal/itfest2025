"""Сервис интеграции с Email (IMAP/SMTP)."""

import asyncio
import email
import imaplib
import smtplib
import re
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.header import decode_header
from datetime import datetime
from typing import Any

from ...core.config import get_settings

settings = get_settings()


class EmailService:
    """
    Сервис для работы с Email.
    
    Поддерживает:
    - Получение писем через IMAP
    - Отправку ответов через SMTP
    - Парсинг писем в тикеты
    """
    
    def __init__(self):
        # IMAP настройки (для получения писем)
        self.imap_server = getattr(settings, 'EMAIL_IMAP_SERVER', None)
        self.imap_port = getattr(settings, 'EMAIL_IMAP_PORT', 993)
        
        # SMTP настройки (для отправки писем)
        self.smtp_server = getattr(settings, 'EMAIL_SMTP_SERVER', None)
        self.smtp_port = getattr(settings, 'EMAIL_SMTP_PORT', 587)
        
        # Учётные данные
        self.email_address = getattr(settings, 'EMAIL_ADDRESS', None)
        self.email_password = getattr(settings, 'EMAIL_PASSWORD', None)
        
        # Название компании для писем
        self.company_name = getattr(settings, 'COMPANY_NAME', 'Help Desk')
        
        self.enabled = bool(
            self.imap_server and 
            self.smtp_server and 
            self.email_address and 
            self.email_password
        )
    
    def _decode_header_value(self, value: str) -> str:
        """Декодирование заголовка письма."""
        if not value:
            return ""
        
        decoded_parts = decode_header(value)
        result = []
        for part, charset in decoded_parts:
            if isinstance(part, bytes):
                try:
                    result.append(part.decode(charset or 'utf-8', errors='replace'))
                except:
                    result.append(part.decode('utf-8', errors='replace'))
            else:
                result.append(part)
        return ''.join(result)
    
    def _extract_email_address(self, from_header: str) -> str:
        """Извлечение email адреса из заголовка From."""
        match = re.search(r'<(.+?)>', from_header)
        if match:
            return match.group(1)
        # Если нет угловых скобок, возвращаем как есть
        return from_header.strip()
    
    def _extract_sender_name(self, from_header: str) -> str:
        """Извлечение имени отправителя из заголовка From."""
        match = re.search(r'^(.+?)\s*<', from_header)
        if match:
            name = match.group(1).strip().strip('"\'')
            return self._decode_header_value(name)
        return ""
    
    def _get_email_body(self, msg: email.message.Message) -> str:
        """Извлечение текста письма."""
        body = ""
        
        if msg.is_multipart():
            for part in msg.walk():
                content_type = part.get_content_type()
                content_disposition = str(part.get("Content-Disposition", ""))
                
                # Пропускаем вложения
                if "attachment" in content_disposition:
                    continue
                
                if content_type == "text/plain":
                    try:
                        charset = part.get_content_charset() or 'utf-8'
                        body = part.get_payload(decode=True).decode(charset, errors='replace')
                        break
                    except:
                        continue
                elif content_type == "text/html" and not body:
                    try:
                        charset = part.get_content_charset() or 'utf-8'
                        html = part.get_payload(decode=True).decode(charset, errors='replace')
                        # Простое удаление HTML тегов
                        body = re.sub(r'<[^>]+>', '', html)
                        body = re.sub(r'\s+', ' ', body).strip()
                    except:
                        continue
        else:
            try:
                charset = msg.get_content_charset() or 'utf-8'
                body = msg.get_payload(decode=True).decode(charset, errors='replace')
            except:
                body = str(msg.get_payload())
        
        return body.strip()
    
    async def fetch_new_emails(self, folder: str = "INBOX", limit: int = 10) -> list[dict[str, Any]]:
        """
        Получение новых (непрочитанных) писем.
        
        Args:
            folder: Папка для проверки
            limit: Максимальное количество писем
            
        Returns:
            Список словарей с данными писем
        """
        if not self.enabled:
            print("Email not configured")
            return []
        
        emails = []
        
        def _fetch_sync():
            nonlocal emails
            try:
                # Подключаемся к IMAP
                mail = imaplib.IMAP4_SSL(self.imap_server, self.imap_port)
                mail.login(self.email_address, self.email_password)
                mail.select(folder)
                
                # Ищем непрочитанные письма
                status, messages = mail.search(None, 'UNSEEN')
                if status != 'OK':
                    return
                
                message_ids = messages[0].split()
                
                # Берём последние N писем
                for msg_id in message_ids[-limit:]:
                    try:
                        status, msg_data = mail.fetch(msg_id, '(RFC822)')
                        if status != 'OK':
                            continue
                        
                        raw_email = msg_data[0][1]
                        msg = email.message_from_bytes(raw_email)
                        
                        # Парсим данные
                        from_header = self._decode_header_value(msg.get('From', ''))
                        subject = self._decode_header_value(msg.get('Subject', 'Без темы'))
                        body = self._get_email_body(msg)
                        date_str = msg.get('Date', '')
                        message_id = msg.get('Message-ID', '')
                        
                        # Парсим дату
                        try:
                            date_tuple = email.utils.parsedate_to_datetime(date_str)
                        except:
                            date_tuple = datetime.now()
                        
                        emails.append({
                            "message_id": message_id,
                            "imap_id": msg_id.decode(),
                            "from_email": self._extract_email_address(from_header),
                            "from_name": self._extract_sender_name(from_header) or "Email User",
                            "subject": subject,
                            "body": body,
                            "timestamp": date_tuple,
                            "raw_from": from_header,
                        })
                        
                    except Exception as e:
                        print(f"Error parsing email {msg_id}: {e}")
                        continue
                
                mail.logout()
                
            except Exception as e:
                print(f"Error fetching emails: {e}")
        
        # Выполняем синхронный код в отдельном потоке
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, _fetch_sync)
        
        return emails
    
    async def mark_as_read(self, imap_id: str, folder: str = "INBOX") -> bool:
        """Пометить письмо как прочитанное."""
        if not self.enabled:
            return False
        
        def _mark_sync():
            try:
                mail = imaplib.IMAP4_SSL(self.imap_server, self.imap_port)
                mail.login(self.email_address, self.email_password)
                mail.select(folder)
                mail.store(imap_id.encode(), '+FLAGS', '\\Seen')
                mail.logout()
                return True
            except Exception as e:
                print(f"Error marking email as read: {e}")
                return False
        
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, _mark_sync)
    
    async def send_email(
        self,
        to_email: str,
        subject: str,
        body: str,
        reply_to_message_id: str | None = None,
    ) -> bool:
        """
        Отправка email.
        
        Args:
            to_email: Адрес получателя
            subject: Тема письма
            body: Текст письма
            reply_to_message_id: ID письма для ответа (threading)
        """
        if not self.enabled:
            print("Email not configured")
            return False
        
        def _send_sync():
            try:
                msg = MIMEMultipart()
                msg['From'] = f"{self.company_name} <{self.email_address}>"
                msg['To'] = to_email
                msg['Subject'] = subject
                
                # Для threading ответов
                if reply_to_message_id:
                    msg['In-Reply-To'] = reply_to_message_id
                    msg['References'] = reply_to_message_id
                
                msg.attach(MIMEText(body, 'plain', 'utf-8'))
                
                # Отправляем через SMTP
                with smtplib.SMTP(self.smtp_server, self.smtp_port) as server:
                    server.starttls()
                    server.login(self.email_address, self.email_password)
                    server.send_message(msg)
                
                return True
                
            except Exception as e:
                print(f"Error sending email: {e}")
                return False
        
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, _send_sync)
    
    async def send_ticket_confirmation(
        self,
        to_email: str,
        ticket_number: str,
        subject: str,
    ) -> bool:
        """Отправка подтверждения создания тикета."""
        body = f"""Здравствуйте!

Ваше обращение получено и зарегистрировано в системе.

📋 Номер тикета: {ticket_number}
📝 Тема: {subject}

Наши специалисты рассмотрят ваше обращение в ближайшее время.
Вы можете отслеживать статус по номеру тикета.

--
{self.company_name}
AI Help Desk System
"""
        return await self.send_email(
            to_email=to_email,
            subject=f"[{ticket_number}] {subject}",
            body=body,
        )
    
    async def send_ticket_response(
        self,
        to_email: str,
        ticket_number: str,
        original_subject: str,
        response: str,
        reply_to_message_id: str | None = None,
    ) -> bool:
        """Отправка ответа на тикет."""
        body = f"""Здравствуйте!

По вашему обращению {ticket_number}:

{response}

--
{self.company_name}
AI Help Desk System
"""
        return await self.send_email(
            to_email=to_email,
            subject=f"Re: [{ticket_number}] {original_subject}",
            body=body,
            reply_to_message_id=reply_to_message_id,
        )


# Singleton instance
email_service = EmailService()


