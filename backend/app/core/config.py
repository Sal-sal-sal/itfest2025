"""Конфигурация приложения и доступ к настройкам."""

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Основные настройки backend-сервиса."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="allow",
    )

    app_name: str = "Template Backend"
    debug: bool = False
    environment: str = Field(default="local", alias="ENVIRONMENT")

    # PostgreSQL
    database_url: str | None = Field(default=None, alias="DATABASE_URL")
    postgres_user: str = Field(default="postgres", alias="POSTGRES_USER")
    postgres_password: str = Field(default="postgres", alias="POSTGRES_PASSWORD")
    postgres_host: str = Field(default="localhost", alias="POSTGRES_HOST")
    postgres_port: int = Field(default=5432, alias="POSTGRES_PORT")
    postgres_db: str = Field(default="template", alias="POSTGRES_DB")

    # Redis
    redis_url: str = Field(default="redis://localhost:6379/0", alias="REDIS_URL")

    # Security
    jwt_secret_key: str = Field(default="change-me", alias="JWT_SECRET_KEY")
    jwt_algorithm: str = Field(default="HS256", alias="JWT_ALGORITHM")
    access_token_exp_minutes: int = Field(default=15, alias="ACCESS_TOKEN_EXPIRE_MINUTES")
    refresh_token_exp_minutes: int = Field(
        default=60 * 24 * 7,
        alias="REFRESH_TOKEN_EXPIRE_MINUTES",
    )

    # CORS
    cors_allow_origins: list[str] = Field(default_factory=lambda: ["*"], alias="CORS_ALLOW_ORIGINS")

    # OpenAI
    openai_api_key: str | None = Field(default=None, alias="OPENAI_API_KEY")
    openai_model: str = Field(default="gpt-4o-mini", alias="OPENAI_MODEL")

    # WhatsApp Business API (Meta)
    WHATSAPP_PHONE_NUMBER_ID: str | None = Field(default=None)
    WHATSAPP_ACCESS_TOKEN: str | None = Field(default=None)
    WHATSAPP_VERIFY_TOKEN: str = Field(default="helpdesk_verify_token")
    
    # Twilio WhatsApp (альтернатива Meta API)
    TWILIO_ACCOUNT_SID: str | None = Field(default=None)
    TWILIO_AUTH_TOKEN: str | None = Field(default=None)
    TWILIO_WHATSAPP_NUMBER: str | None = Field(default=None)  # например: +14155238886
    
    # Twilio Voice (голосовой бот)
    TWILIO_VOICE_NUMBER: str | None = Field(default=None)  # Номер для приёма звонков
    OPERATOR_PHONE_NUMBER: str | None = Field(default=None)  # Номер оператора для перевода звонков

    # Email (IMAP/SMTP)
    EMAIL_IMAP_SERVER: str | None = Field(default=None)
    EMAIL_IMAP_PORT: int = Field(default=993)
    EMAIL_SMTP_SERVER: str | None = Field(default=None)
    EMAIL_SMTP_PORT: int = Field(default=587)
    EMAIL_ADDRESS: str | None = Field(default=None)
    EMAIL_PASSWORD: str | None = Field(default=None)
    COMPANY_NAME: str = Field(default="Help Desk")

    @property
    def sqlalchemy_database_uri(self) -> str:
        """Асинхронная строка подключения для SQLAlchemy/asyncpg."""
        if self.database_url:
            return self.database_url
        return (
            f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )


@lru_cache
def get_settings() -> Settings:
    """Ленивое получение настроек, чтобы переиспользовать инстанс."""
    return Settings()  # type: ignore[arg-type]

