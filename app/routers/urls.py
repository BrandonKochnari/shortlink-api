from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import URLCreate, URLResponse
from app.services.url_service import create_short_url

router = APIRouter()


@router.post("/", response_model=URLResponse)
def create_url(url_data: URLCreate, db: Session = Depends(get_db)):
    try:
        return create_short_url(db, url_data)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))