# Shortlink API

A FastAPI URL shortener API with JWT auth, custom aliases, redirects, expiration handling, click analytics, Docker support, and Alembic migrations.

## Features

- User registration and login
- Swagger-compatible OAuth2 bearer auth
- Create short URLs with random codes or custom aliases
- Redirect short codes to original URLs
- Activate, deactivate, delete, and update expiration on URLs
- Click tracking and basic analytics
- Ownership checks on protected URL routes
- Alembic migration support
- Automated URL tests with `pytest`

## Tech Stack

- Python
- FastAPI
- SQLAlchemy
- PostgreSQL
- Alembic
- Pydantic
- JWT (`python-jose`)
- pytest
- Docker / Docker Compose

## Environment

Create a `.env` file from [.env.example](/Users/muhammad/Random_Projects/shortlink-api/.env.example):

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/shortlink_db
SECRET_KEY=change-this-in-production
```

For local SQLite development, a URL like `sqlite:///./shortlink.db` also works.

## Local Setup

Install dependencies in the project virtual environment:

```bash
./venv/bin/pip install -r requirements.txt
```

Run the database migrations:

```bash
./venv/bin/alembic upgrade head
```

Start the API:

```bash
./venv/bin/uvicorn app.main:app --reload
```

Open the docs at [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs).

## Swagger Auth

The `/docs` Authorize button uses OAuth2 password flow.

1. Register a user with `POST /api/v1/auth/register`
2. Click `Authorize`
3. Put your email in the `username` field
4. Put your password in the `password` field
5. Leave `client_id` and `client_secret` blank

## Useful Routes

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`
- `POST /api/v1/urls/`
- `GET /api/v1/urls/my-urls`
- `GET /api/v1/urls/{short_code}/analytics`
- `PATCH /api/v1/urls/{short_code}/deactivate`
- `PATCH /api/v1/urls/{short_code}/activate`
- `PATCH /api/v1/urls/{short_code}/expiration`
- `DELETE /api/v1/urls/{short_code}`
- `GET /{short_code}`

Delete behavior is a hard delete: deleting a short code removes the row and future redirects return `404`.

## Tests

Run the URL suite:

```bash
./venv/bin/python -m pytest -v tests/test_urls.py
```

Run all tests:

```bash
./venv/bin/python -m pytest -v
```

## Migrations

Create a new migration:

```bash
./venv/bin/alembic revision --autogenerate -m "describe change"
```

Apply migrations:

```bash
./venv/bin/alembic upgrade head
```

Rollback one migration:

```bash
./venv/bin/alembic downgrade -1
```

## Docker

Start the API and Postgres:

```bash
docker compose up --build
```

The API container runs `alembic upgrade head` before starting Uvicorn.

Service defaults:

- API: `http://localhost:8000`
- Postgres host port: `5433`

## Notes

- The app no longer creates tables automatically on startup; run migrations first.
- Datetime comparisons are normalized to UTC before expiration checks.
- Generated files like `*.db`, `.pytest_cache/`, `.DS_Store`, and `venv/` are ignored by Git.
