import asyncio
import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, Header, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from backend.schemas import ChatRequest
from backend.services.chat_stream import create_run_id, stream_chat_events

load_dotenv()

def parse_cors_origins(raw_origins: str) -> list[str]:
    origins = [origin.strip() for origin in raw_origins.split(",")]
    return [origin for origin in origins if origin]


CORS_ORIGINS = parse_cors_origins(os.getenv("CORS_ORIGINS", "http://localhost:5173"))

app = FastAPI(title="Case Fullstack API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

OUTPUT_DIR = Path("output")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/output", StaticFiles(directory=str(OUTPUT_DIR)), name="output")
API_AUTH_TOKEN = os.getenv("API_AUTH_TOKEN", "").strip()

@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/chat/stream")
async def chat_stream(
    req: ChatRequest,
    request: Request,
    authorization: str | None = Header(default=None),
) -> StreamingResponse:
    if not API_AUTH_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="API_AUTH_TOKEN is not configured on backend.",
        )

    expected = f"Bearer {API_AUTH_TOKEN}"
    if authorization != expected:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized. Provide a valid Bearer token.",
        )

    run_id = create_run_id()

    async def stream_with_disconnect_guard() -> object:
        try:
            async for event in stream_chat_events(req, run_id):
                if await request.is_disconnected():
                    break
                yield event
        except asyncio.CancelledError:
            return

    return StreamingResponse(stream_with_disconnect_guard(), media_type="text/event-stream")
