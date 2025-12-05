"""AI сервис для классификации тикетов и генерации ответов."""

import json
import uuid
import re
from typing import Any

import httpx

from ...core.config import get_settings
from ...schemas.ticket import (
    AIClassificationResult,
    TicketPriority,
)

settings = get_settings()


# Демо данные для категорий и департаментов (в реальном приложении загружаются из БД)
DEMO_DEPARTMENTS = {
    "it_support": {
        "id": "11111111-1111-1111-1111-111111111111",
        "name": "IT поддержка",
        "name_kz": "IT қолдау",
        "keywords": ["компьютер", "пароль", "принтер", "интернет", "программа", "почта", "email", "vpn", "сеть", "компьютер", "қолданба", "бағдарлама"],
    },
    "hr": {
        "id": "22222222-2222-2222-2222-222222222222",
        "name": "HR / Кадры",
        "name_kz": "HR / Кадрлар",
        "keywords": ["отпуск", "зарплата", "увольнение", "прием", "больничный", "справка", "договор", "демалыс", "жалақы"],
    },
    "finance": {
        "id": "33333333-3333-3333-3333-333333333333",
        "name": "Финансы",
        "name_kz": "Қаржы",
        "keywords": ["счет", "оплата", "возврат", "бюджет", "расход", "invoice", "шот", "төлем"],
    },
    "admin": {
        "id": "44444444-4444-4444-4444-444444444444",
        "name": "АХО",
        "name_kz": "Әкімшілік-шаруашылық бөлімі",
        "keywords": ["пропуск", "ключ", "офис", "мебель", "уборка", "канцелярия", "рұқсат", "кілт"],
    },
}

DEMO_CATEGORIES = {
    "password_reset": {
        "id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        "name": "Сброс пароля",
        "department": "it_support",
        "auto_response": "Для сброса пароля перейдите по ссылке: https://portal.company.kz/reset-password и следуйте инструкциям. Если возникли сложности, ответьте на это сообщение.",
    },
    "vpn_access": {
        "id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
        "name": "Доступ к VPN",
        "department": "it_support",
        "auto_response": "Инструкция по настройке VPN доступна по ссылке: https://portal.company.kz/vpn-guide. Для получения сертификата обратитесь к вашему руководителю для согласования.",
    },
    "vacation_request": {
        "id": "cccccccc-cccc-cccc-cccc-cccccccccccc",
        "name": "Заявление на отпуск",
        "department": "hr",
        "auto_response": "Заявление на отпуск оформляется через HR-портал: https://hr.company.kz/vacation. Минимальный срок подачи - 14 дней до начала отпуска.",
    },
    "salary_inquiry": {
        "id": "dddddddd-dddd-dddd-dddd-dddddddddddd",
        "name": "Вопрос по зарплате",
        "department": "hr",
        "auto_response": None,
    },
    "invoice_payment": {
        "id": "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee",
        "name": "Оплата счета",
        "department": "finance",
        "auto_response": None,
    },
    "office_supplies": {
        "id": "ffffffff-ffff-ffff-ffff-ffffffffffff",
        "name": "Канцелярские товары",
        "department": "admin",
        "auto_response": "Заказ канцелярии осуществляется через портал закупок: https://portal.company.kz/supplies. Стандартный срок доставки - 3 рабочих дня.",
    },
}

