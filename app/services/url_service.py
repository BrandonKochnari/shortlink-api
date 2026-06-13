from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models import URL, User, Click
from app.schemas import URLCreate
from app.utils.short_code import generate_short_code
import os


def get_public_base_url() -> str:
    return os.getenv("PUBLIC_BASE_URL", "http://localhost:5173").rstrip("/")


def get_url_by_short_code(db: Session, short_code: str) -> URL | None:
    return db.query(URL).filter(URL.short_code == short_code).first()


def get_guest_url_by_short_code(db: Session, short_code: str, guest_token: str) -> URL | None:
    return (
        db.query(URL)
        .filter(URL.short_code == short_code)
        .filter(URL.guest_token == guest_token)
        .first()
    )


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


def build_url_response(url: URL, base_url: str | None = None) -> dict:
    base_url = (base_url or get_public_base_url()).rstrip("/")

    return {
        "id": url.id,
        "original_url": url.original_url,
        "short_code": url.short_code,
        "short_url": f"{base_url}/{url.short_code}",
        "expires_at": url.expires_at,
        "created_at": url.created_at,
        "is_active": url.is_active,
    }


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

    return build_url_response(new_url, base_url)


def create_guest_short_url(db: Session, url_data: URLCreate, guest_token: str, base_url: str | None = None) -> dict:
    base_url = (base_url or get_public_base_url()).rstrip("/")

    short_code = generate_short_code()

    while get_url_by_short_code(db, short_code):
        short_code = generate_short_code()

    new_url = URL(
        user_id=None,
        guest_token=guest_token,
        original_url=str(url_data.original_url),
        short_code=short_code,
        expires_at=datetime.now(timezone.utc) + timedelta(days=7),
        is_active=True,
    )

    db.add(new_url)
    db.commit()
    db.refresh(new_url)

    return build_url_response(new_url, base_url)


def get_urls_for_guest(db: Session, guest_token: str, base_url: str | None = None) -> list[dict]:
    base_url = (base_url or get_public_base_url()).rstrip("/")

    urls = (
        db.query(URL)
        .filter(URL.user_id.is_(None))
        .filter(URL.guest_token == guest_token)
        .all()
    )

    return [
        {
            **build_url_response(url, base_url),
        }
        for url in urls
    ]


def delete_guest_url(db: Session, short_code: str, guest_token: str) -> bool:
    url = get_guest_url_by_short_code(db, short_code, guest_token)

    if not url:
        return False

    db.delete(url)
    db.commit()
    return True

def get_urls_for_user(db: Session, user_id: int, base_url: str | None = None) -> list[dict]:
    
    base_url = (base_url or get_public_base_url()).rstrip("/")

    urls = (
        db.query(URL)
        .filter(URL.user_id == user_id)
        .all()
    )

    return [
        {
            **build_url_response(url, base_url),
        }
        for url in urls
    ]


def get_url_analytics(db: Session, url: URL) -> dict:
    click_count = (
        db.query(Click)
        .filter(Click.url_id == url.id)
        .count()
    )

    last_click = (
        db.query(Click)
        .filter(Click.url_id == url.id)
        .order_by(Click.clicked_at.desc())
        .first()
    )

    return {
        "short_code": url.short_code,
        "original_url": url.original_url,
        "clicks": click_count,
        "created_at": url.created_at,
        "last_clicked": last_click.clicked_at if last_click else None,
        "is_active": url.is_active,
        "is_expired": is_url_expired(url),
        "expires_at": url.expires_at,
    }


def get_url_click_timeseries(
    db: Session,
    url: URL,
    range_key: str,
    now: datetime | None = None,
) -> dict:
    current_time = now or datetime.now(timezone.utc)

    if range_key == "1d":
        bucket_count = 24
        bucket_delta = timedelta(hours=1)
        end_bucket = current_time.replace(minute=0, second=0, microsecond=0)
    elif range_key in {"7d", "30d", "90d"}:
        bucket_count = int(range_key.removesuffix("d"))
        bucket_delta = timedelta(days=1)
        end_bucket = current_time.replace(hour=0, minute=0, second=0, microsecond=0)
    else:
        raise ValueError("Invalid analytics range")

    bucket_starts = [
        end_bucket - (bucket_delta * offset)
        for offset in range(bucket_count - 1, -1, -1)
    ]
    counts_by_bucket = {bucket_start: 0 for bucket_start in bucket_starts}
    first_bucket = bucket_starts[0]
    final_bucket_end = bucket_starts[-1] + bucket_delta

    clicks = (
        db.query(Click)
        .filter(Click.url_id == url.id)
        .all()
    )

    for click in clicks:
        clicked_at = normalize_datetime(click.clicked_at)
        if clicked_at is None or clicked_at < first_bucket or clicked_at >= final_bucket_end:
            continue

        if range_key == "1d":
            bucket_start = clicked_at.replace(minute=0, second=0, microsecond=0)
        else:
            bucket_start = clicked_at.replace(hour=0, minute=0, second=0, microsecond=0)

        if bucket_start in counts_by_bucket:
            counts_by_bucket[bucket_start] += 1

    return {
        "range": range_key,
        "points": [
            {
                "period_start": bucket_start,
                "clicks": counts_by_bucket[bucket_start],
            }
            for bucket_start in bucket_starts
        ],
    }


def record_click(db: Session, url: URL) -> Click:
    click = Click(url_id=url.id)
    
    db.add(click)
    db.commit()
    db.refresh(click)

    return click
