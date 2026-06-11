import os

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.routers import urls, auth
from app.services.url_service import get_url_by_short_code, is_url_expired, record_click

app = FastAPI(title="Shortlink API")

allowed_origins = os.getenv(
    "CORS_ALLOWED_ORIGINS",
    "http://localhost:5173,https://shortlink-generator-app.onrender.com"
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
    tags=["Auth"]
)

@app.get("/")
def root():
    return {"message": "Shortlink API Is Running"}

@app.get("/{short_code}")
def redirect_to_original_url(short_code: str, db: Session = Depends(get_db)):
    url = get_url_by_short_code(db, short_code)

    if not url:
        raise HTTPException(
            status_code=404,
            detail="URL Not Found"
        )
    
    if not url.is_active:
        raise HTTPException(
            status_code=410,
            detail="URL Is Inactive"
        )

    if is_url_expired(url):
        raise HTTPException(
            status_code=410,
            detail="URL Has Expired"
        )
    
    record_click(db, url)

    return RedirectResponse(url.original_url)