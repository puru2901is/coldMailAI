from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.database import init_db
from app.routers import contacts, emails, settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize database
    init_db()
    yield
    # Shutdown: cleanup if needed
    pass


app = FastAPI(
    title="Cold Email AI",
    description="AI-powered cold email generation and sending tool",
    version="0.1.0",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(contacts.router, prefix="/api/contacts", tags=["contacts"])
app.include_router(emails.router, prefix="/api/emails", tags=["emails"])
app.include_router(settings.router, prefix="/api/settings", tags=["settings"])


@app.get("/")
async def root():
    return {"message": "Cold Email AI API", "version": "0.1.0"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}
