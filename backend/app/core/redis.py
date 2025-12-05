"""Redis клиент и утилиты для кеширования и хранения данных."""

import json
import hashlib
from datetime import datetime
from typing import Any

import redis.asyncio as redis
from redis.asyncio import Redis

from .config import get_settings

settings = get_settings()


class RedisService:
    """Сервис для работы с Redis."""
    
    def __init__(self):
        self._client: Redis | None = None
        self._connected = False
    
    async def connect(self) -> None:
        """Подключение к Redis."""
        if self._client is None:
            try:
                self._client = redis.from_url(
                    settings.redis_url,
                    encoding="utf-8",
                    decode_responses=True,
                )
                # Проверяем подключение
                await self._client.ping()
                self._connected = True
                print(f"✅ Redis connected: {settings.redis_url}")
            except Exception as e:
                print(f"⚠️ Redis connection failed: {e}")
                print("   Falling back to in-memory storage")
                self._connected = False
    
    async def disconnect(self) -> None:
        """Отключение от Redis."""
        if self._client:
            await self._client.close()
            self._client = None
            self._connected = False
    
    @property
    def client(self) -> Redis | None:
        return self._client
    
    @property
    def is_connected(self) -> bool:
        return self._connected and self._client is not None
    
    # =========================================================================
    # Escalations Storage
    # =========================================================================
    
    ESCALATION_PREFIX = "escalation:"
    ESCALATION_LIST_KEY = "escalations:list"
    
    async def save_escalation(self, escalation: dict[str, Any]) -> bool:
        """Сохранить эскалацию в Redis."""
        if not self.is_connected:
            return False
        
        try:
            escalation_id = escalation.get("escalation_id") or escalation.get("id")
            key = f"{self.ESCALATION_PREFIX}{escalation_id}"
            
            # Сохраняем эскалацию как JSON
            await self._client.set(key, json.dumps(escalation, ensure_ascii=False, default=str))
            
            # Добавляем ID в список (для быстрого получения всех)
            await self._client.sadd(self.ESCALATION_LIST_KEY, escalation_id)
            
            return True
        except Exception as e:
            print(f"Redis save_escalation error: {e}")
            return False
    
    async def get_escalation(self, escalation_id: str) -> dict[str, Any] | None:
        """Получить эскалацию по ID."""
        if not self.is_connected:
            return None
        
        try:
            key = f"{self.ESCALATION_PREFIX}{escalation_id}"
            data = await self._client.get(key)
            if data:
                return json.loads(data)
            return None
        except Exception as e:
            print(f"Redis get_escalation error: {e}")
            return None
    
    async def get_all_escalations(self, status: str | None = None) -> list[dict[str, Any]]:
        """Получить все эскалации."""
        if not self.is_connected:
            return []
        
        try:
            # Получаем все ID эскалаций
            escalation_ids = await self._client.smembers(self.ESCALATION_LIST_KEY)
            
            escalations = []
            for esc_id in escalation_ids:
                key = f"{self.ESCALATION_PREFIX}{esc_id}"
                data = await self._client.get(key)
                if data:
                    escalation = json.loads(data)
                    if status is None or escalation.get("status") == status:
                        escalations.append(escalation)
            
            # Сортируем по дате создания (новые первые)
            escalations.sort(
                key=lambda x: x.get("created_at", ""),
                reverse=True
            )
            
            return escalations
        except Exception as e:
            print(f"Redis get_all_escalations error: {e}")
            return []
    
    async def update_escalation(self, escalation_id: str, updates: dict[str, Any]) -> dict[str, Any] | None:
        """Обновить эскалацию."""
        if not self.is_connected:
            return None
        
        try:
            escalation = await self.get_escalation(escalation_id)
            if not escalation:
                # Попробуем найти по id
                all_esc = await self.get_all_escalations()
                for e in all_esc:
                    if e.get("id") == escalation_id:
                        escalation = e
                        escalation_id = e.get("escalation_id", escalation_id)
                        break
            
            if not escalation:
                return None
            
            # Обновляем поля
            escalation.update(updates)
            
            # Сохраняем обратно
            await self.save_escalation(escalation)
            
            return escalation
        except Exception as e:
            print(f"Redis update_escalation error: {e}")
            return None
    
    async def delete_escalation(self, escalation_id: str) -> bool:
        """Удалить эскалацию."""
        if not self.is_connected:
            return False
        
        try:
            key = f"{self.ESCALATION_PREFIX}{escalation_id}"
            await self._client.delete(key)
            await self._client.srem(self.ESCALATION_LIST_KEY, escalation_id)
            return True
        except Exception as e:
            print(f"Redis delete_escalation error: {e}")
            return False
    
    # =========================================================================
    # RAG Cache
    # =========================================================================
    
    RAG_CACHE_PREFIX = "rag:cache:"
    RAG_CACHE_TTL = 3600  # 1 час
    
    def _hash_query(self, query: str, language: str = "ru") -> str:
        """Создать хеш для кеширования."""
        key = f"{query.lower().strip()}:{language}"
        return hashlib.md5(key.encode()).hexdigest()
    
    async def get_cached_rag_response(self, query: str, language: str = "ru") -> dict[str, Any] | None:
        """Получить кешированный ответ RAG."""
        if not self.is_connected:
            return None
        
        try:
            hash_key = self._hash_query(query, language)
            key = f"{self.RAG_CACHE_PREFIX}{hash_key}"
            data = await self._client.get(key)
            if data:
                print(f"🚀 RAG cache hit for query: {query[:50]}...")
                return json.loads(data)
            return None
        except Exception as e:
            print(f"Redis get_cached_rag_response error: {e}")
            return None
    
    async def cache_rag_response(
        self,
        query: str,
        response: dict[str, Any],
        language: str = "ru",
        ttl: int | None = None,
    ) -> bool:
        """Кешировать ответ RAG."""
        if not self.is_connected:
            return False
        
        try:
            hash_key = self._hash_query(query, language)
            key = f"{self.RAG_CACHE_PREFIX}{hash_key}"
            
            # Добавляем метаданные кеша
            cached_data = {
                **response,
                "_cached_at": datetime.utcnow().isoformat(),
                "_query": query,
            }
            
            await self._client.setex(
                key,
                ttl or self.RAG_CACHE_TTL,
                json.dumps(cached_data, ensure_ascii=False, default=str),
            )
            return True
        except Exception as e:
            print(f"Redis cache_rag_response error: {e}")
            return False
    
    async def invalidate_rag_cache(self) -> int:
        """Инвалидировать весь кеш RAG."""
        if not self.is_connected:
            return 0
        
        try:
            keys = []
            async for key in self._client.scan_iter(f"{self.RAG_CACHE_PREFIX}*"):
                keys.append(key)
            
            if keys:
                await self._client.delete(*keys)
            
            print(f"🗑️ Invalidated {len(keys)} RAG cache entries")
            return len(keys)
        except Exception as e:
            print(f"Redis invalidate_rag_cache error: {e}")
            return 0
    
    # =========================================================================
    # Session Storage
    # =========================================================================
    
    SESSION_PREFIX = "session:"
    SESSION_TTL = 86400  # 24 часа
    
    async def save_session(self, session_id: str, data: dict[str, Any]) -> bool:
        """Сохранить сессию чата."""
        if not self.is_connected:
            return False
        
        try:
            key = f"{self.SESSION_PREFIX}{session_id}"
            await self._client.setex(
                key,
                self.SESSION_TTL,
                json.dumps(data, ensure_ascii=False, default=str),
            )
            return True
        except Exception as e:
            print(f"Redis save_session error: {e}")
            return False
    
    async def get_session(self, session_id: str) -> dict[str, Any] | None:
        """Получить сессию чата."""
        if not self.is_connected:
            return None
        
        try:
            key = f"{self.SESSION_PREFIX}{session_id}"
            data = await self._client.get(key)
            if data:
                return json.loads(data)
            return None
        except Exception as e:
            print(f"Redis get_session error: {e}")
            return None
    
    # =========================================================================
    # Stats
    # =========================================================================
    
    async def get_stats(self) -> dict[str, Any]:
        """Получить статистику Redis."""
        if not self.is_connected:
            return {"connected": False}
        
        try:
            info = await self._client.info()
            
            # Считаем ключи по типам
            escalation_count = await self._client.scard(self.ESCALATION_LIST_KEY)
            
            rag_cache_count = 0
            async for _ in self._client.scan_iter(f"{self.RAG_CACHE_PREFIX}*"):
                rag_cache_count += 1
            
            session_count = 0
            async for _ in self._client.scan_iter(f"{self.SESSION_PREFIX}*"):
                session_count += 1
            
            return {
                "connected": True,
                "redis_version": info.get("redis_version"),
                "used_memory": info.get("used_memory_human"),
                "connected_clients": info.get("connected_clients"),
                "escalations_count": escalation_count,
                "rag_cache_count": rag_cache_count,
                "sessions_count": session_count,
            }
        except Exception as e:
            print(f"Redis get_stats error: {e}")
            return {"connected": False, "error": str(e)}


# Singleton instance
redis_service = RedisService()

