# September notes: implemented scope and remaining gaps

## Delivered

- Exact Rust/browser arithmetic and engineered assist parity; strict model/input/snapshot checks.
- Native/browser conformance; tamper-resistant receipt v2 claims; fail-closed replay and validator API; current signed demo sample.
- Workbench source compiler with typed ports, required inputs, writer conflicts, cycle rejection, estimated deadline and 100 Hz minimum LoomGuard envelope checks.
- Sensor and final command nodes, persistent Save/Load, canonical .synapse source-package export and integrity-checked import, exact SHA-256 model locks, distinct Stack and package digests, simulator deployment configuration.
- Python derivation recipes bind source bytes, compiler bytes, model/adapter choices and output bytes. Keccak never silently falls back to SHA3. Compiler requirements now use PyCryptodome. Synthetic reproducibility test does not establish real biological reproduction.
- Light semantic UI, keyboard focus, reduced motion, trust lane; no fabricated replay/external/anchor pass or popularity metrics.

## Boundaries

The .synapse format here is canonical JSON (synapsevm.source-package.v1), containing graph, exact module source bytes, lockfile and a planning schedule. It is explicitly executable:false and unsigned. Its typed graph contracts describe intended adapters; the current four low-level model APIs are not a complete composed control runtime. Only LATEST tick-batched delivery is supported. Workbench currently has one node per type and a common sensor rate; imports with other IDs/rates are rejected, not silently rewritten. Layout is not part of identity. Exported deployment files are simulator configuration, not installation or calibration evidence. Latencies are estimates.

Existing model releases are not regenerated or republished. The old manifest digest field names and stored legacy hashes remain historical; new Stack locks hash the actual model bytes directly. New Python manifests explicitly label legacy Keccak fields and bind a SHA-256 derivation recipe. Missing original circuit inputs must be restored to reproduce the historical LoomGuard model. Other three models are engineered examples.

## Next implementation phases

1. Lower versioned typed adapters and control nodes into an executable composed runtime; full command-path receipts; independent WASM conformance; explicit delay/multi-rate/failure semantics.
2. Restore scientific source revision, validate licensing, reproduce the actual derivation; publish measured ScenarioPack baselines and operating envelopes.
3. Git-backed forks/history/NeuroDiff and immutable releases, OCI artifacts/referrers, Sigstore signatures, SLSA/SPDX attachments. No registry or publisher signature exists yet.
4. Hardware DeploymentBundle validation, real calibration, capability sandboxing, staged activation/rollback, advisories and key lifecycle.
5. CRE confidential replay remains optional. Local Graph partner anchoring + Verify Anchor step are wired; on-chain NeuroRegistry deploy + The Graph Studio publish still needed for public inclusion.

## Validation commands

- cargo test --offline -p synapsevm-core
- npm run test:protocol
- python -m unittest discover -s tests -p test_derivation.py
- npm run build:lab

Full cargo workspace checks require uncached WASM dependencies (bumpalo); report this separately from successful core tests.
