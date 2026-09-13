# SynapseVM

**Verified neural control software for machines that must act — and later prove what they did.**

SynapseVM is a stack for compiling small, deterministic neural modules into portable controllers, running them locally at reflex timescales, and producing replayable evidence of critical decisions. It is built for robotics, edge devices, games, and autonomous agents where latency, offline execution, and auditability matter more than cloud-scale models.

> Hard rule: **no chain, CRE, or payment logic in the reflex path.** External verification partners are optional and sit *after* local execution. A braking robot must never wait on a network round-trip.

---

## What you get

| Concept | Role |
|---|---|
| **NeuroBlock** | A versioned neural module with typed interfaces (e.g. LoomGuard collision reflex). |
| **NeuroStack** | A composed graph of sensors → blocks → actuators, packaged as a `.synapse` artifact. |
| **SynapseVM** | Deterministic runtime (Rust + browser) that ticks fixed-point SNN dynamics. |
| **NeuroReceipt** | Cryptographic evidence of a critical tick: input, state, outputs, and commitments for exact replay. |

NeuroLab (the web workbench) exposes three surfaces:

1. **Discover** — browse NeuroBlocks, provenance, and published stacks  
2. **Compose** — wire typed nodes into a stack, validate, compile, and export  
3. **Verify** — import evidence, replay locally, and optionally check partners (The Graph, Hedera HCS, Chainlink CRE)

---

## Why it exists

Large models are powerful planners but expensive, non-deterministic, and hard to audit at every control tick. SynapseVM targets the complementary layer: **tiny, local, deterministic neural reflexes** you can package like software, simulate before shipping, and verify after an incident.

Typical path:

```text
Compose a NeuroStack  →  Simulate locally  →  Export .synapse
        ↓
Critical action produces a NeuroReceipt  (local, offline-capable)
        ↓
Independent replay + optional partner attestations
```

---

## Partner integrations

Partners extend **trust after the fact**. They never authorize or delay a safety action. Each answers a different question. Detailed write-ups (how it works, value, current status, roadmap) live under [`docs/partners/`](docs/partners/README.md).

```text
Local SynapseVM tick
        │
        ▼
 NeuroReceipt (commitments + optional signature)
        │
        ├─► Local / Rust replay ………… “Same bytes → same outputs?”
        ├─► Chainlink CRE ……………… “Independent (optionally confidential) check?”
        ├─► NeuroRegistry + The Graph … “Is this identity / validation discoverable?”
        └─► Hedera HCS ………………… “Is this root in a public, ordered log?”
```

### Local replay (baseline)

Before any partner runs, Verify recomputes the disclosed path: same stack, same input commitments, same pre-state → exact outputs and post-state. A match proves **computational consistency**, not publisher honesty, device trust, or that a physical actuator moved.

### Chainlink CRE — independent validation & confidential replay

**Why:** A receipt produced on the author’s machine is necessary but not sufficient for high-stakes audit. An independent runtime should witness the same claims. Chainlink CRE (Cryptographic / confidential execution workflows) is the **validation plane**: it runs *after* the action, on commitment envelopes exported from Verify (`synapsevm.cre-validation-request.v1`).

**What it is for:**

- Deterministic checks of request digests and receipt ↔ stack / package linkage outside the operator’s UI session.
- Path toward **enclave / confidential replay**: re-run or validate sensitive evidence without publishing raw sensor frames on a public chain. Public artifacts keep commitments and results; private inputs stay in the confidential path when the workflow supports it.
- DON-attested reports when fully deployed (simulation is single-node and is not consensus).

**What it is not:** CRE does not sit in the control loop, does not gate emergency braking, and a missing CRE result must remain **unverified** — never a green check.

Workflow lives under [`cre/neuroproof-workflow`](cre/neuroproof-workflow/README.md).

### NeuroRegistry + The Graph — identity & discoverable history

**Why:** Teams need a shared, queryable record of which blocks and stacks exist and which validations were recorded — without stuffing full traces on-chain.

**NeuroRegistry** (EVM, e.g. Sepolia) stores compact roots and URIs: block / stack registrations and validation records. It is an **identity and audit pointer**, not a full evidence warehouse.

**The Graph** indexes those events into a subgraph so Explore and Verify can ask: “Has this receipt / request hash been recorded? What stack does it bind to?” When `NEXT_PUBLIC_SUBGRAPH_URL` is set, NeuroLab prefers the live endpoint; otherwise a local graph index mirrors the same schema for development.

**What it proves:** Inclusion and discoverability of registered identities and validation metadata.  
**What it does not:** Full receipt contents, biological provenance, or that a device was calibrated.

See [`graph/synapsevm-subgraph`](graph/synapsevm-subgraph/README.md) and [`contracts/`](contracts/).

### Hedera HCS — public ordered anchors

