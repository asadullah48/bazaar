from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel

GatewayName = Literal["jazzcash", "easypaisa", "nayapay", "meezan", "alfalah", "checkout"]


class CustomerInfoIn(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None


class InitiatePaymentRequest(BaseModel):
    checkout_session_id: str
    gateway: GatewayName
    currency: str = "PKR"
    customer_info: Optional[CustomerInfoIn] = None


class InitiatePaymentResponse(BaseModel):
    success: bool
    transaction_id: Optional[str] = None
    redirect_url: Optional[str] = None
    payment_data: Optional[dict[str, Any]] = None
    error: Optional[str] = None


class TransactionStatusResponse(BaseModel):
    status: Literal["pending", "success", "failed", "refunded"]
    amount: float
    currency: str
    gateway_transaction_id: str
    error_message: Optional[str] = None


class RefundRequest(BaseModel):
    transaction_id: str
    gateway: GatewayName
    amount: Optional[float] = None


class RefundResponse(BaseModel):
    success: bool
    refund_id: Optional[str] = None
    amount: Optional[float] = None
    message: Optional[str] = None


class GatewayConfigResponse(BaseModel):
    name: str
    is_active: bool
    supported_currencies: list[str]
    min_amount: float
    max_amount: float
    environment: str
