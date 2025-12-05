"""RAG (Retrieval-Augmented Generation) сервис с иерархической структурой."""

import json
from typing import Any
import httpx

from ...core.config import get_settings
from ...schemas.ticket import TicketPriority

settings = get_settings()


# Иерархическая база знаний
# Уровень 1: Категории
# Уровень 2: Подкатегории  
# Уровень 3: Статьи/FAQ
HIERARCHICAL_KNOWLEDGE_BASE = {
    "it_support": {
        "name": "IT Поддержка",
        "name_kz": "IT Қолдау",
        "keywords": ["компьютер", "пароль", "принтер", "интернет", "программа", "почта", "vpn", "сеть", "ноутбук", "монитор"],
        "subcategories": {
            "passwords": {
                "name": "Пароли и доступ",
                "keywords": ["пароль", "логин", "вход", "доступ", "заблокирован", "сброс", "забыл"],
                "articles": [
                    {
                        "question": "Как сбросить пароль?",
                        "question_kz": "Құпия сөзді қалай қалпына келтіруге болады?",
                        "answer": """Для сброса пароля выполните следующие шаги:

1. Перейдите на страницу входа в систему
2. Нажмите на ссылку "Забыли пароль?"
3. Введите ваш корпоративный email
4. Проверьте почту - вам придёт письмо со ссылкой для сброса
5. Перейдите по ссылке и установите новый пароль

Требования к паролю:
• Минимум 8 символов
• Хотя бы одна заглавная буква
• Хотя бы одна цифра
• Хотя бы один специальный символ

Если письмо не пришло, проверьте папку "Спам" или обратитесь в IT-поддержку.""",
                        "answer_kz": "Құпия сөзді қалпына келтіру үшін кіру бетіне өтіп, 'Құпия сөзді ұмыттыңыз ба?' түймесін басыңыз.",
                        "can_auto_resolve": True,
                        "priority": "low",
                    },
                    {
                        "question": "Аккаунт заблокирован",
                        "answer": """Ваш аккаунт может быть заблокирован по следующим причинам:

1. **3 неудачные попытки входа** - подождите 15 минут
2. **Подозрительная активность** - обратитесь в IT-безопасность
3. **Истёк срок действия пароля** - сбросьте пароль

Для немедленной разблокировки:
• Позвоните на внутренний номер 1234
• Или напишите на security@company.kz

Время разблокировки: обычно 5-10 минут.""",
                        "can_auto_resolve": False,
                        "priority": "high",
                    },
                ],
            },
            "vpn": {
                "name": "VPN и удалённый доступ",
                "keywords": ["vpn", "удаленный", "дом", "подключение", "remote"],
                "articles": [
                    {
                        "question": "Как подключиться к VPN?",
                        "answer": """Инструкция по подключению к корпоративному VPN:

**Установка:**
1. Скачайте VPN-клиент с портала: https://portal.company.kz/vpn
2. Установите приложение
3. Запросите сертификат у руководителя

**Подключение:**
1. Откройте VPN-клиент
2. Выберите сервер: vpn.company.kz
3. Введите логин (email) и пароль
4. Нажмите "Подключиться"

**Решение проблем:**
• Не подключается → проверьте интернет
• Ошибка сертификата → обновите сертификат
• Медленная скорость → выберите другой сервер""",
                        "can_auto_resolve": True,
                        "priority": "medium",
                    },
                ],
            },
            "hardware": {
                "name": "Оборудование",
                "keywords": ["принтер", "монитор", "клавиатура", "мышь", "компьютер", "ноутбук", "не работает"],
                "articles": [
                    {
                        "question": "Принтер не печатает",
                        "answer": """Проверьте следующее:

1. **Питание** - принтер включен?
2. **Бумага** - есть ли бумага в лотке?
3. **Подключение** - горит ли индикатор сети?
4. **Очередь печати** - нет ли зависших заданий?

**Если не помогло:**
Перезагрузите принтер:
1. Выключите принтер
2. Подождите 30 секунд
3. Включите снова

Создайте тикет с фото индикаторов принтера, если проблема не решена.""",
                        "can_auto_resolve": False,
                        "priority": "medium",
                    },
                ],
            },
        },
    },
    "hr": {
        "name": "HR / Кадры",
        "name_kz": "HR / Кадрлар",
        "keywords": ["отпуск", "зарплата", "увольнение", "прием", "больничный", "справка", "договор", "отгул"],
        "subcategories": {
            "vacation": {
                "name": "Отпуска и отгулы",
                "keywords": ["отпуск", "отгул", "выходной", "дни"],
                "articles": [
                    {
                        "question": "Как оформить отпуск?",
                        "answer": """Оформление отпуска через HR-портал:

1. Войдите в HR-портал: https://hr.company.kz
2. Раздел "Отпуска" → "Новое заявление"
3. Выберите тип отпуска:
   • Ежегодный оплачиваемый
   • Без сохранения зарплаты
   • Учебный
4. Укажите даты начала и окончания
5. Добавьте согласование руководителя
6. Отправьте заявление

**Важно:**
• Подавайте заявление минимум за 14 дней
• Отпуск за свой счёт - за 3 дня
• Проверяйте остаток дней в личном кабинете""",
                        "can_auto_resolve": True,
                        "priority": "low",
                    },
                ],
            },
            "salary": {
                "name": "Зарплата и выплаты",
                "keywords": ["зарплата", "деньги", "выплата", "аванс", "премия"],
                "articles": [
                    {
                        "question": "Когда выплачивается зарплата?",
                        "answer": """График выплат:

• **Аванс:** 15 числа каждого месяца
• **Основная часть:** последний рабочий день месяца

Если день выплаты выпадает на выходной - выплата производится в предшествующий рабочий день.

**Расчётный листок:**
Доступен в HR-портале через 1-2 дня после выплаты.

По вопросам расхождений обращайтесь в бухгалтерию: payroll@company.kz""",
                        "can_auto_resolve": True,
                        "priority": "low",
                    },
                ],
            },
        },
    },
    "finance": {
        "name": "Финансы",
        "name_kz": "Қаржы",
        "keywords": ["счёт", "оплата", "возврат", "бюджет", "invoice", "расход"],
        "subcategories": {
            "payments": {
                "name": "Платежи и счета",
                "keywords": ["счёт", "оплата", "платёж", "invoice"],
                "articles": [
                    {
                        "question": "Как согласовать оплату счёта?",
                        "answer": """Процесс согласования оплаты:

1. Загрузите счёт в систему: https://finance.company.kz
2. Заполните форму:
   • Контрагент
   • Сумма
   • Назначение платежа
   • Центр затрат
3. Приложите договор (если есть)
4. Отправьте на согласование

**Сроки:**
• До 100 000 ₸ - 1 рабочий день
• До 1 000 000 ₸ - 3 рабочих дня
• Свыше - до 5 рабочих дней""",
                        "can_auto_resolve": False,
                        "priority": "medium",
                    },
                ],
            },
        },
    },
    "admin": {
        "name": "АХО",
        "name_kz": "Әкімшілік-шаруашылық бөлімі",
        "keywords": ["пропуск", "ключ", "офис", "мебель", "уборка", "канцелярия", "переезд"],
        "subcategories": {
            "access": {
                "name": "Пропуска и доступ",
                "keywords": ["пропуск", "ключ", "карта", "дверь"],
                "articles": [
                    {
                        "question": "Как получить пропуск?",
                        "answer": """Оформление пропуска:

**Для нового сотрудника:**
1. HR оформляет заявку автоматически
2. Пропуск готов в первый рабочий день
3. Получите на ресепшн с паспортом

**Замена пропуска:**
1. Заявка через портал АХО
2. Укажите причину (утеря/поломка)
3. Срок изготовления: 1-2 дня
4. Стоимость замены: 5000 ₸

**Временный пропуск:**
Выдаётся на ресепшн при предъявлении документа.""",
                        "can_auto_resolve": True,
                        "priority": "low",
                    },
                ],
            },
        },
    },
}