# FAQ база для автоответов
FAQ_BASE = [
    {
        "keywords": ["сброс", "пароль", "забыл", "парольді", "ұмыттым"],
        "question": "Как сбросить пароль?",
        "answer": "Для сброса пароля:\n1. Перейдите на страницу входа\n2. Нажмите 'Забыли пароль?'\n3. Введите ваш email\n4. Следуйте инструкциям в письме\n\nЕсли не получили письмо, проверьте папку спам.",
        "answer_kz": "Құпия сөзді қалпына келтіру үшін:\n1. Кіру бетіне өтіңіз\n2. 'Құпия сөзді ұмыттыңыз ба?' түймесін басыңыз\n3. Email-ді енгізіңіз\n4. Хаттағы нұсқауларды орындаңыз",
        "can_auto_resolve": True,
    },
    {
        "keywords": ["vpn", "подключение", "удаленный", "қашықтан"],
        "question": "Как подключиться к VPN?",
        "answer": "Инструкция по VPN:\n1. Скачайте клиент с https://vpn.company.kz\n2. Установите сертификат\n3. Введите ваши корпоративные учетные данные\n4. Выберите сервер и подключитесь\n\nПри проблемах проверьте интернет-соединение.",
        "can_auto_resolve": True,
    },
    {
        "keywords": ["отпуск", "заявление", "демалыс", "өтініш"],
        "question": "Как оформить отпуск?",
        "answer": "Оформление отпуска:\n1. Зайдите в HR-портал\n2. Раздел 'Отпуск' -> 'Новое заявление'\n3. Укажите даты и тип отпуска\n4. Приложите согласование руководителя\n\nМинимальный срок подачи: 14 дней.",
        "can_auto_resolve": True,
    },
    {
        "keywords": ["принтер", "печать", "не печатает", "printer"],
        "question": "Принтер не работает",
        "answer": "Проверьте:\n1. Включен ли принтер\n2. Есть ли бумага\n3. Горит ли индикатор ошибки\n4. Подключен ли по сети\n\nПерезагрузите принтер. Если не помогло, создайте тикет с фото индикаторов.",
        "can_auto_resolve": False,
    },
]


