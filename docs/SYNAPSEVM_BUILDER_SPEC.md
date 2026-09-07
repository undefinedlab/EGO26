# SynapseVM — Builder Specification

> **Working thesis:** SynapseVM compiles biologically derived neural circuits into tiny deterministic SNN controllers that run locally in real time and produce cryptographically replayable evidence for every critical action.
>
> **Product sentence:** *The verified nervous system for autonomous machines.*
>
> **Hackathon objective:** Build a convincing end-to-end implementation proving that a real connectome-derived circuit can be packaged as a reusable `NeuroBlock`, composed with other blocks, run locally inside a 3D robotics simulator, and later validated from a cryptographic `NeuroReceipt` without placing blockchain in the reflex loop.

---

## 0. Builder Rule: What We Are Actually Building

Do **not** build “a fruit-fly brain onchain.”

Build a small developer platform with four primitives:

1. **NeuroCompiler** — connectome/circuit data → normalized executable SNN artifact.
2. **SynapseVM Runtime** — deterministic local fixed-point SNN execution.
3. **NeuroReceipt** — tamper-evident execution witness for important decisions.
4. **NeuroLab** — interactive 3D simulator, block explorer, composer, benchmark and replay UI.

Web3 is the **trust/discovery/settlement plane**, not the physical control plane.

```text
                    SLOW / TRUST PLANE

The Graph / ERC-8004 ── discover + reputation + execution history
           │
           ▼
Chainlink CRE ───────── validate/replay receipts, optional confidential inputs
           │
           ▼
Onchain commitments ── validation + batch roots
           │
           ▼
Hedera ──────────────── optional license / metered settlement

==============================================================

                    FAST / CONTROL PLANE

Sensor → Encoder → Local SynapseVM → Motor action
                       │
                       └── NeuroReceipt written locally
```

**Hard rule:** no search, payment, oracle, remote RPC, blockchain transaction, or TEE network round trip may be required before `BRAKE`, `AVOID`, `TURN`, or another critical action is emitted.

---

# 1. Success Criteria

The hackathon build is successful if all of the following work end-to-end.

### Must-have

- [ ] At least **one real connectome-derived circuit** is imported from FlyWire/MaleCNS data.
- [ ] Four `NeuroBlock` artifacts exist behind a common interface.
- [ ] At least two blocks are meaningfully composable in one controller.
- [ ] SynapseVM executes locally and deterministically.
- [ ] The 3D simulator can run at least **8 scenarios**: 2 scenarios per primitive.
- [ ] A critical output creates a `NeuroReceipt`.
- [ ] Clicking **WHY?** rewinds the decision and shows the causal execution trace.
- [ ] Replaying the same block + state + input produces the same output hash.
- [ ] A receipt/batch is validated through Chainlink CRE or the closest production-capable CRE workflow available during the event.
- [ ] Validation metadata is anchored onchain.
- [ ] The Graph indexes discoverable blocks, compositions and validations.
- [ ] Benchmarks report **measured**, not invented, latency/model-size/RAM numbers.

### Strong bonus

- [ ] ERC-8004 identity + validation integration.
- [ ] Confidential CRE replay where private sensor data is not exposed publicly.
- [ ] Hedera license or metered settlement outside the control loop.
- [ ] Native/WASM deterministic runtime parity test.
- [ ] A circuit lesion/fault experiment visibly changes behavior and receipt hash.

### Do not spend hackathon time on

- full 166k-neuron brain simulation;
- live STDP training;
- robotics hardware unless everything else is already stable;
- zero-knowledge SNN inference;
- per-reflex onchain payments;
- recording every neural spike onchain;
- building a novel SNN interchange format when NIR can be reused.

---

# 2. Core Library: The Four NeuroBlocks

Use four visually understandable primitives that can share the same 3D visual sensor stack.

## 2.1 `LoomGuard`

**Function:** detect rapidly expanding/approaching visual objects and emit emergency avoidance.

**Target interface:**

```ts
input: {
  events: EventFrame | LowResDepthFrame,
  dtUs: number
}

output: {
  danger: number,          // fixed-point normalized
  avoidX: number,
  avoidY: number,
  trigger: boolean
}
```

**Demo A — Car:** object/pedestrian enters collision path → emergency brake.

**Demo B — Drone:** wall/obstacle approaches → evasive turn.

**Priority:** highest. This should be the best-connected-to-real-biology primitive.

---

## 2.2 `FlowSense`

**Function:** estimate optic/self-motion from visual event flow.

```ts
input: {
  events: EventFrame,
  dtUs: number
}

output: {
  flowX: number,
  flowY: number,
  rotation: number,
  confidence: number
}
```

**Demo A — Drone:** stabilize hover during lateral disturbance.

**Demo B — Rover/car:** estimate relative motion when GPS is unavailable.

---

## 2.3 `HeadingCell`

