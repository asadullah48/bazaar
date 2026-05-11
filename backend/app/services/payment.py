"""
Multi-gateway payment service — Python port of payment-gateway-mcp.
Supports JazzCash, EasyPaisa, Naya Pay, Meezan Bank, Bank Alfalah, Checkout.com.
"""
from __future__ import annotations

import base64
import hashlib
import hmac as _hmac
import random
import string
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Literal, Optional

import httpx

from app.core.config import get_settings

# ── Signature helpers ─────────────────────────────────────────────────────────

def _hmac_sha256(data: dict, salt: str, exclude: list[str] | None = None) -> str:
    """JazzCash / Meezan / Alfalah: salt prepended, sorted fields, HMAC-SHA256 hex."""
    exc = set(exclude or ["signature"])
    parts = [salt] + [
        str(data[k])
        for k in sorted(k for k in data if k not in exc and data[k] not in ("", None))
    ]
    msg = "&".join(parts)
    return _hmac.new(salt.encode(), msg.encode(), hashlib.sha256).hexdigest()


def _hmac_sha1_b64(data: dict, key: str) -> str:
    """EasyPaisa: sorted field values joined with &, HMAC-SHA1 base64."""
    msg = "&".join(
        str(data[k]) for k in sorted(k for k in data if data[k] not in ("", None))
    )
    return base64.b64encode(
        _hmac.new(key.encode(), msg.encode(), hashlib.sha1).digest()
    ).decode()


def _txn_id(prefix: str = "TXN") -> str:
    suffix = "".join(random.choices(string.ascii_uppercase + string.digits, k=6))
    return f"{prefix}_{int(time.time() * 1000)}_{suffix}"


# ── Shared types ──────────────────────────────────────────────────────────────

GatewayName = Literal["jazzcash", "easypaisa", "nayapay", "meezan", "alfalah", "checkout"]


@dataclass
class CustomerInfo:
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None


@dataclass
class PaymentRequest:
    gateway: str
    amount: float
    order_id: str
    currency: str = "PKR"
    customer_info: CustomerInfo = field(default_factory=CustomerInfo)
    return_url: Optional[str] = None


@dataclass
class PaymentResult:
    success: bool
    transaction_id: Optional[str] = None
    redirect_url: Optional[str] = None
    payment_data: Optional[dict] = None
    error: Optional[str] = None


@dataclass
class TransactionStatus:
    status: Literal["pending", "success", "failed", "refunded"]
    amount: float
    currency: str
    gateway_transaction_id: str
    error_message: Optional[str] = None


@dataclass
class RefundResult:
    success: bool
    refund_id: Optional[str] = None
    amount: Optional[float] = None
    message: Optional[str] = None


@dataclass
class GatewayConfig:
    name: str
    is_active: bool
    supported_currencies: list[str]
    min_amount: float
    max_amount: float
    environment: Literal["sandbox", "production"]


# ── Abstract base ─────────────────────────────────────────────────────────────

class BaseGateway(ABC):
    @property
    @abstractmethod
    def name(self) -> str: ...

    @abstractmethod
    def get_config(self) -> GatewayConfig: ...

    @abstractmethod
    async def create_payment(self, request: PaymentRequest) -> PaymentResult: ...

    @abstractmethod
    async def inquire_transaction(self, transaction_id: str) -> TransactionStatus: ...

    @abstractmethod
    async def refund_transaction(
        self, transaction_id: str, amount: float | None = None
    ) -> RefundResult: ...

    def _validate_amount(self, amount: float) -> bool:
        cfg = self.get_config()
        return cfg.min_amount <= amount <= cfg.max_amount


# ── JazzCash ──────────────────────────────────────────────────────────────────

