"""Map connectivity weights → fixed-point synaptic weights (Q16.16)."""

from __future__ import annotations

ONE = 1 << 16


def quantize_weights(
    edges: list[tuple[int, int, float]], scale: float = 0.05
) -> list[tuple[int, int, int]]:
    out: list[tuple[int, int, int]] = []
    for pre, post, w in edges:
        q = int(round(float(w) * scale * ONE))
        q = max(-4 * ONE, min(4 * ONE, q))
        out.append((pre, post, q))
    return out