**Function:** maintain/compare heading and emit steering error.

```ts
input: {
  yawDelta: number,
  opticFlowRotation: number,
  targetBearing: number,
  dtUs: number
}

output: {
  headingEstimate: number,
  headingError: number,
  steer: number
}
```

**Demo A — Drone:** orient toward waypoint.

**Demo B — Rover:** maintain corridor direction through noisy turns.

---

## 2.4 `TargetTrack`

**Function:** select and track a small moving visual target.

```ts
input: {
  events: EventFrame,
  dtUs: number
}

output: {
  targetX: number,
  targetY: number,
  targetStrength: number,
  visible: boolean
}
```

**Demo A — Drone:** track another moving drone/ball.

**Demo B — Camera robot:** keep a moving target centered.

---

# 3. Composition: The Flagship `BioPilot` Stack

The hackathon must show that NeuroBlocks are more valuable together than separately.

```text
                 ┌───────────────┐
Camera / events ─┤  TargetTrack  ├────────────┐
                 └───────────────┘            │
                                              ▼
                 ┌───────────────┐      ┌─────────────┐
Camera / events ─┤   FlowSense   ├─────►│ HeadingCell │────► nominal steering
                 └───────────────┘      └──────┬──────┘
                                                │
                                                ▼
                 ┌───────────────┐       ┌────────────┐
Camera / depth ──┤   LoomGuard   ├──────►│   Arbiter  │────► actuator
                 └───────────────┘       └────────────┘
                         │                      ▲
                         └──── hard override ──┘
```

The arbiter must encode explicit priorities.

```yaml
rules:
  - if: LoomGuard.trigger
    output: emergency_avoidance
    priority: 100
  - if: TargetTrack.visible
    output: HeadingCell.steer
    priority: 50
  - else:
    output: maintain_heading
    priority: 10
```

This lets the project claim **typed and priority-aware composition**, not just “several models connected together.”

---

# 4. NeuroBlock Artifact Format

A NeuroBlock is the fundamental portable unit.

Recommended directory:

```text
blocks/loomguard/1.0.0/
├── manifest.json
├── circuit.nir
├── weights.bin
├── topology.bin
├── adapters/
│   ├── input.json
│   └── output.json
├── provenance.json
├── benchmarks.json
├── papers.json
└── test-vectors/
    ├── case-001.input.bin
    ├── case-001.expected.json
    └── ...
```

Example manifest:

```json
{
  "schema": "synapsevm.neuroblock.v1",
  "name": "LoomGuard",
  "version": "1.0.0",
  "description": "Connectome-derived looming/avoidance reflex primitive",
  "organism": "Drosophila melanogaster",
  "sourceDataset": "male-cns:v1.0",
  "neuronModel": "LIF_FIXED_V1",
  "numericFormat": "Q16.16",
  "tickUs": 1000,
  "inputs": ["event_vision"],
  "outputs": ["danger", "avoid_x", "avoid_y", "trigger"],
  "deadlineUs": 10000,
  "priorityClass": "safety_reflex",
  "stateful": true,
  "nirSha256": "...",
  "topologySha256": "...",
  "weightsSha256": "...",
  "provenanceSha256": "...",
  "blockRoot": "0x..."
}
```

The `blockRoot` must commit to every execution-relevant artifact.

Example:

```text
blockRoot = keccak256(
    canonical(manifest_without_root)
  || nirHash
  || topologyHash
  || weightsHash
  || inputAdapterHash
  || outputAdapterHash
)
```

Canonical JSON serialization is required before hashing.

---

# 5. Connectome → NeuroBlock Compiler

## 5.1 Source data

Use MaleCNS v1.0 and/or FlyWire data through Janelia's neuPrint APIs or downloadable graph tables.

MaleCNS provides programmatic access through `neuprint-python`, including neuron annotations and adjacency queries. The published v1.0 data also exposes full segment-to-segment connection strengths and synaptic tables.

Canonical resources:

- <https://male-cns.janelia.org/>
- <https://male-cns.janelia.org/download/>
- <https://neuprint.janelia.org/>

## 5.2 Compiler stages

```text
1. circuit query
       ↓
2. fetch neuron IDs + directed weighted edges
       ↓
3. normalize annotations + neurotransmitter/sign assumptions
       ↓
4. prune graph to selected circuit
       ↓
5. map connectivity weights → fixed-point synaptic weights
       ↓
6. assign deterministic LIF parameters
       ↓
7. create sensor input and actuator output adapters
       ↓
8. export NIR
       ↓
9. compile NIR subset → SynapseVM bytecode/data
       ↓
10. generate provenance + blockRoot + test vectors
```

## 5.3 Practical hackathon compromise

Do not pretend the raw connectome alone gives a physically complete neuron simulator.

Separate:

- **connectomic provenance:** actual neuron IDs + connectivity are sourced from the dataset;
- **computational dynamics:** LIF parameters are an explicit reproducible modeling choice;
- **adapter semantics:** mapping robot sensors to biological inputs and neural outputs to robot actions is engineered by SynapseVM.

Expose those distinctions in the UI.

## 5.4 NIR

Use NIR as the interchange representation where practical. NIR is a common representation for neuromorphic/SNN computation and is supported across multiple simulators and hardware platforms.

Canonical documentation:

- <https://neuroir.org/docs/>
- <https://neuroir.org/docs/what/>

SynapseVM should compile/use a **restricted deterministic subset** of NIR rather than claiming all NIR programs are deterministic.

---

# 6. Deterministic SynapseVM Runtime

This is the hardest and most important engineering component.

## 6.1 Runtime goals

For a fixed:

```text
Block M
State S
Input I
Tick T
```

SynapseVM must produce bit-identical:

```text
(State S', Output O, Trace R)
```

across replay-capable builds.

## 6.2 Avoid floating-point consensus problems

Use fixed-point arithmetic for the hackathon execution path.

Recommended:

```text
membrane voltage: int32, Q16.16
weights:          int16/int32 fixed point
thresholds:       int32
leak:             fixed-point multiplier
spike:            uint8/bool
time/tick:         uint64
```

Example LIF tick:

```text
v_i(t+1) = leak(v_i(t)) + Σ_j(w_ji * spike_j(t)) + input_i(t)

if v_i >= threshold_i:
    spike_i = 1
    v_i = reset_i
else:
    spike_i = 0
```

Define overflow behavior explicitly. Prefer saturating arithmetic.

## 6.3 Runtime implementation

Recommended:

- Rust core for deterministic execution.
- Compile to native library for validator/backend.
- Compile same core to WASM for browser execution where possible.
- Python is allowed for **compiler/data preparation**, not as the canonical deterministic execution engine.

API:

```rust
fn init(block: &NeuroBlockBytes) -> VmState;

fn step(
    state: &mut VmState,
    input: &[i32],
    tick: u64,
    trace_mode: TraceMode
) -> StepResult;
```

```rust
struct StepResult {
    output: Vec<i32>,
    state_root: [u8; 32],
    trace_root: [u8; 32],
    fired_count: u32,
}
```

---

# 7. NeuroReceipt: Proof-Carrying Execution

A signed NeuroReceipt must be generated for **meaningful control decisions**, not every simulation tick.

Trigger examples:

- emergency brake;
- avoidance override;
- target acquired/lost;
- block switch;
- waypoint reached;
- safety threshold crossed.

## 7.1 Receipt schema

```json
{
  "schema": "synapsevm.neuroreceipt.v1",
  "receiptId": "0x...",
  "blockRoot": "0x...",
  "stackRoot": "0x...",
  "deviceId": "simulator-001",
  "sequence": 184293,
  "localTimestampUs": 192338238123,
  "tick": 8921,

  "inputRoot": "0x...",
  "encodedInputRoot": "0x...",
  "stateBeforeRoot": "0x...",
  "traceRoot": "0x...",
  "stateAfterRoot": "0x...",

  "actionType": "AVOID_LEFT",
  "actionDataHash": "0x...",

  "previousReceiptHash": "0x...",
  "runtimeHash": "0x...",
  "signatureScheme": "ed25519",
  "signature": "..."
}
```

## 7.2 What the receipt proves

A valid receipt can support these claims:

1. the declared NeuroBlock/NeuroStack identity;
2. the committed input and pre-state;
3. a committed neural execution trace;
4. the committed post-state and actuator output;
5. ordering relative to earlier receipts through `previousReceiptHash`;
6. replayability if the input/state evidence is made available to the verifier.

It does **not** automatically prove that a physical-world fact was true. For example, a receipt proves what committed sensor input was processed, not necessarily that a real pedestrian existed unless the sensor itself is trusted/attested.

## 7.3 Sparse trace

Do not save every membrane value for every neuron.

For demo mode, retain:

- input channel activations;
- neurons that fired;
- optionally top incoming causal contributors;
- output neuron/decoder activations;
- output action.

Create leaf hashes such as:

```text
H(tick || neuronId || spike || optionalVoltageBucket)
```

Merkleize them into `traceRoot`.

## 7.4 Receipt chain

```text
R[n] = H(
  blockRoot
  || inputRoot
  || stateBeforeRoot
  || traceRoot
  || stateAfterRoot
  || actionDataHash
  || R[n-1]
)
```

This makes deletion/reordering of recorded critical events detectable once a later root has been anchored.

---

# 8. “WHY?” Replay Experience

This is the primary WOW interaction.

When a user clicks **WHY?** on an action:

1. pause/rewind simulator to the receipt tick;
2. render the relevant sensor stimulus;
3. highlight input channels;
4. animate only the sparse causal firing trace;
5. show threshold crossing/output decoder;
6. display final action;
7. locally replay the receipt;
8. compare replay hashes;
9. show `MATCH` or `MISMATCH`.