class JazzCashGateway(BaseGateway):
    name = "jazzcash"
    _ep = {
        "sandbox": {
            "checkout": "https://sandbox.jazzcash.com.pk/ApplicationAPI/API/Payment/HostedCheckout",
            "inquiry": "https://sandbox.jazzcash.com.pk/ApplicationAPI/API/Payment/StatusInquiry",
            "refund": "https://sandbox.jazzcash.com.pk/ApplicationAPI/API/Payment/DoRefundTransaction",
        },
        "production": {
            "checkout": "https://payments.jazzcash.com.pk/ApplicationAPI/API/Payment/HostedCheckout",
            "inquiry": "https://payments.jazzcash.com.pk/ApplicationAPI/API/Payment/StatusInquiry",
            "refund": "https://payments.jazzcash.com.pk/ApplicationAPI/API/Payment/DoRefundTransaction",
        },
    }

    def get_config(self) -> GatewayConfig:
        s = get_settings()
        return GatewayConfig(
            name="jazzcash",
            is_active=bool(s.jazzcash_merchant_id and s.jazzcash_password),
            supported_currencies=["PKR"],
            min_amount=10, max_amount=500_000,
            environment=s.jazzcash_env,  # type: ignore[arg-type]
        )

    async def create_payment(self, req: PaymentRequest) -> PaymentResult:
        s = get_settings()
        txn = _txn_id("JC")
        env = s.jazzcash_env
        endpoint = self._ep[env]["checkout"]
        return_url = req.return_url or s.jazzcash_return_url or f"{s.frontend_url}/payment/callback/jazzcash"
        payload: dict[str, Any] = {
            "pp_Version": "1.1", "pp_TxnType": "HOSTED",
            "pp_MerchantID": s.jazzcash_merchant_id,
            "pp_Password": s.jazzcash_password,
            "pp_TxnRefNo": txn,
            "pp_Amount": round(req.amount * 100),
            "pp_TxnCurrency": req.currency or "PKR",
            "pp_TxnDateTime": time.strftime("%Y%m%d%H%M%S"),
            "pp_BillReference": req.order_id,
            "pp_Description": f"Payment for order {req.order_id}",
            "pp_ReturnURL": return_url,
            "pp_Language": "EN",
        }
        payload["pp_SecureHash"] = _hmac_sha256(payload, s.jazzcash_integrity_salt)
        return PaymentResult(
            success=True, transaction_id=txn, redirect_url=endpoint,
            payment_data={"method": "POST", "action": endpoint, "fields": payload},
        )

    async def inquire_transaction(self, transaction_id: str) -> TransactionStatus:
        s = get_settings()
        env = s.jazzcash_env
        payload: dict[str, Any] = {
            "pp_MerchantID": s.jazzcash_merchant_id,
            "pp_Password": s.jazzcash_password,
            "pp_TxnRefNo": transaction_id,
        }
        payload["pp_SecureHash"] = _hmac_sha256(payload, s.jazzcash_integrity_salt)
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(self._ep[env]["inquiry"], json=payload)
            data = r.json()
        ok = data.get("pp_ResponseCode") == "000"
        return TransactionStatus(
            status="success" if ok else "failed",
            amount=int(data.get("pp_Amount", 0)) / 100,
            currency="PKR",
            gateway_transaction_id=data.get("pp_TxnRefNo", transaction_id),
            error_message=None if ok else data.get("pp_ResponseMessage"),
        )

    async def refund_transaction(self, transaction_id: str, amount: float | None = None) -> RefundResult:
        s = get_settings()
        env = s.jazzcash_env
        payload: dict[str, Any] = {
            "pp_MerchantID": s.jazzcash_merchant_id,
            "pp_Password": s.jazzcash_password,
            "pp_TxnRefNo": transaction_id,
        }
        if amount is not None:
            payload["pp_Amount"] = round(amount * 100)
        payload["pp_SecureHash"] = _hmac_sha256(payload, s.jazzcash_integrity_salt)
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(self._ep[env]["refund"], json=payload)
            data = r.json()
        ok = data.get("pp_ResponseCode") == "000"
        return RefundResult(
            success=ok, refund_id=data.get("pp_RefundTransactionId"),
            amount=amount, message=data.get("pp_ResponseMessage"),
        )


# ── EasyPaisa ─────────────────────────────────────────────────────────────────

