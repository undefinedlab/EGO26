# Verification workspace

Verify provides three modes:
- Artifact: upload a legacy NeuroStack source package or block.json. Compute SHA-256 of the exact file bytes, optionally compare an expected digest, and check canonical source-package metadata and dependency locks.
- Local replay: upload a synapsevm.browser-replay.v1 bundle or open an event from Sim Lab. The verifier starts a fresh JavaScript VM from complete captured pre-state and compares all StepView fields and post-state bytes.
- Signed receipt: submit neuroreceipt.v2 and matching project-relative evidence/model paths to the local Rust verifier through /api/verify/replay. The receipt must match its evidence directory. Signature validation is against the included key, not authenticated device ownership.

Run npm run test:verification for adversarial and exact-replay regression coverage.

Browser replay is unsigned module evidence. It captures the exact parsed model serialization, little-endian int32 input, tick, all voltages/spikes, and full output. Its SHA-256 commitments are a separate format from Rust neuroreceipt.v2 commitments. It does not verify a composed control path or physical actuation.

Sim Lab's Inspect WHY now restores captured pre-state instead of approximating prior activity. Errors cannot return MATCH. Verify can import that session evidence; full evidence and claim reports can also be downloaded.

Every report lists source, build, artifact, deployment, execution, replay, external and anchor claims. A computed hash is not an expected-hash match. A local replay match is not an independent implementation or device attestation. External confidential validation, hardware attestation and public anchoring remain unavailable/unverified.

Compose now supports synapsevm.compose-package.v1 artifacts and synapsevm.stack-replay.v1 replay bundles. Upload both or use Open in Verify from Compose. Full Stack replay checks neural events, arbitration, final commands and state under the exact package identity; these receipts remain unsigned.
