from sqlalchemy.orm import Session

from app.models import URL
from app.schemas import URLCreate
from app.utils.short_code import generate_short_code


def get_url_by_short_code(db: Session, short_code: str) -> URL | None:
    return db.query(URL).filter(URL.short_code == short_code).first()


def create_short_url(
    db: Session,
    url_data: URLCreate,
    base_url: str = "http://localhost:8000",
) -> dict:
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