class EasypaisaGateway(BaseGateway):
    name = "easypaisa"
    _ep = {
        "sandbox": "https://easypaystg.easypaisa.com.pk/tpg/",
        "production": "https://easypay.easypaisa.com.pk/tpg/",
    }

    def get_config(self) -> GatewayConfig:
        s = get_settings()
        return GatewayConfig(
            name="easypaisa",
            is_active=bool(s.easypaisa_store_id and s.easypaisa_hash_key),
            supported_currencies=["PKR"],
            min_amount=1, max_amount=200_000,
            environment=s.easypaisa_env,  # type: ignore[arg-type]
        )

    async def create_payment(self, req: PaymentRequest) -> PaymentResult:
        s = get_settings()
        txn = _txn_id("EP")
        env = s.easypaisa_env
        endpoint = self._ep[env]
        return_url = req.return_url or s.easypaisa_return_url or f"{s.frontend_url}/payment/callback/easypaisa"
        amount_str = f"{req.amount:.2f}"
        pay_method = "MA_PAYMENT" if (req.customer_info and req.customer_info.phone) else "OTC_PAYMENT"
        hash_data = {"storeId": s.easypaisa_store_id, "amount": amount_str, "orderRefNum": req.order_id}
        token = _hmac_sha1_b64(hash_data, s.easypaisa_hash_key)
        expiry = time.strftime("%Y%m%d235959", time.gmtime(time.time() + 86400))
        payload: dict[str, str] = {
            "storeId": s.easypaisa_store_id, "amount": amount_str,
            "postBackURL": return_url, "orderRefNum": req.order_id,
            "expiryDate": expiry, "paymentMethod": pay_method, "token": token,
        }
        if req.customer_info and req.customer_info.phone:
            payload["mobileNum"] = req.customer_info.phone
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(endpoint, data=payload)
            data = r.json()
        ok = data.get("responseCode") == "0000"
        return PaymentResult(
            success=ok,
            transaction_id=txn if ok else None,
            redirect_url=data.get("paymentUrl") if ok else None,
            payment_data={"method": pay_method, "transaction_id": txn, "response": data},
            error=None if ok else data.get("responseDesc", "EasyPaisa payment failed"),
        )

    async def inquire_transaction(self, transaction_id: str) -> TransactionStatus:
        s = get_settings()
        env = s.easypaisa_env
        hash_data = {"storeId": s.easypaisa_store_id, "transactionRefNum": transaction_id}
        token = _hmac_sha1_b64(hash_data, s.easypaisa_hash_key)
        payload = {"storeId": s.easypaisa_store_id, "transactionRefNum": transaction_id, "token": token}
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(self._ep[env], data=payload)
            data = r.json()
        ok = data.get("responseCode") == "0000"
        return TransactionStatus(
            status="success" if ok else ("pending" if data.get("responseCode") == "PENDING" else "failed"),
            amount=float(data.get("transactionAmount", 0)),
            currency="PKR",
            gateway_transaction_id=data.get("transactionId", transaction_id),
            error_message=None if ok else data.get("responseDesc"),
        )

    async def refund_transaction(self, transaction_id: str, amount: float | None = None) -> RefundResult:
        return RefundResult(
            success=False,
            message="EasyPaisa refunds must be processed via merchant portal: https://easypay.easypaisa.com.pk",
        )


# ── Naya Pay ──────────────────────────────────────────────────────────────────

