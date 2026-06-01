from datetime import datetime, timedelta, timezone
from jose import jwt
from passlib.context import CryptContext

SECRET_KEY = "supersecretkey"
ALGORITHM = "HS256"

pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated ="auto"
)

def hash_password(password: str):
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_passowrd: str):
    return pwd_context.verify(plain_password, hashed_passowrd)
    
def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(hours=1)
    to_encode["exp"] = expire
    token = jwt.encode(
        to_encode,
        SECRET_KEY,
        algorithm=ALGORITHM
    )
    
    return token

def decode_access_token(token: str):
    return jwt.decode(
        token, 
        SECRET_KEY, 
        algorithms=[ALGORITHM]
    )