# Системный промпт для AI
SYSTEM_PROMPT = """Ты - AI-ассистент службы поддержки компании. Твоя задача - помогать сотрудникам решать их проблемы.

ПРАВИЛА:
1. Отвечай вежливо и профессионально
2. Давай конкретные и полезные ответы
3. Если есть релевантная информация из базы знаний - используй её
4. Если не знаешь точного ответа - честно скажи и предложи создать тикет
5. Используй форматирование для читаемости (списки, выделение)
6. Отвечай на том языке, на котором задан вопрос (русский или казахский)
7. Будь кратким, но информативным

КОНТЕКСТ ИЗ БАЗЫ ЗНАНИЙ:
{context}

Если контекст пустой или не релевантен вопросу - отвечай на основе общих знаний о корпоративной поддержке."""

SYSTEM_PROMPT_KZ = """Сен - компанияның қолдау қызметінің AI-көмекшісісің. Сенің міндетің - қызметкерлерге мәселелерін шешуге көмектесу.

ЕРЕЖЕЛЕР:
1. Сыпайы және кәсіби жауап бер
2. Нақты және пайдалы жауаптар бер
3. Білім базасынан сәйкес ақпарат болса - оны пайдалан
4. Нақты жауапты білмесең - шынын айт және тикет жасауды ұсын

БІЛІМ БАЗАСЫНАН КОНТЕКСТ:
{context}"""