UI example:

```text
WHY DID THE DRONE TURN LEFT?

World tick: 8921
Closing distance: 0.81m
Relative velocity: 4.3m/s

Sensor root      0x731... ✓
State before     0x099... ✓
LoomGuard        0xabc... ✓
Trace root       0x551... ✓
Action           AVOID_LEFT
Replay output    AVOID_LEFT ✓

NEURORECEIPT REPLAY: VERIFIED
```

Do **not** call this philosophical or semantic explainability. Call it **computational causality / replayable execution provenance**.

---

# 9. NeuroLab 3D Simulator

## 9.1 Frontend stack

Recommended:

- Next.js + TypeScript;
- React Three Fiber / Three.js;
- Web Worker for local WASM runtime so rendering stays smooth;
- Zustand or equivalent small state store;
- lightweight time-series charts for spikes/latency.

## 9.2 Reusable simulation engine

Do not build eight separate games.

Create:

```ts
interface Scenario {
  id: string;
  embodiment: 'car' | 'drone' | 'rover' | 'camera';
  block: string;
  world: WorldConfig;
  sensors: SensorConfig[];
  success: SuccessCondition;
}
```

Example:

```json
{
  "id": "loomguard-drone-wall",
  "embodiment": "drone",
  "block": "LoomGuard@1.0.0",
  "world": {
    "initialSpeed": 4,
    "obstacles": ["moving_wall"]
  },
  "sensors": ["event_camera", "depth_proxy"],
  "success": "no_collision"
}
```

## 9.3 Scenario list

### LoomGuard
- car emergency braking;
- drone obstacle avoidance.

### FlowSense
- drone disturbance stabilization;
- rover self-motion estimation.

### HeadingCell
- drone waypoint heading;
- rover corridor navigation.

### TargetTrack
- drone follows moving target;
- pan/tilt camera centers target.

## 9.4 Lab controls

Must include:

- `ADD OBSTACLE`
- `CHANGE SPEED`
- `ADD SENSOR NOISE`
- `DISABLE BLOCK`
- `LESION NEURON`
- `SWAP VERSION`
- `REPLAY`
- `WHY?`

A lesion changes the circuit artifact, so it must produce a different block/version/hash before rerunning if treated as a permanent model change.

---

# 10. NeuroStack and Typed Composition

NeuroBlocks expose explicit port types.

Example:

```ts
type PortType =
  | 'event_vision'
  | 'optic_flow'
  | 'heading_delta'
  | 'target_bearing'
  | 'avoidance_vector'
  | 'steering_command';
```

Composition should fail fast:

```text
ERROR SVM-COMP-001
LoomGuard expects input event_vision
Received gps_coordinate
```

Stack manifest:

```json
{
  "schema": "synapsevm.neurostack.v1",
  "name": "BioPilot",
  "version": "0.1.0",
  "nodes": [
    {"id": "loom", "blockRoot": "0x..."},
    {"id": "flow", "blockRoot": "0x..."},
    {"id": "heading", "blockRoot": "0x..."}
  ],
  "edges": [
    {"from": "flow.flowX", "to": "heading.opticFlowRotation"}
  ],
  "arbitration": {
    "loom.trigger": "hard_override"
  },
  "stackRoot": "0x..."
}
```

`stackRoot` commits to block roots, wiring and arbitration rules.

---

# 11. Trust Levels

Expose a simple trust badge system in the registry.

### Level 0 — Unverified

Model exists but no reproducible provenance.

### Level 1 — Provenance Verified

- artifact hashes;
- source dataset references;
- fixed version;
- deterministic test vectors.

### Level 2 — Runtime Attested

- signed runtime/device receipt;
- runtime hash;
- state transition commitment.

### Level 3 — Replay Verified

- input evidence available to verifier;
- deterministic replay succeeds;
- replay output + state hashes match.

### Future Level 4 — Succinct Cryptographic Proof

Potential zkVM/zkML proof for deterministic SNN execution. **Not hackathon scope.**

---

# 12. Chainlink CRE Integration — Validation Plane

Chainlink CRE should validate evidence **after or independently from the local action**.

Canonical docs entry point:

- <https://docs.chain.link/>

Use the latest CRE CLI/templates available during implementation; CRE is actively evolving, so do not hard-code assumptions from old examples.

## 12.1 Basic workflow

```text
Local runtime
   ↓
NeuroReceipt / receipt batch
   ↓
CRE workflow
   ├── fetch receipt evidence
   ├── verify signatures
   ├── resolve registered blockRoot
   ├── verify receipt chain
   ├── optional deterministic replay
   └── produce validation result
   ↓
ERC-8004 Validation Registry / validation contract
```

## 12.2 Confidential variant

