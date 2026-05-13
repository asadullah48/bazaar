import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select

from app.core.config import get_settings
from app.core.database import AsyncSessionLocal
from app.core.redis import get_redis
from app.models.campaign import Campaign, CampaignProduct, UserEvent
from app.models.catalog import CartItem, InventoryAlert, Product, ProductVariant, Wishlist
from app.models.order import Order
from app.models.payout import PayoutRecord
from app.models.user import SellerProfile, User
from app.services.notifications import send_email, send_whatsapp
from app.services.qr_generator import generate_qr_data_uri

settings = get_settings()
QR_TTL = 86400


async def generate_product_qr(ctx, product_id: str):
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Product).where(Product.id == uuid.UUID(product_id))
        )
        product = result.scalar_one_or_none()
        if product is None:
            return {"error": "product not found"}

        url = f"{settings.base_url}/en/products/{product.slug}"
        data_uri = generate_qr_data_uri(url)

        product.qr_data = {
            "qr_code_url": data_uri,
            "tap_to_pay_enabled": True,
            "product_id": str(product.id),
            "encoded_url": url,
        }

        redis = await get_redis()
        await redis.setex(f"qr:{product_id}", QR_TTL, data_uri)

        await db.commit()

    return {"product_id": product_id, "status": "done"}


# ── Stock alert ───────────────────────────────────────────────────────────────

