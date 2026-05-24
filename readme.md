# URL Shortener API

A production-style URL shortener API built with FastAPI and PostgreSQL. The API supports user authentication, custom short links, expiration dates, redirect tracking, click analytics, rate limiting, and automated tests.

## Features

- User registration and login
- JWT-based authentication
- Create shortened URLs
- Generate random short codes
- Support custom aliases
- Set optional expiration dates
- Redirect short links to original URLs
- Track link clicks
- View analytics for each link
- List, update, and deactivate user links
- Rate limiting for protected endpoints
- PostgreSQL database
- Automated tests with pytest
- Docker support

## Tech Stack

- Python
- FastAPI
- PostgreSQL
- SQLAlchemy
- Pydantic
- Alembic
- JWT authentication
- pytest
- Docker

## Project Structure

```text
url-shortener-api/
│
├── app/
│   ├── main.py
│   ├── config.py
│   ├── database.py
│   ├── models.py
│   ├── schemas.py
│   ├── dependencies.py
│   │
│   ├── routers/
│   │   ├── auth.py
│   │   ├── urls.py
│   │   └── analytics.py
│   │
│   ├── services/
│   │   ├── auth_service.py
│   │   ├── url_service.py
│   │   └── analytics_service.py
│   │
│   └── utils/
│       ├── security.py
│       └── short_code.py
│
├── tests/
│   ├── test_auth.py
│   ├── test_urls.py
│   └── test_analytics.py
│
├── alembic/
├── .env.example
├── .gitignore
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
└── README.md
```

Muhammad Sayed, Brandon Kochnari
Date: 5/23/2026


