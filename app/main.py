import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.auth import router as auth_router
from .api.notifications import router as notifications_router
from .api.share import router as share_router
from .api.vault import router as vault_router
from .bootstrap import initialize_database

initialize_database()

app = FastAPI(title="DataGuard MVP")

cors_origins_env = os.getenv("CORS_ORIGINS")
if cors_origins_env:
    cors_origins = [origin.strip() for origin in cors_origins_env.split(",") if origin.strip()]
else:
    cors_origins = ["http://localhost:5173", "http://127.0.0.1:5173"]

if "*" in cors_origins and os.getenv("APP_ENV", "development").lower() != "development":
    raise RuntimeError("CORS_ORIGINS cannot include '*' outside development")

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(vault_router)
app.include_router(share_router)
app.include_router(notifications_router)
app.include_router(auth_router)
