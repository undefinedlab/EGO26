# Compose

The workspace is a typed graph editor with multiple node instances, editable rates and parameters, undo/redo, explicit port connections, adapter suggestions, persisted drafts, and versioned package imports.

## Available execution

Collision Shield, Emergency Brake, and Safety Override run the exact locked LoomGuard model through explicit adapters and control nodes to simulated actuator commands. The 3D viewport visualizes these commands using synthetic recorded features; it is not a physics or hardware benchmark.

BioPilot is a source template. FlowSense, HeadingCell and TargetTrack currently expose a shared reflex decoder in their bundled models, not their advertised output ABIs. The compiler lists those gaps and refuses to execute those source-only packages.

## Runtime contract

- JavaScript runtime: synapsevm-compose-js-v1; fixed-point neural model runtime: synapsevm-fixed-v1.
- Each step advances a 1 ms logical clock. Valid node rates are 25, 50, 100, 125, 200, 250, 500 and 1000 Hz.
- Ready nodes use deterministic priority/topological order. Each input uses explicit LATEST delivery. Slower producers' values are held.
- PreviousValue reads its prior value and commits its new input after the scheduled graph tick. Implicit feedback is rejected.
- Sensor input is supplied by node ID. EventCamera and WorldState use four Q16.16 features: depth_front, depth_left, depth_right and loom. This is not raw image ingestion.
- SafetyGate and Arbiter honor the neural trigger or configured danger threshold. Safety sets forward speed to zero and retains the avoidance direction. BrakeDecoder maps this command to a simulated brake.
- Latency is an estimated compute path. It excludes sensor acquisition, scheduling waits, hardware drivers and wall-clock execution overhead.
- All sensor inputs due on a tick must be supplied. Failed steps restore the complete prior state. Concurrent steps/state mutation are rejected.

## Build and export

A .synapse file contains canonical graph settings, exact module JSON bytes, dependency digests, scheduling periods, receipt policy and runtime identity. Stack identity excludes visual positions and includes all execution settings. Import recomputes the entire package. Legacy source packages are checked, then upgraded to the current source plan when opened in Compose.

Download both the .synapse package and compose-runtime.mjs. The latter is a bundled ES module with no npm or website dependency. It exports loadCompiledStack, scenarioInput and replayStack. Node 22+ supports its Web Crypto dependency; browsers require a secure context.

Build the runtime export with npm run build:compose-runtime. npm run build:lab also regenerates it. Run npm run test:compose and npm run test:verification for regression checks.

WASM, Rust and ROS2 composed exports are not implemented.

## Evidence and Library integration

FAST emits no receipts. AUDIT records critical actuator-output changes. DEBUG records every executed tick. Receipts bind the Stack, canonical package hash, recorded input, pre-state, neural events, control decisions, actuator commands, post-state and receipt-chain context. They are unsigned local evidence, not hardware attestation or proof of physical actuation.

Use Replay in fresh runtime or Open in Verify to reproduce a captured decision. Downloaded replay bundles require their exact Stack package. The verifier checks complete receipt equality and reports the scope explicitly.

Publish to local Library transfers the built package to the release form. Published Stacks reopen with exact version and module bytes. Publication validates package integrity; it does not silently run integration tests or attach independent attestations.

Drafts are stored per browser origin under synapsevm.compose.draft.v2. Save draft exports layouts and imported module bytes. Local publication data remains in .synapse-library.
