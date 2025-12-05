# AI Help Desk Service

> Интеллектуальная система поддержки пользователей для ITFEST Hackathon 2025

## 🎯 Цель проекта

Разработка AI-сервиса, который полностью заменяет первую линию поддержки и обеспечивает автоматическую маршрутизацию обращений без участия операторов.

## ✨ Основные возможности

- **🤖 AI-классификация** - Автоматическое определение категории, приоритета и департамента
- **⚡ Автоматическое решение** - До 50% тикетов закрываются без участия специалистов
- **🌐 Мультиязычность** - Полная поддержка казахского и русского языков
- **📊 Веб-панель мониторинга** - Аналитика в реальном времени
- **🔄 Умная маршрутизация** - Эскалация сложных кейсов в профильные департаменты
- **💬 Помощь операторам** - AI-подсказки, резюмирование переписки, перевод

## 🏗️ Архитектура

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React + Vite)                   │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────────────┐ │
│  │ Landing │  │ Submit  │  │Dashboard│  │ Ticket Details  │ │
│  │  Page   │  │ Ticket  │  │  Stats  │  │   & Messages    │ │
│  └─────────┘  └─────────┘  └─────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  Backend (FastAPI + Async)                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  Tickets    │  │ Departments │  │   AI Service        │  │
│  │  API        │  │ Categories  │  │   (OpenAI/Rules)    │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
        ┌──────────┐   ┌──────────┐    ┌──────────┐
        │PostgreSQL│   │  Redis   │    │ OpenAI   │
        │ Database │   │  Cache   │    │   API    │
        └──────────┘   └──────────┘    └──────────┘
```

## 🚀 Быстрый старт

### Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL 15+
- Redis 7+
- Poetry (для Python зависимостей)

### Backend

```bash
cd backend

# Установка зависимостей
poetry install

# Копирование конфигурации
cp env.example .env
# Отредактируйте .env и добавьте OPENAI_API_KEY

# Запуск PostgreSQL и Redis (через Docker)
docker compose up -d postgres redis

# Применение миграций
poetry run alembic upgrade head

# Запуск сервера
poetry run uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend

# Установка зависимостей
npm install

# Запуск dev-сервера
npm run dev
```

## 📋 API Endpoints

### Тикеты
- `POST /api/v1/tickets` - Создать тикет (с AI-классификацией)
- `GET /api/v1/tickets` - Список тикетов с фильтрами
- `GET /api/v1/tickets/{id}` - Получить тикет с сообщениями
- `PATCH /api/v1/tickets/{id}` - Обновить тикет
- `POST /api/v1/tickets/{id}/messages` - Добавить сообщение
- `POST /api/v1/tickets/{id}/escalate` - Эскалировать тикет
- `POST /api/v1/tickets/{id}/summarize` - AI-резюме переписки

### AI
- `POST /api/v1/tickets/ai/classify` - Классифицировать текст
- `POST /api/v1/tickets/ai/generate-response` - Генерация ответа
- `POST /api/v1/tickets/ai/translate` - Перевод текста

### Аналитика
- `GET /api/v1/tickets/analytics/dashboard` - Статистика дашборда

### Справочники
- `GET /api/v1/departments` - Список департаментов
- `POST /api/v1/departments` - Создать департамент
- `GET /api/v1/categories` - Список категорий
- `POST /api/v1/categories` - Создать категорию
- `GET /api/v1/knowledge-base/search` - Поиск в базе знаний

## 🔧 Конфигурация

### Переменные окружения (backend/.env)

```env
# Database
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=helpdesk
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres

# Redis
REDIS_URL=redis://localhost:6379/0

# JWT
JWT_SECRET_KEY=your-secret-key
ACCESS_TOKEN_EXPIRE_MINUTES=15

# OpenAI (для AI-функций)
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini

# CORS
CORS_ALLOW_ORIGINS=["http://localhost:5173"]
```

## 📊 Метрики дашборда

- **Всего тикетов** - Общее количество обращений
- **Новых тикетов** - Требуют внимания
- **Решено** - Закрытые обращения
- **Авто-решено AI** - Автоматически закрытые
- **Точность классификации** - % правильной маршрутизации
- **Среднее время ответа** - SLA первого ответа
- **Среднее время решения** - SLA закрытия тикета

## 🌍 Поддержка языков

- **Русский (ru)** - Полная поддержка
- **Казахский (kz)** - Полная поддержка, включая:
  - Автоопределение языка обращения
  - Генерация ответов на казахском
  - Перевод между языками
  - Локализованные шаблоны ответов

## 🔒 Безопасность

- JWT-аутентификация с refresh tokens
- CORS-защита
- Валидация входных данных (Pydantic)
- Безопасное хранение паролей (bcrypt)
- Rate limiting (через Redis)

## 📦 Технологический стек

### Backend
- **FastAPI** - Async REST API
- **SQLAlchemy 2.0** - Async ORM
- **PostgreSQL** - База данных
- **Redis** - Кэширование и сессии
- **Alembic** - Миграции БД
- **Pydantic** - Валидация данных
- **OpenAI API** - AI-классификация и генерация

### Frontend
- **React 19** - UI библиотека
- **TypeScript** - Типизация
- **Vite** - Сборщик
- **Tailwind CSS** - Стилизация
- **React Router** - Маршрутизация
- **Axios** - HTTP-клиент
- **Lucide React** - Иконки

## 👥 Команда

Разработано для ITFEST Hackathon 2025

## 📄 Лицензия

MIT
