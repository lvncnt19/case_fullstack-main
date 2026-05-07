import json
import os
import re
from pathlib import Path
from typing import Any

import pandas as pd


def parse_thinking(text: str) -> tuple[str, str]:
    # On isole le raisonnement interne pour ne pas le mélanger à la réponse finale.
    pattern = re.compile(r"<thinking>(.*?)</thinking>", re.DOTALL)
    thinking_parts = pattern.findall(text)
    thinking = "\n".join(t.strip() for t in thinking_parts if t.strip())
    clean_text = pattern.sub("", text).strip()
    return thinking, clean_text


def strip_tool_tags(text: str) -> str:
    # Certains petits modèles "simulent" des appels outils dans le texte.
    # On les retire pour garder une réponse finale propre côté utilisateur.
    clean_text = re.sub(r"<tool>.*?</tool>", "", text, flags=re.DOTALL)
    clean_text = re.sub(r"\n\s*\n+", "\n", clean_text)
    return clean_text.strip()


def sse_event(event: str, data: dict[str, Any]) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=True)}\n\n"


def extract_saved_path(content: str) -> str | None:
    match = re.search(r"Saved to:\s*(.+)", content)
    return match.group(1).strip() if match else None


def build_artifact_payload(saved_path: str, run_id: str) -> dict[str, Any]:
    artifact_type = "figure" if saved_path.endswith(".html") else "table"
    payload: dict[str, Any] = {
        "run_id": run_id,
        "artifact_type": artifact_type,
        "path": f"/{saved_path.replace(os.sep, '/')}",
        "title": Path(saved_path).stem.replace("_", " ").title(),
    }

    if artifact_type != "table":
        return payload

    csv_path = Path(saved_path)
    if not csv_path.exists():
        return payload

    try:
        table_df = pd.read_csv(csv_path)
        # Preview volontairement limitée pour éviter de surcharger le flux SSE.
        payload["columns"] = table_df.columns.tolist()
        payload["rows"] = table_df.head(25).values.tolist()
    except Exception:
        pass

    return payload