class AIService:
    """Сервис для AI-классификации и автоответов."""

    def __init__(self):
        self.api_key = getattr(settings, 'openai_api_key', None)
        self.model = getattr(settings, 'openai_model', 'gpt-4o-mini')
        self.use_openai = bool(self.api_key and self.api_key != "your-openai-api-key-here")

    async def classify_ticket(
        self,
        subject: str,
        description: str,
        language: str = "ru",
    ) -> AIClassificationResult:
        """
        Классифицирует тикет и определяет категорию, департамент, приоритет.
        
        Использует OpenAI если ключ доступен, иначе простой rule-based подход.
        """
        if self.use_openai:
            return await self._classify_with_openai(subject, description, language)
        return await self._classify_rule_based(subject, description, language)

    async def _classify_with_openai(
        self,
        subject: str,
        description: str,
        language: str,
    ) -> AIClassificationResult:
        """Классификация с использованием OpenAI."""
        
        departments_info = "\n".join([
            f"- {key}: {val['name']} ({val['name_kz']}), ключевые слова: {', '.join(val['keywords'])}"
            for key, val in DEMO_DEPARTMENTS.items()
        ])
        
        categories_info = "\n".join([
            f"- {key}: {val['name']}, департамент: {val['department']}"
            for key, val in DEMO_CATEGORIES.items()
        ])

        system_prompt = f"""Ты - AI-ассистент службы поддержки. Твоя задача - классифицировать обращения пользователей.

Доступные департаменты:
{departments_info}

Доступные категории:
{categories_info}

Проанализируй обращение и верни JSON с полями:
- department_key: ключ департамента (it_support, hr, finance, admin)
- category_key: ключ категории или null
- priority: приоритет (low, medium, high, critical)
- confidence: уверенность от 0 до 1
- detected_language: язык обращения (ru или kz)
- summary: краткое резюме обращения (1-2 предложения)
- suggested_response: предложенный ответ на обращение
- can_auto_resolve: можно ли автоматически решить (true/false)

Определяй critical приоритет только для срочных проблем, блокирующих работу.
Отвечай ТОЛЬКО валидным JSON без markdown."""

        user_message = f"Тема: {subject}\n\nОписание: {description}"

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": self.model,
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": user_message},
                        ],
                        "temperature": 0.3,
                        "max_tokens": 1000,
                    },
                    timeout=30.0,
                )
                response.raise_for_status()
                data = response.json()
                
                content = data["choices"][0]["message"]["content"]
                # Очистим от возможных markdown-блоков
                content = content.strip()
                if content.startswith("```"):
                    content = re.sub(r"```json?\n?", "", content)
                    content = content.rstrip("`").strip()
                
                result = json.loads(content)
                
                # Получаем ID департамента и категории
                dept_key = result.get("department_key", "it_support")
                dept_data = DEMO_DEPARTMENTS.get(dept_key, DEMO_DEPARTMENTS["it_support"])
                department_id = uuid.UUID(dept_data["id"])
                
                cat_key = result.get("category_key")
                category_id = None
                if cat_key and cat_key in DEMO_CATEGORIES:
                    category_id = uuid.UUID(DEMO_CATEGORIES[cat_key]["id"])
                
                return AIClassificationResult(
                    category_id=category_id,
                    department_id=department_id,
                    priority=TicketPriority(result.get("priority", "medium")),
                    confidence=float(result.get("confidence", 0.8)),
                    detected_language=result.get("detected_language", language),
                    summary=result.get("summary", subject),
                    suggested_response=result.get("suggested_response"),
                    can_auto_resolve=result.get("can_auto_resolve", False),
                )
                
        except Exception as e:
            print(f"OpenAI classification error: {e}")
            # Fallback на rule-based
            return await self._classify_rule_based(subject, description, language)

    async def _classify_rule_based(
        self,
        subject: str,
        description: str,
        language: str,
    ) -> AIClassificationResult:
        """Простая классификация на основе правил и ключевых слов."""
        
        text = f"{subject} {description}".lower()
        
        # Определение языка
        kz_indicators = ["қ", "ұ", "ү", "ә", "ө", "і", "ғ", "һ"]
        detected_language = "kz" if any(ind in text for ind in kz_indicators) else "ru"
        
        # Определение приоритета
        priority = TicketPriority.MEDIUM
        critical_keywords = ["срочно", "не работает", "блокирует", "критично", "авария", "шұғыл"]
        high_keywords = ["важно", "быстрее", "проблема", "ошибка", "маңызды", "қате"]
        low_keywords = ["вопрос", "уточнить", "когда", "как", "сұрақ"]
        
        if any(kw in text for kw in critical_keywords):
            priority = TicketPriority.CRITICAL
        elif any(kw in text for kw in high_keywords):
            priority = TicketPriority.HIGH
        elif any(kw in text for kw in low_keywords):
            priority = TicketPriority.LOW
        
        # Определение департамента
        best_dept = "it_support"
        best_score = 0
        
        for dept_key, dept_data in DEMO_DEPARTMENTS.items():
            score = sum(1 for kw in dept_data["keywords"] if kw.lower() in text)
            if score > best_score:
                best_score = score
                best_dept = dept_key
        
        department_id = uuid.UUID(DEMO_DEPARTMENTS[best_dept]["id"])
        
        # Определение категории
        category_id = None
        for cat_key, cat_data in DEMO_CATEGORIES.items():
            if cat_data["department"] == best_dept:
                cat_name = cat_data["name"].lower()
                if any(word in text for word in cat_name.split()):
                    category_id = uuid.UUID(cat_data["id"])
                    break
        
        # Проверка FAQ для автоответа
        suggested_response = None
        can_auto_resolve = False
        
        for faq in FAQ_BASE:
            if any(kw in text for kw in faq["keywords"]):
                if detected_language == "kz" and faq.get("answer_kz"):
                    suggested_response = faq["answer_kz"]
                else:
                    suggested_response = faq["answer"]
                can_auto_resolve = faq.get("can_auto_resolve", False)
                break
        
        confidence = 0.7 if best_score > 0 else 0.5
        
        return AIClassificationResult(
            category_id=category_id,
            department_id=department_id,
            priority=priority,
            confidence=confidence,
            detected_language=detected_language,
            summary=subject[:200] if len(subject) > 200 else subject,
            suggested_response=suggested_response,
            can_auto_resolve=can_auto_resolve,
        )

    async def generate_response(
        self,
        ticket_subject: str,
        ticket_description: str,
        conversation_history: list[dict[str, str]],
        language: str = "ru",
    ) -> str:
        """Генерирует ответ на обращение."""
        
        if self.use_openai:
            return await self._generate_with_openai(
                ticket_subject, ticket_description, conversation_history, language
            )
        return self._generate_rule_based(ticket_subject, ticket_description, language)

    async def _generate_with_openai(
        self,
        ticket_subject: str,
        ticket_description: str,
        conversation_history: list[dict[str, str]],
        language: str,
    ) -> str:
        """Генерация ответа через OpenAI."""
        
        lang_instruction = "Отвечай на казахском языке." if language == "kz" else "Отвечай на русском языке."
        
        system_prompt = f"""Ты - вежливый и профессиональный AI-ассистент службы поддержки.
{lang_instruction}

Правила:
1. Будь кратким и по существу
2. Предлагай конкретные решения
3. Если нужна дополнительная информация - спрашивай
4. Используй формальный, но дружелюбный тон
5. Не выдумывай информацию, которой не знаешь"""

        messages = [{"role": "system", "content": system_prompt}]
        
        # Добавляем контекст тикета
        messages.append({
            "role": "user",
            "content": f"Тема обращения: {ticket_subject}\n\nОписание: {ticket_description}",
        })
        
        # Добавляем историю переписки
        for msg in conversation_history[-10:]:  # Последние 10 сообщений
            role = "user" if msg.get("is_from_client") else "assistant"
            messages.append({"role": role, "content": msg["content"]})
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": self.model,
                        "messages": messages,
                        "temperature": 0.7,
                        "max_tokens": 500,
                    },
                    timeout=30.0,
                )
                response.raise_for_status()
                data = response.json()
                return data["choices"][0]["message"]["content"]
                
        except Exception as e:
            print(f"OpenAI response generation error: {e}")
            return self._generate_rule_based(ticket_subject, ticket_description, language)

    def _generate_rule_based(
        self,
        ticket_subject: str,
        ticket_description: str,
        language: str,
    ) -> str:
        """Простая генерация ответа на основе шаблонов."""
        
        text = f"{ticket_subject} {ticket_description}".lower()
        
        # Ищем в FAQ
        for faq in FAQ_BASE:
            if any(kw in text for kw in faq["keywords"]):
                if language == "kz" and faq.get("answer_kz"):
                    return faq["answer_kz"]
                return faq["answer"]
        
        # Стандартный ответ
        if language == "kz":
            return "Сіздің өтінішіңіз қабылданды. Біздің маман жақын арада Сізге хабарласады. Рақмет!"
        
        return "Ваше обращение принято в обработку. Наш специалист свяжется с вами в ближайшее время. Спасибо за обращение!"

    async def summarize_conversation(
        self,
        messages: list[dict[str, str]],
        language: str = "ru",
    ) -> str:
        """Создает краткое резюме переписки."""
        
        if not self.use_openai:
            return "Резюме недоступно без OpenAI API"
        
        lang_instruction = "Отвечай на казахском языке." if language == "kz" else "Отвечай на русском языке."
        
        system_prompt = f"""Создай краткое резюме переписки службы поддержки (3-5 предложений).
{lang_instruction}
Укажи: суть проблемы, текущий статус, предпринятые действия."""

        conversation = "\n".join([
            f"{'Клиент' if msg.get('is_from_client') else 'Поддержка'}: {msg['content']}"
            for msg in messages
        ])
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": self.model,
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": conversation},
                        ],
                        "temperature": 0.3,
                        "max_tokens": 300,
                    },
                    timeout=30.0,
                )
                response.raise_for_status()
                data = response.json()
                return data["choices"][0]["message"]["content"]
                
        except Exception as e:
            print(f"OpenAI summarization error: {e}")
            return "Резюме недоступно"

    async def translate_text(
        self,
        text: str,
        target_language: str,
    ) -> str:
        """Переводит текст на указанный язык (ru/kz)."""
        
        if not self.use_openai:
            return text
        
        lang_name = "казахский" if target_language == "kz" else "русский"
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": self.model,
                        "messages": [
                            {
                                "role": "system",
                                "content": f"Переведи текст на {lang_name} язык. Отвечай только переводом, без пояснений.",
                            },
                            {"role": "user", "content": text},
                        ],
                        "temperature": 0.3,
                        "max_tokens": 1000,
                    },
                    timeout=30.0,
                )
                response.raise_for_status()
                data = response.json()
                return data["choices"][0]["message"]["content"]
                
        except Exception as e:
            print(f"OpenAI translation error: {e}")
            return text


# Singleton instance
ai_service = AIService()

