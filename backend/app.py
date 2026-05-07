import asyncio
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from backend.schemas import ChatRequest
from backend.services.chat_stream import create_run_id, stream_chat_events

load_dotenv()

app = FastAPI(title="Case Fullstack API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

OUTPUT_DIR = Path("output")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/output", StaticFiles(directory=str(OUTPUT_DIR)), name="output")

@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/chat/stream")
async def chat_stream(req: ChatRequest, request: Request) -> StreamingResponse:
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
