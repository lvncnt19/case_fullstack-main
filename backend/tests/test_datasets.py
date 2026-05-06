from pathlib import Path

from backend.services.datasets import load_datasets


def test_load_datasets_reads_csv_files_and_builds_info(tmp_path: Path) -> None:
    (tmp_path / "Sales Data.csv").write_text(
        "region,amount\nEU,100\nUS,200\n",
        encoding="utf-8",
    )

    datasets, info = load_datasets(str(tmp_path))

    assert "sales_data" in datasets
    assert datasets["sales_data"].shape == (2, 2)
    assert "sales_data" in info
    assert "region, amount" in info


def test_load_datasets_returns_empty_when_directory_is_missing(tmp_path: Path) -> None:
    missing_dir = tmp_path / "does-not-exist"
    datasets, info = load_datasets(str(missing_dir))

    assert datasets == {}
    assert info == "No datasets available."
