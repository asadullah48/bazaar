from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class WishlistItem(BaseModel):
    product_id: uuid.UUID
    title: str
    slug: Optional[str] = None
    min_price: Optional[float] = None
    added_at: datetime
    is_available: bool
