from pathlib import Path

from backend.services.events import (
    build_artifact_payload,
    extract_saved_path,
    parse_thinking,
)


def test_parse_thinking_removes_tags_and_returns_clean_answer() -> None:
    text = "<thinking>step 1</thinking>\nFinal answer"
    thinking, answer = parse_thinking(text)

    assert thinking == "step 1"
    assert answer == "Final answer"


def test_extract_saved_path_returns_path_when_present() -> None:
    content = "Query done. Saved to: output/result.csv"
    assert extract_saved_path(content) == "output/result.csv"


def test_build_artifact_payload_for_table_includes_preview(tmp_path: Path) -> None:
    csv_path = tmp_path / "sample.csv"
    csv_path.write_text("col_a,col_b\n1,2\n3,4\n", encoding="utf-8")

    payload = build_artifact_payload(str(csv_path), run_id="run-1")

    assert payload["artifact_type"] == "table"
    assert payload["run_id"] == "run-1"
    assert payload["columns"] == ["col_a", "col_b"]
    assert payload["rows"] == [[1, 2], [3, 4]]
