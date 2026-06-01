from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import URLCreate, URLResponse
from app.services.url_service import create_short_url, get_urls_for_user, get_url_by_short_code
from app.routers.auth import get_current_user
from app.models import User, Click

router = APIRouter()

@router.get("/my-urls", response_model=list[URLResponse])
def get_my_urls(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return get_urls_for_user(db, current_user.id)


@router.post("/", response_model=URLResponse)
def create_url(url_data: URLCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        return create_short_url(db, url_data, current_user)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))
    
@router.get("/{short_code}/analytics")
def get_url_analytics(short_code: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    url = get_url_by_short_code(db, short_code)

    if not url: 
        raise HTTPException(status_code=404, detail="URL not found")
    
    if url.user_id != current_user.id: 
        raise HTTPException(status_code=403, detail="Invalid Access")
    
    click_count = (
        db.query(Click)
        .filter(Click.url_id == url.id)
        .count()
    )

    return {
        "short_code": url.short_code,
        "original_url": url.original_url,
        "clicks": click_count
    }