"""
Olinda Chatbot Service — Dedicated FastAPI Server for Student Q&A and Widget Delivery.
Default Port: 8000
"""

import os
import time

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from contextlib import asynccontextmanager
from data.database import init_db
from api.routes import router

@asynccontextmanager
async def lifespan(app):
    init_db()
    yield


app = FastAPI(
    lifespan=lifespan,
    title="Olinda Chatbot Service",
    description="Decoupled microservice for Hobart College student advisory chatbot",
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
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)


app.include_router(router)


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("CHATBOT_PORT", os.getenv("PORT", 8000)))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
