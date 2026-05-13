from arq.connections import RedisSettings
from arq import cron

from app.core.config import get_settings
from app.workers.tasks import (
    check_upcoming_flash_sales,
    compute_ml_recommendations,
    escalate_stuck_orders,
    generate_product_qr,
    notify_flash_sale_wishlist,
    notify_low_stock,
    scan_abandoned_carts,
    send_all_daily_digests,
    send_campaign_blast,
    send_cart_abandonment_reminder,
    send_rating_request,
)

settings = get_settings()


class WorkerSettings:
    functions = [
        generate_product_qr,
        notify_low_stock,
        send_all_daily_digests,
        escalate_stuck_orders,
        send_campaign_blast,
        send_rating_request,
        send_cart_abandonment_reminder,
        notify_flash_sale_wishlist,
        check_upcoming_flash_sales,
        scan_abandoned_carts,
        compute_ml_recommendations,
    ]
    redis_settings = RedisSettings.from_dsn(settings.arq_redis_url)
    cron_jobs = [
        cron(send_all_daily_digests, hour=1, minute=0),       # 6 AM PKT daily
        cron(escalate_stuck_orders, hour=2, minute=0),         # 7 AM PKT daily
        cron(check_upcoming_flash_sales, minute=0),            # every hour
        cron(scan_abandoned_carts, hour=6, minute=30),         # 11:30 AM PKT daily
        cron(compute_ml_recommendations, hour=0, minute=30),   # 5:30 AM PKT nightly
    ]
