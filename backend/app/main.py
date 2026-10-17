from fastapi import FastAPI

from app.api import receipts

app = FastAPI(title="Tally")
app.include_router(receipts.router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
