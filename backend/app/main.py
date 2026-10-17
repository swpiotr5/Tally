import logging

from fastapi import FastAPI

from app.api import receipts

# Application logs (e.g. tokens and time per extraction) next to uvicorn's access log.
logging.basicConfig(level=logging.INFO, format="%(levelname)s:     %(name)s - %(message)s")

app = FastAPI(title="Tally")
app.include_router(receipts.router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