class NayaPayGateway(BaseGateway):
    name = "nayapay"
    _ep = {
        "sandbox": {
            "auth": "https://sandbox.nayapay.com/api/v1/oauth/token",
            "payment": "https://sandbox.nayapay.com/api/v1/payment/create",
            "inquiry": "https://sandbox.nayapay.com/api/v1/payment/status",
            "refund": "https://sandbox.nayapay.com/api/v1/payment/refund",
        },
        "production": {
            "auth": "https://api.nayapay.com/api/v1/oauth/token",
            "payment": "https://api.nayapay.com/api/v1/payment/create",
            "inquiry": "https://api.nayapay.com/api/v1/payment/status",
            "refund": "https://api.nayapay.com/api/v1/payment/refund",
        },
    }

    def get_config(self) -> GatewayConfig:
        s = get_settings()
        return GatewayConfig(
            name="nayapay",
            is_active=bool(s.nayapay_client_id and s.nayapay_client_secret),
            supported_currencies=["PKR"],
            min_amount=1, max_amount=250_000,
            environment=s.nayapay_env,  # type: ignore[arg-type]
        )

    async def _get_token(self, client: httpx.AsyncClient) -> str:
        s = get_settings()
        r = await client.post(
            self._ep[s.nayapay_env]["auth"],
            json={"grant_type": "client_credentials", "client_id": s.nayapay_client_id, "client_secret": s.nayapay_client_secret},
        )
        return r.json()["access_token"]

    async def create_payment(self, req: PaymentRequest) -> PaymentResult:
        s = get_settings()
        txn = _txn_id("NP")
        ep = self._ep[s.nayapay_env]
        async with httpx.AsyncClient(timeout=15) as client:
            token = await self._get_token(client)
            r = await client.post(ep["payment"], headers={"Authorization": f"Bearer {token}"}, json={
                "merchantTransactionId": txn, "amount": req.amount,
                "currency": req.currency or "PKR", "orderId": req.order_id,
                "returnUrl": req.return_url or s.nayapay_return_url or f"{s.frontend_url}/payment/callback/nayapay",
                "customerEmail": req.customer_info.email if req.customer_info else None,
                "customerPhone": req.customer_info.phone if req.customer_info else None,
                "customerName": req.customer_info.name if req.customer_info else None,
                "description": f"Payment for order {req.order_id}",
            })
            data = r.json()
        ok = data.get("status") in ("CREATED", "success") or data.get("success") is True
        return PaymentResult(
            success=ok, transaction_id=txn if ok else None,
            redirect_url=data.get("paymentUrl") if ok else None,
            payment_data={"transaction_id": txn, "gateway_ref": data.get("paymentId")},
            error=None if ok else data.get("message", "Naya Pay payment failed"),
        )

    async def inquire_transaction(self, transaction_id: str) -> TransactionStatus:
        s = get_settings()
        ep = self._ep[s.nayapay_env]
        _smap = {"COMPLETED": "success", "PAID": "success", "PENDING": "pending", "FAILED": "failed", "REFUNDED": "refunded"}
        async with httpx.AsyncClient(timeout=15) as client:
            token = await self._get_token(client)
            r = await client.get(f"{ep['inquiry']}/{transaction_id}", headers={"Authorization": f"Bearer {token}"})
            data = r.json()
        return TransactionStatus(
            status=_smap.get(data.get("status", ""), "failed"),
            amount=data.get("amount", 0), currency=data.get("currency", "PKR"),
            gateway_transaction_id=data.get("paymentId", transaction_id),
        )

    async def refund_transaction(self, transaction_id: str, amount: float | None = None) -> RefundResult:
        s = get_settings()
        ep = self._ep[s.nayapay_env]
        payload: dict[str, Any] = {"transactionId": transaction_id}
        if amount is not None:
            payload["amount"] = amount
        async with httpx.AsyncClient(timeout=15) as client:
            token = await self._get_token(client)
            r = await client.post(ep["refund"], headers={"Authorization": f"Bearer {token}"}, json=payload)
            data = r.json()
        ok = data.get("success") is True or data.get("status") == "REFUNDED"
        return RefundResult(success=ok, refund_id=data.get("refundId"), amount=amount, message=data.get("message"))


# ── Meezan Bank ───────────────────────────────────────────────────────────────

