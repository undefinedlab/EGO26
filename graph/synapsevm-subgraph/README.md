# SynapseVM subgraph (The Graph partner)

Indexes `NeuroRegistry` events for discovery and audit history (builder spec §14 / Phase 6).

## Entities

| Entity | Source event |
|--------|----------------|
| `NeuroBlock` | `NeuroBlockRegistered` / `NeuroBlockDeactivated` |
| `NeuroStack` | `NeuroStackRegistered` |
| `Validation` | `ValidationRecorded` |
| `ReceiptBatch` | Derived from validation (`receiptRoot`) |

Rich metadata fields (`name`, `organism`, …) default empty until a manifest URI is resolved off-chain. On-chain events only carry roots + URIs (spec §16).

## Local E2E (no Studio deploy)

NeuroLab ships a **Graph partner** that mirrors this schema:

1. Verify → import CRE result → **Anchor validation**
2. Writes into the local index (`/api/graph` + browser store)
3. Trust graph step **Anchor** turns green when the validation is queryable

Set `NEXT_PUBLIC_SUBGRAPH_URL` to a deployed GraphQL endpoint to prefer The Graph over the local index.

## Deploy to The Graph

```bash
# 1. Deploy NeuroRegistry (Foundry)
cd ../../contracts
forge create NeuroRegistry --rpc-url $SEPOLIA_RPC_URL --private-key $FOUNDATION_KEY

# 2. Put address + startBlock in networks.json / subgraph.yaml

# 3. Build & publish
npm install
npm run codegen
npm run build
npm run deploy   # graph auth --studio <TOKEN> first
```

## Queries the UI uses

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
