import asyncio
import json
import os
import re
from pathlib import Path
from typing import Any, AsyncGenerator
from uuid import uuid4

import pandas as pd
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from agent.agent import create_agent
from agent.context import AgentContext

load_dotenv()

app = FastAPI(title="Case Fullstack API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

OUTPUT_DIR = Path("output")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/output", StaticFiles(directory=str(OUTPUT_DIR)), name="output")

SESSION_HISTORIES: dict[str, list[Any]] = {}


class ChatRequest(BaseModel):
    question: str = Field(min_length=1)
    session_id: str | None = None
    mock: bool = True


def load_datasets(data_dir: str = "data") -> tuple[dict[str, pd.DataFrame], str]:
    data_path = Path(data_dir)
    if not data_path.exists():
        return {}, "No datasets available."

    datasets: dict[str, pd.DataFrame] = {}
    info_lines: list[str] = []

    for csv_file in sorted(data_path.glob("*.csv")):
        name = re.sub(r"[^a-zA-Z0-9_]", "_", csv_file.stem).strip("_").lower()
        df = pd.read_csv(csv_file)
        datasets[name] = df
        cols = ", ".join(df.columns.tolist())
        info_lines.append(
            f"- **{name}** ({df.shape[0]} rows, {df.shape[1]} columns)\n  Columns: {cols}"
        )

    if not info_lines:
        return {}, "No datasets available. Add CSV files to the data/ directory."
    return datasets, "\n".join(info_lines)


def parse_thinking(text: str) -> tuple[str, str]:
    pattern = re.compile(r"<thinking>(.*?)</thinking>", re.DOTALL)
    thinking_parts = pattern.findall(text)
    thinking = "\n".join(t.strip() for t in thinking_parts if t.strip())
    clean_text = pattern.sub("", text).strip()
    return thinking, clean_text


def sse_event(event: str, data: dict[str, Any]) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=True)}\n\n"


def extract_saved_path(content: str) -> str | None:
    match = re.search(r"Saved to:\s*(.+)", content)
    return match.group(1).strip() if match else None


async def stream_mock(req: ChatRequest, run_id: str) -> AsyncGenerator[str, None]:
    session_id = req.session_id or str(uuid4())
    yield sse_event("session", {"session_id": session_id, "run_id": run_id})
    await asyncio.sleep(0.2)

    thinking = [
        "Je dois identifier la table la plus pertinente pour repondre.",
        "Je calcule ensuite une aggregation simple pour obtenir un insight lisible.",
        "Je prepare enfin une visualisation claire pour l'utilisateur.",
    ]
    for chunk in thinking:
        yield sse_event("thinking_delta", {"run_id": run_id, "delta": chunk + "\n"})
        await asyncio.sleep(0.25)

    args = {
        "sql": "SELECT Contract, COUNT(*) AS clients FROM telcoclient GROUP BY Contract ORDER BY clients DESC",
        "description": "Compter le nombre de clients par type de contrat",
    }
    yield sse_event("tool_call", {"run_id": run_id, "tool_name": "query_data", "args": args})
    await asyncio.sleep(0.2)
    yield sse_event(
        "tool_result",
        {
            "run_id": run_id,
            "tool_name": "query_data",
            "content": "Query executed successfully. Result: 3 rows x 2 columns",
        },
    )
    await asyncio.sleep(0.2)
    yield sse_event(
        "tool_call",
        {
            "run_id": run_id,
            "tool_name": "visualize",
            "args": {
                "title": "Distribution des contrats",
                "result_type": "figure",
                "description": "Comparer les volumes de clients par contrat",
            },
        },
    )
    await asyncio.sleep(0.2)
    yield sse_event(
        "artifact",
        {
            "run_id": run_id,
            "artifact_type": "figure_json",
            "title": "Distribution des contrats",
            "figure": {
                "data": [
                    {
                        "type": "bar",
                        "x": ["Month-to-month", "Two year", "One year"],
                        "y": [3875, 1695, 1473],
                    }
                ],
                "layout": {"template": "plotly_white", "xaxis": {"title": "Contract"}, "yaxis": {"title": "Clients"}},
            },
        },
    )
    await asyncio.sleep(0.2)

    yield sse_event(
        "artifact",
        {
            "run_id": run_id,
            "artifact_type": "table",
            "title": "Clients par contrat",
            "columns": ["Contract", "clients"],
            "rows": [
                ["Month-to-month", 3875],
                ["Two year", 1695],
                ["One year", 1473],
            ],
        },
    )
    await asyncio.sleep(0.2)

    yield sse_event(
        "final",
        {
            "run_id": run_id,
            "text": "La majorite des clients sont en contrat month-to-month, ce qui indique un risque de churn plus eleve. Une strategie de migration vers des contrats annuels pourrait ameliorer la retention.",
        },
    )
    yield sse_event("done", {"run_id": run_id})


