"""
Payment router — initiate, callback, status, refund.

Checkout flow:
  1. POST /v1/checkout            → creates orders in pending_payment status
  2. POST /v1/payments/initiate   → calls gateway, returns redirect_url
  3. Browser → gateway payment page → gateway POSTs back to callback URL
  4. POST /v1/payments/callback/{gateway} → verifies result, updates order status
"""
import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_db
from app.core.deps import get_current_active_user, require_seller
from app.models.order import CheckoutSession, Order, OrderStatusHistory
from app.models.user import User
from app.schemas.payment import (
    GatewayConfigResponse,
    InitiatePaymentRequest,
    InitiatePaymentResponse,
    RefundRequest,
    RefundResponse,
    TransactionStatusResponse,
)
from app.services.payment import (
    CustomerInfo,
    PaymentRequest,
    get_gateway,
    list_active_gateways,
)

router = APIRouter(prefix="/payments", tags=["payments"])


# ── Available gateways ────────────────────────────────────────────────────────

@router.get("/gateways", response_model=list[GatewayConfigResponse])
async def available_gateways():
    """Returns all payment gateways that have credentials configured."""
    return [
        GatewayConfigResponse(
            name=g.name, is_active=g.is_active,
            supported_currencies=g.supported_currencies,
            min_amount=g.min_amount, max_amount=g.max_amount,
            environment=g.environment,
        )
        for g in list_active_gateways()
    ]


# ── Initiate payment ──────────────────────────────────────────────────────────

@router.post("/initiate", response_model=InitiatePaymentResponse)
async def initiate_payment(
    payload: InitiatePaymentRequest,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Creates a payment session with the chosen gateway.
    Returns redirect_url — the frontend redirects the buyer there.
    For form-based gateways (JazzCash, Meezan, Alfalah) also returns payment_data
    with POST fields the frontend must submit.
    """
    # 1. Validate checkout session belongs to this buyer
    session = await db.get(CheckoutSession, uuid.UUID(payload.checkout_session_id))
    if not session or session.buyer_id != user.id:
        raise HTTPException(status_code=404, detail="Checkout session not found")

    # 2. Confirm there are pending orders
    orders = (
        await db.execute(
            select(Order).where(
                Order.checkout_session_id == session.id,
                Order.payment_status == "pending",
            )
        )
    ).scalars().all()
    if not orders:
        raise HTTPException(status_code=400, detail="No pending orders found for this session")

    # 3. Build gateway request
    try:
        gw = get_gateway(payload.gateway)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    ci = payload.customer_info
    req = PaymentRequest(
        gateway=payload.gateway,
        amount=float(session.total_amount),
        order_id=str(session.id),
        currency=payload.currency,
        customer_info=CustomerInfo(
            name=ci.name if ci else None,
            email=ci.email if ci else None,
            phone=ci.phone if ci else None,
        ),
    )
    result = await gw.create_payment(req)

    if not result.success:
        raise HTTPException(status_code=502, detail=result.error or "Payment gateway error")

    # 4. Persist transaction_id so the callback can find these orders
    await db.execute(
        update(Order)
        .where(Order.checkout_session_id == session.id)
        .values(payment_ref=result.transaction_id, payment_method=payload.gateway)
    )
    session.payment_ref = result.transaction_id
    await db.commit()

    return InitiatePaymentResponse(
        success=True,
        transaction_id=result.transaction_id,
        redirect_url=result.redirect_url,
        payment_data=result.payment_data,
    )


# ── Payment callback ──────────────────────────────────────────────────────────

@router.post("/callback/{gateway}")
@router.get("/callback/{gateway}")
async def payment_callback(
    gateway: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Receives the gateway redirect/postback after the buyer pays.
    Updates order status, then redirects buyer to the frontend success/failure page.
    """
    s = get_settings()
    frontend = s.frontend_url

    # Parse callback payload (POST form or GET query string)
    if request.method == "POST":
        form = await request.form()
        data: dict[str, Any] = dict(form)
    else:
        data = dict(request.query_params)

    success, transaction_id = _parse_callback(gateway, data)

    if not transaction_id:
        return RedirectResponse(url=f"{frontend}/payment/failure?reason=missing_txn")

    orders = (
        await db.execute(select(Order).where(Order.payment_ref == transaction_id))
    ).scalars().all()

    if not orders:
        return RedirectResponse(url=f"{frontend}/payment/failure?reason=order_not_found")

    new_payment_status = "paid" if success else "failed"
    new_order_status = "payment_confirmed" if success else "payment_failed"

    for order in orders:
        prev = order.status
        order.payment_status = new_payment_status
        order.status = new_order_status
        db.add(OrderStatusHistory(
            order_id=order.id,
            from_status=prev,
            to_status=new_order_status,
            changed_by=order.buyer_id,
        ))

    await db.commit()

    order_ids = ",".join(str(o.id) for o in orders)
    if success:
        return RedirectResponse(url=f"{frontend}/payment/success?orders={order_ids}")
    return RedirectResponse(url=f"{frontend}/payment/failure?orders={order_ids}")


def _parse_callback(gateway: str, data: dict[str, Any]) -> tuple[bool, str | None]:
    """Extract success flag and transaction_id from gateway-specific callback data."""
    if gateway == "jazzcash":
        return data.get("pp_ResponseCode") == "000", data.get("pp_TxnRefNo")
    if gateway == "easypaisa":
        return data.get("responseCode") == "0000", data.get("orderRefNum") or data.get("transactionRefNum")
    if gateway == "nayapay":
        return data.get("status") in ("COMPLETED", "PAID", "success"), data.get("merchantTransactionId")
    if gateway == "meezan":
        return data.get("pp_ResponseCode") == "000", data.get("pp_TxnRefNo")
    if gateway == "alfalah":
        ok = data.get("HS_ResponseCode") == "00" or data.get("HS_TransactionStatus") == "Paid"
        return ok, data.get("HS_TransactionReferenceNo")
    if gateway == "checkout":
        return data.get("status") in ("Authorized", "Captured", "Paid"), data.get("reference")
    return False, None


# ── Transaction status (poll) ─────────────────────────────────────────────────

@router.get("/status/{gateway}/{transaction_id}", response_model=TransactionStatusResponse)
async def transaction_status(
    gateway: str,
    transaction_id: str,
    _user: User = Depends(get_current_active_user),
):
    """Poll the gateway directly for real-time transaction status."""
    try:
        gw = get_gateway(gateway)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    s = await gw.inquire_transaction(transaction_id)
    return TransactionStatusResponse(
        status=s.status, amount=s.amount, currency=s.currency,
        gateway_transaction_id=s.gateway_transaction_id,
        error_message=s.error_message,
    )


# ── Refund ────────────────────────────────────────────────────────────────────

@router.post("/refund", response_model=RefundResponse)
async def refund_payment(
    payload: RefundRequest,
    _user: User = Depends(require_seller),
):
    """Initiate a full or partial refund. Seller/admin only."""
    try:
        gw = get_gateway(payload.gateway)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    result = await gw.refund_transaction(payload.transaction_id, payload.amount)
    return RefundResponse(
        success=result.success, refund_id=result.refund_id,
        amount=result.amount, message=result.message,
    )
