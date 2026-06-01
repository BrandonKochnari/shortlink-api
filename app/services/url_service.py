from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models import URL, User, Click
from app.schemas import URLCreate, URLUpdate
from app.utils.short_code import generate_short_code


def get_url_by_short_code(db: Session, short_code: str) -> URL | None:
    return db.query(URL).filter(URL.short_code == short_code).first()


def get_active_url_by_short_code(db: Session, short_code: str) -> URL | None:
    return (
        db.query(URL)
        .filter(URL.short_code == short_code)
        .filter(URL.is_active == True)
        .first()
    )


def get_url_by_id(db: Session, url_id: int) -> URL | None:
    return db.query(URL).filter(URL.id == url_id).first()


def get_all_urls(db: Session) -> list[URL]:
    return db.query(URL).all()


def build_url_response(url: URL, base_url: str = "http://localhost:8000") -> dict:
    return {
        "id": url.id,
        "original_url": url.original_url,
        "short_code": url.short_code,
        "short_url": f"{base_url}/{url.short_code}",
        "expires_at": url.expires_at,
        "created_at": url.created_at,
    }


def is_url_expired(url: URL) -> bool:
    if url.expires_at is None:
        return False

    now = datetime.now(timezone.utc)
    expires_at = url.expires_at

    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    return now > expires_at


def create_short_url(db: Session, url_data: URLCreate, current_user: User, base_url: str = "http://localhost:8000") -> dict:
    if url_data.custom_alias:
        existing_url = get_url_by_short_code(db, url_data.custom_alias)

        if existing_url:
            raise ValueError("Custom alias already exists")

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

    return build_url_response(new_url, base_url)

def get_urls_for_user(db: Session, user_id: int, base_url: str = "http://localhost:8000") -> list[dict]:
    urls = (
        db.query(URL)
        .filter(URL.user_id == user_id)
        .all()
    )

    return [build_url_response(url, base_url) for url in urls]


def update_url(db: Session, url_id: int, url_data: URLUpdate) -> URL | None:
    url = get_url_by_id(db, url_id)

    if url is None:
        return None

    if url_data.original_url is not None:
        url.original_url = str(url_data.original_url)

    if url_data.expires_at is not None:
        url.expires_at = url_data.expires_at

    if url_data.is_active is not None:
        url.is_active = url_data.is_active

    db.commit()
    db.refresh(url)

    return url


def deactivate_url(db: Session, url_id: int) -> URL | None:
    url = get_url_by_id(db, url_id)

    if url is None:
        return None

    url.is_active = False
    db.commit()
    db.refresh(url)

    return url


def record_click(db: Session, url: URL) -> Click:
    click = Click(url_id=url.id)
    
    db.add(click)
    db.commit()
    db.refresh(click)

    return click
