"""Normalize annotations + neurotransmitter/sign assumptions."""

from __future__ import annotations


def normalize(graph: dict) -> dict:
    nodes = graph.get("nodes") or []
    edges = graph.get("edges") or []
    normalized_nodes = []
    for n in nodes:
        normalized_nodes.append(
            {
                **n,
                "driveRole": (n.get("driveRole") or "other").lower(),
                "lobe": n.get("lobe") or "unknown",
            }
        )
    normalized_edges = []
    for e in edges:
        w = float(e.get("weight") or 0.0)
        normalized_edges.append({"pre": e["pre"], "post": e["post"], "weight": w, "sign": 1 if w >= 0 else -1})
    return {**graph, "nodes": normalized_nodes, "edges": normalized_edges}