Preferred sponsor demo if supported cleanly by the current CRE confidential-compute tooling:

```text
PRIVATE:
  sensor input
  stateBefore
  execution trace/replay data

PUBLIC:
  blockRoot
  input commitment
  output/action commitment
  receiptRoot
  replayMatched = true
```

Narrative:

> “The manufacturer can prove the registered neural controller generated the claimed decision without publishing proprietary sensor frames.”

## 12.3 Verification result

```json
{
  "requestHash": "0x...",
  "receiptRoot": "0x...",
  "blockRoot": "0x...",
  "signatureValid": true,
  "receiptChainValid": true,
  "replayAttempted": true,
  "replayMatched": true,
  "validatorVersion": "cre-neuroproof-0.1.0"
}
```

---

# 13. ERC-8004 Integration

ERC-8004 defines Identity, Reputation and Validation registries for discoverable agents with pluggable trust models, including validation approaches based on re-execution and TEE oracles.

Canonical spec:

- <https://eips.ethereum.org/EIPS/eip-8004>

Use ERC-8004 for **deployed composite agents** such as `BioPilot`, not necessarily for every individual neuron block.

Example agent registration concept:

```json
{
  "type": "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
  "name": "BioPilot Demo Agent",
  "description": "Autonomous controller composed from verified SynapseVM NeuroBlocks",
  "services": [
    {
      "name": "web",
      "endpoint": "https://<demo>/agents/biopilot"
    }
  ],
  "x402Support": false,
  "active": true,
  "supportedTrust": [
    "tee-attestation",
    "re-execution"
  ]
}
```

For validation, submit the NeuroReceipt batch/evidence URI + hash through the ERC-8004 Validation Registry where deployment/support is feasible.

---

# 14. The Graph Integration — Discovery and History

The Graph already indexes ERC-8004/Agent0 data across multiple chains with a shared schema. Use that where it helps agent discovery, then add a SynapseVM-specific data product/subgraph only for fields not represented by Agent0.

Reference:

- <https://thegraph.com/blog/agent0-subgraphs-live-erc-8004-agent-economy/>

## 14.1 Index these entities

```graphql
type NeuroBlock @entity {
  id: Bytes!
  name: String!
  version: String!
  organism: String!
  sourceDataset: String!
  neuronCount: Int!
  synapseCount: Int!
  blockRoot: Bytes!
  manifestURI: String!
  publisher: Bytes!
  createdAt: BigInt!
}

type NeuroStack @entity {
  id: Bytes!
  name: String!
  version: String!
  stackRoot: Bytes!
  manifestURI: String!
  blocks: [NeuroStackBlock!]! @derivedFrom(field: "stack")
}

type Validation @entity {
  id: Bytes!
  requestHash: Bytes!
  receiptRoot: Bytes!
  blockRoot: Bytes!
  validator: Bytes!
  score: Int!
  tag: String
  timestamp: BigInt!
}

type ReceiptBatch @entity {
  id: Bytes!
  deviceId: String!
  firstSequence: BigInt!
  lastSequence: BigInt!
  receiptRoot: Bytes!
  validation: Validation
}
```

## 14.2 Queries the UI should demonstrate

```graphql
# Find verified visual safety blocks
neuroBlocks(where: {
  organism: "Drosophila melanogaster"
}) { ... }
```

Plus application-level filters in your backend/indexed metadata:

- capability = collision avoidance;
- deterministic = true;
- replay validation = passed;
- p95 latency below X;
- model size below Y.

The product value is **standardized discovery**: a robot/developer can compare interoperable neural primitives using one schema.

---

# 15. Hedera Integration — Optional Economic Plane

Hedera must stay out of the control loop.

Use it for one narrow capability:

### Option A — prepaid license

```text
Developer chooses LoomGuard@1
        ↓
license purchase
        ↓
signed license entitlement
        ↓
download/install locally
        ↓
execute offline many times
```

### Option B — metered batch settlement

```text
10,000 local executions
       ↓
usage accumulator / Merkle root
       ↓
one settlement transaction
```

Do **not** implement a payment before every braking or steering decision.

Hedera docs:

- <https://docs.hedera.com/>

If an x402 sponsor track is still relevant during the event, x402 can gate **download/license/API access**, not hard real-time reflex execution.

---

# 16. Smart Contracts

Keep contracts minimal.

## 16.1 `NeuroRegistry.sol`

If a custom registry is still needed beyond ERC-8004:

```solidity
struct BlockRecord {
    bytes32 blockRoot;
    string manifestURI;
    address publisher;
    uint64 createdAt;
    bool active;
}
```

Functions:

```solidity
registerBlock(bytes32 blockRoot, string calldata manifestURI)
registerStack(bytes32 stackRoot, string calldata manifestURI)
deactivateBlock(bytes32 blockRoot)
```

Events:

