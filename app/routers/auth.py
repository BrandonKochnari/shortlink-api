from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from fastapi.security import OAuth2PasswordBearer
from app.services.security import (
    hash_password,
    verify_password,
    create_access_token,
    decode_access_token
)

from app.database import get_db
from app.models import User
from app.schemas import (
    UserCreate,
    UserLogin,
    UserResponse,
    Token
)

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/api/v1/auth/login"
)

router = APIRouter()

@router.post(
        "/register",
        response_model=UserResponse
)

def register(user_data: UserCreate, db: Session = Depends(get_db)):
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
        hashed_password=hashed_password
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

@router.post(
    "/login",
    response_model=Token
)

def login(user_data: UserLogin, db: Session = Depends(get_db)):
    user = (
        db.query(User)
        .filter(User.email == user_data.email)
        .first()
    )
    if not user:
        raise HTTPException(
            status_code=401,
            detail="Invalid Email or Password"
        )
    if not verify_password(user_data.password, user.hashed_password):
        raise HTTPException(
            status_code=401,
            detail="Invalid Email or Password"
        )
    
    access_token = create_access_token({"sub": str(user.id)})
    return {
        "access_token": access_token,
        "token_type": "bearer"
    }

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    payload = decode_access_token(token)
    user_id = payload.get("sub")
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