"""Minimal ShelterConnect API server."""

from contextlib import asynccontextmanager
import os

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.database import engine, init_db
from app.auth.dependencies import CurrentUser, get_current_user
from app.driver_service import DriverWorkflowError
from app.drivers import router as driver_router
from app.rides import router as ride_router
from app.ride_service import RideCreationError


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="ShelterConnect API", lifespan=lifespan)
app.include_router(driver_router)
app.include_router(ride_router)


@app.exception_handler(DriverWorkflowError)
async def driver_workflow_error(request, exc: DriverWorkflowError):
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


@app.exception_handler(RideCreationError)
async def ride_creation_error(request, exc: RideCreationError):
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in os.getenv(
        "CORS_ORIGINS", "http://localhost:3000,http://localhost:5173"
    ).split(",") if origin.strip()],
    allow_methods=["GET", "POST", "PATCH", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.get("/api/me", response_model=CurrentUser)
def me(user: CurrentUser = Depends(get_current_user)):
    return user


@app.get("/health")
def health():
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))
    return {"status": "ok"}
