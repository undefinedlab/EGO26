# Chainlink CRE — independent validation plane

**Partner:** [Chainlink](https://chain.link/) · **Product surface:** CRE (Chainlink Runtime Environment) workflows  
**Repo path:** [`cre/neuroproof-workflow/`](../../cre/neuroproof-workflow/)  
**NeuroLab APIs:** `POST /api/verify/cre`, Verify → export `synapsevm.cre-validation-request.v1`

---

## 1. Role in the SynapseVM stack

Chainlink CRE is the **validation plane**: an independent runtime that checks commitment envelopes *after* a local SynapseVM action.

It answers:

> Did an external workflow (and later, a DON-attested report) agree with the structural claims of this receipt — without putting CRE in the control loop?

It does **not** answer: “Did the physical robot move?”, “Was the publisher honest?”, or “Should we brake now?”

```text
Compose / Simulate / Deploy
        │
        ▼
 Critical tick → NeuroReceipt (local, offline-capable)
        │
        ▼
 Verify: local replay first
        │
        ▼
 Export CRE request envelope
        │
        ▼
 CRE NeuroProof workflow ──► validation result
        │
        ▼
 Optional: record result via NeuroRegistry / The Graph
```

---

## 2. How the partner stack works

### Envelope (public, commitment-only)

NeuroLab exports `synapsevm.cre-validation-request.v1` from Verify. The first public envelope is designed so **raw sensor frames, full state dumps, and actuator traces stay out of the public path**.

The workflow deterministically checks:

| Check | Intent |
|---|---|
| SHA-256 request digest | Envelope integrity |
| Receipt ↔ Stack link | Evidence binds to the claimed stack identity |
| Receipt ↔ package link | Evidence binds to the claimed package |
| Previous-receipt link shape | Chain structure is well-formed |

Explicitly **out of scope** for the current public envelope:

- Full receipt signature verification as a green pass (reported `false` until wired for production keys)
- Full confidential / enclave replay of private inputs
- Consensus DON attestation (local `cre workflow simulate` is single-node)

### Execution modes

1. **Local deterministic tests** (`bun test` in the workflow package) — exercise the validator logic without CRE infra.
2. **CRE CLI simulate** — `cre workflow simulate neuroproof-workflow …` with an HTTP payload file; staging uses an unauthenticated trigger allowed only in simulation.
3. **NeuroLab gateway** — when `SYNAPSEVM_CRE_*` env vars are set, Verify can call `/api/verify/cre` so the UI stays fail-closed if CRE is unavailable.

### What stays out of the reflex path

CRE is never consulted before an AVOID / STOP decision. Latency of CRE, RPC, or DON consensus is irrelevant to LoomGuard tick timing.

---

## 3. Where it brings value

| Stakeholder | Value |
|---|---|
| **Robotics / OEM audit** | A receipt authored on the operator’s laptop is necessary but not sufficient. An independent runtime witnesses the same commitment claims. |
| **Regulators / insurers** | Clear separation: local determinism vs third-party validation. Missing CRE = “unverified”, not “failed safety”. |
| **IP-sensitive OEMs** | Roadmap for **confidential replay**: prove the registered controller produced the claimed decision without publishing proprietary camera / lidar frames on a public chain. |
| **Multi-party disputes** | DON-attested reports (when deployed) reduce “he said / she said” over whose verifier to trust. |

Narrative goal (builder spec §12.2):

> The manufacturer can prove the registered neural controller generated the claimed decision without publishing proprietary sensor frames.

---

## 4. What it is now (honest status)

| Capability | Status |
|---|---|
| Commitment-only CRE request format from Verify | **Shipped** |
| Deterministic NeuroProof workflow + unit tests + WASM compile | **Shipped** (`cre/neuroproof-workflow`) |
| CRE CLI local simulation path | **Documented / runnable** when CLI + auth are installed |
| NeuroLab `/api/verify/cre` + env-gated runner | **Wired** (optional) |
| Production HTTP trigger with authorized EVM key | **Not claimed deployed** — config still uses placeholders until release |
| DON-signed portable validation report | **Not claimed** — separate release step |
| Confidential / TEE replay of private inputs | **Optional roadmap** — not required for basic CRE validation |
| Signature + full replay inside CRE | **Explicitly incomplete** in current envelope (reports `false` for those flags) |

UI rule: a missing or failed CRE result must remain **unverified** — never a fabricated green check.

---

## 5. Roadmap

### Near-term

1. Production CRE config: replace `REPLACE_WITH_AUTHORIZED_EVM_ADDRESS`, deploy workflow to a Chainlink environment that supports authenticated HTTP triggers.
2. Portable **DON-signed report** artifact that Verify can import and display as an independent attestation (still fail-closed if absent).
3. Tighten receipt signature verification once device / publisher key models are stable.

### Mid-term

4. **Confidential CRE path**: private sensor input + stateBefore + trace stay in the confidential compute path; public artifacts keep commitments + `replayMatched`.
5. Batch validation: one CRE run over a Merkle-batched set of critical receipts (cost / latency amortization).
6. Record CRE outcomes into NeuroRegistry `ValidationRecorded` so The Graph can surface them (see [the-graph.md](./the-graph.md)).

### Longer-term

7. Multiple independent validators (CRE + other TEE / re-execution oracles) with quorum policies.
8. Align validation metadata with ERC-8004 Validation Registry where agent identity is registered (builder spec §13).
9. Optional zk / succinct proofs of deterministic SNN ticks — **explicitly out of current scope** (builder spec Level 4).

### Will not do

- Put CRE (or any oracle) in the hard real-time control loop.
- Treat simulate-mode single-node runs as DON consensus.
- Invent a “validated” badge when the workflow did not run.

---

## 6. Configuration & pointers

| Item | Location |
|---|---|
| Workflow README | [`cre/neuroproof-workflow/README.md`](../../cre/neuroproof-workflow/README.md) |
| Env (Lab) | `SYNAPSEVM_CRE_PROJECT_DIR`, `SYNAPSEVM_CRE_CLI`, `SYNAPSEVM_ETH_RPC_URL` |
| Builder spec | [`../SYNAPSEVM_BUILDER_SPEC.md`](../SYNAPSEVM_BUILDER_SPEC.md) §12, Phase 5 |
| Chainlink docs | <https://docs.chain.link/> |

Local workflow checks:

```bash
cd cre/neuroproof-workflow
bun install --frozen-lockfile
bun test
bun run typecheck
bun run compile
```
