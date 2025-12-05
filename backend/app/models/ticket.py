"""Модели тикетов Help Desk."""

import uuid
import enum
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, Text, func, Float
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..db.base import Base


class TicketStatus(str, enum.Enum):
    """Статус тикета."""
    NEW = "new"
    PROCESSING = "processing"
    WAITING_RESPONSE = "waiting_response"
    RESOLVED = "resolved"
    CLOSED = "closed"
    ESCALATED = "escalated"


class TicketPriority(str, enum.Enum):
    """Приоритет тикета."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class TicketSource(str, enum.Enum):
    """Источник обращения."""
    EMAIL = "email"
    CHAT = "chat"
    PORTAL = "portal"
    PHONE = "phone"
    TELEGRAM = "telegram"


class Department(Base):
    """Отдел/департамент для маршрутизации."""

    __tablename__ = "departments"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    name_kz: Mapped[str] = mapped_column(String(100), nullable=True)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    keywords: Mapped[str] = mapped_column(Text, nullable=True)  # JSON список ключевых слов для маршрутизации
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    tickets: Mapped[list["Ticket"]] = relationship("Ticket", back_populates="department")

    def __repr__(self) -> str:
        return f"<Department {self.name}>"


class Category(Base):
    """Категория обращения."""

    __tablename__ = "categories"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    name_kz: Mapped[str] = mapped_column(String(100), nullable=True)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    department_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("departments.id"),
        nullable=True,
    )
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("categories.id"),
        nullable=True,
    )
    auto_response_template: Mapped[str] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    tickets: Mapped[list["Ticket"]] = relationship("Ticket", back_populates="category")

    def __repr__(self) -> str:
        return f"<Category {self.name}>"


class Ticket(Base):
    """Тикет/обращение в службу поддержки."""

    __tablename__ = "tickets"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    ticket_number: Mapped[str] = mapped_column(String(20), unique=True, index=True, nullable=False)
    
    # Контакт клиента
    client_name: Mapped[str] = mapped_column(String(200), nullable=True)
    client_email: Mapped[str] = mapped_column(String(320), nullable=True)
    client_phone: Mapped[str] = mapped_column(String(50), nullable=True)
    
    # Содержание
    subject: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    language: Mapped[str] = mapped_column(String(10), default="ru", nullable=False)  # ru, kz
    
    # Классификация
    status: Mapped[TicketStatus] = mapped_column(
        Enum(TicketStatus, values_callable=lambda x: [e.value for e in x], name='ticketstatus'),
        default=TicketStatus.NEW,
        nullable=False,
    )
    priority: Mapped[TicketPriority] = mapped_column(
        Enum(TicketPriority, values_callable=lambda x: [e.value for e in x], name='ticketpriority'),
        default=TicketPriority.MEDIUM,
        nullable=False,
    )
    source: Mapped[TicketSource] = mapped_column(
        Enum(TicketSource, values_callable=lambda x: [e.value for e in x], name='ticketsource'),
        default=TicketSource.PORTAL,
        nullable=False,
    )
    
    # Маршрутизация
    department_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("departments.id"),
        nullable=True,
    )
    category_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("categories.id"),
        nullable=True,
    )
    assigned_to_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=True,
    )
    
    # AI-метаданные
    ai_classified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    ai_confidence: Mapped[float] = mapped_column(Float, nullable=True)  # Уверенность ИИ в классификации
    ai_auto_resolved: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    ai_summary: Mapped[str] = mapped_column(Text, nullable=True)
    ai_suggested_response: Mapped[str] = mapped_column(Text, nullable=True)
    
    # Временные метки
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
    first_response_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    resolved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    closed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    
    # Связи
    department: Mapped["Department"] = relationship("Department", back_populates="tickets")
    category: Mapped["Category"] = relationship("Category", back_populates="tickets")
    assigned_to: Mapped["User"] = relationship("User", foreign_keys=[assigned_to_id])
    messages: Mapped[list["Message"]] = relationship("Message", back_populates="ticket", order_by="Message.created_at")

    def __repr__(self) -> str:
        return f"<Ticket {self.ticket_number}>"


class Message(Base):
    """Сообщение в тикете."""

    __tablename__ = "messages"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    ticket_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tickets.id"),
        nullable=False,
    )
    sender_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=True,
    )
    
    content: Mapped[str] = mapped_column(Text, nullable=False)
    is_from_client: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_ai_generated: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_internal_note: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    ticket: Mapped["Ticket"] = relationship("Ticket", back_populates="messages")
    sender: Mapped["User"] = relationship("User", foreign_keys=[sender_id])

    def __repr__(self) -> str:
        return f"<Message {self.id}>"


class KnowledgeBase(Base):
    """База знаний для автоответов."""

    __tablename__ = "knowledge_base"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    category_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("categories.id"),
        nullable=True,
    )
    
    question: Mapped[str] = mapped_column(Text, nullable=False)
    question_kz: Mapped[str] = mapped_column(Text, nullable=True)
    answer: Mapped[str] = mapped_column(Text, nullable=False)
    answer_kz: Mapped[str] = mapped_column(Text, nullable=True)
    keywords: Mapped[str] = mapped_column(Text, nullable=True)  # JSON список ключевых слов
    
    usage_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<KnowledgeBase {self.id}>"


# Импорт User для связей
from .user import User