class RAGService:
    """Сервис для иерархического RAG."""

    def __init__(self):
        self.api_key = getattr(settings, 'openai_api_key', None)
        self.model = getattr(settings, 'openai_model', 'gpt-4o-mini')
        self.use_openai = bool(self.api_key and self.api_key != "your-openai-api-key-here")
        self.knowledge_base = HIERARCHICAL_KNOWLEDGE_BASE

    def search_knowledge_base(
        self,
        query: str,
        top_k: int = 3,
    ) -> list[dict[str, Any]]:
        """
        Иерархический поиск по базе знаний.
        
        Уровень 1: Поиск по категориям
        Уровень 2: Поиск по подкатегориям
        Уровень 3: Поиск по статьям
        """
        query_lower = query.lower()
        results = []
        
        # Уровень 1: Поиск релевантных категорий
        for cat_key, category in self.knowledge_base.items():
            cat_score = 0
            for keyword in category.get("keywords", []):
                if keyword.lower() in query_lower:
                    cat_score += 2
            
            if cat_score > 0 or any(word in query_lower for word in category["name"].lower().split()):
                # Уровень 2: Поиск в подкатегориях
                for subcat_key, subcategory in category.get("subcategories", {}).items():
                    subcat_score = cat_score
                    for keyword in subcategory.get("keywords", []):
                        if keyword.lower() in query_lower:
                            subcat_score += 3
                    
                    # Уровень 3: Поиск статей
                    for article in subcategory.get("articles", []):
                        article_score = subcat_score
                        
                        # Проверка вопроса
                        question = article.get("question", "").lower()
                        for word in query_lower.split():
                            if len(word) > 3 and word in question:
                                article_score += 5
                        
                        # Проверка ответа
                        answer = article.get("answer", "").lower()
                        for word in query_lower.split():
                            if len(word) > 3 and word in answer:
                                article_score += 1
                        
                        if article_score > 0:
                            results.append({
                                "category": category["name"],
                                "subcategory": subcategory["name"],
                                "question": article["question"],
                                "answer": article["answer"],
                                "can_auto_resolve": article.get("can_auto_resolve", False),
                                "priority": article.get("priority", "medium"),
                                "score": article_score,
                            })
        
        # Сортируем по релевантности и возвращаем топ-K
        results.sort(key=lambda x: x["score"], reverse=True)
        return results[:top_k]

    def build_context(self, search_results: list[dict]) -> str:
        """Формирует контекст из результатов поиска."""
        if not search_results:
            return "Релевантная информация не найдена в базе знаний."
        
        context_parts = []
        for i, result in enumerate(search_results, 1):
            context_parts.append(f"""
--- Статья {i} ---
Категория: {result['category']} > {result['subcategory']}
Вопрос: {result['question']}
Ответ: {result['answer']}
""")
        
        return "\n".join(context_parts)

    async def chat(
        self,
        message: str,
        conversation_history: list[dict[str, str]] | None = None,
        language: str = "ru",
    ) -> dict[str, Any]:
        """
        Основной метод чата с RAG.
        
        Returns:
            {
                "response": str,
                "sources": list,
                "can_auto_resolve": bool,
                "suggested_priority": str,
            }
        """
        # Шаг 1: Поиск в базе знаний
        search_results = self.search_knowledge_base(message)
        
        # Шаг 2: Формирование контекста
        context = self.build_context(search_results)
        
        # Определяем, можно ли авто-решить
        can_auto_resolve = any(r.get("can_auto_resolve", False) for r in search_results)
        suggested_priority = search_results[0]["priority"] if search_results else "medium"
        
        # Шаг 3: Генерация ответа
        if self.use_openai:
            response = await self._generate_with_openai(
                message, context, conversation_history, language
            )
        else:
            response = self._generate_fallback(message, search_results, language)
        
        return {
            "response": response,
            "sources": [
                {
                    "category": r["category"],
                    "subcategory": r["subcategory"],
                    "question": r["question"],
                }
                for r in search_results
            ],
            "can_auto_resolve": can_auto_resolve,
            "suggested_priority": suggested_priority,
        }

    async def _generate_with_openai(
        self,
        message: str,
        context: str,
        conversation_history: list[dict[str, str]] | None,
        language: str,
    ) -> str:
        """Генерация ответа через OpenAI."""
        
        system_prompt = SYSTEM_PROMPT_KZ if language == "kz" else SYSTEM_PROMPT
        system_prompt = system_prompt.format(context=context)
        
        messages = [{"role": "system", "content": system_prompt}]
        
        # Добавляем историю разговора
        if conversation_history:
            for msg in conversation_history[-10:]:
                role = "user" if msg.get("is_user") else "assistant"
                messages.append({"role": role, "content": msg["content"]})
        
        # Добавляем текущее сообщение
        messages.append({"role": "user", "content": message})
        
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
                        "max_tokens": 1000,
                    },
                    timeout=30.0,
                )
                response.raise_for_status()
                data = response.json()
                return data["choices"][0]["message"]["content"]
                
        except Exception as e:
            print(f"OpenAI error: {e}")
            return self._generate_fallback(message, [], language)

    def _generate_fallback(
        self,
        message: str,
        search_results: list[dict],
        language: str,
    ) -> str:
        """Fallback ответ без OpenAI."""
        
        if search_results:
            # Возвращаем лучший найденный ответ
            best = search_results[0]
            if language == "kz":
                return f"Мен сіздің сұрағыңызға жауап таптым:\n\n{best['answer']}"
            return f"Нашёл ответ на ваш вопрос:\n\n{best['answer']}"
        
        if language == "kz":
            return "Кешіріңіз, мен бұл сұраққа нақты жауап таба алмадым. Тикет жасауыңызды ұсынамын, біздің мамандар сізге көмектеседі."
        
        return "К сожалению, я не нашёл точного ответа на ваш вопрос. Рекомендую создать тикет - наши специалисты обязательно помогут!"

    def add_to_knowledge_base(
        self,
        category_key: str,
        subcategory_key: str,
        article: dict,
    ) -> bool:
        """
        Добавляет статью в иерархическую базу знаний.
        
        Позволяет динамически расширять RAG.
        """
        try:
            if category_key not in self.knowledge_base:
                return False
            
            category = self.knowledge_base[category_key]
            if subcategory_key not in category.get("subcategories", {}):
                return False
            
            category["subcategories"][subcategory_key]["articles"].append(article)
            return True
        except Exception:
            return False

    def get_categories(self) -> list[dict]:
        """Возвращает структуру категорий для UI."""
        result = []
        for key, cat in self.knowledge_base.items():
            subcats = []
            for subkey, subcat in cat.get("subcategories", {}).items():
                subcats.append({
                    "key": subkey,
                    "name": subcat["name"],
                    "article_count": len(subcat.get("articles", [])),
                })
            result.append({
                "key": key,
                "name": cat["name"],
                "name_kz": cat.get("name_kz"),
                "subcategories": subcats,
            })
        return result


# Singleton instance
rag_service = RAGService()

