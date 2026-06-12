from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models import URL, User, Click
from app.schemas import URLCreate
from app.utils.short_code import generate_short_code
import os


def get_public_base_url() -> str:
    return os.getenv("PUBLIC_BASE_URL", "http://localhost:5173").rstrip("/")


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


def create_short_url(db: Session, url_data: URLCreate, current_user: User, base_url: str | None = None) -> dict:

    base_url = (base_url or get_public_base_url()).rstrip("/")

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
        "is_active": new_url.is_active,
    }

def get_urls_for_user(db: Session, user_id: int, base_url: str | None = None) -> list[dict]:
    
    base_url = (base_url or get_public_base_url()).rstrip("/")

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
            "is_active": url.is_active,
        }
        for url in urls
    ]

def record_click(db: Session, url: URL) -> Click:
    click = Click(url_id=url.id)
    
    db.add(click)
    db.commit()
    db.refresh(click)

    return click
