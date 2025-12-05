"""Модели базы данных."""

from .user import User
from .ticket import (
    Ticket,
    TicketStatus,
    TicketPriority,
    TicketSource,
    Department,
    Category,
    Message,
    KnowledgeBase,
)

__all__ = [
    "User",
    "Ticket",
    "TicketStatus",
    "TicketPriority",
    "TicketSource",
    "Department",
    "Category",
    "Message",
    "KnowledgeBase",
]
