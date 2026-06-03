from datetime import datetime
from pydantic import BaseModel, HttpUrl, EmailStr


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

class UserCreate(BaseModel):
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str 
    token_type: str

class UserResponse(BaseModel):
    id: int
    email: EmailStr
    created_at: datetime

    class Config:
        from_attributes = True

class URLAnalytics(BaseModel):
    short_code: str
    original_url: str
    clicks: int
    created_at: datetime
    last_clicked: datetime | None = None
    is_active: bool