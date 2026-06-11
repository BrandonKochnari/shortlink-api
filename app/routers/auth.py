from datetime import datetime, timedelta, timezone
import secrets

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.services.security import (
    hash_password,
    verify_password,
    create_access_token,
    decode_access_token
)
from app.services.email_service import email_service
from app.schemas import (
    ResendVerificationRequest,
    UserCreate,
    UserResponse,
    Token
)

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/api/v1/auth/login"
)

router = APIRouter()


VERIFICATION_TOKEN_EXPIRE_HOURS = 24


def generate_verification_token() -> str:
    return secrets.token_urlsafe(32)


def verification_expiration() -> datetime:
    return datetime.now(timezone.utc) + timedelta(hours=VERIFICATION_TOKEN_EXPIRE_HOURS)


def normalize_datetime(value: datetime | None) -> datetime | None:
    if value is None:
        return None

    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)

    return value.astimezone(timezone.utc)


def build_verification_link(request: Request, token: str) -> str:
    return f"{request.url_for('verify_email')}?token={token}"


def assign_verification_token(user: User) -> None:
    user.verification_token = generate_verification_token()
    user.verification_token_expires_at = verification_expiration()


@router.post(
        "/register",
        response_model=UserResponse
)

def register(user_data: UserCreate, request: Request, db: Session = Depends(get_db)):
    existing_user = (
        db.query(User)
        .filter(User.email == user_data.email)
        .first()
    )
    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Email Already Registered"
        )
    hashed_password = hash_password(user_data.password)
    user = User(
        email=user_data.email,
        hashed_password=hashed_password,
        email_verified=False,
    )
    assign_verification_token(user)
    db.add(user)
    db.commit()
    db.refresh(user)
    email_service.send_verification_email(
        user.email,
        build_verification_link(request, user.verification_token),
    )
    return user

@router.post(
    "/login",
    response_model=Token
)

def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    user = (
        db.query(User)
        .filter(User.email == form_data.username)
        .first()
    )
    if not user:
        raise HTTPException(
            status_code=401,
            detail="Invalid Email or Password"
        )
    if not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=401,
            detail="Invalid Email or Password"
        )

    if not user.email_verified:
        raise HTTPException(
            status_code=403,
            detail="Email Not Verified"
        )
    
    access_token = create_access_token({"sub": str(user.id)})
    return {
        "access_token": access_token,
        "token_type": "bearer"
    }


@router.get("/verify-email")
def verify_email(token: str, db: Session = Depends(get_db)):
    user = (
        db.query(User)
        .filter(User.verification_token == token)
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=400,
            detail="Invalid Verification Token"
        )

    expires_at = normalize_datetime(user.verification_token_expires_at)
    if expires_at is None or datetime.now(timezone.utc) > expires_at:
        raise HTTPException(
            status_code=400,
            detail="Verification Token Expired"
        )

    user.email_verified = True
    user.verification_token = None
    user.verification_token_expires_at = None
    db.commit()

    return {"message": "Email Verified"}


@router.post("/resend-verification")
def resend_verification(
    request_data: ResendVerificationRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    user = (
        db.query(User)
        .filter(User.email == request_data.email)
        .first()
    )

    if user and not user.email_verified:
        assign_verification_token(user)
        db.commit()
        db.refresh(user)
        email_service.send_verification_email(
            user.email,
            build_verification_link(request, user.verification_token),
        )

    return {"message": "If the account exists and is unverified, a verification email was sent"}

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    try:
        payload = decode_access_token(token)
        user_id = payload.get("sub")
    except JWTError:
        raise HTTPException(
            status_code=401,
            detail="Invalid Token"
        )

    if user_id is None:
        raise HTTPException(
            status_code=401,
            detail="Invalid Token"
        )
    user = (
        db.query(User)
        .filter(User.id == int(user_id))
        .first()
    )
    if not user:
        raise HTTPException(
            status_code=401,
            detail="User Not Found"
        )
    return user

@router.get(
    "/me",
    response_model = UserResponse
)

def get_me(current_user: User = Depends(get_current_user)):
    return current_user