class MeezanGateway(BaseGateway):
    name = "meezan"
    _ep = {
        "sandbox": {
            "checkout": "https://sandbox.meezanbank.com/ApplicationAPI/API/2.0/Purchase",
            "inquiry": "https://sandbox.meezanbank.com/ApplicationAPI/API/2.0/StatusInquiry",
            "refund": "https://sandbox.meezanbank.com/ApplicationAPI/API/2.0/Refund",
        },
        "production": {
            "checkout": "https://payments.meezanbank.com/ApplicationAPI/API/2.0/Purchase",
            "inquiry": "https://payments.meezanbank.com/ApplicationAPI/API/2.0/StatusInquiry",
            "refund": "https://payments.meezanbank.com/ApplicationAPI/API/2.0/Refund",
        },
    }

    def get_config(self) -> GatewayConfig:
        s = get_settings()
        return GatewayConfig(
            name="meezan",
            is_active=bool(s.meezan_merchant_id and s.meezan_password),
            supported_currencies=["PKR"],
            min_amount=10, max_amount=1_000_000,
            environment=s.meezan_env,  # type: ignore[arg-type]
        )

    async def create_payment(self, req: PaymentRequest) -> PaymentResult:
        s = get_settings()
        txn = _txn_id("MZ")
        env = s.meezan_env
        endpoint = self._ep[env]["checkout"]
        return_url = req.return_url or s.meezan_return_url or f"{s.frontend_url}/payment/callback/meezan"
        payload: dict[str, Any] = {
            "pp_Version": "2.0", "pp_TxnType": "HOSTED",
            "pp_MerchantID": s.meezan_merchant_id,
            "pp_Password": s.meezan_password,
            "pp_TxnRefNo": txn,
            "pp_Amount": round(req.amount * 100),
            "pp_TxnCurrency": req.currency or "PKR",
            "pp_TxnDateTime": time.strftime("%Y%m%d%H%M%S"),
            "pp_BillReference": req.order_id,
            "pp_Description": f"Order {req.order_id}",
            "pp_ReturnURL": return_url,
            "pp_Language": "EN",
        }
        payload["pp_SecureHash"] = _hmac_sha256(payload, s.meezan_integrity_salt)
        return PaymentResult(
            success=True, transaction_id=txn, redirect_url=endpoint,
            payment_data={"method": "POST", "action": endpoint, "fields": payload},
        )

    async def inquire_transaction(self, transaction_id: str) -> TransactionStatus:
        s = get_settings()
        env = s.meezan_env
        payload: dict[str, Any] = {
            "pp_MerchantID": s.meezan_merchant_id,
            "pp_Password": s.meezan_password,
            "pp_TxnRefNo": transaction_id,
        }
        payload["pp_SecureHash"] = _hmac_sha256(payload, s.meezan_integrity_salt)
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(self._ep[env]["inquiry"], json=payload)
            data = r.json()
        ok = data.get("pp_ResponseCode") == "000"
        return TransactionStatus(
            status="success" if ok else "failed",
            amount=int(data.get("pp_Amount", 0)) / 100, currency="PKR",
            gateway_transaction_id=data.get("pp_TxnRefNo", transaction_id),
            error_message=None if ok else data.get("pp_ResponseMessage"),
        )

    async def refund_transaction(self, transaction_id: str, amount: float | None = None) -> RefundResult:
        s = get_settings()
        env = s.meezan_env
        payload: dict[str, Any] = {
            "pp_MerchantID": s.meezan_merchant_id,
            "pp_Password": s.meezan_password,
            "pp_TxnRefNo": transaction_id,
        }
        if amount is not None:
            payload["pp_Amount"] = round(amount * 100)
        payload["pp_SecureHash"] = _hmac_sha256(payload, s.meezan_integrity_salt)
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(self._ep[env]["refund"], json=payload)
            data = r.json()
        ok = data.get("pp_ResponseCode") == "000"
        return RefundResult(
            success=ok, refund_id=data.get("pp_RefundTransactionId"),
            amount=amount, message=data.get("pp_ResponseMessage"),
        )


# ── Bank Alfalah ──────────────────────────────────────────────────────────────

