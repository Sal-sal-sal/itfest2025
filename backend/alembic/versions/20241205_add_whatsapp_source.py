"""Add WhatsApp to ticket source enum

Revision ID: 20241205_whatsapp
Revises: 20241205_helpdesk
Create Date: 2025-12-05

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '20241205_whatsapp'
down_revision: Union[str, Sequence[str], None] = '20241205_helpdesk'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add whatsapp value to ticketsource enum."""
    # Добавляем новое значение в enum
    op.execute("ALTER TYPE ticketsource ADD VALUE IF NOT EXISTS 'whatsapp'")


def downgrade() -> None:
    """Remove whatsapp from ticketsource enum.
    
    Note: PostgreSQL не позволяет удалять значения из enum напрямую.
    Для полного отката нужно пересоздать enum, что сложно если есть данные.
    """
    pass

