"""Package LoomGuard NeuroBlock from ARCHIVE FlyWire optic circuit."""

from __future__ import annotations

import hashlib
import math
import json
import struct
import sys
from pathlib import Path
from typing import Any

# Q16.16
ONE = 1 << 16


def q16(v: float) -> int:
    scaled = v * ONE
    if not math.isfinite(scaled):
        raise ValueError("Q16 requires a finite number")
    rounded = math.floor(abs(scaled) + 0.5) * (-1 if scaled < 0 else 1)
    return max(-(1 << 31), min((1 << 31) - 1, rounded))


def canonical_json(obj: Any) -> bytes:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode(
        "utf-8"
    )


def keccak256(data: bytes) -> bytes:
    # SHA3-256 is not Keccak-256. Never substitute a different digest.
    from Crypto.Hash import keccak
    return keccak.new(digest_bits=256, data=data).digest()


def hex0x(b: bytes) -> str:
    return "0x" + b.hex()


def load_circuit(path: Path) -> dict:
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def prune_loomguard(circuit: dict, max_neurons: int = 800) -> dict:
    core = {"lc4", "lplc2", "gf", "escw"}
    nodes = []
    for n in circuit["nodes"]:
        dr = (n.get("driveRole") or "").lower()
        if n.get("lobe") == "optic" or dr in core:
            nodes.append(n)
    if len(nodes) > max_neurons:
        # Prefer core + highest-degree partners among optic
        nodes = nodes[:max_neurons]

    keep = {n["id"] for n in nodes}
    edges = [e for e in circuit["edges"] if e["pre"] in keep and e["post"] in keep]

    io = circuit.get("io") or {}
    sensors = io.get("sensors") or {}
    collision = [i for i in sensors.get("collision") or [] if i in keep]
    hazard = [i for i in sensors.get("hazard") or [] if i in keep]
    escape = [i for i in (io.get("escape") or []) if i in keep]

    return {
        "source_circuit": {
            "name": circuit.get("name"),
            "source": circuit.get("source"),
            "citation": circuit.get("citation"),
            "neuronCount": circuit.get("neuronCount"),
            "edgeCount": circuit.get("edgeCount"),
        },
        "nodes": nodes,
        "edges": edges,
        "io": {
            "collision": collision,
            "hazard": hazard,
            "escape": escape,
        },
        "params": circuit.get("params") or {},
    }


