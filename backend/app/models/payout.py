import uuid
from sqlalchemy import String, ForeignKey, Numeric, Date, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from datetime import datetime, date
from app.core.database import Base


class PayoutRecord(Base):
    __tablename__ = "payout_records"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    seller_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    period_end: Mapped[date] = mapped_column(Date, nullable=False)
    gross_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    commission_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    processing_fees: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    penalties: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    net_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    bank_ref: Mapped[str | None] = mapped_column(String(255))
    paid_at: Mapped[datetime | None] = mapped_column()
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    line_items: Mapped[list["PayoutLineItem"]] = relationship(back_populates="payout", cascade="all, delete-orphan")


class PayoutLineItem(Base):
    __tablename__ = "payout_line_items"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    payout_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("payout_records.id", ondelete="CASCADE"))
    order_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("orders.id"))
    order_total: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    commission_rate: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    commission_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    processing_fee: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    seller_payout: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)

    payout: Mapped["PayoutRecord"] = relationship(back_populates="line_items")


class SellerPayoutSchedule(Base):
    __tablename__ = "seller_payout_schedules"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    seller_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    frequency: Mapped[str] = mapped_column(String(20), default="weekly")  # "weekly" | "biweekly"
    bank_name: Mapped[str | None] = mapped_column(String(100))
    account_number: Mapped[str | None] = mapped_column(String(50))
    account_title: Mapped[str | None] = mapped_column(String(100))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())
