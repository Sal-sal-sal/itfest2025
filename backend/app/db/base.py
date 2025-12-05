"""Базовый класс моделей SQLAlchemy."""

from sqlalchemy.orm import DeclarativeBase, declared_attr


class Base(DeclarativeBase):
    """Общий declarative base с указанием схемы."""

    __abstract__ = True

    @declared_attr.directive
    def __tablename__(cls) -> str:  # noqa: N805 (SQLAlchemy требует cls)
        return cls.__name__.lower()

