# Hedera — public ordered anchors & optional economic plane

**Partner:** [Hedera](https://hedera.com/)  
**Primary service today:** Hedera Consensus Service (HCS)  
**Repo paths:** NeuroLab `/api/anchor` · [`hedera/licensing-demo/`](../../hedera/licensing-demo/)  
**Docs:** <https://docs.hedera.com/>

---

## 1. Role in the SynapseVM stack

Hedera provides two related but separate planes, both **outside** the reflex loop:

| Plane | Question |
|---|---|
| **Audit / anchor (HCS)** | Is a compact batch or receipt root in a public, consensus-timestamped, append-only log? |
| **Economic (roadmap / demo)** | Can license purchase or metered batch usage settle without paying per braking tick? |

HCS answers **tamper-evident public bookmarking**. It does not execute neural ticks, replace local replay, or authorize actuators.

```text
Critical events locally
        │
        ▼
 Batch / Merkle root of receipt commitments
        │
        ▼
 HCS submitMessage (operator key, server-side)
        │
        ▼
 Mirror node: sequence + consensus timestamp
        │
        ▼
 Later dispute: compare claimed root vs public topic log
```

Economic flows (prepaid license, metered settlement) remain **download / entitlement / settlement** concerns — never “pay then brake.”

---

## 2. How the partner stack works

### HCS anchoring (current product path)

1. Verify (or batch tooling) builds a compact root over receipt / batch commitments (`anchorMerkle` helpers).
2. NeuroLab `POST /api/anchor` runs **server-side** with operator credentials (the key never leaves the server).
3. Message is submitted to a configured HCS topic (`HEDERA_TOPIC_ID`) on testnet or mainnet (`HEDERA_NETWORK`).
4. Response surfaces sequence number / transaction id for UI and reports.
5. Anyone can later check the mirror log: deletion or reordering of evidence that claimed that root becomes detectable once the message is consensus-timestamped.

Local receipts without an HCS message remain **valid local evidence** — they are simply not yet in a public consensus log.

### Licensing demo (economic sketch)

[`hedera/licensing-demo/`](../../hedera/licensing-demo/) sketches prepaid license or batch-usage Merkle settlement for modules such as LoomGuard — explicitly outside the control loop (builder spec §15).

Two intended patterns:

**Option A — prepaid license**

```text
Choose LoomGuard@version → purchase / entitlement → download → execute offline many times
```

**Option B — metered batch settlement**

```text
N local executions → usage accumulator / Merkle root → one settlement transaction
```

x402 (if used) may gate **download / license / API access**, never hard real-time reflex execution.

---

## 3. Where it brings value

| Stakeholder | Value |
|---|---|
| **Dispute / forensics** | Public, ordered, timestamped anchors resist silent omission that app-only registries can suffer. |
| **Enterprises** | Separates the **millisecond reflex plane** from the **settlement / compliance ledger plane**. |
| **Publishers** | Future path to license NeuroBlocks without per-tick micropayments that would destroy latency budgets. |
| **Auditors** | Independent mirror-node verification of “this root existed at consensus time T.” |

Hedera’s value is **ordering + public durability of compact commitments**, plus optional economics — not SNN execution.

---

## 4. What it is now (honest status)

| Capability | Status |
|---|---|
| Server-side HCS submit via `/api/anchor` | **Wired** when operator env is set |
| Merkle / batch message helpers | **In Lab** (`lib/anchorMerkle`, Hedera key parsing) |
| Fail-closed Verify language when unanchored | **Shipped** (unanchored ≠ invalid local receipt) |
| Licensing demo sketch | **Present** (`hedera/licensing-demo`) — not a full marketplace |
| Mainnet production topic ops / key rotation playbooks | **Operator-owned** — not assumed for every clone |
| Full settlement UI in NeuroLab | **Not shipped** (builder Phase 8; cut-first if behind) |
| Per-tick payment | **Explicitly forbidden** by architecture |

Env required for live anchoring:

- `HEDERA_NETWORK`
- `HEDERA_OPERATOR_ID`
- `HEDERA_OPERATOR_KEY`
- `HEDERA_TOPIC_ID`

---

## 5. Roadmap

### Near-term

1. Harden anchor UX: show topic id, sequence, consensus time, and explorer links with clear “anchor only” copy.
2. Document topic creation / operator key rotation for testnet demos.
3. Batch multiple receipt roots into one HCS message to control cost.

### Mid-term

4. **Settlement UI** for prepaid license download entitlements (builder Phase 8) — still offline after entitlement.
5. Metered batch settlement: accumulate usage Merkle roots, settle periodically.
6. Optional dual-anchor story: registry/Graph for identity + HCS for public ordered audit bookmarks.
7. Align license entitlements with published `blockRoot` / package digests so “licensed bytes” match Verify identity.

### Longer-term

8. Policy packs: which events must be anchored (critical only vs sampled).
9. Multi-topic designs (per-tenant / per-fleet) without leaking PII into HCS payloads — commitments only.
10. If x402 remains relevant, gate artifact download APIs — never control ticks.

### Will not do

- Call Hedera (or wait on mirror nodes) inside the SynapseVM tick / emergency brake path.
- Put raw sensor frames or full receipts on HCS — **roots and compact commitments only**.
- Claim that an HCS message proves the actuator physically moved.

---

## 6. Configuration & pointers

| Item | Location |
|---|---|
| Anchor API | `apps/neurolab-web/app/api/anchor/route.ts` |
| Licensing demo | [`hedera/licensing-demo/README.md`](../../hedera/licensing-demo/README.md) |
| Env (Lab) | `HEDERA_NETWORK`, `HEDERA_OPERATOR_ID`, `HEDERA_OPERATOR_KEY`, `HEDERA_TOPIC_ID` |
| Builder spec | [`../SYNAPSEVM_BUILDER_SPEC.md`](../SYNAPSEVM_BUILDER_SPEC.md) §15, Phase 8 |
| Hedera docs | <https://docs.hedera.com/> |

### Claims stack reminder

| Layer | Failure mode if missing |
|---|---|
| Local replay | Bug or incomplete disclosure |
| CRE | Unverified independent check |
| Registry + Graph | Not indexed ≠ false |
| **Hedera HCS** | **Not anchored ≠ invalid local receipt** |
