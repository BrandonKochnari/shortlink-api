from fastapi import FastAPI

from app import models
from app.database import Base, engine
from app.routers import urls, auth

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Shortlink API")

app.include_router(urls.router, prefix="/api/v1/urls", tags=["URLs"])
app.include_router(
    auth.router,
    prefix="/api/v1/auth",
    tags=["Auth"]
)

@app.get("/")

def root():
    return {"message": "Shortlink API is running"}