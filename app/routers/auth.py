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
    decode_access_token,
)
from app.schemas import (
    UserCreate,
    UserResponse,
    Token,
)
from app.utils.rate_limit import limiter

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/api/v1/auth/login"
)

router = APIRouter()


@router.post(
    "/register",
    response_model=UserResponse,
)
@limiter.limit("3/minute")
def register(request: Request, user_data: UserCreate, db: Session = Depends(get_db)):
    existing_user = (
        db.query(User)
        .filter(User.email == user_data.email)
        .first()
    )
    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Email Already Registered",
        )

    user = User(
        email=user_data.email,
        hashed_password=hash_password(user_data.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post(
    "/login",
    response_model=Token,
)
@limiter.limit("5/minute")
def login(
    request: Request,
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
            detail="Invalid Email or Password",
        )
    if not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=401,
            detail="Invalid Email or Password",
        )

    access_token = create_access_token({"sub": str(user.id)})
    return {
        "access_token": access_token,
        "token_type": "bearer",
    }


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    try:
        payload = decode_access_token(token)
        user_id = payload.get("sub")
    except JWTError:
        raise HTTPException(
            status_code=401,
            detail="Invalid Token",
        )

    if user_id is None:
        raise HTTPException(
            status_code=401,
            detail="Invalid Token",
        )
    user = (
        db.query(User)
        .filter(User.id == int(user_id))
        .first()
    )
    if not user:
        raise HTTPException(
            status_code=401,
            detail="User Not Found",
        )
    return user


@router.get(
    "/me",
    response_model=UserResponse,
)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user