**Why:** Local and even on-chain app registries can be forked, pruned, or selectively omitted in a dispute. Hedera Consensus Service provides a **public, consensus-timestamped, append-only topic** for compact batch / receipt roots. Anchoring a root after a critical event makes later deletion or reordering of that evidence detectable against the mirror log.

**What it is for:**

- Tamper-evident **audit bookmarks** (message sequence + timestamp on testnet/mainnet).
- Separating the economic / settlement-capable ledger plane from the millisecond reflex plane.
- Optional future license or metered settlement flows that remain **outside** control (builder spec §15).

**What it is not:** Hedera does not execute the neural tick, does not replace local replay, and an unanchored local receipt is still valid local evidence — it is simply not yet in a public consensus log.

NeuroLab submits via `/api/anchor` when `HEDERA_OPERATOR_ID`, `HEDERA_OPERATOR_KEY`, and `HEDERA_TOPIC_ID` are configured.

### How claims stack (honest model)

| Layer | Question answered | Failure mode |
|---|---|---|
| Local replay | Did this stack compute this output from this state? | Bug or incomplete disclosure |
| CRE / enclave | Did an independent (optionally confidential) validator agree? | Unverified if absent |
| Registry + Graph | Can others find the identity / validation record? | Not indexed ≠ false |
| Hedera HCS | Is a compact root in a public consensus log? | Not anchored ≠ invalid local receipt |

SynapseVM UI and APIs are fail-closed: missing partners stay open claims. Nothing fabricates a pass.

---

## Repository layout

```text
apps/neurolab-web/     NeuroLab — Discover / Compose / Verify (Next.js)
crates/                SynapseVM core runtime (Rust)
compiler/              Python packaging for NeuroBlocks
blocks/                Versioned block artifacts
contracts/             NeuroRegistry (Sepolia) — optional public identity root
graph/                 The Graph subgraph for registry events
cre/                   Chainlink CRE neuroproof workflow (optional)
hedera/                Hedera HCS anchoring helpers (optional)
docs/                  Specs, status, and implementation notes
tests/                 Protocol, library, compose, and verification tests
```

---

## Quick start

**Requirements:** Node.js ≥ 20, Rust toolchain, Python 3 (for block packaging).

```bash
# Install workspace deps
npm install

# Python compiler deps (block packaging)
python -m pip install -r compiler/requirements.txt

# Run NeuroLab
npm run dev:lab
# → http://localhost:3000
```

Optional local services:

```bash
npm run dev:validator   # receipt validator API
```

### Partner configuration (optional)

Landing, Discover, Compose, and **local** Verify work with no partner env. To enable the trust plane, set keys in `apps/neurolab-web/.env.local` (testnets are fine; do not commit secrets):

| Variable | Partner |
|---|---|
| `NEXT_PUBLIC_NEURO_REGISTRY_ADDRESS` / `_NETWORK` | Registry |
| `NEXT_PUBLIC_SUBGRAPH_URL` | The Graph |
| `HEDERA_NETWORK`, `HEDERA_OPERATOR_ID`, `HEDERA_OPERATOR_KEY`, `HEDERA_TOPIC_ID` | Hedera HCS |
| `SYNAPSEVM_CRE_PROJECT_DIR`, `SYNAPSEVM_CRE_CLI`, `SYNAPSEVM_ETH_RPC_URL` | CRE simulate / DON signers |

---

## Validation

| Check | Command |
|---|---|
| Core determinism | `npm run test:core` |
| LoomGuard E2E | `npm run test:e2e` |
| Native / browser protocol | `npm run test:protocol` |
| Compose / library / verification | `npm run test:compose` · `npm run test:library` · `npm run test:verification` |
| Package blocks | `npm run compile:loomguard && npm run compile:library` |
| Measured bench | `npm run bench` |
| Production Lab build | `npm run build:lab` |

Derivation / scientific packaging tests:

```bash
python -m unittest discover -s tests -p test_derivation.py
```

---

## Documentation

| Doc | Contents |
|---|---|
| [Partner integrations](docs/partners/README.md) | Chainlink CRE, The Graph, Hedera — how each works, value, status, roadmap |
| [Implementation status](docs/IMPLEMENTATION_STATUS.md) | Delivered scope and remaining gaps |
| [Execution spec](docs/SYNAPSEVM_EXECUTION_SPEC.md) | Runtime arithmetic, ticks, receipts |
| [Implementation plan](docs/IMPLEMENTATION_PLAN.md) | Roadmap phases |
| [Verification](docs/VERIFICATION.md) | Claim language and boundaries |
| [Builder spec](docs/SYNAPSEVM_BUILDER_SPEC.md) | Product architecture including partners |
| [CRE workflow](cre/neuroproof-workflow/README.md) | NeuroProof CRE details |
| [Subgraph](graph/synapsevm-subgraph/README.md) | Graph schema and deploy |

---

## License & contribution

Private research / product repository. Treat keys in local `.env` files as secrets even on testnets; do not commit them.
