from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import get_settings
from app.routers import addresses as addresses_router
from app.routers import admin as admin_router
from app.routers import auth as auth_router
from app.routers import cart as cart_router
from app.routers import catalog as catalog_router
from app.routers import categories as categories_router
from app.routers import checkout as checkout_router
from app.routers import orders as orders_router
from app.routers import products as products_router
from app.routers import reviews as reviews_router
from app.routers import search as search_router
from app.routers import users as users_router
from app.routers import payouts as payouts_router
from app.routers import payout_schedule as payout_schedule_router
from app.routers import rfq as rfq_router
from app.routers import payments as payments_router
from app.routers import wishlist as wishlist_router
from app.routers import inventory as inventory_router
from app.routers import seller_analytics as seller_analytics_router
from app.routers import translate as translate_router
from app.routers import campaign as campaign_router
from app.routers import slots as slots_router
from app.routers import events as events_router
from app.routers import recommendations as recommendations_router

settings = get_settings()

app = FastAPI(
    title="ShopUnity API",
    version="1.0.0",
    docs_url="/docs" if settings.app_env != "production" else None,
    redoc_url="/redoc" if settings.app_env != "production" else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(auth_router.router, prefix="/v1")
app.include_router(users_router.router, prefix="/v1")
app.include_router(categories_router.router, prefix="/v1")
app.include_router(products_router.router, prefix="/v1")
app.include_router(catalog_router.router, prefix="/v1")
app.include_router(admin_router.router, prefix="/v1")
app.include_router(cart_router.router, prefix="/v1")
app.include_router(checkout_router.router, prefix="/v1")
app.include_router(orders_router.router, prefix="/v1")
app.include_router(addresses_router.router, prefix="/v1")
app.include_router(reviews_router.router, prefix="/v1")
app.include_router(search_router.router, prefix="/v1")
app.include_router(payouts_router.router, prefix="/v1")
app.include_router(payout_schedule_router.router, prefix="/v1")
app.include_router(rfq_router.router, prefix="/v1")
app.include_router(payments_router.router, prefix="/v1")
app.include_router(wishlist_router.router, prefix="/v1")
app.include_router(inventory_router.router, prefix="/v1")
app.include_router(seller_analytics_router.router, prefix="/v1")
app.include_router(translate_router.router)
app.include_router(campaign_router.router)
app.include_router(slots_router.router)
app.include_router(events_router.router)
app.include_router(recommendations_router.router)


@app.get("/health", tags=["system"])
async def health():
    return {"status": "ok", "env": settings.app_env}
