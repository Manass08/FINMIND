
from fastapi import FastAPI

app = FastAPI(
    title="FINMIND API",
    description="Financial Intelligence and Risk Platform",
    version="0.1.0",
)


@app.get("/")
def home():
    return {
        "message": "FINMIND API is running!",
        "project": "FINMIND",
        "version": "0.1.0",
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
    }
