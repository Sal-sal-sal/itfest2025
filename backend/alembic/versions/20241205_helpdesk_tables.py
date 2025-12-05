"""Create Help Desk tables

Revision ID: 20241205_helpdesk
Revises: 8402130f6587
Create Date: 2025-12-05

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '20241205_helpdesk'
down_revision: Union[str, Sequence[str], None] = '8402130f6587'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create Help Desk tables."""
    
    # Departments table
    op.create_table(
        'departments',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('name_kz', sa.String(length=100), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('keywords', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
    )
    
    # Categories table
    op.create_table(
        'categories',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('name_kz', sa.String(length=100), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('department_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('parent_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('auto_response_template', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['department_id'], ['departments.id']),
        sa.ForeignKeyConstraint(['parent_id'], ['categories.id']),
    )
    
    # Tickets table
    op.create_table(
        'tickets',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('ticket_number', sa.String(length=20), nullable=False),
        sa.Column('client_name', sa.String(length=200), nullable=True),
        sa.Column('client_email', sa.String(length=320), nullable=True),
        sa.Column('client_phone', sa.String(length=50), nullable=True),
        sa.Column('subject', sa.String(length=500), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('language', sa.String(length=10), nullable=False, server_default='ru'),
        sa.Column('status', sa.Enum('new', 'processing', 'waiting_response', 'resolved', 'closed', 'escalated', name='ticketstatus'), nullable=False, server_default='new'),
        sa.Column('priority', sa.Enum('low', 'medium', 'high', 'critical', name='ticketpriority'), nullable=False, server_default='medium'),
        sa.Column('source', sa.Enum('email', 'chat', 'portal', 'phone', 'telegram', name='ticketsource'), nullable=False, server_default='portal'),
        sa.Column('department_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('category_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('assigned_to_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('ai_classified', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('ai_confidence', sa.Float(), nullable=True),
        sa.Column('ai_auto_resolved', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('ai_summary', sa.Text(), nullable=True),
        sa.Column('ai_suggested_response', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.Column('first_response_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('closed_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['department_id'], ['departments.id']),
        sa.ForeignKeyConstraint(['category_id'], ['categories.id']),
        sa.ForeignKeyConstraint(['assigned_to_id'], ['users.id']),
    )
    op.create_index('ix_tickets_ticket_number', 'tickets', ['ticket_number'], unique=True)
    op.create_index('ix_tickets_status', 'tickets', ['status'])
    op.create_index('ix_tickets_priority', 'tickets', ['priority'])
    op.create_index('ix_tickets_created_at', 'tickets', ['created_at'])
    
    # Messages table
    op.create_table(
        'messages',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('ticket_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('sender_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('is_from_client', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('is_ai_generated', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('is_internal_note', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['ticket_id'], ['tickets.id']),
        sa.ForeignKeyConstraint(['sender_id'], ['users.id']),
    )
    op.create_index('ix_messages_ticket_id', 'messages', ['ticket_id'])
    
    # Knowledge Base table
    op.create_table(
        'knowledge_base',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('category_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('question', sa.Text(), nullable=False),
        sa.Column('question_kz', sa.Text(), nullable=True),
        sa.Column('answer', sa.Text(), nullable=False),
        sa.Column('answer_kz', sa.Text(), nullable=True),
        sa.Column('keywords', sa.Text(), nullable=True),
        sa.Column('usage_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['category_id'], ['categories.id']),
    )
    
    # Seed initial departments
    op.execute("""
        INSERT INTO departments (id, name, name_kz, description, keywords)
        VALUES 
        ('11111111-1111-1111-1111-111111111111', 'IT поддержка', 'IT қолдау', 'Техническая поддержка IT', '["компьютер", "пароль", "принтер", "интернет", "программа", "почта", "email", "vpn", "сеть"]'),
        ('22222222-2222-2222-2222-222222222222', 'HR / Кадры', 'HR / Кадрлар', 'Отдел кадров', '["отпуск", "зарплата", "увольнение", "прием", "больничный", "справка", "договор"]'),
        ('33333333-3333-3333-3333-333333333333', 'Финансы', 'Қаржы', 'Финансовый отдел', '["счет", "оплата", "возврат", "бюджет", "расход", "invoice"]'),
        ('44444444-4444-4444-4444-444444444444', 'АХО', 'Әкімшілік-шаруашылық бөлімі', 'Административно-хозяйственный отдел', '["пропуск", "ключ", "офис", "мебель", "уборка", "канцелярия"]')
    """)
    
    # Seed initial categories
    op.execute("""
        INSERT INTO categories (id, name, name_kz, department_id, auto_response_template)
        VALUES 
        ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Сброс пароля', 'Құпия сөзді қалпына келтіру', '11111111-1111-1111-1111-111111111111', 'Для сброса пароля перейдите по ссылке: https://portal.company.kz/reset-password'),
        ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Доступ к VPN', 'VPN-ге қосылу', '11111111-1111-1111-1111-111111111111', 'Инструкция по настройке VPN: https://portal.company.kz/vpn-guide'),
        ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Проблема с принтером', 'Принтер мәселесі', '11111111-1111-1111-1111-111111111111', NULL),
        ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Заявление на отпуск', 'Демалыс өтінімі', '22222222-2222-2222-2222-222222222222', 'Заявление на отпуск: https://hr.company.kz/vacation'),
        ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'Вопрос по зарплате', 'Жалақы туралы сұрақ', '22222222-2222-2222-2222-222222222222', NULL),
        ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'Оплата счета', 'Шот төлемі', '33333333-3333-3333-3333-333333333333', NULL)
    """)
    
    # Seed knowledge base
    op.execute("""
        INSERT INTO knowledge_base (id, question, question_kz, answer, answer_kz, keywords)
        VALUES 
        ('11111111-aaaa-aaaa-aaaa-111111111111', 'Как сбросить пароль?', 'Құпия сөзді қалай қалпына келтіруге болады?', 
         'Для сброса пароля:\n1. Перейдите на страницу входа\n2. Нажмите "Забыли пароль?"\n3. Введите ваш email\n4. Следуйте инструкциям в письме', 
         'Құпия сөзді қалпына келтіру үшін:\n1. Кіру бетіне өтіңіз\n2. "Құпия сөзді ұмыттыңыз ба?" түймесін басыңыз\n3. Email-ді енгізіңіз\n4. Хаттағы нұсқауларды орындаңыз',
         '["сброс", "пароль", "забыл", "парольді", "ұмыттым"]'),
        ('22222222-aaaa-aaaa-aaaa-222222222222', 'Как подключиться к VPN?', 'VPN-ге қалай қосылуға болады?', 
         'Инструкция по VPN:\n1. Скачайте клиент с https://vpn.company.kz\n2. Установите сертификат\n3. Введите корпоративные учетные данные\n4. Выберите сервер и подключитесь', 
         'VPN нұсқаулығы:\n1. https://vpn.company.kz сайтынан клиентті жүктеп алыңыз\n2. Сертификатты орнатыңыз\n3. Корпоративтік деректерді енгізіңіз',
         '["vpn", "подключение", "удаленный", "қашықтан"]'),
        ('33333333-aaaa-aaaa-aaaa-333333333333', 'Как оформить отпуск?', 'Демалысты қалай рәсімдеуге болады?', 
         'Оформление отпуска:\n1. Зайдите в HR-портал\n2. Раздел "Отпуск" -> "Новое заявление"\n3. Укажите даты и тип отпуска\n4. Приложите согласование руководителя\n\nМинимальный срок подачи: 14 дней', 
         'Демалысты рәсімдеу:\n1. HR-порталға кіріңіз\n2. "Демалыс" -> "Жаңа өтінім" бөліміне өтіңіз\n3. Күндер мен демалыс түрін көрсетіңіз',
         '["отпуск", "заявление", "демалыс", "өтініш"]')
    """)


def downgrade() -> None:
    """Drop Help Desk tables."""
    op.drop_table('knowledge_base')
    op.drop_index('ix_messages_ticket_id', table_name='messages')
    op.drop_table('messages')
    op.drop_index('ix_tickets_created_at', table_name='tickets')
    op.drop_index('ix_tickets_priority', table_name='tickets')
    op.drop_index('ix_tickets_status', table_name='tickets')
    op.drop_index('ix_tickets_ticket_number', table_name='tickets')
    op.drop_table('tickets')
    op.drop_table('categories')
    op.drop_table('departments')
    
    # Drop enums
    op.execute('DROP TYPE IF EXISTS ticketstatus')
    op.execute('DROP TYPE IF EXISTS ticketpriority')
    op.execute('DROP TYPE IF EXISTS ticketsource')

