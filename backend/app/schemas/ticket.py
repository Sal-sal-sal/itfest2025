"""Pydantic-схемы для тикетов."""

import uuid
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, EmailStr, Field


class TicketStatus(str, Enum):
    NEW = "new"
    PROCESSING = "processing"
    WAITING_RESPONSE = "waiting_response"
    RESOLVED = "resolved"
    CLOSED = "closed"
    ESCALATED = "escalated"


class TicketPriority(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class TicketSource(str, Enum):
    EMAIL = "email"
    CHAT = "chat"
    PORTAL = "portal"
    PHONE = "phone"
    TELEGRAM = "telegram"


# Department schemas
class DepartmentBase(BaseModel):
    name: str = Field(max_length=100)
    name_kz: str | None = None
    description: str | None = None


class DepartmentCreate(DepartmentBase):
    keywords: list[str] | None = None


class DepartmentRead(DepartmentBase):
    id: uuid.UUID
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


# Category schemas
class CategoryBase(BaseModel):
    name: str = Field(max_length=100)
    name_kz: str | None = None
    description: str | None = None


class CategoryCreate(CategoryBase):
    department_id: uuid.UUID | None = None
    parent_id: uuid.UUID | None = None
    auto_response_template: str | None = None


class CategoryRead(CategoryBase):
    id: uuid.UUID
    department_id: uuid.UUID | None
    parent_id: uuid.UUID | None
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


# Ticket schemas
class TicketBase(BaseModel):
    subject: str = Field(max_length=500)
    description: str
    language: str = Field(default="ru", pattern="^(ru|kz)$")


class TicketCreate(TicketBase):
    client_name: str | None = Field(max_length=200, default=None)
    client_email: EmailStr | None = None
    client_phone: str | None = Field(max_length=50, default=None)
    source: TicketSource = TicketSource.PORTAL
    category_id: uuid.UUID | None = None
    # Опциональные поля для переопределения AI-классификации
    priority: TicketPriority | None = None
    department_id: uuid.UUID | None = None


class TicketUpdate(BaseModel):
    subject: str | None = Field(max_length=500, default=None)
    description: str | None = None
    status: TicketStatus | None = None
    priority: TicketPriority | None = None
    department_id: uuid.UUID | None = None
    category_id: uuid.UUID | None = None
    assigned_to_id: uuid.UUID | None = None


class TicketRead(TicketBase):
    id: uuid.UUID
    ticket_number: str
    client_name: str | None
    client_email: str | None
    client_phone: str | None
    status: TicketStatus
    priority: TicketPriority
    source: TicketSource
    department_id: uuid.UUID | None
    category_id: uuid.UUID | None
    assigned_to_id: uuid.UUID | None
    ai_classified: bool
    ai_confidence: float | None
    ai_auto_resolved: bool
    ai_summary: str | None
    ai_suggested_response: str | None
    created_at: datetime
    updated_at: datetime
    first_response_at: datetime | None
    resolved_at: datetime | None

    class Config:
        from_attributes = True


class TicketListRead(BaseModel):
    id: uuid.UUID
    ticket_number: str
    subject: str
    client_name: str | None
    client_email: str | None
    status: TicketStatus
    priority: TicketPriority
    source: TicketSource
    ai_classified: bool
    ai_auto_resolved: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TicketWithMessages(TicketRead):
    messages: list["MessageRead"] = []
    department: DepartmentRead | None = None
    category: CategoryRead | None = None


# Message schemas
class MessageBase(BaseModel):
    content: str


class MessageCreate(MessageBase):
    is_internal_note: bool = False


class MessageRead(MessageBase):
    id: uuid.UUID
    ticket_id: uuid.UUID
    sender_id: uuid.UUID | None
    is_from_client: bool
    is_ai_generated: bool
    is_internal_note: bool
    created_at: datetime

    class Config:
        from_attributes = True


# Knowledge Base schemas
class KnowledgeBaseBase(BaseModel):
    question: str
    answer: str


class KnowledgeBaseCreate(KnowledgeBaseBase):
    question_kz: str | None = None
    answer_kz: str | None = None
    category_id: uuid.UUID | None = None
    keywords: list[str] | None = None


class KnowledgeBaseRead(KnowledgeBaseBase):
    id: uuid.UUID
    question_kz: str | None
    answer_kz: str | None
    category_id: uuid.UUID | None
    usage_count: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


# AI Classification response
class AIClassificationResult(BaseModel):
    category_id: uuid.UUID | None = None
    department_id: uuid.UUID | None = None
    priority: TicketPriority
    confidence: float = Field(ge=0, le=1)
    detected_language: str
    summary: str
    suggested_response: str | None = None
    can_auto_resolve: bool = False


# Analytics schemas
class TicketStats(BaseModel):
    total_tickets: int
    new_tickets: int
    resolved_tickets: int
    auto_resolved_tickets: int
    avg_response_time_minutes: float | None
    avg_resolution_time_minutes: float | None
    classification_accuracy: float
    auto_resolution_rate: float


class DepartmentStats(BaseModel):
    department_id: uuid.UUID
    department_name: str
    ticket_count: int
    avg_resolution_time_minutes: float | None


class PriorityDistribution(BaseModel):
    low: int
    medium: int
    high: int
    critical: int


class SourceDistribution(BaseModel):
    email: int
    chat: int
    portal: int
    phone: int
    telegram: int


class DashboardStats(BaseModel):
    ticket_stats: TicketStats
    priority_distribution: PriorityDistribution
    source_distribution: SourceDistribution
    department_stats: list[DepartmentStats]
    recent_tickets: list[TicketListRead]


# Update forward references
TicketWithMessages.model_rebuild()

