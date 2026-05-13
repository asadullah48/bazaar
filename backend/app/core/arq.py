import arq
from arq import ArqRedis
from arq.connections import RedisSettings

from app.core.config import get_settings

settings = get_settings()
_pool: ArqRedis | None = None


async def get_arq_pool() -> ArqRedis:
    global _pool
    if _pool is None:
        _pool = await arq.create_pool(RedisSettings.from_dsn(settings.arq_redis_url))
    return _pool
