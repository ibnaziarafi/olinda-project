"""Dashboard application composition."""
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from data.database import init_db
from api.auth_routes import router as auth_router
from api.analytics_routes import router as analytics_router
from api.knowledge_routes import router as knowledge_router

@asynccontextmanager
async def lifespan(app):
    init_db()
    yield

app = FastAPI(
    lifespan=lifespan,
    title="Olinda Dashboard Management System Service",
    description="Decoupled microservice for Hobart College staff management portal and knowledge ingestion",
    version="1.0.0"
)

frontend_origins = [
    origin.strip()
    for origin in os.getenv(
        "FRONTEND_ORIGINS",
        "https://olinda.rafistacks.dev,https://portal-olinda.rafistacks.dev,https://olinda-ai.vercel.app,http://localhost:3000,http://localhost:5173,http://localhost:5500,http://127.0.0.1:5500",
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=frontend_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


app.include_router(auth_router)
app.include_router(analytics_router)
app.include_router(knowledge_router)
if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("DASHBOARD_PORT", os.getenv("PORT", 8001)))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
