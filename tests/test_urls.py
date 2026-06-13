import os
import re
import sys
import uuid
from datetime import datetime, timedelta, timezone
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
from app.models import URL  # noqa: E402
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


def auth_headers(client: TestClient) -> dict[str, str]:
    suffix = uuid.uuid4().hex[:8]
    email = f"user-{suffix}@example.com"
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

    token = login_response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def create_url(client: TestClient, headers: dict[str, str], **overrides):
    payload = {
        "original_url": "https://example.com",
        "expires_at": None,
    }
    payload.update(overrides)
    return client.post("/api/v1/urls/", json=payload, headers=headers)


def create_guest_url(client: TestClient, **overrides):
    payload = {
        "original_url": "https://example.com",
    }
    payload.update(overrides)
    return client.post("/api/v1/urls/guest", json=payload)


def assert_generated_short_code(short_code: str):
    assert re.fullmatch(r"[A-Za-z0-9]{5}", short_code)


def assert_no_store(response):
    assert "no-store" in response.headers["cache-control"]
    assert response.headers["pragma"] == "no-cache"
    assert response.headers["expires"] == "0"


def created_short_code(response) -> str:
    short_code = response.json()["short_code"]
    assert_generated_short_code(short_code)
    return short_code


def parse_api_datetime(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def test_create_short_url_random_code(client: TestClient):
    headers = auth_headers(client)
    response = create_url(client, headers)

    assert response.status_code == 200

    data = response.json()
    assert data["original_url"] == "https://example.com/"
    assert_generated_short_code(data["short_code"])
    assert data["short_url"].endswith(data["short_code"])
    assert data["expires_at"] is None
    assert data["is_active"] is True


def test_guest_can_create_short_url_without_auth(client: TestClient):
    response = create_guest_url(client)

    assert response.status_code == 200
    data = response.json()
    assert data["original_url"] == "https://example.com/"
    assert_generated_short_code(data["short_code"])
    assert data["short_url"].endswith(data["short_code"])
    assert data["expires_at"] is not None
    assert data["is_active"] is True

    db = TestingSessionLocal()
    try:
        url = db.query(URL).filter(URL.short_code == data["short_code"]).first()
        assert url is not None
        assert url.user_id is None
    finally:
        db.close()


def test_guest_short_url_expires_about_seven_days_after_creation(client: TestClient):
    before_create = datetime.now(timezone.utc)
    response = create_guest_url(
        client,
        expires_at="2035-01-01T00:00:00",
    )
    after_create = datetime.now(timezone.utc)

    assert response.status_code == 200
    expires_at = parse_api_datetime(response.json()["expires_at"])

    assert before_create + timedelta(days=7) <= expires_at <= after_create + timedelta(days=7)


def test_guest_cannot_access_analytics(client: TestClient):
    create_response = create_guest_url(client)
    assert create_response.status_code == 200
    short_code = created_short_code(create_response)

    analytics_response = client.get(f"/api/v1/urls/{short_code}/analytics")

    assert analytics_response.status_code == 401


def test_guest_cannot_activate_or_deactivate_links(client: TestClient):
    create_response = create_guest_url(client)
    assert create_response.status_code == 200
    short_code = created_short_code(create_response)

    deactivate_response = client.patch(f"/api/v1/urls/{short_code}/deactivate")
    activate_response = client.patch(f"/api/v1/urls/{short_code}/activate")

    assert deactivate_response.status_code == 401
    assert activate_response.status_code == 401


def test_guest_short_urls_do_not_appear_in_authenticated_my_urls(client: TestClient):
    create_guest_response = create_guest_url(client)
    assert create_guest_response.status_code == 200
    guest_short_code = created_short_code(create_guest_response)

    headers = auth_headers(client)
    my_urls_response = client.get("/api/v1/urls/my-urls", headers=headers)

    assert my_urls_response.status_code == 200
    short_codes = {url["short_code"] for url in my_urls_response.json()}
    assert guest_short_code not in short_codes


def test_custom_alias_payload_is_ignored(client: TestClient):
    headers = auth_headers(client)
    requested_alias = "custom-choice"

    response = create_url(
        client,
        headers,
        original_url="https://fastapi.tiangolo.com/",
        custom_alias=requested_alias,
    )

    assert response.status_code == 200

    data = response.json()
    assert_generated_short_code(data["short_code"])
    assert data["short_code"] != requested_alias
    assert data["short_url"].endswith(data["short_code"])


def test_redirect_short_url(client: TestClient):
    headers = auth_headers(client)

    create_response = create_url(client, headers)
    assert create_response.status_code == 200
    short_code = created_short_code(create_response)

    response = client.get(f"/{short_code}", follow_redirects=False)

    assert response.status_code in [307, 308]
    assert response.headers["location"] == "https://example.com/"
    assert_no_store(response)


def test_missing_short_code_returns_404(client: TestClient):
    response = client.get("/abcde", follow_redirects=False)

    assert response.status_code == 404
    assert response.json()["detail"] == "URL Not Found"
    assert_no_store(response)


def test_expired_url_returns_410(client: TestClient):
    headers = auth_headers(client)

    create_response = create_url(
        client,
        headers,
        expires_at="2020-01-01T00:00:00",
    )
    assert create_response.status_code == 200
    short_code = created_short_code(create_response)

    redirect_response = client.get(f"/{short_code}", follow_redirects=False)

    assert redirect_response.status_code == 410
    assert redirect_response.json()["detail"] == "URL Has Expired"


def test_my_urls_returns_authenticated_users_urls(client: TestClient):
    headers = auth_headers(client)

    create_response = create_url(client, headers)
    assert create_response.status_code == 200
    short_code = created_short_code(create_response)

    response = client.get("/api/v1/urls/my-urls", headers=headers)

    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 1
    assert data[0]["short_code"] == short_code
    assert data[0]["is_active"] is True


def test_analytics_returns_click_count(client: TestClient):
    headers = auth_headers(client)

    create_response = create_url(client, headers)
    assert create_response.status_code == 200
    short_code = created_short_code(create_response)

    redirect_response = client.get(f"/{short_code}", follow_redirects=False)
    assert redirect_response.status_code in [307, 308]

    analytics_response = client.get(
        f"/api/v1/urls/{short_code}/analytics",
        headers=headers,
    )

    assert analytics_response.status_code == 200
    data = analytics_response.json()
    assert data["short_code"] == short_code
    assert data["clicks"] == 1
    assert data["last_clicked"] is not None


def test_prefetch_request_does_not_increment_click_count(client: TestClient):
    headers = auth_headers(client)

    create_response = create_url(client, headers)
    assert create_response.status_code == 200
    short_code = created_short_code(create_response)

    prefetch_response = client.get(
        f"/{short_code}",
        follow_redirects=False,
        headers={
            "purpose": "prefetch",
            "sec-fetch-mode": "no-cors",
            "sec-fetch-dest": "empty",
        },
    )
    assert prefetch_response.status_code in [307, 308]

    analytics_after_prefetch = client.get(
        f"/api/v1/urls/{short_code}/analytics",
        headers=headers,
    )
    assert analytics_after_prefetch.status_code == 200
    assert analytics_after_prefetch.json()["clicks"] == 0

    navigate_response = client.get(
        f"/{short_code}",
        follow_redirects=False,
        headers={
            "sec-fetch-mode": "navigate",
            "sec-fetch-dest": "document",
        },
    )
    assert navigate_response.status_code in [307, 308]

    analytics_after_navigation = client.get(
        f"/api/v1/urls/{short_code}/analytics",
        headers=headers,
    )
    assert analytics_after_navigation.status_code == 200
    assert analytics_after_navigation.json()["clicks"] == 1


def test_deactivate_url_blocks_redirect(client: TestClient):
    headers = auth_headers(client)

    create_response = create_url(client, headers)
    assert create_response.status_code == 200
    short_code = created_short_code(create_response)

    deactivate_response = client.patch(
        f"/api/v1/urls/{short_code}/deactivate",
        headers=headers,
    )

    assert deactivate_response.status_code == 200

    redirect_response = client.get(f"/{short_code}", follow_redirects=False)

    assert redirect_response.status_code == 410
    assert redirect_response.json()["detail"] == "URL Is Inactive"
    assert_no_store(redirect_response)


def test_activate_url_allows_redirect_again(client: TestClient):
    headers = auth_headers(client)

    create_response = create_url(client, headers)
    assert create_response.status_code == 200
    short_code = created_short_code(create_response)

    deactivate_response = client.patch(
        f"/api/v1/urls/{short_code}/deactivate",
        headers=headers,
    )
    assert deactivate_response.status_code == 200

    activate_response = client.patch(
        f"/api/v1/urls/{short_code}/activate",
        headers=headers,
    )
    assert activate_response.status_code == 200

    redirect_response = client.get(f"/{short_code}", follow_redirects=False)

    assert redirect_response.status_code in [307, 308]
    assert redirect_response.headers["location"] == "https://example.com/"


def test_create_url_requires_auth(client: TestClient):
    response = client.post(
        "/api/v1/urls/",
        json={
            "original_url": "https://example.com",
            "expires_at": None,
        },
    )

    assert response.status_code == 401


def test_user_cannot_view_other_users_analytics(client: TestClient):
    user_a_headers = auth_headers(client)

    create_response = create_url(client, user_a_headers)
    assert create_response.status_code == 200
    short_code = created_short_code(create_response)

    user_b_headers = auth_headers(client)
    analytics_response = client.get(
        f"/api/v1/urls/{short_code}/analytics",
        headers=user_b_headers,
    )

    assert analytics_response.status_code == 403
    assert analytics_response.json()["detail"] == "Invalid Access"


def test_user_cannot_deactivate_other_users_url(client: TestClient):
    user_a_headers = auth_headers(client)

    create_response = create_url(client, user_a_headers)
    assert create_response.status_code == 200
    short_code = created_short_code(create_response)

    user_b_headers = auth_headers(client)
    deactivate_response = client.patch(
        f"/api/v1/urls/{short_code}/deactivate",
        headers=user_b_headers,
    )

    assert deactivate_response.status_code == 403
    assert deactivate_response.json()["detail"] == "Invalid Access"


def test_user_cannot_delete_other_users_url(client: TestClient):
    user_a_headers = auth_headers(client)

    create_response = create_url(client, user_a_headers)
    assert create_response.status_code == 200
    short_code = created_short_code(create_response)

    user_b_headers = auth_headers(client)
    delete_response = client.delete(
        f"/api/v1/urls/{short_code}",
        headers=user_b_headers,
    )

    assert delete_response.status_code == 403
    assert delete_response.json()["detail"] == "Invalid Access"


def test_user_cannot_update_other_users_expiration(client: TestClient):
    user_a_headers = auth_headers(client)

    create_response = create_url(client, user_a_headers)
    assert create_response.status_code == 200
    short_code = created_short_code(create_response)

    user_b_headers = auth_headers(client)
    update_response = client.patch(
        f"/api/v1/urls/{short_code}/expiration",
        headers=user_b_headers,
        json={"expires_at": "2030-01-01T00:00:00"},
    )

    assert update_response.status_code == 403
    assert update_response.json()["detail"] == "Invalid Access"


def test_update_url_expiration(client: TestClient):
    headers = auth_headers(client)

    create_response = create_url(client, headers)
    assert create_response.status_code == 200
    short_code = created_short_code(create_response)

    update_response = client.patch(
        f"/api/v1/urls/{short_code}/expiration",
        headers=headers,
        json={"expires_at": "2030-01-01T00:00:00"},
    )

    assert update_response.status_code == 200
    data = update_response.json()
    assert data["message"] == "URL Expiry Updated"
    assert data["expires_at"].startswith("2030-01-01T00:00:00")


def test_updating_expiration_to_past_blocks_redirect(client: TestClient):
    headers = auth_headers(client)

    create_response = create_url(client, headers)
    assert create_response.status_code == 200
    short_code = created_short_code(create_response)

    initial_redirect_response = client.get(f"/{short_code}", follow_redirects=False)
    assert initial_redirect_response.status_code in [307, 308]

    update_response = client.patch(
        f"/api/v1/urls/{short_code}/expiration",
        headers=headers,
        json={"expires_at": "2020-01-01T00:00:00"},
    )
    assert update_response.status_code == 200

    redirect_response = client.get(f"/{short_code}", follow_redirects=False)

    assert redirect_response.status_code == 410
    assert redirect_response.json()["detail"] == "URL Has Expired"


def test_delete_url_removes_short_code(client: TestClient):
    headers = auth_headers(client)

    create_response = create_url(client, headers)
    assert create_response.status_code == 200
    short_code = created_short_code(create_response)

    delete_response = client.delete(
        f"/api/v1/urls/{short_code}",
        headers=headers,
    )

    assert delete_response.status_code == 200
    assert delete_response.json() == {"message": "URL Deleted"}

    redirect_response = client.get(f"/{short_code}", follow_redirects=False)

    assert redirect_response.status_code == 404
    assert redirect_response.json()["detail"] == "URL Not Found"


def test_delete_url_with_click_history_succeeds(client: TestClient):
    headers = auth_headers(client)

    create_response = create_url(client, headers)
    assert create_response.status_code == 200
    short_code = created_short_code(create_response)

    first_redirect = client.get(f"/{short_code}", follow_redirects=False)
    second_redirect = client.get(f"/{short_code}", follow_redirects=False)
    assert first_redirect.status_code in [307, 308]
    assert second_redirect.status_code in [307, 308]

    delete_response = client.delete(
        f"/api/v1/urls/{short_code}",
        headers=headers,
    )

    assert delete_response.status_code == 200
    assert delete_response.json() == {"message": "URL Deleted"}

    redirect_response = client.get(f"/{short_code}", follow_redirects=False)
    assert redirect_response.status_code == 404


def test_my_urls_does_not_include_other_users_urls(client: TestClient):
    user_a_headers = auth_headers(client)
    create_a_response = create_url(client, user_a_headers)
    assert create_a_response.status_code == 200
    user_a_short_code = created_short_code(create_a_response)

    user_b_headers = auth_headers(client)
    create_b_response = create_url(client, user_b_headers)
    assert create_b_response.status_code == 200
    user_b_short_code = created_short_code(create_b_response)

    my_urls_response = client.get("/api/v1/urls/my-urls", headers=user_a_headers)

    assert my_urls_response.status_code == 200
    short_codes = {url["short_code"] for url in my_urls_response.json()}
    assert user_a_short_code in short_codes
    assert user_b_short_code not in short_codes
