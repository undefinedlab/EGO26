# The Graph + NeuroRegistry — identity & discoverable history

**Partners:** [The Graph](https://thegraph.com/) (indexing) · **NeuroRegistry** (EVM contract in this repo)  
**Repo paths:** [`graph/synapsevm-subgraph/`](../../graph/synapsevm-subgraph/) · [`contracts/`](../../contracts/)  
**NeuroLab APIs:** `/api/graph`, `/api/graph/anchor`, Explore / Verify trust steps

---

## 1. Role in the SynapseVM stack

NeuroRegistry + The Graph form the **discovery and audit-history plane**.

They answer:

> Can others find a registered block / stack identity, and has a validation for this request hash been recorded in a queryable index?

They do **not** store full NeuroReceipts, prove biological provenance, or replace local replay / CRE validation.

```text
Publisher / Verify flow
        │
        ├─► registerBlock / registerStack ──► NeuroRegistry (on-chain roots + URIs)
        │                                            │
        │                                            ▼
        │                                   The Graph subgraph indexes events
        │                                            │
        └─► ValidationRecorded (after CRE / local anchor) ──► queryable Validation entity
                                                            │
                                                            ▼
                                              Discover / Verify UI (“is it indexed?”)
```

When a live subgraph URL is not configured, NeuroLab’s **local Graph partner** mirrors the same schema for development so the Anchor trust step can still turn green against a local index.

---

## 2. How the partner stack works

### NeuroRegistry (on-chain, minimal)

Contract goal (builder spec §16): store **compact roots and URIs**, not evidence warehouses.

Typical records:

| Record | Meaning |
|---|---|
| `NeuroBlockRegistered` | `blockRoot` + `manifestURI` + publisher |
| `NeuroStackRegistered` | `stackRoot` + `manifestURI` + publisher |
| `ValidationRecorded` | Links `requestHash`, `receiptRoot`, score / evidence URI, etc. |

On-chain data is intentionally thin. Rich fields (`name`, organism, task tags, …) are expected from off-chain manifests resolved via URI — until then subgraph fields may be empty strings.

### The Graph subgraph

The subgraph indexes registry events into entities:

| Entity | Source |
|---|---|
| `NeuroBlock` | block register / deactivate |
| `NeuroStack` | stack register |
| `Validation` | validation recorded |
| `ReceiptBatch` | derived from validation (`receiptRoot`) |

NeuroLab queries (example):

```graphql
{
  validations(where: { requestHash: "0x…" }, first: 1) {
    id
    requestHash
    receiptRoot
    blockRoot
    score
    evidenceURI
    timestamp
    txHash
  }
}
```

### Local Graph partner (dev)

Without Studio deploy:

1. Verify → import CRE / validation result → **Anchor validation**
2. Writes into the local index (`/api/graph` + browser store)
3. Trust graph **Anchor** step turns green when the validation is queryable locally

Set `NEXT_PUBLIC_SUBGRAPH_URL` to prefer a deployed GraphQL endpoint over the local mirror.

### ERC-8004 adjacency

Builder spec §13 / §14: use ERC-8004 / Agent0 for **composed agents** (e.g. BioPilot) where feasible; keep a SynapseVM-specific subgraph for fields Agent0 does not cover. Reputation registries are optional mid-term, not a blocker for identity + validation indexing.

---

## 3. Where it brings value

| Stakeholder | Value |
|---|---|
| **Developers** | One schema to ask “which stacks exist?” and “was this receipt’s validation recorded?” without scraping RPC logs. |
| **Fleet / platform ops** | Discoverable history of registered identities across environments (testnet → mainnet). |
| **Auditors** | Independent inclusion proofs of *metadata* (tx hash, timestamp, roots) next to local evidence bundles. |
| **Ecosystem** | Interoperability path toward ERC-8004 agent discovery while keeping SynapseVM-specific validation fields. |

Product value is **standardized discovery**, not “the chain ran the neural net.”

---

## 4. What it is now (honest status)

| Capability | Status |
|---|---|
| Subgraph schema + mappings for NeuroRegistry events | **Shipped** (`graph/synapsevm-subgraph`) |
| Local Graph partner + Verify Anchor step | **Wired** |
| NeuroLab preference for `NEXT_PUBLIC_SUBGRAPH_URL` | **Wired** |
| NeuroRegistry Solidity + Foundry layout | **In repo** (`contracts/`) |
| Public Sepolia (or other) registry deploy + Studio subgraph publish | **Operator-dependent** — not assumed live for every clone |
| Off-chain manifest enrichment into subgraph entities | **Partial** — empty metadata until URI resolution |
| ERC-8004 Identity / Reputation / Validation registries | **Roadmap / optional** — fallback NeuroRegistry is the current path |
| Publisher authentication / Sigstore / SLSA attachments | **Not yet** (see IMPLEMENTATION_STATUS) |

Fail-closed rule: **not indexed ≠ false**. Absence of a Graph hit means “not discoverable here,” not “local replay lied.”

---

## 5. Roadmap

### Near-term

1. Documented one-click (or scripted) **Sepolia NeuroRegistry deploy** + subgraph `networks.json` / startBlock update.
2. Graph Studio (or decentralized network) **publish** of `synapsevm-subgraph` with a stable public URL for demos.
3. Verify UI polish: show request hash → validation entity → tx explorer links with honest labels.

### Mid-term

4. Resolve `manifestURI` off-chain to fill name / version / organism fields in the subgraph.
5. Index CRE validation results end-to-end (request → CRE → `ValidationRecorded` → Graph query green).
6. Optional **ERC-8004** agent registration for BioPilot-class stacks; map Validation Registry submissions where tooling allows.
7. Multi-network support (additional L2s) with one subgraph schema.

### Longer-term

8. Reputation / trust badges derived from validation history (builder spec trust badge notes) — never conflated with local replay MATCH.
9. Cross-product queries with Agent0 subgraphs for agent discovery.
10. Immutable release metadata (OCI / Sigstore / SPDX) linked from registry URIs.

### Will not do

- Put Graph queries or RPC waits in the reflex tick path.
- Upload full sensor traces or private evidence to the subgraph.
- Treat “not found in Graph” as a safety failure.

---

## 6. Configuration & pointers

| Item | Location |
|---|---|
| Subgraph README | [`graph/synapsevm-subgraph/README.md`](../../graph/synapsevm-subgraph/README.md) |
| Contracts | [`contracts/`](../../contracts/) |
| Env (Lab) | `NEXT_PUBLIC_NEURO_REGISTRY_ADDRESS`, `NEXT_PUBLIC_NEURO_REGISTRY_NETWORK`, `NEXT_PUBLIC_SUBGRAPH_URL` |
| Builder spec | [`../SYNAPSEVM_BUILDER_SPEC.md`](../SYNAPSEVM_BUILDER_SPEC.md) §14, §16, Phase 6 |
| Agent0 / ERC-8004 context | <https://thegraph.com/blog/agent0-subgraphs-live-erc-8004-agent-economy/> |

Deploy sketch:

```bash
# 1. Deploy NeuroRegistry (Foundry)
cd contracts
forge create NeuroRegistry --rpc-url $SEPOLIA_RPC_URL --private-key $FOUNDATION_KEY

# 2. Put address + startBlock in subgraph networks.json / subgraph.yaml

# 3. Build & publish
cd ../graph/synapsevm-subgraph
npm install && npm run codegen && npm run build && npm run deploy
```