```solidity
NeuroBlockRegistered(bytes32 indexed blockRoot, address indexed publisher, string manifestURI)
NeuroStackRegistered(bytes32 indexed stackRoot, address indexed publisher, string manifestURI)
```

## 16.2 Validation

Prefer ERC-8004 Validation Registry if available and appropriate.

If not, implement a tiny fallback:

```solidity
recordValidation(
    bytes32 requestHash,
    bytes32 receiptRoot,
    bytes32 blockRoot,
    uint8 score,
    string calldata evidenceURI
)
```

Do not store sensor data or full execution traces onchain.

---

# 17. Benchmarking: Prove the SNN Advantage Carefully

Never claim “SNNs are better than LLMs” globally.

Claim:

> For deterministic, high-frequency sensory control, a tiny specialized local neural primitive can avoid the size, network dependency and token-generation latency of a general LLM/VLM agent loop.

## 17.1 Required measurements

For each NeuroBlock:

- artifact/model bytes;
- loaded RAM;
- startup time;
- average tick duration;
- p50 action latency;
- p95 action latency;
- CPU utilization;
- number of fired spikes per tick;
- success/failure rate across scenarios;
- false positive reflex rate where applicable.

## 17.2 Baselines

Use two honest baselines:

### Baseline A — conventional controller or tiny ANN

This is the scientifically relevant engineering competitor.

### Baseline B — general VLM/LLM agent loop

Use this only to demonstrate why semantic/cloud agents are a poor **hard real-time reflex loop**, not to claim inferior intelligence.

## 17.3 Energy

Do not publish “microwatts” or an energy multiplier unless measured with a defensible methodology/hardware.

If energy cannot be measured, show:

- CPU time;
- memory;
- serialized size;
- network calls = 0 for local control;
- operations/spikes.

---

# 18. Repository Structure

Recommended monorepo:

```text
synapsevm/
├── README.md
├── pnpm-workspace.yaml
├── Cargo.toml
├── apps/
│   ├── neurolab-web/            # Next.js + R3F simulator/explorer
│   └── validator-api/           # receipt evidence/replay endpoint
│
├── crates/
│   ├── synapsevm-core/          # deterministic fixed-point runtime
│   ├── synapsevm-wasm/          # WASM bindings
│   ├── synapsevm-types/         # receipts/manifests canonical types
│   └── synapsevm-merkle/        # trace + batch commitments
│
├── compiler/
│   ├── synapse_compiler/        # Python
│   │   ├── neuprint_source.py
│   │   ├── graph_normalize.py
│   │   ├── nir_export.py
│   │   ├── quantize.py
│   │   └── package_block.py
│   └── notebooks/               # exploration only, not production path
│
├── blocks/
│   ├── loomguard/
│   ├── flowsense/
│   ├── headingcell/
│   └── targettrack/
│
├── scenarios/
│   ├── loomguard-car.json
│   ├── loomguard-drone.json
│   └── ...
│
├── contracts/
│   ├── NeuroRegistry.sol
│   └── scripts/
│
├── cre/
│   └── neuroproof-workflow/
│
├── graph/
│   └── synapsevm-subgraph/
│
├── hedera/
│   └── licensing-demo/
│
├── tests/
│   ├── determinism/
│   ├── receipt-replay/
│   ├── compiler/
│   └── scenarios/
│
└── docs/
    ├── neuroblock-v1.md
    ├── neuroreceipt-v1.md
    └── security-model.md
```

---

# 19. API Contracts

## 19.1 Browser/WASM runtime

```ts
interface SynapseVM {
  load(block: Uint8Array): Promise<BlockHandle>;
  reset(handle: BlockHandle): void;
  step(handle: BlockHandle, input: Int32Array, tick: bigint): StepResult;
  snapshot(handle: BlockHandle): Uint8Array;
  stateRoot(handle: BlockHandle): Hex32;
}
```

## 19.2 Receipt builder

```ts
interface ReceiptBuilder {
  begin(inputRoot: Hex32, stateBeforeRoot: Hex32): void;
  addTraceEvent(event: TraceEvent): void;
  finalize(action: Action, stateAfterRoot: Hex32): NeuroReceipt;
}
```

## 19.3 Replay validator

```http
POST /v1/replay
Content-Type: application/json

{
  "receipt": { ... },
  "evidenceUri": "ipfs://..."
}
```

Response:

```json
{
  "valid": true,
  "blockRootMatch": true,
  "stateBeforeMatch": true,
  "traceRootMatch": true,
  "stateAfterMatch": true,
  "actionMatch": true
}
```

---

# 20. Determinism Test Suite

This must exist before sponsor work.

For every block, ship 20–100 golden vectors.

Test:

```text
native Rust execution
      ==
WASM execution
      ==
validator replay
```

Compare:

- output bytes;
- final state bytes;
- `stateRoot`;
- `traceRoot`.

CI should fail on mismatch.

Pseudo-test:

