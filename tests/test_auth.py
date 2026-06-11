import os
import sys
import uuid
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))
if "DATABASE_URL" not in os.environ:
    os.environ["DATABASE_URL"] = f"sqlite:///{Path(__file__).resolve().parent / 'test_shortlink.db'}"

from app.database import Base, get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models import User  # noqa: E402


TEST_DATABASE_URL = os.environ["DATABASE_URL"]
engine_kwargs = {}
if TEST_DATABASE_URL.startswith("sqlite"):
    engine_kwargs["connect_args"] = {"check_same_thread": False}
engine = create_engine(TEST_DATABASE_URL, **engine_kwargs)
TestingSessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(autouse=True)
def reset_database():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield


@pytest.fixture
def client():
    app.dependency_overrides[get_db] = override_get_db
    return TestClient(app)


def unique_email() -> str:
    return f"user-{uuid.uuid4().hex[:8]}@example.com"


def get_user_by_email(email: str) -> User:
    db = TestingSessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        assert user is not None
        return user
    finally:
        db.close()


def test_register_creates_unverified_user_with_token(client: TestClient):
    email = unique_email()

    response = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "password123"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["email"] == email
    assert data["email_verified"] is False

    user = get_user_by_email(email)
    assert user.email_verified is False
    assert user.verification_token
    assert user.verification_token_expires_at is not None


def test_login_blocked_before_email_verification(client: TestClient):
    email = unique_email()
    password = "password123"

    register_response = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": password},
    )
    assert register_response.status_code == 200

    login_response = client.post(
        "/api/v1/auth/login",
        data={"username": email, "password": password},
    )

    assert login_response.status_code == 403
    assert login_response.json()["detail"] == "Email Not Verified"


def test_verify_email_marks_user_verified_and_clears_token(client: TestClient):
    email = unique_email()

    register_response = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "password123"},
    )
    assert register_response.status_code == 200

    token = get_user_by_email(email).verification_token
    verify_response = client.get(
        "/api/v1/auth/verify-email",
        params={"token": token},
    )

    assert verify_response.status_code == 200
    assert verify_response.json() == {"message": "Email Verified"}

    user = get_user_by_email(email)
    assert user.email_verified is True
    assert user.verification_token is None
    assert user.verification_token_expires_at is None


def test_login_succeeds_after_email_verification(client: TestClient):
    email = unique_email()
    password = "password123"

    register_response = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": password},
    )
    assert register_response.status_code == 200

    token = get_user_by_email(email).verification_token
    verify_response = client.get(
        "/api/v1/auth/verify-email",
        params={"token": token},
    )
    assert verify_response.status_code == 200

    login_response = client.post(
        "/api/v1/auth/login",
        data={"username": email, "password": password},
    )

    assert login_response.status_code == 200
    data = login_response.json()
    assert data["access_token"]
    assert data["token_type"] == "bearer"


def test_resend_verification_rotates_token(client: TestClient):
    email = unique_email()

    register_response = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "password123"},
    )
    assert register_response.status_code == 200

    original_token = get_user_by_email(email).verification_token
    resend_response = client.post(
        "/api/v1/auth/resend-verification",
        json={"email": email},
    )

    assert resend_response.status_code == 200
    user = get_user_by_email(email)
    assert user.verification_token
    assert user.verification_token != original_token
