# URL Shortlink

URL Shortlink is a full-stack URL shortener project with a FastAPI backend, a React frontend, JWT authentication, click analytics, expiration controls, and Alembic migrations.

## Live Deployment

- Backend API: [https://shortlink-api-1.onrender.com](https://shortlink-api-1.onrender.com)
- Swagger docs: [https://shortlink-api-1.onrender.com/docs](https://shortlink-api-1.onrender.com/docs)

## What The Project Does

Users can register, log in, create short links, choose custom aliases, set expiration dates, view their own URLs, activate or deactivate links, delete links, and inspect click analytics.

The backend records clicks on real redirect requests and avoids counting speculative browser prefetch requests as analytics clicks.

## Current Features

- User registration
- User login with JWT bearer tokens
- Swagger-compatible OAuth2 password flow for `/docs`
- Protected user session endpoint
- Create short URLs with generated codes
- Create short URLs with custom aliases
- Redirect short URLs to original destinations
- Optional expiration dates
- Activate and deactivate URLs
- Delete URLs
- Update expiration dates
- User ownership checks on protected routes
- Click tracking
- Per-link analytics
- Alembic migrations
- Docker and Docker Compose setup
- Automated URL tests

## Tech Stack

### Backend

- Python 3.13
- FastAPI
- SQLAlchemy
- PostgreSQL
- Alembic
- Pydantic
- `python-jose`
- `passlib`

### Frontend

- React 18
- TypeScript
- Vite
- Tailwind CSS
- React Router

### Testing

- pytest
- FastAPI TestClient
- httpx

## Repository Structure

```text
shortlink-api/
├── app/
│   ├── main.py
│   ├── database.py
│   ├── models.py
│   ├── schemas.py
│   ├── routers/
│   │   ├── auth.py
│   │   └── urls.py
│   ├── services/
│   │   ├── security.py
│   │   └── url_service.py
│   └── utils/
│       └── short_code.py
├── alembic/
│   └── versions/
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   ├── auth/
│   │   ├── components/
│   │   ├── lib/
│   │   └── pages/
│   └── package.json
├── tests/
├── Dockerfile
├── docker-compose.yml
├── alembic.ini
├── requirements.txt
└── readme.md
```

## API Overview

### Auth Routes

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`

### URL Routes

- `POST /api/v1/urls/`
- `GET /api/v1/urls/my-urls`
- `GET /api/v1/urls/{short_code}/analytics`
- `PATCH /api/v1/urls/{short_code}/deactivate`
- `PATCH /api/v1/urls/{short_code}/activate`
- `PATCH /api/v1/urls/{short_code}/expiration`
- `DELETE /api/v1/urls/{short_code}`

### Redirect Route

- `GET /{short_code}`

## Authentication Notes

The backend uses bearer tokens.

For Swagger:

1. Open `/docs`
2. Register a user with `POST /api/v1/auth/register`
3. Click `Authorize`
4. Put your email in the `username` field
5. Put your password in the `password` field
6. Leave `client_id` and `client_secret` blank

Swagger uses OAuth2 password flow, so `/api/v1/auth/login` expects form data in the docs flow, not JSON.

## Environment Variables

Use [.env.example](/Users/muhammad/Random_Projects/shortlink-api/.env.example) as the template.

Current expected variables:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/shortlink_db
SECRET_KEY=change-this-in-production
BASE_URL=http://localhost:8000
CORS_ALLOWED_ORIGINS=http://localhost:5173,https://shortlink-api-1.onrender.com
```

### Variable Meanings

- `DATABASE_URL`: SQLAlchemy database connection string
- `SECRET_KEY`: JWT signing secret
- `BASE_URL`: base URL used when building returned `short_url` values
- `CORS_ALLOWED_ORIGINS`: comma-separated list of allowed frontend origins

## Backend Local Setup

### 1. Create and activate a virtual environment

```bash
python3 -m venv venv
source venv/bin/activate
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Configure environment variables

Create a `.env` file:

```bash
cp .env.example .env
```

Then adjust the values for your machine and database.

### 4. Run migrations

```bash
alembic upgrade head
```

### 5. Start the API

```bash
uvicorn app.main:app --reload
```

Local backend endpoints:

- API root: [http://127.0.0.1:8000](http://127.0.0.1:8000)
- Swagger docs: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

## Frontend Local Setup

The frontend lives in [frontend/](/Users/muhammad/Random_Projects/shortlink-api/frontend).

### 1. Install frontend dependencies

```bash
cd frontend
npm install
```

### 2. Configure the API base URL if needed

The frontend defaults to the deployed backend:

```ts
https://shortlink-api-1.onrender.com
```

For local backend development, set:

```bash
VITE_API_BASE_URL=http://localhost:8000
```

You can do that in a frontend `.env` file or in your shell before starting Vite.

### 3. Start the frontend

```bash
npm run dev
```

Typical local frontend URL:

- [http://localhost:5173](http://localhost:5173)

## Running Tests

Run the full test suite from the project root:

```bash
./venv/bin/python -m pytest -q
```

Run the URL-focused suite only:

```bash
./venv/bin/python -m pytest -v tests/test_urls.py
```

At the time of this update, the current URL suite passes locally.

## Migrations

Alembic is part of the repository and should be committed along with schema changes.

### Create a new migration

```bash
alembic revision --autogenerate -m "describe change"
```

### Apply migrations

```bash
alembic upgrade head
```

### Roll back one revision

```bash
alembic downgrade -1
```

### Important note for older local databases

If your database tables were created before Alembic was introduced, `alembic upgrade head` may fail because the tables already exist.

In that case, if the schema already matches the initial migration, you can mark it as migrated with:

```bash
alembic stamp head
```

Only do that if you are sure the existing schema matches the migration history you want Alembic to track.

## Docker

The monorepo has separate Docker builds for each app:

- Backend API: [Dockerfile.backend](/Users/muhammad/Random_Projects/shortlink-api/Dockerfile.backend)
- Frontend app: [frontend/Dockerfile](/Users/muhammad/Random_Projects/shortlink-api/frontend/Dockerfile)

### Start frontend, backend, and Postgres

```bash
docker compose up --build
```

The API container runs migrations before starting Uvicorn. The frontend container builds the Vite app and serves it with Nginx.

Default ports:

- API: `8000`
- Frontend: `5173`
- Postgres host port: `5433`

### Start only one app

```bash
docker compose up --build api
docker compose up --build frontend
```

## Current Behavior Notes

- Delete is a hard delete, not a soft delete
- Deleting a URL also removes its associated click records through cascade behavior
- Expired URLs return `410`
- Inactive URLs return `410`
- Missing URLs return `404`
- Invalid tokens return `401`
- Analytics are ownership-protected
- Speculative prefetch-style requests are not counted as user clicks

## Deployment Notes

The backend is currently deployed on Render at:

- [https://shortlink-api-1.onrender.com](https://shortlink-api-1.onrender.com)

If you deploy a new backend URL later, update:

- this README
- `frontend/src/api/config.ts`
- `CORS_ALLOWED_ORIGINS`
- `BASE_URL` where applicable

## Known Follow-Up Areas

These are reasonable future improvements, but they are not required for the current app to run:

- broader backend test coverage beyond URL-focused tests
- frontend deployment documentation
- CI checks for migrations plus frontend build
- more detailed analytics dimensions beyond total clicks and last clicked time

## Authors

- Muhammad Sayed
- Brandon Kochnari
