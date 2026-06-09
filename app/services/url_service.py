from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models import URL, User, Click
from app.schemas import URLCreate
from app.utils.short_code import generate_short_code
import os

BASE_URL = os.getenv("BASE_URL", "http://localhost:8000")


def get_url_by_short_code(db: Session, short_code: str) -> URL | None:
    return db.query(URL).filter(URL.short_code == short_code).first()


def normalize_datetime(value: datetime | None) -> datetime | None:
    if value is None:
        return None

    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)

    return value.astimezone(timezone.utc)


def is_url_expired(url: URL, now: datetime | None = None) -> bool:
    expires_at = normalize_datetime(url.expires_at)

    if expires_at is None:
        return False

    current_time = now or datetime.now(timezone.utc)
    return current_time > expires_at


def create_short_url(db: Session, url_data: URLCreate, current_user: User, base_url: str = BASE_URL) -> dict:
    if url_data.custom_alias:
        existing_url = get_url_by_short_code(db, url_data.custom_alias)

        if existing_url:
            raise ValueError("Custom Alias Already Exists")

        short_code = url_data.custom_alias

    else:
        short_code = generate_short_code()

        while get_url_by_short_code(db, short_code):
            short_code = generate_short_code()

    new_url = URL(
        user_id = current_user.id,
        original_url=str(url_data.original_url),
        short_code=short_code,
        expires_at=url_data.expires_at,
    )

    db.add(new_url)
    db.commit()
    db.refresh(new_url)

    return {
        "id": new_url.id,
        "original_url": new_url.original_url,
        "short_code": new_url.short_code,
        "short_url": f"{base_url}/{new_url.short_code}",
        "expires_at": new_url.expires_at,
        "created_at": new_url.created_at,
    }

def get_urls_for_user(db: Session, user_id: int, base_url: str = BASE_URL) -> list[dict]:
    urls = (
        db.query(URL)
        .filter(URL.user_id == user_id)
        .all()
    )

    return [
        {
            "id": url.id,
            "original_url": url.original_url,
            "short_code": url.short_code, 
            "short_url": f"{base_url}/{url.short_code}",
            "expires_at": url.expires_at,
            "created_at": url.created_at,
        }
        for url in urls
    ]

def record_click(db: Session, url: URL) -> Click:
    click = Click(url_id=url.id)
    
    db.add(click)
    db.commit()
    db.refresh(click)

    return click