```rust
#[test]
fn loomguard_case_001_is_bit_identical() {
    let input = load_fixture("case-001.input.bin");
    let expected = load_fixture("case-001.expected.json");

    let result = run_fixture(input);

    assert_eq!(result.action_hash, expected.action_hash);
    assert_eq!(result.state_root, expected.state_root);
    assert_eq!(result.trace_root, expected.trace_root);
}
```

---

# 21. Security / Threat Model

Document what is and is not proven.

| Threat | Mitigation | Residual limitation |
|---|---|---|
| modified model | `blockRoot` | cannot prove biological truth |
| modified runtime | runtime hash / optional attestation | local commodity device may not be trusted |
| deleted receipts | hash-chained receipts + later anchor | tail can be dropped before anchoring |
| modified evidence | Merkle/hash commitments | availability still required for replay |
| spoofed sensor | trusted sensor path in future | simulator only proves simulator state |
| dishonest validator | independent replay / CRE / multiple validators | depends on validator trust model |
| floating-point divergence | fixed-point canonical runtime | limits supported operators |
| payment latency | settlement outside control loop | licensing policy must allow offline execution |

Important language:

- **Attestation** proves something about the execution environment/configuration.
- **Replay verification** proves the committed deterministic computation reproduces.
- Neither proves physical reality unless the sensor/source is itself trusted.

---

# 22. UI Information Architecture

Primary nav:

```text
EXPLORE | SIMULATE | COMPOSE | VERIFY | BENCHMARK
```

## Explore

Cards:

```text
LoomGuard v1.0
184 neurons*        4.2K synapses*
Biology: Drosophila
Replay verified ✓
p95: 2.1 ms*

[SIMULATE] [DETAILS] [+ COMPOSE]
```

`*actual values only after implementation/measurement.`

## Simulate

Split view:

```text
┌────────────────────────────┬───────────────────────────┐
│        3D WORLD            │      NEURAL TRACE         │
│                            │                           │
│ drone  →        obstacle   │  ○─○─●─●                  │
│                            │     ╲ │                   │
│                            │      ●●                   │
└────────────────────────────┴───────────────────────────┘

INPUT          OUTPUT          RUNTIME
0.81m          AVOID_LEFT      local WASM
4.3m/s         danger .94      1.8ms*

[WHY?] [REPLAY] [LESION] [ADD NOISE]
```

## Compose

Node editor with typed ports and hard-override edge.

## Verify

Show receipt fields + local replay + CRE validation + onchain validation.

## Benchmark

Measured tables/charts only.

---

# 23. Demo Script — 3 Minutes

## 0:00–0:20 — Problem

> “LLM agents are good at deliberation. They are the wrong abstraction for a millisecond reflex. Autonomous machines need a nervous system.”

Show four NeuroBlocks.

## 0:20–0:45 — Library

> “SynapseVM packages biologically derived circuits into tiny portable neural functions.”

Open `LoomGuard` provenance: source dataset → neuron IDs → compiled artifact hash.

## 0:45–1:15 — Same block, two embodiments

Run car braking, then drone avoidance.

Say:

> “This is the same NeuroBlock. We changed the sensor/motor adapter, not the neural circuit.”

## 1:15–1:45 — Composition

Run `BioPilot`: target tracking + heading + flow, then suddenly add obstacle.

`LoomGuard` hard-overrides heading and the drone avoids collision.

## 1:45–2:15 — WHY?

Click `WHY?`.

Rewind to stimulus → firing trace → threshold → action.

Local deterministic replay reports exact hash match.

Say:

> “Every critical action carries a replayable NeuroReceipt.”

## 2:15–2:40 — Verification

Submit receipt/batch to CRE validation.

Show validation result anchored through ERC-8004/fallback contract and visible in The Graph.

Say:

> “Blockchain never sits in the reflex loop. It verifies what ran after the machine acted.”

## 2:40–3:00 — Product vision + benchmark

Show model size/p50/p95/RAM versus baselines.

Finish:

> “Hugging Face distributes models. SynapseVM distributes verifiable neural functions for machines — a nervous system for embodied agents.”

---

# 24. Build Order

Follow this order strictly.

## Phase 0 — Skeleton

- monorepo;
- web app boots;
- Rust/WASM hello-world runtime;
- one deterministic test.

## Phase 1 — LoomGuard end-to-end

- obtain one real connectome circuit/graph;
- package `LoomGuard`;
- deterministic runtime;
- drone obstacle scene;
- local action;
- receipt;
- replay.

**Do not continue until this works.**

## Phase 2 — WHY? UX

- sparse trace;
- simulator rewind;
- neural trace visualization;
- deterministic match UI.

## Phase 3 — Remaining blocks

- implement three additional primitives;
- reuse sensor pipeline;
- add second scenario for each.

## Phase 4 — Composition

