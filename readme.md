# Shortlink

Shortlink is a full-stack URL shortener with authenticated link management, click analytics, expiration controls, and production deployments for both the frontend and backend.

## Live Application

- Frontend: [https://urlshortlink.xyz/dashboard](https://urlshortlink.xyz/dashboard)
- Backend API: [https://shortlink-c8sm.onrender.com](https://shortlink-c8sm.onrender.com)
- API docs: [https://shortlink-c8sm.onrender.com/docs](https://shortlink-c8sm.onrender.com/docs)

## Overview

Authenticated users can:

- register and log in
- create shortened URLs with auto-generated short codes
- set optional expiration dates
- view all links they own
- activate or deactivate links
- delete links
- inspect per-link analytics, including total clicks and last click time

Shortlink uses a React frontend for the product UI and a FastAPI backend for authentication, URL management, redirect handling, analytics, and persistence.

## Stack

### Frontend

- React 18
- TypeScript
- Vite
- React Router
- Tailwind CSS
- PostCSS
- Fetch API
- Nginx for the containerized frontend
- Vercel-style rewrite configuration plus a custom domain

### Backend

- Python 3
- FastAPI
- SQLAlchemy
- PostgreSQL
- Alembic
- Pydantic
- `python-jose` for JWT auth
- `passlib` for password hashing
- `python-multipart` for OAuth2 form parsing
- `slowapi` for rate limiting
- Uvicorn

### Infrastructure

- Render for the deployed backend
- Docker
- Docker Compose

### Testing

- pytest
- FastAPI `TestClient`
- httpx

## Product Behavior

- Short codes are generated automatically.
- Custom aliases are not part of the current product.
- Redirects respect both activation status and expiration.
- Expired links return `410 Gone`.
- Missing links return `404 Not Found`.
- Invalid bearer tokens return `401`.
- Delete operations cascade to related click records.
- Redirect analytics skip speculative browser requests to reduce double counting.

## Repository Layout

```text
shortlink-api/
├── alembic/
│   └── versions/
├── app/
│   ├── routers/
│   ├── services/
│   ├── utils/
│   ├── database.py
│   ├── main.py
│   ├── models.py
│   └── schemas.py
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── api/
│   │   ├── auth/
│   │   ├── components/
│   │   ├── lib/
│   │   └── pages/
│   ├── Dockerfile
│   ├── nginx.conf
│   └── vercel.json
├── scripts/
├── tests/
├── alembic.ini
├── docker-compose.yml
├── Dockerfile
├── Dockerfile.backend
├── requirements.txt
└── readme.md
```

## API Surface

### Auth

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`

### URLs

- `POST /api/v1/urls/`
- `GET /api/v1/urls/my-urls`
- `GET /api/v1/urls/{short_code}/analytics`
- `PATCH /api/v1/urls/{short_code}/activate`
- `PATCH /api/v1/urls/{short_code}/deactivate`
- `PATCH /api/v1/urls/{short_code}/expiration`
- `DELETE /api/v1/urls/{short_code}`

### Redirect

- `GET /{short_code}`

## Authentication Notes

The backend uses JWT bearer tokens.

Swagger is configured with OAuth2 password flow. In `/docs`:

1. Register a user.
2. Click `Authorize`.
3. Enter the account email in the `username` field.
4. Enter the password in the `password` field.
5. Leave `client_id` and `client_secret` blank.

## Environment Variables

Use [.env.example](/Users/muhammad/Random_Projects/shortlink-api/.env.example) as the starting point.

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/shortlink_db
SECRET_KEY=change-this-in-production
PUBLIC_BASE_URL=http://localhost:5173
CORS_ALLOWED_ORIGINS=http://localhost:5173,https://urlshortlink.xyz,https://www.urlshortlink.xyz
```

### Backend variables

- `DATABASE_URL`: database connection string used by SQLAlchemy and Alembic
- `SECRET_KEY`: signing key for JWT creation and validation
- `PUBLIC_BASE_URL`: base URL used when the API returns `short_url`
- `CORS_ALLOWED_ORIGINS`: comma-separated frontend origins allowed to call the API

### Frontend variables

- `VITE_API_BASE_URL`: API base URL used by the frontend build

The frontend also supports runtime injection through `frontend/public/runtime-config.js`, which is populated by `frontend/docker-entrypoint.sh` in container deployments.

## Local Development

### Backend setup

1. Create and activate a virtual environment:

```bash
python3 -m venv venv
source venv/bin/activate
```

2. Install backend dependencies:

```bash
pip install -r requirements.txt
```

3. Create a local environment file:

```bash
cp -n .env.example .env
```

If `.env` already exists, do not overwrite it unless you intentionally want to replace your working local settings.

4. Run database migrations:

```bash
alembic upgrade head
```

5. Start the backend:

```bash
uvicorn app.main:app --reload
```

Local backend URLs:

- API: [http://127.0.0.1:8000](http://127.0.0.1:8000)
- Docs: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

### Frontend setup

1. Install frontend dependencies:

```bash
cd frontend
npm ci
```

2. Point the frontend at the local API:

```bash
VITE_API_BASE_URL=http://127.0.0.1:8000
```

Use `127.0.0.1:8000` for local development. The repo also contains production runtime config for deployed environments, so setting `VITE_API_BASE_URL` explicitly keeps the local frontend pointed at your local backend.

3. Start the frontend:

```bash
VITE_API_BASE_URL=http://127.0.0.1:8000 npm run dev
```

Typical local frontend URL:

- [http://localhost:5173](http://localhost:5173)

### Recommended local startup flow

Terminal 1, backend:

```bash
cd /Users/muhammad/Random_Projects/shortlink-api
source venv/bin/activate
./venv/bin/alembic upgrade head
./venv/bin/uvicorn app.main:app --reload
```

Terminal 2, frontend:

```bash
cd /Users/muhammad/Random_Projects/shortlink-api/frontend
npm ci
VITE_API_BASE_URL=http://127.0.0.1:8000 npm run dev
```

Then open:

- frontend: [http://localhost:5173](http://localhost:5173)
- backend docs: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

## Docker

Run the full local stack with:

```bash
docker compose up --build
```

This starts:

- PostgreSQL
- the FastAPI backend
- the frontend served through Nginx

Default local ports:

- frontend: `5173`
- backend: `8000`
- PostgreSQL: `5433`

The backend containers run `alembic upgrade head` before starting Uvicorn.

## Migrations

Create a migration:

```bash
alembic revision --autogenerate -m "describe change"
```

Apply migrations:

```bash
alembic upgrade head
```

Roll back one revision:

```bash
alembic downgrade -1
```

If an older local database already has tables but no Alembic history, mark it as current only if the schema already matches:

```bash
alembic stamp head
```

## Testing

Run all backend tests:

```bash
./venv/bin/python -m pytest -q
```

Run the URL-focused suite:

```bash
./venv/bin/python -m pytest -v tests/test_urls.py
```

Run the frontend production build check:

```bash
cd frontend
npm run build
```

## Helper Scripts

The `scripts/` folder includes local convenience scripts such as:

- `scripts/start_dev.sh`
- `scripts/reset_docker.sh`
- `scripts/run_tests.sh`

`scripts/run_tests.sh` supports both Unix-style and Windows-style virtual environment layouts.

## Deployment Notes

- The production frontend runs on [https://urlshortlink.xyz](https://urlshortlink.xyz).
- The production backend runs on [https://shortlink-c8sm.onrender.com](https://shortlink-c8sm.onrender.com).
- The frontend defaults, runtime config, Docker config, and backend CORS settings are aligned to the current production URLs.

## Authors

- Muhammad Sayed
- Brandon Kochnari
