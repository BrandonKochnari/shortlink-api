import os

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from sqlalchemy.orm import Session

from app.database import get_db
from app.routers import auth, urls
from app.services.url_service import get_url_by_short_code, is_url_expired, record_click
from app.utils.rate_limit import limiter

app = FastAPI(title="URL Shortlink")
app.state.limiter = limiter

LOGIN_LIMIT_MESSAGE = "Maximum login attempts reached. Please try again in a minute."
REGISTER_LIMIT_MESSAGE = "Maximum registration attempts reached. Please try again in a minute."
CREATE_URL_LIMIT_MESSAGE = "Maximum URL creation attempts reached. Please try again in a minute."
REDIRECT_LIMIT_MESSAGE = "Too many redirect requests. Please try again in a minute."
URL_DATA_LIMIT_MESSAGE = "Too many URL data requests. Please try again in a minute."
DEFAULT_LIMIT_MESSAGE = "Too many requests. Please try again in a minute."


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    path = request.url.path

    if "/auth/login" in path:
        message = LOGIN_LIMIT_MESSAGE
    elif "/auth/register" in path:
        message = REGISTER_LIMIT_MESSAGE
    elif request.method == "POST" and "/urls" in path:
        message = CREATE_URL_LIMIT_MESSAGE
    elif "analytics" in path or "my-urls" in path:
        message = URL_DATA_LIMIT_MESSAGE
    elif request.method == "GET":
        message = REDIRECT_LIMIT_MESSAGE
    else:
        message = DEFAULT_LIMIT_MESSAGE

    return JSONResponse(
        status_code=429,
        content={"detail": message},
    )

NO_STORE_HEADERS = {
    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    "Pragma": "no-cache",
    "Expires": "0",
}

allowed_origins = os.getenv(
    "CORS_ALLOWED_ORIGINS",
    "http://localhost:5173,https://urlshortlink.xyz,https://www.urlshortlink.xyz",
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in allowed_origins],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(SlowAPIMiddleware)

app.include_router(urls.router, prefix="/api/v1/urls", tags=["URLs"])
app.include_router(
    auth.router,
    prefix="/api/v1/auth",
    tags=["Auth"],
)


@app.get("/")
def root():
    return {"message": "URL Shortlink Is Running"}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/{short_code}")
@limiter.limit("60/minute")
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
            headers=NO_STORE_HEADERS,
        )

    if not url.is_active:
        raise HTTPException(
            status_code=410,
            detail="URL Is Inactive",
            headers=NO_STORE_HEADERS,
        )

    if is_url_expired(url):
        raise HTTPException(
            status_code=410,
            detail="URL Has Expired",
            headers=NO_STORE_HEADERS,
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

    return RedirectResponse(url.original_url, headers=NO_STORE_HEADERS)