async def stream_real(req: ChatRequest, run_id: str) -> AsyncGenerator[str, None]:
    from pydantic_ai.messages import (
        ModelRequest,
        ModelResponse,
        TextPart,
        ToolCallPart,
        ToolReturnPart,
    )

    datasets, dataset_info = load_datasets()
    session_id = req.session_id or str(uuid4())
    yield sse_event("session", {"session_id": session_id, "run_id": run_id})

    if not datasets:
        yield sse_event("error", {"run_id": run_id, "message": "No CSV files found in data/."})
        yield sse_event("done", {"run_id": run_id})
        return

    agent = create_agent(dataset_info)
    context = AgentContext(datasets=datasets, dataset_info=dataset_info)
    history = SESSION_HISTORIES.get(session_id, [])

    try:
        last_tool_name = ""
        result = await agent.run(
            req.question,
            deps=context,
            message_history=history or None,
        )
        all_msgs = result.all_messages()
        new_msgs = all_msgs[len(history) :]

        for msg in new_msgs:
            if isinstance(msg, ModelResponse):
                for part in msg.parts:
                    if isinstance(part, TextPart) and part.content.strip():
                        thinking, _ = parse_thinking(part.content)
                        if thinking:
                            yield sse_event(
                                "thinking_delta",
                                {"run_id": run_id, "delta": thinking + "\n"},
                            )
                            await asyncio.sleep(0.05)
                    elif isinstance(part, ToolCallPart):
                        last_tool_name = part.tool_name
                        args = (
                            part.args
                            if isinstance(part.args, dict)
                            else json.loads(part.args)
                            if isinstance(part.args, str)
                            else {}
                        )
                        yield sse_event(
                            "tool_call",
                            {
                                "run_id": run_id,
                                "tool_name": part.tool_name,
                                "args": args,
                            },
                        )
                        await asyncio.sleep(0.05)

            elif isinstance(msg, ModelRequest):
                for part in msg.parts:
                    if isinstance(part, ToolReturnPart):
                        content = str(part.content)
                        yield sse_event(
                            "tool_result",
                            {
                                "run_id": run_id,
                                "tool_name": last_tool_name or "tool_result",
                                "content": content[:2000],
                            },
                        )
                        saved_path = extract_saved_path(content)
                        if saved_path:
                            artifact_type = "figure" if saved_path.endswith(".html") else "table"
                            artifact_payload: dict[str, Any] = {
                                "run_id": run_id,
                                "artifact_type": artifact_type,
                                "path": f"/{saved_path.replace(os.sep, '/')}",
                                "title": Path(saved_path).stem.replace("_", " ").title(),
                            }
                            # If the tool generated a CSV table, include a preview directly
                            # in the stream so the frontend can render it immediately.
                            if artifact_type == "table":
                                csv_path = Path(saved_path)
                                if csv_path.exists():
                                    try:
                                        table_df = pd.read_csv(csv_path)
                                        artifact_payload["columns"] = table_df.columns.tolist()
                                        artifact_payload["rows"] = table_df.head(25).values.tolist()
                                    except Exception:
                                        pass
                            yield sse_event(
                                "artifact",
                                artifact_payload,
                            )
                        await asyncio.sleep(0.05)

        _, answer = parse_thinking(result.output)
        yield sse_event("final", {"run_id": run_id, "text": answer})
        SESSION_HISTORIES[session_id] = all_msgs
    except Exception as exc:
        yield sse_event("error", {"run_id": run_id, "message": str(exc)})
    finally:
        yield sse_event("done", {"run_id": run_id})


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/chat/stream")
async def chat_stream(req: ChatRequest) -> StreamingResponse:
    run_id = str(uuid4())
    generator = stream_mock(req, run_id) if req.mock else stream_real(req, run_id)
    return StreamingResponse(generator, media_type="text/event-stream")
