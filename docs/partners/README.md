# Partner integrations

Partners extend **trust after the fact**. They never authorize, delay, or sit inside the SynapseVM reflex path. A braking robot must not wait on a network round-trip.

```text
Local SynapseVM tick
        │
        ▼
 NeuroReceipt (commitments + optional signature)
        │
        ├─► Local / Rust replay ……… “Same bytes → same outputs?”
        ├─► Chainlink CRE …………… “Independent (optionally confidential) check?”
        ├─► NeuroRegistry + The Graph … “Is this identity / validation discoverable?”
        └─► Hedera HCS ……………… “Is this root in a public, ordered log?”
```

| Partner | File | Question answered |
|---|---|---|
| **Chainlink CRE** | [chainlink-cre.md](./chainlink-cre.md) | Did an independent (optionally confidential) validator agree? |
| **The Graph + NeuroRegistry** | [the-graph.md](./the-graph.md) | Can others find the identity / validation record? |
| **Hedera** | [hedera.md](./hedera.md) | Is a compact root in a public consensus log? (plus future license/settlement) |

## Hard rules

1. **Fail-closed UI** — missing partners stay open claims. Nothing fabricates a pass.
2. **Post-action only** — export from Verify, then optionally submit. Never gate emergency braking.
3. **Honest claim language** — each layer answers one question; absence ≠ invalid local evidence.

## Related

- Product overview: [`../../README.md`](../../README.md)
- Builder architecture: [`../SYNAPSEVM_BUILDER_SPEC.md`](../SYNAPSEVM_BUILDER_SPEC.md)
- Verification claim language: [`../VERIFICATION.md`](../VERIFICATION.md)
- Implementation gaps: [`../IMPLEMENTATION_STATUS.md`](../IMPLEMENTATION_STATUS.md)
