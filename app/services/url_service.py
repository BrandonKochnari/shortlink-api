from datetime import datetime, timedelta, timezone
import os
import re

from sqlalchemy.orm import Session

from app.models import URL, User, Click
from app.schemas import URLCreate
from app.utils.short_code import generate_short_code


EASTERN_STANDARD_OFFSET = timedelta(hours=-5)
EASTERN_DAYLIGHT_OFFSET = timedelta(hours=-4)
CUSTOM_ALIAS_PATTERN = re.compile(r"^[A-Za-z0-9_-]{3,32}$")
CUSTOM_ALIAS_MESSAGE = "Custom short code must be 3-32 characters and use only letters, numbers, dashes, or underscores."
DUPLICATE_ALIAS_MESSAGE = "Custom short code is already taken."
GUEST_LINK_LIMIT = 10
GUEST_LINK_LIMIT_MESSAGE = "Guest accounts can create up to 10 links. Sign in for unlimited links."


def _nth_weekday_of_month(year: int, month: int, weekday: int, occurrence: int) -> datetime:
    first_day = datetime(year, month, 1)
    days_until_weekday = (weekday - first_day.weekday()) % 7
    return first_day + timedelta(days=days_until_weekday + (occurrence - 1) * 7)


def _eastern_dst_utc_bounds(year: int) -> tuple[datetime, datetime]:
    dst_start_local = _nth_weekday_of_month(year, 3, 6, 2).replace(hour=2)
    dst_end_local = _nth_weekday_of_month(year, 11, 6, 1).replace(hour=2)
    dst_start_utc = dst_start_local - EASTERN_STANDARD_OFFSET
    dst_end_utc = dst_end_local - EASTERN_DAYLIGHT_OFFSET
    return dst_start_utc, dst_end_utc


def _eastern_offset_for_utc(value: datetime) -> timedelta:
    utc_value = normalize_datetime(value)

    if utc_value is None:
        return EASTERN_STANDARD_OFFSET

    utc_naive = utc_value.replace(tzinfo=None)
    dst_start_utc, dst_end_utc = _eastern_dst_utc_bounds(utc_naive.year)

    if dst_start_utc <= utc_naive < dst_end_utc:
        return EASTERN_DAYLIGHT_OFFSET

    return EASTERN_STANDARD_OFFSET


def get_public_base_url() -> str:
    return os.getenv("PUBLIC_BASE_URL", "http://localhost:5173").rstrip("/")


def normalize_custom_alias(custom_alias: str | None) -> str | None:
    if custom_alias is None:
        return None

    normalized_alias = custom_alias.strip()

    if not normalized_alias:
        return None

    if not CUSTOM_ALIAS_PATTERN.fullmatch(normalized_alias):
        raise ValueError(CUSTOM_ALIAS_MESSAGE)

    return normalized_alias


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


def normalize_datetime_eastern(value: datetime | None) -> datetime | None:
    normalized_value = normalize_datetime(value)

    if normalized_value is None:
        return None

    eastern_offset = _eastern_offset_for_utc(normalized_value)
    timezone_name = "EDT" if eastern_offset == EASTERN_DAYLIGHT_OFFSET else "EST"
    eastern_timezone = timezone(eastern_offset, timezone_name)
    return normalized_value.astimezone(eastern_timezone)


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
        "expires_at": normalize_datetime_eastern(url.expires_at),
        "created_at": normalize_datetime_eastern(url.created_at),
        "is_active": url.is_active,
    }


def generate_unique_short_code(db: Session) -> str:
    short_code = generate_short_code()

    while get_url_by_short_code(db, short_code):
        short_code = generate_short_code()

    return short_code


def create_short_url(db: Session, url_data: URLCreate, current_user: User, base_url: str | None = None) -> dict:

    base_url = (base_url or get_public_base_url()).rstrip("/")

    custom_alias = normalize_custom_alias(url_data.custom_alias)

    if custom_alias:
        if get_url_by_short_code(db, custom_alias):
            raise ValueError(DUPLICATE_ALIAS_MESSAGE)
        short_code = custom_alias
    else:
        short_code = generate_unique_short_code(db)

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

    guest_link_count = (
        db.query(URL)
        .filter(URL.user_id.is_(None))
        .filter(URL.guest_token == guest_token)
        .count()
    )

    if guest_link_count >= GUEST_LINK_LIMIT:
        raise ValueError(GUEST_LINK_LIMIT_MESSAGE)

    short_code = generate_unique_short_code(db)

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
        "created_at": normalize_datetime_eastern(url.created_at),
        "last_clicked": normalize_datetime_eastern(last_click.clicked_at) if last_click else None,
        "is_active": url.is_active,
        "is_expired": is_url_expired(url),
        "expires_at": normalize_datetime_eastern(url.expires_at),
    }


def get_url_click_timeseries(
    db: Session,
    url: URL,
    range_key: str,
    now: datetime | None = None,
) -> dict:
    current_time = normalize_datetime_eastern(now) or normalize_datetime_eastern(datetime.now(timezone.utc))

    if range_key == "1d":
        bucket_count = 24
        bucket_delta = timedelta(hours=1)
    elif range_key in {"7d", "30d", "90d"}:
        bucket_count = int(range_key.removesuffix("d"))
        bucket_delta = timedelta(days=1)
    else:
        raise ValueError("Invalid analytics range")

    bucket_ends = [
        current_time - (bucket_delta * offset)
        for offset in range(bucket_count - 1, -1, -1)
    ]
    counts_by_bucket = {bucket_end: 0 for bucket_end in bucket_ends}
    first_bucket_start = bucket_ends[0] - bucket_delta
    final_bucket_end = bucket_ends[-1]

    clicks = (
        db.query(Click)
        .filter(Click.url_id == url.id)
        .all()
    )

    for click in clicks:
        clicked_at = normalize_datetime_eastern(click.clicked_at)
        if clicked_at is None or clicked_at <= first_bucket_start or clicked_at > final_bucket_end:
            continue

        elapsed = clicked_at - first_bucket_start
        bucket_index = max(0, min(bucket_count - 1, int((elapsed.total_seconds() - 0.000001) // bucket_delta.total_seconds())))
        counts_by_bucket[bucket_ends[bucket_index]] += 1

    return {
        "range": range_key,
        "points": [
            {
                "period_start": bucket_end,
                "clicks": counts_by_bucket[bucket_end],
            }
            for bucket_end in bucket_ends
        ],
    }


def record_click(db: Session, url: URL) -> Click:
    click = Click(url_id=url.id)
    
    db.add(click)
    db.commit()
    db.refresh(click)

    return click
