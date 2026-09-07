"""Export a restricted deterministic NIR subset (JSON)."""

from __future__ import annotations

import json
from pathlib import Path


def export_nir(graph: dict, path: str | Path) -> None:
    path = Path(path)
    nodes = graph.get("nodes") or []
    edges = graph.get("edges") or []
    id_to_idx = {n["id"]: i for i, n in enumerate(nodes)}
    payload = {
        "format": "synapsevm.nir.subset.v0",
        "nodes": [
            {"id": i, "type": "LIF", "flywireId": nodes[i].get("id")} for i in range(len(nodes))
        ],
        "edges": [
            {
                "pre": id_to_idx[e["pre"]],
                "post": id_to_idx[e["post"]],
                "weight": e["weight"],
            }
            for e in edges
            if e["pre"] in id_to_idx and e["post"] in id_to_idx
        ],
    }
    path.write_text(json.dumps(payload), encoding="utf-8")
