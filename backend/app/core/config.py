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

    # ── JazzCash ──────────────────────────────────────────────────────────────
    jazzcash_merchant_id: str = ""
    jazzcash_password: str = ""
    jazzcash_integrity_salt: str = ""
    jazzcash_env: str = "sandbox"
    jazzcash_return_url: str = ""

    deepl_api_key: str = ""

    # ── EasyPaisa ─────────────────────────────────────────────────────────────
    easypaisa_store_id: str = ""
    easypaisa_hash_key: str = ""
    easypaisa_env: str = "sandbox"
    easypaisa_return_url: str = ""

    # ── Naya Pay ──────────────────────────────────────────────────────────────
    nayapay_client_id: str = ""
    nayapay_client_secret: str = ""
    nayapay_env: str = "sandbox"
    nayapay_return_url: str = ""

    # ── Meezan Bank ───────────────────────────────────────────────────────────
    meezan_merchant_id: str = ""
    meezan_password: str = ""
    meezan_integrity_salt: str = ""
    meezan_env: str = "sandbox"
    meezan_return_url: str = ""

    # ── Bank Alfalah ──────────────────────────────────────────────────────────
    alfalah_merchant_id: str = ""
    alfalah_merchant_key: str = ""
    alfalah_channel_id: str = "1001"
    alfalah_env: str = "sandbox"
    alfalah_return_url: str = ""

    # ── Checkout.com (international cards) ────────────────────────────────────
    checkout_secret_key: str = ""
    checkout_public_key: str = ""
    checkout_env: str = "sandbox"
    checkout_success_url: str = ""
    checkout_failure_url: str = ""

    arq_redis_url: str = "redis://localhost:6379/1"

    anthropic_api_key: str | None = None
    base_url: str = "https://shopunity.pk"


@lru_cache
def get_settings() -> Settings:
    return Settings()
