"""Package FlowSense / HeadingCell / TargetTrack NeuroBlocks (+ scenarios)."""

from __future__ import annotations

import json
import struct
from pathlib import Path

from .package_block import canonical_json, hex0x, keccak256, q16


def csr_chain(n: int, weight: float = 0.5):
    offsets = [0]
    pres: list[int] = []
    weights: list[int] = []
    for post in range(n):
        if post > 0:
            pres.append(post - 1)
            weights.append(q16(weight))
        offsets.append(len(pres))
    return offsets, pres, weights


def package_engineered(
    name: str,
    version: str,
    out_dir: Path,
    n: int,
    inputs: list[str],
    outputs: list[str],
    provenance_note: str,
):
    offsets, pres, weights = csr_chain(n)
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "adapters").mkdir(exist_ok=True)
    (out_dir / "test-vectors").mkdir(exist_ok=True)

    topology = (
        struct.pack("<I", n)
        + struct.pack(f"<{n + 1}I", *offsets)
        + struct.pack(f"<{len(pres)}I", *pres)
    )
    (out_dir / "topology.bin").write_bytes(topology)
    (out_dir / "weights.bin").write_bytes(struct.pack(f"<{len(weights)}i", *weights))

    leak, thr, reset = q16(0.9), q16(1.0), 0
    input_channels = [{"name": inp, "targets": [min(i, n - 1)]} for i, inp in enumerate(inputs)]

    if name == "FlowSense":
        output_channels = {
            "danger": [],
            "avoidLeft": [n // 4],
            "avoidRight": [n // 2],
            "avoidY": [3 * n // 4],
            "trigger": [n - 1],
        }
    elif name == "HeadingCell":
        output_channels = {
            "danger": [],
            "avoidLeft": [1],
            "avoidRight": [2],
            "avoidY": [],
            "trigger": [n - 1],
        }
    else:
        output_channels = {
            "danger": [n - 1],
            "avoidLeft": [n // 3],
            "avoidRight": [2 * n // 3],
            "avoidY": [n // 2],
            "trigger": [n - 1],
        }

    block = {
        "schema": "synapsevm.blockbytes.v1",
        "name": name,
        "version": version,
        "neuronCount": n,
        "csrOffsets": offsets,
        "csrPres": press if False else pres,
        "csrWeights": weights,
        "leak": leak,
        "threshold": thr,
        "reset": reset,
        "inputChannels": input_channels,
        "outputChannels": output_channels,
        "triggerThreshold": q16(0.1),
        "flywireIds": [],
        "engineeredOutputs": outputs,
    }
    # tidy
    block["csrPres"] = pres

    raw = json.dumps(block)
    (out_dir / "block.json").write_text(raw, encoding="utf-8")
    block_hash = keccak256(raw.encode())

    provenance = {
        "connectomicProvenance": {"note": provenance_note},
        "computationalDynamics": {"neuronModel": "LIF_FIXED_V1", "numericFormat": "Q16.16"},
        "adapterSemantics": {"inputs": inputs, "outputs": outputs},
    }
    (out_dir / "provenance.json").write_text(json.dumps(provenance, indent=2), encoding="utf-8")
    (out_dir / "adapters" / "input.json").write_text(
        json.dumps({"ports": inputs}, indent=2), encoding="utf-8"
    )
    (out_dir / "adapters" / "output.json").write_text(
        json.dumps({"ports": outputs}, indent=2), encoding="utf-8"
    )

    for i in range(20):
        case = {
            "id": f"case-{i + 1:03d}",
            "input": [q16(0.1 * ((i % 5) + 1))] * len(inputs),
            "ticks": 8,
        }
        (out_dir / "test-vectors" / f"{case['id']}.input.json").write_text(
            json.dumps(case), encoding="utf-8"
        )

    body = {
        "schema": "synapsevm.neuroblock.v1",
        "name": name,
        "version": version,
        "description": f"{name} NeuroBlock",
        "organism": "Drosophila melanogaster",
        "sourceDataset": "engineered-or-fragment",
        "neuronModel": "LIF_FIXED_V1",
        "numericFormat": "Q16.16",
        "tickUs": 1000,
        "inputs": inputs,
        "outputs": outputs,
        "deadlineUs": 10000,
        "priorityClass": "nominal",
        "stateful": True,
        "neuronCount": n,
        "synapseCount": len(pres),
        "blockBytesSha256": hex0x(block_hash),
    }
    root = keccak256(canonical_json(body) + block_hash)
    manifest = {**body, "blockRoot": hex0x(root)}
    (out_dir / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    (out_dir / "benchmarks.json").write_text(
        json.dumps(
            {"status": "pending_measurement", "neuronCount": n, "synapseCount": len(pres)},
            indent=2,
        ),
        encoding="utf-8",
    )
    print(f"Packaged {name}@{version} n={n} root={hex0x(root)}")
    return hex0x(root)


def main():
    root = Path(__file__).resolve().parents[2]
    package_engineered(
        "FlowSense",
        "1.0.0",
        root / "blocks" / "flowsense" / "1.0.0",
        64,
        ["event_vision"],
        ["flowX", "flowY", "rotation", "confidence"],
        "Engineered optic-flow primitive (honest non-connectome topology)",
    )
    package_engineered(
        "HeadingCell",
        "1.0.0",
        root / "blocks" / "headingcell" / "1.0.0",
        48,
        ["yawDelta", "opticFlowRotation", "targetBearing"],
        ["headingEstimate", "headingError", "steer"],
        "CX/heading-inspired fragment; dynamics + adapters engineered",
    )
    package_engineered(
        "TargetTrack",
        "1.0.0",
        root / "blocks" / "targettrack" / "1.0.0",
        80,
        ["event_vision"],
        ["targetX", "targetY", "targetStrength", "visible"],
        "Engineered small-target tracker (honest provenance)",
    )

    scenarios = root / "scenarios"
    extra = {
        "flowsense-drone.json": {
            "id": "flowsense-drone-disturbance",
            "embodiment": "drone",
            "block": "FlowSense@1.0.0",
            "world": {"disturbance": "lateral_gust"},
            "sensors": ["event_camera"],
            "success": "stabilize_hover",
        },
        "flowsense-rover.json": {
            "id": "flowsense-rover-gps-denied",
            "embodiment": "rover",
            "block": "FlowSense@1.0.0",
            "world": {"gps": False},
            "sensors": ["event_camera"],
            "success": "estimate_motion",
        },
        "headingcell-drone.json": {
            "id": "headingcell-drone-waypoint",
            "embodiment": "drone",
            "block": "HeadingCell@1.0.0",
            "world": {"waypoint": [10, 0, 0]},
            "sensors": ["imu", "optic_flow"],
            "success": "align_heading",
        },
        "headingcell-rover.json": {
            "id": "headingcell-rover-corridor",
            "embodiment": "rover",
            "block": "HeadingCell@1.0.0",
            "world": {"corridor": True},
            "sensors": ["imu"],
            "success": "maintain_corridor",
        },
        "targettrack-drone.json": {
            "id": "targettrack-drone-chase",
            "embodiment": "drone",
            "block": "TargetTrack@1.0.0",
            "world": {"target": "moving_ball"},
            "sensors": ["event_camera"],
            "success": "keep_target_visible",
        },
        "targettrack-camera.json": {
            "id": "targettrack-camera-center",
            "embodiment": "camera",
            "block": "TargetTrack@1.0.0",
            "world": {"gimbal": True},
            "sensors": ["event_camera"],
            "success": "center_target",
        },
    }
    for fname, payload in extra.items():
        (scenarios / fname).write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print("Wrote 6 additional scenarios")


if __name__ == "__main__":
    main()