async def notify_low_stock(ctx, variant_id: str, product_title: str, new_qty: int, seller_id: str):
    """Send WhatsApp + email to seller when a variant hits zero or threshold stock."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.id == uuid.UUID(seller_id)))
        seller = result.scalar_one_or_none()
        if seller is None:
            return {"error": "seller not found"}

    if new_qty == 0:
        msg = f"ShopUnity: ⚠️ *{product_title}* is OUT OF STOCK and has been paused automatically."
        subject = f"Out of stock: {product_title}"
    else:
        msg = f"ShopUnity: ⚠️ Low stock for *{product_title}* — only {new_qty} units left."
        subject = f"Low stock alert: {product_title}"

    if seller.phone:
        send_whatsapp(seller.phone, msg)
    send_email(seller.email, subject, f"<p style='font-family:sans-serif'>{msg}</p>")

    return {"variant_id": variant_id, "qty": new_qty, "notified": seller.email}


# ── Daily digest (cron) ───────────────────────────────────────────────────────

def _digest_html(
    store_name: str,
    order_count: int,
    revenue: float,
    pending_payout: float,
    low_stock_count: int,
) -> str:
    return (
        f"<div style='font-family:sans-serif;max-width:480px;margin:auto'>"
        f"<h2 style='color:#ea580c'>ShopUnity — Daily Digest</h2>"
        f"<p>Good morning, {store_name}!</p>"
        f"<table width='100%' cellpadding='10' style='border-collapse:collapse'>"
        f"<tr><td>\U0001f4e6 Orders (24h)</td><td><strong>{order_count}</strong></td></tr>"
        f"<tr style='background:#f9f9f9'><td>\U0001f4b0 Revenue (24h)</td>"
        f"<td><strong>PKR {revenue:,.0f}</strong></td></tr>"
        f"<tr><td>⏳ Pending payout</td><td><strong>PKR {pending_payout:,.0f}</strong></td></tr>"
        f"<tr style='background:#f9f9f9'><td>⚠️ Low-stock variants</td>"
        f"<td><strong>{low_stock_count}</strong></td></tr>"
        f"</table>"
        f"<p style='color:#9ca3af;font-size:12px;margin-top:24px'>ShopUnity · Karachi, Pakistan</p>"
        f"</div>"
    )


async def send_all_daily_digests(ctx):
    """Cron task — runs at 1 AM UTC (6 AM PKT). Sends digest email to every approved seller."""
    yesterday = datetime.now(timezone.utc) - timedelta(hours=24)

    async with AsyncSessionLocal() as db:
        sellers_result = await db.execute(
            select(SellerProfile, User)
            .join(User, User.id == SellerProfile.user_id)
            .where(SellerProfile.status == "approved", User.is_active == True)
        )
        all_sellers = sellers_result.all()

        sent = 0
        for sp, user in all_sellers:
            sid = user.id

            # 24h orders + revenue
            stats = (
                await db.execute(
                    select(
                        func.count(Order.id).label("order_count"),
                        func.coalesce(func.sum(Order.total_amount), 0).label("revenue"),
                    ).where(
                        Order.seller_id == sid,
                        Order.payment_status == "paid",
                        Order.created_at >= yesterday,
                    )
                )
            ).one()

            # Pending payout
            pending_payout = (
                await db.execute(
                    select(func.coalesce(func.sum(PayoutRecord.net_amount), 0)).where(
                        PayoutRecord.seller_id == sid,
                        PayoutRecord.status == "pending",
                    )
                )
            ).scalar() or 0

            # Low-stock variant count (below threshold, not yet zero)
            low_stock_count = (
                await db.execute(
                    select(func.count(ProductVariant.id))
                    .join(Product, Product.id == ProductVariant.product_id)
                    .outerjoin(InventoryAlert, InventoryAlert.variant_id == ProductVariant.id)
                    .where(
                        Product.seller_id == sid,
                        ProductVariant.is_active == True,
                        ProductVariant.stock_qty > 0,
                        ProductVariant.stock_qty
                        <= func.coalesce(InventoryAlert.threshold, ProductVariant.low_stock_threshold),
                    )
                )
            ).scalar() or 0

            html = _digest_html(
                store_name=sp.store_name,
                order_count=stats.order_count,
                revenue=float(stats.revenue),
                pending_payout=float(pending_payout),
                low_stock_count=low_stock_count,
            )
            send_email(user.email, f"Daily digest — {sp.store_name}", html)
            sent += 1

    return {"digests_sent": sent}


# ── Order escalation (cron) ───────────────────────────────────────────────────

async def escalate_stuck_orders(ctx):
    """Cron task — runs every 4h. Flags orders stuck in 'processing' > 24h and alerts seller."""
    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)

    async with AsyncSessionLocal() as db:
        stuck_result = await db.execute(
            select(Order, User)
            .join(User, User.id == Order.seller_id, isouter=True)
            .where(
                Order.status == "processing",
                Order.created_at < cutoff,
            )
        )
        stuck_orders = stuck_result.all()

        escalated = 0
        for order, seller in stuck_orders:
            # Flag the order
            order.status = "escalated"
            db.add(order)

            if seller:
                msg = (
                    f"ShopUnity: ⚠️ Order #{str(order.id)[:8].upper()} has been in "
                    f"'processing' for over 24 hours. Please fulfill or contact support."
                )
                if seller.phone:
                    send_whatsapp(seller.phone, msg)
                send_email(seller.email, f"Action needed: Order #{str(order.id)[:8].upper()}", f"<p style='font-family:sans-serif'>{msg}</p>")
            escalated += 1

        if escalated:
            await db.commit()

    return {"escalated": escalated}


# ── Phase 4B: Segmented marketing triggers ─────────────────────────────────────

async def send_campaign_blast(ctx, campaign_id: str):
    """WhatsApp + email blast to buyers with affinity for the campaign's categories."""
    async with AsyncSessionLocal() as db:
        campaign = (
            await db.execute(select(Campaign).where(Campaign.id == uuid.UUID(campaign_id)))
        ).scalar_one_or_none()
        if not campaign:
            return {"error": "campaign not found"}

        category_ids = (
            await db.execute(
                select(Product.category_id)
                .join(CampaignProduct, CampaignProduct.product_id == Product.id)
                .where(
                    CampaignProduct.campaign_id == campaign.id,
                    Product.category_id.is_not(None),
                )
                .distinct()
            )
        ).scalars().all()

        if not category_ids:
            return {"sent": 0, "reason": "no categories"}

        cutoff = datetime.now(timezone.utc) - timedelta(days=30)
        buyer_ids = (
            await db.execute(
                select(UserEvent.user_id)
                .join(Product, Product.id == UserEvent.product_id)
                .where(
                    UserEvent.event_type == "view",
                    UserEvent.user_id.is_not(None),
                    UserEvent.created_at >= cutoff,
                    Product.category_id.in_(category_ids),
                )
                .distinct()
            )
        ).scalars().all()

        redis = await get_redis()
        sent = 0
        for uid in buyer_ids:
            if await redis.get(f"mkt_optout:{uid}"):
                continue
            user = (await db.execute(select(User).where(User.id == uid))).scalar_one_or_none()
            if not user or not user.is_active:
                continue

            discount = f" Save {int(campaign.discount_pct)}% on selected products." if campaign.discount_pct else ""
            url = f"{settings.base_url}/en/campaigns/{campaign.slug}"
            msg = f"ShopUnity: \U0001f525 *{campaign.title}* is live!{discount}\n{url}"
            if user.phone:
                send_whatsapp(user.phone, msg)
            send_email(
                user.email,
                f"\U0001f525 {campaign.title} — ShopUnity",
                f"<p style='font-family:sans-serif'>{msg.replace(chr(10), '<br>')}</p>",
            )
            sent += 1

    return {"campaign_id": campaign_id, "sent": sent}