class AlfalahGateway(BaseGateway):
    name = "alfalah"
    _ep = {
        "sandbox": {
            "checkout": "https://sandbox.bankalfalah.com/HS/HS/Hash",
            "inquiry": "https://sandbox.bankalfalah.com/HS/HS/TransactionStatusInquiry",
            "refund": "https://sandbox.bankalfalah.com/HS/HS/Refund",
        },
        "production": {
            "checkout": "https://payments.bankalfalah.com/HS/HS/Hash",
            "inquiry": "https://payments.bankalfalah.com/HS/HS/TransactionStatusInquiry",
            "refund": "https://payments.bankalfalah.com/HS/HS/Refund",
        },
    }

    def get_config(self) -> GatewayConfig:
        s = get_settings()
        return GatewayConfig(
            name="alfalah",
            is_active=bool(s.alfalah_merchant_id and s.alfalah_merchant_key),
            supported_currencies=["PKR", "USD"],
            min_amount=10, max_amount=2_000_000,
            environment=s.alfalah_env,  # type: ignore[arg-type]
        )

    async def create_payment(self, req: PaymentRequest) -> PaymentResult:
        s = get_settings()
        txn = _txn_id("AF")
        env = s.alfalah_env
        endpoint = self._ep[env]["checkout"]
        currency = req.currency or "PKR"
        return_url = req.return_url or s.alfalah_return_url or f"{s.frontend_url}/payment/callback/alfalah"
        hash_fields = {
            "merchantId": s.alfalah_merchant_id, "channelId": s.alfalah_channel_id,
            "returnUrl": return_url, "orderId": req.order_id,
            "amount": f"{req.amount:.2f}", "currency": currency,
        }
        payload: dict[str, Any] = {
            "HS_MerchantId": s.alfalah_merchant_id,
            "HS_ChannelId": s.alfalah_channel_id,
            "HS_ReturnURL": return_url,
            "HS_MerchantUsername": s.alfalah_merchant_id,
            "HS_MerchantPassword": s.alfalah_merchant_key,
            "HS_RequestHash": _hmac_sha256(hash_fields, s.alfalah_merchant_key),
            "HS_TransactionReferenceNo": txn,
            "HS_StoreId": s.alfalah_merchant_id,
            "HS_OrderId": req.order_id,
            "HS_TransactionAmount": f"{req.amount:.2f}",
            "HS_Currency": currency,
            "HS_IsRedirectionRequest": "0",
        }
        return PaymentResult(
            success=True, transaction_id=txn, redirect_url=endpoint,
            payment_data={"method": "POST", "action": endpoint, "fields": payload},
        )

    async def inquire_transaction(self, transaction_id: str) -> TransactionStatus:
        s = get_settings()
        env = s.alfalah_env
        payload: dict[str, Any] = {
            "HS_MerchantId": s.alfalah_merchant_id,
            "HS_ChannelId": s.alfalah_channel_id,
            "HS_TransactionReferenceNo": transaction_id,
        }
        payload["HS_RequestHash"] = _hmac_sha256(payload, s.alfalah_merchant_key)
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(self._ep[env]["inquiry"], json=payload)
            data = r.json()
        ok = data.get("HS_ResponseCode") == "00" or data.get("HS_TransactionStatus") == "Paid"
        return TransactionStatus(
            status="success" if ok else ("pending" if data.get("HS_TransactionStatus") == "Pending" else "failed"),
            amount=float(data.get("HS_TransactionAmount", 0)), currency=data.get("HS_Currency", "PKR"),
            gateway_transaction_id=data.get("HS_AuthorizationCode", transaction_id),
            error_message=None if ok else data.get("HS_ResponseMessage"),
        )

    async def refund_transaction(self, transaction_id: str, amount: float | None = None) -> RefundResult:
        s = get_settings()
        env = s.alfalah_env
        payload: dict[str, Any] = {
            "HS_MerchantId": s.alfalah_merchant_id,
            "HS_ChannelId": s.alfalah_channel_id,
            "HS_TransactionReferenceNo": transaction_id,
        }
        if amount is not None:
            payload["HS_TransactionAmount"] = f"{amount:.2f}"
        payload["HS_RequestHash"] = _hmac_sha256(payload, s.alfalah_merchant_key)
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(self._ep[env]["refund"], json=payload)
            data = r.json()
        ok = data.get("HS_ResponseCode") == "00"
        return RefundResult(
            success=ok, refund_id=data.get("HS_RefundTransactionId"),
            amount=amount, message=data.get("HS_ResponseMessage"),
        )


# ── Checkout.com ──────────────────────────────────────────────────────────────

