from fastapi import FastAPI

from app import models
from app.database import Base, engine
from app.routers import urls

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Shortlink API")

app.include_router(urls.router, prefix="/api/v1/urls", tags=["URLs"])


@app.get("/")
def root():
    return {"message": "Shortlink API is running"}