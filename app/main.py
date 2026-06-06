from fastapi import FastAPI, Depends, HTTPException
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from datetime import datetime, timezone

from app import models
from app.database import Base, engine, get_db
from app.routers import urls, auth
from app.services.url_service import (
    get_active_url_by_short_code,
    is_url_expired,
    record_click,
)

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Shortlink API")

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
    url = get_active_url_by_short_code(db, short_code)

    if not url:
        raise HTTPException(
            status_code=404,
            detail="Short URL not found"
        )

    if is_url_expired(url):
        raise HTTPException(
            status_code=410,
            detail="Short URL has expired"
        )

    record_click(db, url)

    return RedirectResponse(url.original_url)
