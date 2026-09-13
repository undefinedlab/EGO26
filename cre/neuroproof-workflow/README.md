# SynapseVM NeuroProof for Chainlink CRE

This workflow is a post-action trust-plane validator. It never sits in the robot control loop and cannot delay or authorize a safety action.

The HTTP trigger accepts `synapsevm.cre-validation-request.v1`, the commitment-only envelope exported from Verify. It deterministically checks:

- the SHA-256 request digest;
- the receipt-to-Stack link;
- the receipt-to-package link;
- the shape of the previous-receipt link.

It explicitly reports `false` for receipt signature verification and replay. Raw sensor input, replay state, execution events, and actuator values are not included in this first public envelope.

## Local checks

```bash
bun install --frozen-lockfile
bun test
bun run typecheck
bun run compile
```

The unit tests exercise the deterministic validator. `bun run compile` compiles `workflow.ts` to CRE-compatible WASM with the official TypeScript SDK toolchain.

## CRE simulation

From the `cre` directory, after installing and authenticating the CRE CLI:

```bash
cre workflow simulate neuroproof-workflow --target staging-settings --non-interactive --trigger-index 0 --http-payload @C:/path/to/exported.cre-request.json
```

The staging configuration deliberately uses an unauthenticated HTTP trigger because Chainlink permits an empty trigger configuration only in simulation. Local simulation runs one node and is not DON consensus.

Before deployment, replace `REPLACE_WITH_AUTHORIZED_EVM_ADDRESS` in `config.production.json`. Production HTTP triggers require an authorized EVM key. Deploying the workflow and adding a portable DON-signed report are separate release steps; this repository does not claim either has happened.
