from datetime import datetime
from pydantic import BaseModel, HttpUrl


class URLCreate(BaseModel):
    original_url: HttpUrl
    custom_alias: str | None = None
    expires_at: datetime | None = None


class URLResponse(BaseModel):
    id: int
    original_url: str
    short_code: str
    short_url: str
    expires_at: datetime | None = None
    created_at: datetime

    class Config:
        from_attributes = True