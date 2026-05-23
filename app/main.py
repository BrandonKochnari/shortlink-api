from fastapi import FastAPI

app = FastAPI(title="Shortlink API")


@app.get("/")
def root():
    return {"message": "Shortlink API is running"}