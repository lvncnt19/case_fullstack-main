import asyncio
import json
from typing import Any, AsyncGenerator
from uuid import uuid4

from anyio import BrokenResourceError
from agent.agent import create_agent
from agent.context import AgentContext
from pydantic_ai import AgentRunResultEvent
from pydantic_ai.messages import (
    FunctionToolCallEvent,
    FunctionToolResultEvent,
    PartDeltaEvent,
    PartStartEvent,
    TextPart,
    TextPartDelta,
    ThinkingPart,
    ThinkingPartDelta,
    ToolReturnPart,
)

from backend.schemas import ChatRequest
from backend.services.datasets import load_datasets
from backend.services.events import (
    build_artifact_payload,
    extract_saved_path,
    parse_thinking,
    strip_tool_tags,
    sse_event,
)

SESSION_HISTORIES: dict[str, list[Any]] = {}
MAX_TOOL_RESULT_CHARS = 2000


def create_run_id() -> str:
    return str(uuid4())


def normalize_stream_error(exc: Exception) -> str:
    raw_message = str(exc).strip()
    lower_message = raw_message.lower()

    transient_markers = (
        "connection error",
        "incomplete chunked read",
        "peer closed connection",
        "timed out",
        "timeout",
        "connection reset",
    )
    if any(marker in lower_message for marker in transient_markers):
        return (
            "Provider temporarily unreachable (network/rate-limit). "
            "Please retry your request in a few seconds."
        )

    if raw_message:
        return raw_message
    return "Unexpected backend error while streaming."


async def stream_chat_events(req: ChatRequest, run_id: str) -> AsyncGenerator[str, None]:
    # On recharge les CSV au début de chaque run pour rester cohérent avec l'état disque.
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

    client_disconnected = False

    try:
        final_text = ""

        async for event in agent.run_stream_events(
            req.question,
            deps=context,
            message_history=history or None,
        ):
            if isinstance(event, PartStartEvent):
                if isinstance(event.part, ThinkingPart) and event.part.content:
                    # Le thinking est envoyé en delta pour un affichage progressif côté UI.
                    yield sse_event("thinking_delta", {"run_id": run_id, "delta": event.part.content})
                    await asyncio.sleep(0.05)
                    continue

                if isinstance(event.part, TextPart) and event.part.content:
                    final_text += event.part.content
                continue

            if isinstance(event, PartDeltaEvent):
                if isinstance(event.delta, ThinkingPartDelta) and event.delta.content_delta:
                    yield sse_event(
                        "thinking_delta",
                        {"run_id": run_id, "delta": event.delta.content_delta},
                    )
                    await asyncio.sleep(0.05)
                    continue

                if isinstance(event.delta, TextPartDelta) and event.delta.content_delta:
                    final_text += event.delta.content_delta
                continue

            if isinstance(event, FunctionToolCallEvent):
                part = event.part
                # Les args peuvent arriver en dict ou en JSON string selon le provider.
                args = (
                    part.args
                    if isinstance(part.args, dict)
                    else json.loads(part.args)
                    if isinstance(part.args, str)
                    else {}
                )
                yield sse_event(
                    "tool_call",
                    {"run_id": run_id, "tool_name": part.tool_name, "args": args},
                )
                await asyncio.sleep(0.05)
                continue

            if isinstance(event, FunctionToolResultEvent):
                result_part = event.result
                if not isinstance(result_part, ToolReturnPart):
                    continue

                content = str(result_part.content)
                truncated = len(content) > MAX_TOOL_RESULT_CHARS
                tool_name = result_part.tool_name or "tool_result"
                yield sse_event(
                    "tool_result",
                    {
                        "run_id": run_id,
                        "tool_name": tool_name,
                        "content": content[:MAX_TOOL_RESULT_CHARS],
                        "truncated": truncated,
                    },
                )

                saved_path = extract_saved_path(content)
                if saved_path:
                    # On convertit les outputs outils en artefacts rendables directement.
                    yield sse_event("artifact", build_artifact_payload(saved_path, run_id))

                await asyncio.sleep(0.05)
                continue

            if isinstance(event, AgentRunResultEvent):
                result = event.result
                SESSION_HISTORIES[session_id] = result.all_messages()
                if not final_text:
                    final_text = str(result.output or "")

        _, answer = parse_thinking(final_text)
        answer = strip_tool_tags(answer)
        yield sse_event("final", {"run_id": run_id, "text": answer})
    except (asyncio.CancelledError, BrokenResourceError):
        # Déconnexion client pendant le stream: on coupe sans logger d'erreur applicative.
        client_disconnected = True
        return
    except Exception as exc:
        yield sse_event("error", {"run_id": run_id, "message": normalize_stream_error(exc)})
    finally:
        if not client_disconnected:
            yield sse_event("done", {"run_id": run_id})