async def send_rating_request(ctx, order_id: str, buyer_id: str):
    """Email buyer asking to rate their purchase. Enqueued with 48h defer on delivery."""
    async with AsyncSessionLocal() as db:
        order = (
            await db.execute(select(Order).where(Order.id == uuid.UUID(order_id)))
        ).scalar_one_or_none()
        user = (
            await db.execute(select(User).where(User.id == uuid.UUID(buyer_id)))
        ).scalar_one_or_none()
        if not order or not user:
            return {"error": "not found"}

    url = f"{settings.base_url}/en/orders/{order_id}/review"
    html = (
        f"<div style='font-family:sans-serif;max-width:480px;margin:auto'>"
        f"<h2 style='color:#ea580c'>How was your order?</h2>"
        f"<p>Your order <strong>#{order.order_number}</strong> has been delivered.</p>"
        f"<p>Your review helps other shoppers and supports Pakistani sellers.</p>"
        f"<a href='{url}' style='display:inline-block;background:#ea580c;color:#fff;"
        f"padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:12px'>"
        f"Rate Your Purchase</a>"
        f"<p style='color:#9ca3af;font-size:12px;margin-top:24px'>ShopUnity · Karachi, Pakistan</p>"
        f"</div>"
    )
    send_email(user.email, f"How was your order? #{order.order_number}", html)
    return {"order_id": order_id, "sent_to": user.email}


async def send_cart_abandonment_reminder(ctx, buyer_id: str, product_titles: list):
    """WhatsApp + email nudge for abandoned cart. Redis-gated to one reminder per 48h."""
    redis = await get_redis()
    gate_key = f"cart_reminder:{buyer_id}"
    if await redis.get(gate_key):
        return {"skipped": "already_sent"}

    async with AsyncSessionLocal() as db:
        user = (
            await db.execute(select(User).where(User.id == uuid.UUID(buyer_id)))
        ).scalar_one_or_none()
        if not user or not user.is_active:
            return {"error": "user not found"}

    titles_str = ", ".join(product_titles[:3])
    if len(product_titles) > 3:
        titles_str += f" and {len(product_titles) - 3} more"
    cart_url = f"{settings.base_url}/en/cart"
    msg = (
        f"ShopUnity: \U0001f6d2 You left something behind!\n"
        f"Still in your cart: *{titles_str}*.\n"
        f"Complete your purchase before they sell out → {cart_url}"
    )
    if user.phone:
        send_whatsapp(user.phone, msg)
    send_email(
        user.email,
        "You left items in your cart — ShopUnity",
        f"<p style='font-family:sans-serif'>{msg.replace(chr(10), '<br>')}</p>",
    )
    await redis.setex(gate_key, 172800, "1")  # 48h gate prevents spam
    return {"buyer_id": buyer_id, "notified": True}


async def notify_flash_sale_wishlist(ctx, campaign_id: str):
    """Email + WhatsApp to users who wishlisted products going on flash sale."""
    async with AsyncSessionLocal() as db:
        campaign = (
            await db.execute(select(Campaign).where(Campaign.id == uuid.UUID(campaign_id)))
        ).scalar_one_or_none()
        if not campaign:
            return {"error": "campaign not found"}

        product_ids = (
            await db.execute(
                select(CampaignProduct.product_id).where(CampaignProduct.campaign_id == campaign.id)
            )
        ).scalars().all()
        if not product_ids:
            return {"sent": 0}

        wishlist_rows = (
            await db.execute(
                select(Wishlist.user_id, Wishlist.product_id)
                .where(Wishlist.product_id.in_(product_ids))
                .distinct()
            )
        ).all()

        user_pids: dict[uuid.UUID, list] = {}
        for uid, pid in wishlist_rows:
            user_pids.setdefault(uid, []).append(pid)

        redis = await get_redis()
        sent = 0
        for uid, pids in user_pids.items():
            if await redis.get(f"mkt_optout:{uid}"):
                continue
            user = (await db.execute(select(User).where(User.id == uid))).scalar_one_or_none()
            if not user or not user.is_active:
                continue

            discount = f" at {int(campaign.discount_pct)}% off" if campaign.discount_pct else ""
            start_str = campaign.start_at.strftime("%d %b %Y, %H:%M UTC")
            url = f"{settings.base_url}/en/campaigns/{campaign.slug}"
            msg = (
                f"ShopUnity: ⚡ Flash sale starting soon!\n"
                f"*{campaign.title}*{discount} — {len(pids)} item(s) from your wishlist included.\n"
                f"Starts: {start_str}\n{url}"
            )
            if user.phone:
                send_whatsapp(user.phone, msg)
            send_email(
                user.email,
                f"⚡ Your wishlisted items are on sale — {campaign.title}",
                f"<p style='font-family:sans-serif'>{msg.replace(chr(10), '<br>')}</p>",
            )
            sent += 1

    return {"campaign_id": campaign_id, "sent": sent}


