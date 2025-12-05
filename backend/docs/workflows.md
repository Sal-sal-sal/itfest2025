## Flowchart: Бэкенд инфраструктура

### 1. PostgreSQL + Alembic (async)
- загрузить `.env` → `Settings` (Pydantic)
- `Settings.postgres_dsn` → `create_async_engine`
- engine → `async_sessionmaker` → DI в приложении
- Alembic `env.py` → получает `Settings.postgres_dsn`
- команда `poetry run alembic revision --autogenerate`
- команда `poetry run alembic upgrade head`

### 2. Аутентификация
- `POST /auth/register` → валидация DTO
- проверка `UserRepo.get_by_email`
- `PasswordService.hash` → создать `User`
- `UserRepo.add` → коммит
- создать токены: `JWTService.create_access` + `create_refresh`
- сохранить refresh (Redis) → ответ клиенту

- `POST /auth/login`
  - валидация → `UserRepo.get_by_email`
  - `PasswordService.verify`
  - issue tokens (как выше)

- `POST /auth/refresh`
  - проверить refresh в Redis
  - если валиден → выпустить новый набор
  - опционально: инвалидация старого refresh

### 3. Redis
- `Settings.redis_url`
- `RedisClient = aioredis.from_url`
- сценарии:
  - хранение refresh токенов (ключ `refresh:{user_id}`)
  - блоклист токенов (`denylist:{jti}`)
  - кеширование данных (TTL)
- graceful shutdown: `await redis.close()`

