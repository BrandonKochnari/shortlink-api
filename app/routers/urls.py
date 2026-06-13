from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import URLCreate, URLResponse, URLAnalytics, URLAnalyticsTimeseries, URLUpdate
from app.services.url_service import (
    create_guest_short_url,
    create_short_url,
    delete_guest_url,
    get_guest_url_by_short_code,
    get_url_analytics as build_url_analytics,
    get_url_click_timeseries,
    get_url_by_short_code,
    get_urls_for_guest,
    get_urls_for_user,
)
from app.routers.auth import get_current_user
from app.models import User
from app.utils.rate_limit import limiter

router = APIRouter()

NO_STORE_HEADERS = {
    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    "Pragma": "no-cache",
    "Expires": "0",
}


def prevent_cache(response: Response) -> None:
    response.headers.update(NO_STORE_HEADERS)


def get_guest_token(x_guest_token: str | None = Header(default=None, alias="X-Guest-Token")) -> str:
    guest_token = (x_guest_token or "").strip()

    if not guest_token:
        raise HTTPException(status_code=400, detail="Guest token is required")

    if len(guest_token) > 128:
        raise HTTPException(status_code=400, detail="Guest token is invalid")

    return guest_token


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


@router.post("/guest", response_model=URLResponse)
@limiter.limit("5/minute")
def create_guest_url(
    url_data: URLCreate,
    request: Request,
    response: Response,
    guest_token: str = Depends(get_guest_token),
    db: Session = Depends(get_db),
):
    prevent_cache(response)
    try:
        return create_guest_short_url(db, url_data, guest_token)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))


@router.get("/guest", response_model=list[URLResponse])
@limiter.limit("20/minute")
def get_guest_urls(
    request: Request,
    response: Response,
    guest_token: str = Depends(get_guest_token),
    db: Session = Depends(get_db),
):
    prevent_cache(response)
    return get_urls_for_guest(db, guest_token)


@router.delete("/guest/{short_code}")
@limiter.limit("20/minute")
def delete_guest_short_url(
    short_code: str,
    request: Request,
    response: Response,
    guest_token: str = Depends(get_guest_token),
    db: Session = Depends(get_db),
):
    prevent_cache(response)

    if not delete_guest_url(db, short_code, guest_token):
        raise HTTPException(status_code=404, detail="URL Not Found")

    return {"message": "URL Deleted"}


@router.get("/guest/{short_code}/analytics", response_model=URLAnalytics)
@limiter.limit("20/minute")
def get_guest_url_analytics(
    short_code: str,
    request: Request,
    response: Response,
    guest_token: str = Depends(get_guest_token),
    db: Session = Depends(get_db),
):
    prevent_cache(response)
    url = get_guest_url_by_short_code(db, short_code, guest_token)

    if not url:
        raise HTTPException(status_code=404, detail="URL Not Found")

    return build_url_analytics(db, url)


@router.get("/guest/{short_code}/analytics/timeseries", response_model=URLAnalyticsTimeseries)
@limiter.limit("20/minute")
def get_guest_url_analytics_timeseries(
    short_code: str,
    request: Request,
    response: Response,
    range: str = "7d",
    guest_token: str = Depends(get_guest_token),
    db: Session = Depends(get_db),
):
    prevent_cache(response)
    url = get_guest_url_by_short_code(db, short_code, guest_token)

    if not url:
        raise HTTPException(status_code=404, detail="URL Not Found")

    try:
        return get_url_click_timeseries(db, url, range)
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

    return build_url_analytics(db, url)


@router.get("/{short_code}/analytics/timeseries", response_model=URLAnalyticsTimeseries)
@limiter.limit("20/minute")
def get_url_analytics_timeseries(
    short_code: str,
    request: Request,
    response: Response,
    range: str = "7d",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    prevent_cache(response)
    url = get_url_by_short_code(db, short_code)

    if not url:
        raise HTTPException(status_code=404, detail="URL Not Found")

    if url.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Invalid Access")

    try:
        return get_url_click_timeseries(db, url, range)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))

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
    
