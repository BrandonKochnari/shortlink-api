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
from app.utils.rate_limit import limiter  # noqa: E402


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
    limiter.limiter.storage.reset()
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    limiter.limiter.storage.reset()


@pytest.fixture
def client():
    app.dependency_overrides[get_db] = override_get_db
    return TestClient(app)


def unique_email() -> str:
    return f"user-{uuid.uuid4().hex[:8]}@example.com"


def test_register_creates_user(client: TestClient):
    email = unique_email()

    response = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "password123"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["email"] == email
    assert "email_verified" not in data


def test_duplicate_register_rejected(client: TestClient):
    email = unique_email()
    payload = {"email": email, "password": "password123"}

    first_response = client.post("/api/v1/auth/register", json=payload)
    second_response = client.post("/api/v1/auth/register", json=payload)

    assert first_response.status_code == 200
    assert second_response.status_code == 400
    assert second_response.json()["detail"] == "Email Already Registered"


def test_login_succeeds_immediately_after_registration(client: TestClient):
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

    assert login_response.status_code == 200
    data = login_response.json()
    assert data["access_token"]
    assert data["token_type"] == "bearer"


def test_login_rejects_invalid_password(client: TestClient):
    email = unique_email()

    register_response = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "password123"},
    )
    assert register_response.status_code == 200

    login_response = client.post(
        "/api/v1/auth/login",
        data={"username": email, "password": "wrong-password"},
    )

    assert login_response.status_code == 401
    assert login_response.json()["detail"] == "Invalid Email or Password"


def test_register_returns_429_after_rate_limit_exceeded(client: TestClient):
    responses = [
        client.post(
            "/api/v1/auth/register",
            json={"email": unique_email(), "password": "password123"},
        )
        for _ in range(6)
    ]

    assert [response.status_code for response in responses[:5]] == [200] * 5
    assert responses[5].status_code == 429