- BioPilot stack;
- typed ports;
- hard override;
- stack root.

## Phase 5 — Chainlink CRE

- validate one receipt;
- then batches;
- confidential replay only if feasible.

## Phase 6 — Registry + The Graph

- block/stack registration;
- ERC-8004 agent/validation if feasible;
- Graph queries in Explore/Verify pages.

## Phase 7 — Benchmarks

- run scenario suite;
- export JSON;
- render comparison UI.

## Phase 8 — Hedera

Only after everything above is stable.

- license/download payment or batch metering demo;
- keep it outside reflex path.

---

# 25. Hackathon Scope Cuts

If behind schedule, cut in this order:

1. Hedera settlement UI.
2. Confidential CRE inputs; keep standard CRE validation.
3. ERC-8004 reputation; keep identity/validation or fallback registry.
4. Two of the eight simulator scenarios.
5. `TargetTrack` sophistication.
6. NIR export polish.

Never cut:

- real connectome provenance for at least one primitive;
- deterministic local runtime;
- LoomGuard live demo;
- NeuroReceipt;
- WHY?/replay;
- one end-to-end verification path;
- measured benchmark.

---

# 26. Definition of “Done” for the Winning Technical Core

The most important E2E test should be automatable:

```text
1. Load LoomGuard@1.0.0.
2. Start simulator with deterministic seed 42.
3. Inject obstacle at tick 8000.
4. SynapseVM emits AVOID_LEFT at tick N.
5. Simulator does not collide.
6. Runtime generates NeuroReceipt R.
7. Save evidence bundle E.
8. Reset a separate validator process.
9. Load the exact artifact committed by R.blockRoot.
10. Replay E from R.stateBeforeRoot.
11. Validator produces identical action/state/trace commitments.
12. CRE validates/records the result.
13. Query indexed validation in UI.
14. Clicking WHY? reconstructs the receipt event.
```

If these fourteen steps work live, the project has a strong technical backbone even if secondary features are incomplete.

---

# 27. Suggested Evidence Bundle Format

```text
receipt-bundles/<receipt-id>/
├── receipt.json
├── input.bin
├── state-before.bin
├── trace.bin               # sparse trace only
├── action.json
├── block-manifest.json
└── meta.json
```

For confidential validation, upload/encrypt/store this through the mechanism required by the CRE workflow. Public chain data should contain commitments and validation result, not raw sensor frames.

---

# 28. Product Vocabulary

Use consistently:

- **NeuroBlock** — one reusable neural primitive.
- **NeuroStack** — composition of NeuroBlocks.
- **SynapseVM** — deterministic execution runtime/protocol.
- **NeuroCompiler** — connectome/NIR compilation pipeline.
- **NeuroReceipt** — cryptographic execution witness.
- **NeuroProof** — validation process/result, not necessarily a ZK proof.
- **NeuroLab** — simulator/explorer/composer/replay UI.
- **BioPilot** — flagship composed robotics controller.

Avoid:

- “proof that biology is correct”;
- “TEE proves the math”;
- “microwatt” without measurement;
- “zero knowledge” unless a ZK system is actually used;
- “SNNs replace LLMs.”

Preferred message:

> **LLMs deliberate. SynapseVM reacts.**

And:

> **Every critical neural action is locally fast and globally auditable.**

---

# 29. External References

These should be checked during implementation because APIs/tools may change.

### Connectome data

- MaleCNS project: <https://male-cns.janelia.org/>
- MaleCNS download/programmatic access: <https://male-cns.janelia.org/download/>
- neuPrint: <https://neuprint.janelia.org/>

### Neuromorphic representation

- NIR docs: <https://neuroir.org/docs/>
- NIR overview: <https://neuroir.org/docs/what/>

### Verification / Web3

- Chainlink developer docs / CRE entry point: <https://docs.chain.link/>
- ERC-8004 specification: <https://eips.ethereum.org/EIPS/eip-8004>
- The Graph Agent0/ERC-8004 overview: <https://thegraph.com/blog/agent0-subgraphs-live-erc-8004-agent-economy/>
- Hedera docs: <https://docs.hedera.com/>

---

# 30. Final North Star

A judge must be able to understand the project from one live sequence:

```text
REAL BIOLOGICAL CIRCUIT
        ↓
COMPILED NEUROBLOCK
        ↓
LOCAL DETERMINISTIC SNN
        ↓
OBSTACLE APPEARS
        ↓
ROBOT REACTS IMMEDIATELY
        ↓
NEURORECEIPT
        ↓
WHY? → REPLAY THE CAUSAL TRACE
        ↓
CRE VALIDATION
        ↓
ONCHAIN / ERC-8004 VALIDATION
        ↓
THE GRAPH DISCOVERY + HISTORY
```

If that works, SynapseVM is no longer “a fly-brain demo.”

It is a credible prototype of **proof-carrying neural software for autonomous machines**.