class CheckoutGateway(BaseGateway):
    name = "checkout"
    _ep = {
        "sandbox": {"payments": "https://api.sandbox.checkout.com/payments"},
        "production": {"payments": "https://api.checkout.com/payments"},
    }
    _smap = {
        "Authorized": "success", "Captured": "success", "Paid": "success",
        "Pending": "pending", "Declined": "failed", "Expired": "failed",
        "Canceled": "failed", "Refunded": "refunded", "Partially Refunded": "refunded",
    }

    def get_config(self) -> GatewayConfig:
        s = get_settings()
        return GatewayConfig(
            name="checkout", is_active=bool(s.checkout_secret_key),
            supported_currencies=["PKR", "USD", "EUR", "GBP", "AED"],
            min_amount=0.5, max_amount=999_999,
            environment=s.checkout_env,  # type: ignore[arg-type]
        )

    async def create_payment(self, req: PaymentRequest) -> PaymentResult:
        s = get_settings()
        txn = _txn_id("CKO")
        endpoint = self._ep[s.checkout_env]["payments"]
        currency = req.currency or "USD"
        payload = {
            "amount": round(req.amount * 100), "currency": currency,
            "reference": req.order_id, "description": f"Order {req.order_id}",
            "customer": {
                "email": req.customer_info.email if req.customer_info else None,
                "name": req.customer_info.name if req.customer_info else None,
            },
            "3ds": {"enabled": True},
            "success_url": req.return_url or s.checkout_success_url or f"{s.frontend_url}/payment/success",
            "failure_url": s.checkout_failure_url or f"{s.frontend_url}/payment/failure",
            "metadata": {"merchant_transaction_id": txn},
        }
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(
                endpoint,
                headers={"Authorization": f"Bearer {s.checkout_secret_key}"},
                json=payload,
            )
            data = r.json()
        ok = data.get("status") in ("Pending", "Authorized")
        redirect_url = (data.get("_links") or {}).get("redirect", {}).get("href")
        return PaymentResult(
            success=ok, transaction_id=txn if ok else None, redirect_url=redirect_url,
            payment_data={"gateway_payment_id": data.get("id"), "status": data.get("status"), "redirect_url": redirect_url},
            error=None if ok else ", ".join(data.get("error_codes", ["Checkout.com payment failed"])),
        )

    async def inquire_transaction(self, transaction_id: str) -> TransactionStatus:
        s = get_settings()
        endpoint = self._ep[s.checkout_env]["payments"]
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(
                f"{endpoint}/{transaction_id}",
                headers={"Authorization": f"Bearer {s.checkout_secret_key}"},
            )
            data = r.json()
        return TransactionStatus(
            status=self._smap.get(data.get("status", ""), "failed"),
            amount=int(data.get("amount", 0)) / 100, currency=data.get("currency", "USD"),
            gateway_transaction_id=data.get("id", transaction_id),
        )

    async def refund_transaction(self, transaction_id: str, amount: float | None = None) -> RefundResult:
        s = get_settings()
        endpoint = self._ep[s.checkout_env]["payments"]
        payload: dict[str, Any] = {}
        if amount is not None:
            payload["amount"] = round(amount * 100)
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(
                f"{endpoint}/{transaction_id}/refunds",
                headers={"Authorization": f"Bearer {s.checkout_secret_key}"},
                json=payload,
            )
        ok = r.status_code == 202
        data = r.json() if r.content else {}
        return RefundResult(success=ok, refund_id=data.get("action_id"), amount=amount,
                            message="Refund initiated" if ok else "Refund failed")


# ── Registry ──────────────────────────────────────────────────────────────────

_REGISTRY: dict[str, BaseGateway] = {
    g.name: g for g in [
        JazzCashGateway(), EasypaisaGateway(), NayaPayGateway(),
        MeezanGateway(), AlfalahGateway(), CheckoutGateway(),
    ]
}


def get_gateway(name: str) -> BaseGateway:
    gw = _REGISTRY.get(name)
    if not gw:
        raise ValueError(f"Unknown gateway '{name}'. Valid: {list(_REGISTRY)}")
    return gw


def list_active_gateways() -> list[GatewayConfig]:
    return [g.get_config() for g in _REGISTRY.values() if g.get_config().is_active]
