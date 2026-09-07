"""Fetch neuron IDs + directed weighted edges (FlyWire ARCHIVE fixture for Phase 1)."""

from __future__ import annotations

import json
from pathlib import Path


def fetch_circuit(query: str | None = None, path: str | Path | None = None) -> dict:
    """Load a local circuit JSON. Live neuPrint queries land later."""
    if path is None:
        root = Path(__file__).resolve().parents[2]
        path = root.parent / "ARCHIVE" / "packages" / "snn" / "circuit.json"
    path = Path(path)
    with path.open(encoding="utf-8") as f:
        data = json.load(f)
    if query:
        data["_query"] = query
    return data
