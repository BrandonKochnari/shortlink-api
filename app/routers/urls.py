from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import URLCreate, URLResponse, URLAnalytics, URLUpdate
from app.services.url_service import (
    create_short_url,
    get_url_by_short_code,
    get_urls_for_user,
    is_url_expired,
)
from app.routers.auth import get_current_user
from app.models import User, Click
from app.utils.rate_limit import limiter

router = APIRouter()

NO_STORE_HEADERS = {
    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    "Pragma": "no-cache",
    "Expires": "0",
}


def prevent_cache(response: Response) -> None:
    response.headers.update(NO_STORE_HEADERS)


@router.get("/my-urls", response_model=list[URLResponse])
@limiter.limit("20/minute")
def get_my_urls(request: Request, response: Response, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    prevent_cache(response)
    return get_urls_for_user(db, current_user.id)


@router.post("/", response_model=URLResponse)
@limiter.limit("5/minute")
def create_url(url_data: URLCreate, request: Request, response: Response, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    prevent_cache(response)
    try:
        return create_short_url(db, url_data, current_user)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))
    
@router.get("/{short_code}/analytics", response_model=URLAnalytics)
@limiter.limit("20/minute")
def get_url_analytics(short_code: str, request: Request, response: Response, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    prevent_cache(response)
    url = get_url_by_short_code(db, short_code)

    if not url: 
        raise HTTPException(status_code=404, detail="URL Not Found")
    
    if url.user_id != current_user.id: 
        raise HTTPException(status_code=403, detail="Invalid Access")
    
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
        "expires_at": url.expires_at
    }

@router.patch("/{short_code}/deactivate")
def deactivate_url(short_code: str, response: Response, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    prevent_cache(response)
    url = get_url_by_short_code(db, short_code)
    
    if not url: 
        raise HTTPException(status_code=404, detail="URL Not Found")
    
    if url.user_id != current_user.id: 
        raise HTTPException(status_code=403, detail="Invalid Access")
    
    url.is_active = False

    db.commit()
    db.refresh(url)

    return {"message": "URL Deactivated", "short_code": url.short_code, "is_active": url.is_active}

@router.patch("/{short_code}/activate")
def activate_url(short_code: str, response: Response, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    prevent_cache(response)
    url = get_url_by_short_code(db, short_code)
    
    if not url: 
        raise HTTPException(status_code=404, detail="URL Not Found")
    
    if url.user_id != current_user.id: 
        raise HTTPException(status_code=403, detail="Invalid Access")
    
    url.is_active = True

    db.commit()
    db.refresh(url)

    return {"message": "URL Activated", "short_code": url.short_code, "is_active": url.is_active}

@router.delete("/{short_code}")
def delete_url(short_code: str, response: Response, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    prevent_cache(response)
    url = get_url_by_short_code(db, short_code)
    
    if not url: 
        raise HTTPException(status_code=404, detail="URL Not Found")
    
    if url.user_id != current_user.id: 
        raise HTTPException(status_code=403, detail="Invalid Access")
    
    db.delete(url)
    db.commit()

    return {"message": "URL Deleted"}

@router.patch("/{short_code}/expiration")
def update_expiration(short_code: str, update_data: URLUpdate, response: Response, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    prevent_cache(response)
    url = get_url_by_short_code(db, short_code)
    
    if not url: 
        raise HTTPException(status_code=404, detail="URL Not Found")
    
    if url.user_id != current_user.id: 
        raise HTTPException(status_code=403, detail="Invalid Access")
    
    url.expires_at = update_data.expires_at

    db.commit()
    db.refresh(url)

    return {"message": "URL Expiry Updated", "expires_at": url.expires_at}
    
