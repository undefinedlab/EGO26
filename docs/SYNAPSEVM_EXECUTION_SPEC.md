# SynapseVM fixed-v1 execution contract

This documents the current Rust and browser reference behavior. The September notes are roadmap inputs; examples in them do not override executable semantics.

- Values are signed int32 Q16.16. Addition saturates to int32. Multiplication uses an exact signed 64-bit product, arithmetic right shift by 16 (negative values round toward negative infinity), then saturation. Float adapter conversion rounds nearest, ties away from zero, then saturates. Non-finite browser/Python adapter inputs are rejected.
- For each step, input length must match the channel list. Inputs drive targets in channel/target array order. Runtime assist is an engineered modeling choice: the named loom channel at >= 9830 drives trigger neurons with loom+32768 and danger neurons with loom. A peak input >= 16384 additionally drives danger with peak and trigger with trunc(peak/2). Overlapping target lists accumulate each contribution.
- CSR edges are grouped by postsynaptic neuron. Iterate posts and stored edges in ascending array order; accumulate saturating weights from previous-step spikes. Add the resulting synaptic current after external drive. These edges have one-step delay.
- Neurons update in ascending index order: v=sat(mul(v,leak)+current); spike iff v>=threshold, then reset. No refractory counter exists in fixed-v1. No implicit queue, variable synaptic delay, or multi-rate scheduler is implemented.
- Decoder rates are saturating Q16 spike sums divided by channel population length, truncating toward zero. Danger sums danger and trigger rates. Trigger is any trigger spike OR danger>=declared threshold OR danger>=6554. AvoidX=right-left. Outputs are danger, avoidX, avoidY, trigger (0/1).
- Snapshot encoding is little-endian tick:u64, count:u32, then voltage:i32 + spike:u8 (0 or 1) per neuron. Malformed snapshots are rejected before mutation. Browser ticks must be nonnegative safe integers; Rust supports u64. Tick is a supplied label; recurrent state advances once per call, without implicit catch-up.
- Sparse trace order is ascending neuron index. Each leaf is Keccak-256(tick LE u64 || neuron LE u32 || 1 byte). The existing Merkle crate defines tree reduction; empty trace is 32 zero bytes. Off mode does not collect trace. State root is Keccak-256(snapshot bytes).
- Browser/native conformance checks all output values, full snapshot bytes, and complete spike sequences across 132 steps and four bundled models. It does not certify WASM target execution; that build has not been run. The browser implementation is independently written, with BigInt fixed multiplication.

## Receipt v2

New evidence uses synapsevm.neuroreceipt.v2. Canonical signed JSON now includes encodedInputRoot, localTimestampUs, and signatureScheme in addition to previous fields. Receipt ID is Keccak-256(canonical message with receiptId empty); the signature covers the message with the populated ID. All claim fields are bound. Legacy v1 samples are preserved, but the strict verifier rejects v1 and asks for regenerated evidence.

Replay compares exact block bytes, runtime identity, both input commitments, pre/post state, sparse trace, every action field and action hash, receipt ID and Ed25519 signature. A bundled public key establishes signature consistency only: device trust, chain completeness, hardware attestation, publisher trust, and physical actuation remain unproven. Nonzero Stack roots are rejected until composed runtime replay exists. Parse, missing-file and invalid-state failures return valid:false.
