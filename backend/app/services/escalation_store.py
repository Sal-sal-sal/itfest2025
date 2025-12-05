"""Хранилище эскалаций с поддержкой Redis и fallback на in-memory."""

from datetime import datetime
from typing import Any

from ..core.redis import redis_service


class EscalationStore:
    """
    Хранилище эскалаций.
    Использует Redis если доступен, иначе in-memory.
    """
    
    def __init__(self):
        self._memory_store: list[dict[str, Any]] = []
    
    @property
    def _use_redis(self) -> bool:
        return redis_service.is_connected
    
    async def add(self, escalation: dict[str, Any]) -> dict[str, Any]:
        """Добавить новую эскалацию."""
        if self._use_redis:
            await redis_service.save_escalation(escalation)
        else:
            self._memory_store.append(escalation)
        return escalation
    
    async def get_all(self, status: str | None = None) -> list[dict[str, Any]]:
        """Получить все эскалации."""
        if self._use_redis:
            return await redis_service.get_all_escalations(status)
        
        if status:
            return [e for e in self._memory_store if e.get("status") == status]
        return self._memory_store.copy()
    
    async def get_by_id(self, escalation_id: str) -> dict[str, Any] | None:
        """Получить эскалацию по ID."""
        if self._use_redis:
            # Сначала пробуем по escalation_id
            result = await redis_service.get_escalation(escalation_id)
            if result:
                return result
            
            # Если не нашли, ищем по id
            all_esc = await redis_service.get_all_escalations()
            for e in all_esc:
                if e.get("id") == escalation_id:
                    return e
            return None
        
        for e in self._memory_store:
            if e.get("escalation_id") == escalation_id or e.get("id") == escalation_id:
                return e
        return None
    
    async def update(self, escalation_id: str, updates: dict[str, Any]) -> dict[str, Any] | None:
        """Обновить эскалацию."""
        if self._use_redis:
            # Получаем текущую эскалацию
            escalation = await self.get_by_id(escalation_id)
            if not escalation:
                return None
            
            # Обновляем
            escalation.update(updates)
            
            # Сохраняем
            real_id = escalation.get("escalation_id") or escalation.get("id")
            await redis_service.save_escalation(escalation)
            
            return escalation
        
        for i, e in enumerate(self._memory_store):
            if e.get("escalation_id") == escalation_id or e.get("id") == escalation_id:
                self._memory_store[i].update(updates)
                return self._memory_store[i]
        return None
    
    async def delete(self, escalation_id: str) -> bool:
        """Удалить эскалацию."""
        if self._use_redis:
            # Сначала находим реальный ID
            escalation = await self.get_by_id(escalation_id)
            if escalation:
                real_id = escalation.get("escalation_id") or escalation.get("id")
                return await redis_service.delete_escalation(real_id)
            return False
        
        initial_len = len(self._memory_store)
        self._memory_store = [
            e for e in self._memory_store
            if e.get("escalation_id") != escalation_id and e.get("id") != escalation_id
        ]
        return len(self._memory_store) < initial_len
    
    async def add_client_message(self, escalation_id: str, message: str) -> dict[str, Any] | None:
        """Добавить сообщение клиента в эскалацию."""
        escalation = await self.get_by_id(escalation_id)
        if not escalation:
            return None
        
        # Инициализируем массивы если нужно
        if "client_messages" not in escalation:
            escalation["client_messages"] = []
        if "conversation_history" not in escalation:
            escalation["conversation_history"] = []
        
        # Добавляем сообщение
        escalation["client_messages"].append({
            "content": message,
            "timestamp": datetime.utcnow().isoformat() + "Z",
        })
        escalation["conversation_history"].append({
            "content": message,
            "is_user": True,
        })
        
        # Сохраняем
        if self._use_redis:
            await redis_service.save_escalation(escalation)
        
        return escalation
    
    async def add_operator_message(self, escalation_id: str, message: str) -> dict[str, Any] | None:
        """Добавить ответ оператора в эскалацию."""
        escalation = await self.get_by_id(escalation_id)
        if not escalation:
            return None
        
        # Инициализируем массивы если нужно
        if "operator_messages" not in escalation:
            escalation["operator_messages"] = []
        if "conversation_history" not in escalation:
            escalation["conversation_history"] = []
        
        # Добавляем сообщение
        now = datetime.utcnow().isoformat() + "Z"
        escalation["operator_messages"].append({
            "content": message,
            "timestamp": now,
        })
        escalation["conversation_history"].append({
            "content": message,
            "is_user": False,
            "is_operator": True,
        })
        
        # Обновляем время ответа если первый ответ
        if not escalation.get("responded_at"):
            escalation["responded_at"] = now
        
        # Обновляем последний ответ для совместимости
        escalation["operator_response"] = message
        
        # Сохраняем
        if self._use_redis:
            await redis_service.save_escalation(escalation)
        
        return escalation
    
    async def set_status(self, escalation_id: str, status: str) -> dict[str, Any] | None:
        """Изменить статус эскалации."""
        updates = {"status": status}
        
        if status == "resolved":
            updates["resolved_at"] = datetime.utcnow().isoformat() + "Z"
        
        return await self.update(escalation_id, updates)
    
    async def count(self, status: str | None = None) -> int:
        """Подсчитать количество эскалаций."""
        escalations = await self.get_all(status)
        return len(escalations)
    
    async def get_stats(self) -> dict[str, Any]:
        """Получить статистику по эскалациям."""
        all_esc = await self.get_all()
        
        pending = sum(1 for e in all_esc if e.get("status") == "pending")
        in_progress = sum(1 for e in all_esc if e.get("status") == "in_progress")
        resolved = sum(1 for e in all_esc if e.get("status") == "resolved")
        
        by_department = {}
        by_priority = {}
        
        for e in all_esc:
            dept = e.get("department", "unknown")
            by_department[dept] = by_department.get(dept, 0) + 1
            
            priority = e.get("priority", "medium")
            by_priority[priority] = by_priority.get(priority, 0) + 1
        
        return {
            "total": len(all_esc),
            "pending": pending,
            "in_progress": in_progress,
            "resolved": resolved,
            "by_department": by_department,
            "by_priority": by_priority,
            "storage": "redis" if self._use_redis else "memory",
        }


# Singleton instance
escalation_store = EscalationStore()

