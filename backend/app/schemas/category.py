from __future__ import annotations

from typing import List, Optional
import uuid

from pydantic import BaseModel


class CategoryNode(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    icon_url: Optional[str] = None
    children: List[CategoryNode] = []

    model_config = {"from_attributes": True}


CategoryNode.model_rebuild()


class CategoryDetail(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    icon_url: Optional[str] = None
    banner_url: Optional[str] = None
    description: Optional[str] = None
    commission_rate: float
    children: List[CategoryNode] = []

    model_config = {"from_attributes": True}


class CategoryCreate(BaseModel):
    name: str
    slug: Optional[str] = None
    parent_id: Optional[uuid.UUID] = None
    commission_rate: float = 7.0
    icon_url: Optional[str] = None


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    parent_id: Optional[uuid.UUID] = None
    commission_rate: Optional[float] = None
    icon_url: Optional[str] = None
    is_active: Optional[bool] = None
