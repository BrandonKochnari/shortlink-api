import os

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.routers import auth, urls
from app.services.url_service import get_url_by_short_code, is_url_expired, record_click

app = FastAPI(title="Shortlink API")

allowed_origins = os.getenv(
    "CORS_ALLOWED_ORIGINS",
    "http://localhost:5173,https://shortlink-generator-app.onrender.com,https://shortlink-api-4ubx.onrender.com",
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in allowed_origins],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(urls.router, prefix="/api/v1/urls", tags=["URLs"])
app.include_router(
    auth.router,
    prefix="/api/v1/auth",
    tags=["Auth"],
)


@app.get("/")
def root():
    return {"message": "Shortlink API Is Running"}


@app.get("/{short_code}")
def redirect_to_original_url(
    short_code: str,
    request: Request,
    db: Session = Depends(get_db),
):
    url = get_url_by_short_code(db, short_code)

    if not url:
        raise HTTPException(
            status_code=404,
            detail="URL Not Found",
        )

    if not url.is_active:
        raise HTTPException(
            status_code=410,
            detail="URL Is Inactive",
        )

    if is_url_expired(url):
        raise HTTPException(
            status_code=410,
            detail="URL Has Expired",
        )

    purpose = (
        request.headers.get("purpose")
        or request.headers.get("x-purpose")
        or request.headers.get("sec-purpose")
    )
    sec_fetch_dest = request.headers.get("sec-fetch-dest")
    sec_fetch_mode = request.headers.get("sec-fetch-mode")

    is_speculative_request = (
        purpose in {"prefetch", "preview"}
        or sec_fetch_mode == "navigate" and sec_fetch_dest not in {None, "document", "iframe"}
        or sec_fetch_mode != "navigate" and sec_fetch_dest in {"empty", "object"}
    )

    if not is_speculative_request:
        record_click(db, url)

    return RedirectResponse(url.original_url)