async def check_upcoming_flash_sales(ctx):
    """Cron — hourly. Enqueues wishlist notifications for flash sales starting in ~1h."""
    now = datetime.now(timezone.utc)
    window_start = now + timedelta(minutes=50)
    window_end = now + timedelta(minutes=70)

    async with AsyncSessionLocal() as db:
        upcoming = (
            await db.execute(
                select(Campaign).where(
                    Campaign.type == "flash_sale",
                    Campaign.start_at.between(window_start, window_end),
                    Campaign.is_active == True,
                )
            )
        ).scalars().all()

    redis = await get_redis()
    queued = 0
    pool = ctx.get("redis")
    for campaign in upcoming:
        gate = f"flashsale_notified:{campaign.id}"
        if await redis.get(gate):
            continue
        if pool:
            await pool.enqueue_job("notify_flash_sale_wishlist", str(campaign.id))
        await redis.setex(gate, 7200, "1")
        queued += 1

    return {"queued": queued}


async def scan_abandoned_carts(ctx):
    """Cron — every 4h. Enqueues cart abandonment reminder for idle carts >24h."""
    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)

    async with AsyncSessionLocal() as db:
        rows = (
            await db.execute(
                select(CartItem.user_id, Product.title)
                .join(ProductVariant, ProductVariant.id == CartItem.variant_id)
                .join(Product, Product.id == ProductVariant.product_id)
                .where(CartItem.added_at <= cutoff, CartItem.user_id.is_not(None))
                .order_by(CartItem.user_id)
            )
        ).all()

    user_titles: dict[uuid.UUID, list] = {}
    for uid, title in rows:
        user_titles.setdefault(uid, []).append(title)

    pool = ctx.get("redis")
    queued = 0
    for uid, titles in user_titles.items():
        if pool:
            await pool.enqueue_job(
                "send_cart_abandonment_reminder",
                str(uid),
                list(dict.fromkeys(titles)),
            )
            queued += 1

    return {"carts_scanned": len(user_titles), "jobs_enqueued": queued}


# ── Phase 5: ML Recommendations (nightly batch) ────────────────────────────────

async def compute_ml_recommendations(ctx):
    """Nightly cron — item co-occurrence from view events → Redis ML rec cache."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=30)
    ML_RECS_TTL = 86400
    MIN_EVENTS = 50  # skip batch if data is too sparse to be meaningful

    async with AsyncSessionLocal() as db:
        rows = (
            await db.execute(
                select(UserEvent.session_id, UserEvent.product_id)
                .where(
                    UserEvent.event_type == "view",
                    UserEvent.product_id.is_not(None),
                    UserEvent.created_at >= cutoff,
                )
                .order_by(UserEvent.session_id)
            )
        ).all()

    if len(rows) < MIN_EVENTS:
        return {"skipped": True, "reason": "insufficient_data", "events": len(rows)}

    # Group product views by session
    session_products: dict[str, list] = {}
    for session_id, product_id in rows:
        session_products.setdefault(session_id, []).append(product_id)

    # Count co-occurrences: {product_id: {co_product_id: count}}
    co_count: dict = {}
    view_count: dict = {}
    for prods in session_products.values():
        unique_prods = list(dict.fromkeys(prods))  # deduplicate within session
        for pid in unique_prods:
            view_count[pid] = view_count.get(pid, 0) + 1
        for i, a in enumerate(unique_prods):
            for b in unique_prods[i + 1:]:
                co_count.setdefault(a, {})[b] = co_count.get(a, {}).get(b, 0) + 1
                co_count.setdefault(b, {})[a] = co_count.get(b, {}).get(a, 0) + 1

    # Normalize co-occurrence by geometric mean of view counts (Jaccard-like)
    redis = await get_redis()
    written = 0
    for product_id, co_items in co_count.items():
        scored = []
        for co_pid, count in co_items.items():
            norm = (view_count.get(product_id, 1) * view_count.get(co_pid, 1)) ** 0.5
            scored.append((str(co_pid), round(count / norm, 6)))

        # Keep top 8 by normalized score
        scored.sort(key=lambda x: x[1], reverse=True)
        top = [{"id": pid, "score": sc} for pid, sc in scored[:8]]
        import json as _json
        await redis.setex(f"ml_recs:{product_id}", ML_RECS_TTL, _json.dumps(top))
        written += 1

    return {"events": len(rows), "products_scored": written}
