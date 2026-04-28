from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_env: str = "development"
    frontend_url: str = "http://localhost:3000"

    database_url: str = "postgresql+asyncpg://bazaar:bazaarpass@localhost:5432/bazaar_db"
    redis_url: str = "redis://localhost:6379/0"

    jwt_secret_key: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7

    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_whatsapp_from: str = "whatsapp:+14155238886"

    resend_api_key: str = ""
    from_email: str = "noreply@bazaar.pk"

    r2_endpoint_url: str = ""
    r2_access_key: str = ""
    r2_secret_key: str = ""
    r2_bucket_name: str = "bazaar-assets"
    r2_public_url: str = ""

    paymob_api_key: str = ""
    paymob_integration_id: str = ""
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""

    arq_redis_url: str = "redis://localhost:6379/1"


@lru_cache
def get_settings() -> Settings:
    return Settings()
