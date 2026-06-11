from datetime import datetime
from pydantic import BaseModel, ConfigDict, EmailStr, HttpUrl


class URLCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    original_url: HttpUrl
    expires_at: datetime | None = None


class URLResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    original_url: str
    short_code: str
    short_url: str
    expires_at: datetime | None = None
    created_at: datetime
    is_active: bool

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
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    created_at: datetime

class URLAnalytics(BaseModel):
    short_code: str
    original_url: str
    clicks: int
    created_at: datetime
    last_clicked: datetime | None = None
    is_active: bool
    expires_at: datetime | None = None
    is_expired: bool

class URLUpdate(BaseModel):
    expires_at: datetime | None = None