def package_loomguard(
    circuit_path: Path,
    out_dir: Path,
    *,
    name: str = "LoomGuard",
    version: str = "1.0.0",
    max_neurons: int = 800,
) -> str:
    circuit = load_circuit(circuit_path)
    pruned = prune_loomguard(circuit, max_neurons=max_neurons)
    nodes = pruned["nodes"]
    edges = pruned["edges"]
    id_to_idx = {n["id"]: i for i, n in enumerate(nodes)}
    n = len(nodes)

    # CSR: for each post, list (pre, weight_q16)
    csr_offsets = [0]
    csr_pres: list[int] = []
    csr_weights: list[int] = []
    # group edges by post
    by_post: dict[int, list[tuple[int, int]]] = {i: [] for i in range(n)}
    for e in edges:
        pre = id_to_idx[e["pre"]]
        post = id_to_idx[e["post"]]
        # scale raw synapse weight into Q16.16 (clip)
        w = q16(float(e["weight"]) * 0.05)
        w = max(-ONE * 4, min(ONE * 4, w))
        by_post[post].append((pre, w))
    for post in range(n):
        for pre, w in by_post[post]:
            csr_pres.append(pre)
            csr_weights.append(w)
        csr_offsets.append(len(csr_pres))

    # LIF params (explicit modeling choice, not claimed biology)
    # Map ARCHIVE float LIF into relative Q16.16 around 0 with threshold ~1.0
    leak = q16(0.92)
    threshold = q16(1.0)
    reset = 0
    params_bin = struct.pack(f"<{n}i", *([leak] * n))
    params_bin += struct.pack(f"<{n}i", *([threshold] * n))
    params_bin += struct.pack(f"<{n}i", *([reset] * n))

    topology = bytearray()
    topology += struct.pack("<I", n)
    topology += struct.pack(f"<{n + 1}I", *csr_offsets)
    topology += struct.pack(f"<{len(csr_pres)}I", *csr_pres)
    weights_bin = struct.pack(f"<{len(csr_weights)}i", *csr_weights)

    collision_idx = [id_to_idx[i] for i in pruned["io"]["collision"][:32]]
    hazard_idx = [id_to_idx[i] for i in pruned["io"]["hazard"][:32]]
    escape_idx = [id_to_idx[i] for i in pruned["io"]["escape"]]
    # Prefer GF/escw drive roles for escape decoder
    for i, node in enumerate(nodes):
        dr = (node.get("driveRole") or "").lower()
        if dr in {"gf", "escw"} and i not in escape_idx:
            escape_idx.append(i)
    escape_idx = escape_idx[:16]

    # left/right avoid: LC4/LPLC2 by side
    left_idx = [
        i
        for i, node in enumerate(nodes)
        if (node.get("driveRole") or "").lower() in {"lc4", "lplc2"}
        and (node.get("side") or "") == "left"
    ][:24]
    right_idx = [
        i
        for i, node in enumerate(nodes)
        if (node.get("driveRole") or "").lower() in {"lc4", "lplc2"}
        and (node.get("side") or "") == "right"
    ][:24]

    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "adapters").mkdir(exist_ok=True)
    (out_dir / "test-vectors").mkdir(exist_ok=True)

    topology_path = out_dir / "topology.bin"
    weights_path = out_dir / "weights.bin"
    params_path = out_dir / "params.bin"
    topology_path.write_bytes(topology)
    weights_path.write_bytes(weights_bin)
    params_path.write_bytes(params_bin)

    provenance = {
        "connectomicProvenance": {
            "organism": "Drosophila melanogaster",
            "dataset": pruned["source_circuit"].get("source"),
            "citation": pruned["source_circuit"].get("citation"),
            "neuronIds": [n["id"] for n in nodes],
            "synapseCount": len(edges),
            "populations": {
                "lc4": sum(1 for n in nodes if (n.get("driveRole") or "").lower() == "lc4"),
                "lplc2": sum(1 for n in nodes if (n.get("driveRole") or "").lower() == "lplc2"),
                "gf": sum(1 for n in nodes if (n.get("driveRole") or "").lower() == "gf"),
                "escw": sum(1 for n in nodes if (n.get("driveRole") or "").lower() == "escw"),
            },
        },
        "computationalDynamics": {
            "neuronModel": "LIF_FIXED_V1",
            "numericFormat": "Q16.16",
            "leak": leak,
            "threshold": threshold,
            "reset": reset,
            "note": "LIF parameters are an explicit SynapseVM modeling choice",
        },
        "adapterSemantics": {
            "note": "Robot depth/loom channels map onto FlyWire collision/hazard sensory IDs",
            "inputs": ["depth_front", "depth_left", "depth_right", "loom"],
            "outputs": ["danger", "avoid_x", "avoid_y", "trigger"],
        },
    }
    provenance_path = out_dir / "provenance.json"
    provenance_path.write_text(json.dumps(provenance, indent=2), encoding="utf-8")

    input_adapter = {
        "ports": {
            "depth_front": {"dtype": "i32", "role": "input", "targets": collision_idx[:16]},
            "depth_left": {"dtype": "i32", "role": "input", "targets": collision_idx[16:24] or collision_idx[:8]},
            "depth_right": {"dtype": "i32", "role": "input", "targets": collision_idx[24:32] or collision_idx[8:16]},
            "loom": {"dtype": "i32", "role": "input", "targets": hazard_idx[:16]},
        }
    }
    output_adapter = {
        "ports": {
            "danger": {"dtype": "i32", "role": "output", "sources": escape_idx},
            "avoid_x": {"dtype": "i32", "role": "output", "left": left_idx, "right": right_idx},
            "avoid_y": {"dtype": "i32", "role": "output", "sources": hazard_idx[:8]},
            "trigger": {"dtype": "bool", "role": "output", "sources": escape_idx, "threshold": q16(0.15)},
        }
    }
    (out_dir / "adapters" / "input.json").write_text(json.dumps(input_adapter, indent=2), encoding="utf-8")
    (out_dir / "adapters" / "output.json").write_text(json.dumps(output_adapter, indent=2), encoding="utf-8")

    # SynapseVM native block JSON (loaded by Rust runtime)
    block_json = {
        "schema": "synapsevm.blockbytes.v1",
        "name": name,
        "version": version,
        "neuronCount": n,
        "csrOffsets": csr_offsets,
        "csrPres": csr_pres,
        "csrWeights": csr_weights,
        "leak": leak,
        "threshold": threshold,
        "reset": reset,
        "inputChannels": [
            {"name": "depth_front", "targets": input_adapter["ports"]["depth_front"]["targets"]},
            {"name": "depth_left", "targets": input_adapter["ports"]["depth_left"]["targets"]},
            {"name": "depth_right", "targets": input_adapter["ports"]["depth_right"]["targets"]},
            {"name": "loom", "targets": input_adapter["ports"]["loom"]["targets"]},
        ],
        "outputChannels": {
            "danger": escape_idx,
            "avoidLeft": left_idx,
            "avoidRight": right_idx,
            "avoidY": hazard_idx[:8],
            "trigger": escape_idx,
        },
        "triggerThreshold": q16(0.15),
        "flywireIds": [n["id"] for n in nodes],
    }
    block_path = out_dir / "block.json"
    block_path.write_text(json.dumps(block_json), encoding="utf-8")

    derivation = {
        "kind": "NeuroDerivation", "version": 1,
        "source": {"file": circuit_path.name, "sha256": hashlib.sha256(circuit_path.read_bytes()).hexdigest()},
        "compiler": {"module": "compiler.synapse_compiler.package_block", "sourceSha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest()},
        "selection": {"predicate": "optic lobe OR driveRole in lc4,lplc2,gf,escw", "maxNeurons": max_neurons, "ordering": "source node and edge array order"},
        "neuronModel": {"type": "LIF", "leakQ16": leak, "thresholdQ16": threshold, "resetQ16": reset},
        "synapseMapping": {"weightScale": 0.05, "clipQ16": [-4 * ONE, 4 * ONE], "rounding": "nearest, ties away from zero", "delayTicks": 1},
        "inputAdapter": input_adapter, "outputDecoder": output_adapter,
        "runtime": "synapsevm-fixed-v1",
        "engineeredAssist": "loom >= 9830: trigger += loom+32768, danger += loom; max input >= 16384: danger += peak, trigger += trunc(peak/2)",
        "seed": 0, "calibration": {"status": "not independently calibrated"},
        "output": {"blockBytesSha256": hashlib.sha256(block_path.read_bytes()).hexdigest()},
    }
    (out_dir / "derivation.json").write_bytes(canonical_json(derivation))

    # NIR-ish restricted export (hackathon-thin)
    nir = {
        "format": "synapsevm.nir.subset.v0",
        "nodes": [{"id": i, "type": "LIF", "flywireId": nodes[i]["id"]} for i in range(n)],
        "edges": [
            {"pre": id_to_idx[e["pre"]], "post": id_to_idx[e["post"]], "weight": e["weight"]}
            for e in edges
        ],
    }
    (out_dir / "circuit.nir.json").write_text(json.dumps(nir), encoding="utf-8")

    topo_hash = keccak256(topology_path.read_bytes())
    weights_hash = keccak256(weights_path.read_bytes())
    params_hash = keccak256(params_bin)
    prov_hash = keccak256(canonical_json(provenance))
    in_hash = keccak256(canonical_json(input_adapter))
    out_hash = keccak256(canonical_json(output_adapter))
    nir_hash = keccak256((out_dir / "circuit.nir.json").read_bytes())
    block_hash = keccak256(block_path.read_bytes())

    manifest_body = {
        "schema": "synapsevm.neuroblock.v1",
        "name": name,
        "version": version,
        "description": "Connectome-derived looming/avoidance reflex primitive (FlyWire optic escape)",
        "organism": "Drosophila melanogaster",
        "sourceDataset": pruned["source_circuit"].get("source"),
        "neuronModel": "LIF_FIXED_V1",
        "numericFormat": "Q16.16",
        "tickUs": 1000,
        "inputs": ["event_vision", "depth_proxy"],
        "outputs": ["danger", "avoid_x", "avoid_y", "trigger"],
        "deadlineUs": 10000,
        "priorityClass": "safety_reflex",
        "stateful": True,
        "neuronCount": n,
        "synapseCount": len(edges),
        "nirSha256": hex0x(nir_hash),
        "topologySha256": hex0x(topo_hash),
        "weightsSha256": hex0x(weights_hash),
        "provenanceSha256": hex0x(prov_hash),
        "paramsSha256": hex0x(params_hash),
        "inputAdapterSha256": hex0x(in_hash),
        "outputAdapterSha256": hex0x(out_hash),
        "blockBytesSha256": hex0x(block_hash),
        "digestAlgorithm": "keccak256",
        "legacyDigestFieldNote": "Fields ending Sha256 below retain legacy names but contain Keccak-256; use derivation output for SHA-256",
        "derivationSha256": hashlib.sha256(canonical_json(derivation)).hexdigest(),
        "artifacts": {
            "derivation": "derivation.json",
            "block": "block.json",
            "topology": "topology.bin",
            "weights": "weights.bin",
            "params": "params.bin",
            "nir": "circuit.nir.json",
            "provenance": "provenance.json",
        },
    }
    block_root = keccak256(
        canonical_json(manifest_body)
        + nir_hash
        + topo_hash
        + weights_hash
        + in_hash
        + out_hash
        + block_hash
    )
    manifest = {**manifest_body, "blockRoot": hex0x(block_root)}
    (out_dir / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    # Golden test vectors: quiet vs loom
    vectors = []
    for i, (label, channels) in enumerate(
        [
            ("quiet", [0, 0, 0, 0]),
            ("loom_front", [q16(0.8), q16(0.2), q16(0.2), q16(1.0)]),
            ("left_wall", [q16(0.3), q16(0.9), 0, q16(0.4)]),
            ("right_wall", [q16(0.3), 0, q16(0.9), q16(0.4)]),
        ]
    ):
        case = {
            "id": f"case-{i+1:03d}",
            "label": label,
            "input": channels,
            "ticks": 12,
        }
        vectors.append(case)
        (out_dir / "test-vectors" / f"{case['id']}.input.json").write_text(
            json.dumps(case, indent=2), encoding="utf-8"
        )

    benchmarks = {
        "status": "pending_measurement",
        "neuronCount": n,
        "synapseCount": len(edges),
        "artifactBytes": sum(p.stat().st_size for p in out_dir.rglob("*") if p.is_file()),
    }
    (out_dir / "benchmarks.json").write_text(json.dumps(benchmarks, indent=2), encoding="utf-8")
    (out_dir / "papers.json").write_text(
        json.dumps(
            [
                {
                    "title": "FlyWire: whole-brain connectome of Drosophila",
                    "note": "Source connectivity for LoomGuard optic populations",
                }
            ],
            indent=2,
        ),
        encoding="utf-8",
    )

    print(f"Packaged {name}@{version}: neurons={n} synapses={len(edges)} blockRoot={hex0x(block_root)}")
    return hex0x(block_root)


def main(argv: list[str] | None = None) -> int:
    argv = list(sys.argv[1:] if argv is None else argv)
    root = Path(__file__).resolve().parents[2]  # VM/
    default_circuit = root.parent / "ARCHIVE" / "packages" / "snn" / "circuit.json"
    circuit = Path(argv[0]) if argv else default_circuit
    out = Path(argv[1]) if len(argv) > 1 else root / "blocks" / "loomguard" / "1.0.0"
    if not circuit.exists():
        print(f"circuit not found: {circuit}", file=sys.stderr)
        return 1
    package_loomguard(circuit, out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
