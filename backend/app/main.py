import logging

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api import auth, dashboard, health, parts, purchase_orders, suppliers
from app.core.config import get_settings

settings = get_settings()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)

app = FastAPI(title="PartsPulse API", version="0.1.0")

logging.getLogger("partspulse").info("PartsPulse API starting up")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    # Handlers already raise the {"error": {...}} shape via `detail=`.
    # For exceptions raised elsewhere (e.g. FastAPI's own 404), wrap it too.
    if isinstance(exc.detail, dict) and "error" in exc.detail:
        payload = exc.detail
    else:
        payload = {"error": {"code": "HTTP_ERROR", "message": str(exc.detail), "details": []}}
    return JSONResponse(status_code=exc.status_code, content=payload)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"error": {"code": "VALIDATION_ERROR", "message": "Invalid request data", "details": exc.errors()}},
    )


app.include_router(health.router)
app.include_router(auth.router)
app.include_router(suppliers.router)
app.include_router(parts.router)
app.include_router(purchase_orders.router)
app.include_router(dashboard.router)
