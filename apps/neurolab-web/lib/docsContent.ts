export type DocSection = {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
  steps?: string[];
  /** Monospace process / architecture diagram */
  diagram?: string;
  note?: string;
};

export type DocPage = {
  slug: string;
  title: string;
  nav: string;
  summary: string;
  sections: DocSection[];
};

export const DOC_PAGES: DocPage[] = [
  {
    slug: "overview",
    title: "Platform overview",
    nav: "Overview",
    summary:
      "SynapseVM is software infrastructure for building, running, and proving tiny deterministic neural controllers — the reflex layer machines need when a large model is too slow, too costly, or too opaque.",
    sections: [
      {
        heading: "What the platform does",
        paragraphs: [
          "SynapseVM turns neural modules into portable software packages. You select versioned NeuroBlocks, compose them into a NeuroStack, run that stack in a deterministic runtime (SynapseVM), and — for critical decisions — emit a NeuroReceipt that another party can replay bit-for-bit.",
          "NeuroLab is the workbench on top of that stack: Discover to find modules, Compose to wire them, Simulate to watch them live, and Verify to check evidence.",
        ],
        diagram: `┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Discover   │───▶│   Compose   │───▶│  Simulate   │───▶│   Verify    │
│  find       │    │  wire &     │    │  run live   │    │  replay     │
│  modules    │    │  package    │    │  loop       │    │  evidence   │
└─────────────┘    └──────┬──────┘    └─────────────┘    └─────────────┘
                          │
                          ▼
                   .synapse package
                   (NeuroStack artifact)`,
      },
      {
        heading: "Why it exists",
        paragraphs: [
          "Planners and large models decide goals. Controllers must still react in milliseconds: dodge, brake, stabilize, veto an unsafe command. Those reactions need to be local, cheap, and auditable.",
          "SynapseVM targets that layer. It does not replace your planner. It packages the neural reflexes that must keep working when the network is gone and that must leave a trail when something critical fires.",
        ],
      },
      {
        heading: "Design constraints",
        bullets: [
          "Determinism — same stack, same input, same state ⇒ same outputs across conforming runtimes.",
          "Local-first — control ticks do not wait on a chain, oracle, or payment rail.",
          "Honest claims — a receipt proves a disclosed computation path, not physical actuation or publisher virtue by itself.",
          "Typed composition — illegal port wiring fails the graph checker before compile.",
        ],
      },
    ],
  },
  {
    slug: "architecture",
    title: "Architecture",
    nav: "Architecture",
    summary:
      "How NeuroBlocks, stacks, the runtime, and receipts fit together as one pipeline from biology-inspired modules to verifiable execution.",
    sections: [
      {
        heading: "Layers",
        paragraphs: [
          "Think of SynapseVM as four layers. Each has a clear job; none silently pretends to do another’s job.",
        ],
        diagram: `  Data / provenance          NeuroBlock library
  (datasets, circuits)  ──▶  (versioned modules)
                                    │
                                    ▼
                             NeuroStack graph
                          (typed composition)
                                    │
                                    ▼
                              SynapseVM tick
                         (deterministic runtime)
                                    │
                         critical action?
                                    │
                                    ▼
                              NeuroReceipt
                         (replayable evidence)`,
      },
      {
        heading: "Control plane vs evidence plane",
        paragraphs: [
          "The control plane is the tick path: sensors → neural modules → actuators. It must stay offline-capable and fast.",
          "The evidence plane runs after a critical action: packaging a receipt, replaying it, and (optionally) consulting external indexes or anchors. Evidence never authorizes the reflex itself.",
        ],
        note: "If a feature would add latency or network dependency inside a safety tick, it does not belong in the control plane.",
      },
      {
        heading: "Where code lives",
        bullets: [
          "NeuroLab (apps/neurolab-web) — Discover, Compose, Simulate, Verify UI.",
          "SynapseVM core (crates/) — fixed-point SNN runtime and receipt semantics.",
          "Compiler / blocks — packaging versioned NeuroBlock artifacts.",
          "Optional partners — registry, subgraph, consensus anchors, confidential validators; always post-action.",
        ],
      },
    ],
  },
  {
    slug: "neuroblocks",
    title: "NeuroBlocks",
    nav: "NeuroBlocks",
    summary:
      "A NeuroBlock is a versioned neural module with typed interfaces — the reusable unit you discover, lock, and place on a stack.",
    sections: [
      {
        heading: "Definition",
        paragraphs: [
          "A NeuroBlock ships a neural function (for example collision loom response) together with identity: name, version, interface ports, and digests over the locked model or source bytes. Consumers depend on that identity, not on a notebook sitting on someone’s laptop.",
        ],
      },
      {
        heading: "What a block declares",
        bullets: [
          "Inputs — named channels with types (vision events, heading deltas, …).",
          "Outputs — named channels the rest of the graph may consume.",
          "Runtime expectations — rate envelopes and deadlines the stack planner must respect.",
          "Provenance — where the module came from (connectome-derived, engineered, synthetic, …).",
        ],
        diagram: `        inputs                  NeuroBlock                 outputs
   ┌────────────────┐      ┌──────────────────┐      ┌────────────────┐
   │ EventVision    │─────▶│  LoomGuard@1.0   │─────▶│ avoidance_vec  │
   │ …              │      │  digest · lock   │      │ trigger        │
   └────────────────┘      └──────────────────┘      └────────────────┘`,
      },
      {
        heading: "Lifecycle",
        steps: [
          "Author or derive the module and package it with an explicit version.",
          "Publish or bundle it so Discover can list interface and provenance.",
          "Compose locks the exact bytes into a stack lockfile.",
          "Runtime loads only locked modules — no silent substitution.",
        ],
      },
    ],
  },
  {
    slug: "neurostacks",
    title: "NeuroStacks",
    nav: "NeuroStacks",
    summary:
      "A NeuroStack is a typed graph of sensors, NeuroBlocks, control, and actuators — packaged as a portable .synapse artifact.",
    sections: [
      {
        heading: "Composition model",
        paragraphs: [
          "Stacks are graphs, not free-form scripts. Nodes are typed pieces (sensor, adapter, neuroblock, control, state, actuator). Edges connect ports. The graph checker rejects cycles where forbidden, writer conflicts, missing required inputs, and type mismatches.",
        ],
        diagram: `  Sensor ──▶ NeuroBlock ──▶ Control ──▶ Actuator
                │
                └──▶ (optional) State / Adapter`,
      },
      {
        heading: "Identity",
        paragraphs: [
          "Stack identity is cryptographic over structure and locked modules — not over canvas layout. Moving nodes on the Compose board does not change the digest. Changing a module version or an edge does.",
        ],
      },
      {
        heading: "Executable vs source packages",
        paragraphs: [
          "Some exports are fully runnable under the current composed runtime. Others are source or planning packages marked executable:false. Always read the manifest: SynapseVM will not pretend a planning graph is a finished on-robot controller.",
        ],
        note: "Treat executable:false as a hard engineering signal, not a UI quirk.",
      },
    ],
  },
  {
    slug: "compose",
    title: "Compose process",
    nav: "Compose",
    summary:
      "How you go from an empty canvas to a validated, compiled NeuroStack package.",
    sections: [
      {
        heading: "Process",
        steps: [
          "Open Compose on an empty canvas (or load a draft / demo preset if you want a known graph).",
          "Add nodes from the palette: at least a sensor path, one or more NeuroBlocks, and an actuator.",
          "Wire ports. The checker reports illegal connections immediately.",
          "Resolve errors (types, missing inputs, timing envelopes).",
          "Name the artifact, compile, and download the .synapse package — or shelve it for Simulate / Verify.",
        ],
        diagram: ` empty canvas
      │
      ▼
 add nodes ──▶ wire ports ──▶ graph check
                                  │
                         errors?──┤──▶ fix & recheck
                                  │
                                  ▼
                               compile
                                  │
                                  ▼
                            .synapse out`,
      },
      {
        heading: "What compile produces",
        paragraphs: [
          "Compile freezes the graph and lockfile: module digests, runtime plan, and verification metadata. The file name you choose becomes the stack’s human name when it is valid; invalid names keep the previous graph name rather than smuggling illegal characters into the package.",
        ],
      },
      {
        heading: "Drafts",
        paragraphs: [
          "Compose keeps a local draft in the browser so work survives reloads. Clearing site data discards that draft. Export anything you need to keep.",
        ],
      },
    ],
  },
  {
    slug: "simulate",
    title: "Simulate process",
    nav: "Simulate",
    summary:
      "Run the same locked stack in a live loop to inspect behavior before you treat a path as evidence.",
    sections: [
      {
        heading: "Purpose",
        paragraphs: [
          "Simulate sits under Verify. Its job is to exercise the package you built — channel flow, timing feel, scenario response — not to invent a parallel “demo brain.” Prefer the locked stack over a notebook copy.",
        ],
      },
      {
        heading: "Process",
        steps: [
          "Load or select the compiled stack (from Compose shelf or import).",
          "Choose a scenario or live inputs.",
          "Step or run the loop; watch outputs and events.",
          "When a critical path matters, capture a receipt and move to Verify.",
        ],
        diagram: `  .synapse ──▶ load runtime ──▶ tick loop
                                    │
                         observe channels / events
                                    │
                         capture receipt? ──▶ Verify`,
      },
      {
        heading: "Limits",
        paragraphs: [
          "Simulation is a lab instrument. A clean sim run is not certification, not hardware-in-the-loop proof, and not a substitute for replay of a real receipt.",
        ],
      },
    ],
  },
  {
    slug: "runtime",
    title: "SynapseVM runtime",
    nav: "Runtime",
    summary:
      "How a tick advances: fixed-point dynamics, ordered updates, and why two conforming engines must agree.",
    sections: [
      {
        heading: "Tick model (conceptual)",
        paragraphs: [
          "Each tick applies inputs, propagates synaptic drive, updates neuron state in a defined order, and emits decoded outputs. Arithmetic is fixed-point (Q16.16) with explicit saturation and rounding rules so Rust and browser engines can match.",
        ],
        diagram: `  t ──▶ apply inputs
         │
         ▼
       synaptic accumulate (defined order)
         │
         ▼
       neuron update (index order)
         │
         ▼
       decode outputs + optional snapshot / trace
         │
         ▼
       t + 1`,
      },
      {
        heading: "Determinism contract",
        bullets: [
          "Same module bytes, same input vector, same pre-state ⇒ same outputs and post-state.",
          "Malformed snapshots and non-finite adapter inputs are rejected — fail closed.",
          "Conformance tests compare native and browser paths on bundled models.",
        ],
        note: "Full numeric rules live in the repository execution spec. Product docs describe the contract; the spec defines the bits.",
      },
    ],
  },
  {
    slug: "receipts",
    title: "NeuroReceipts",
    nav: "Receipts",
    summary:
      "A receipt is structured evidence of a critical tick — enough to replay, not a warranty about the physical world.",
    sections: [
      {
        heading: "What is recorded",
        paragraphs: [
          "A NeuroReceipt binds the stack identity to a tick’s disclosed path: input commitments, pre-state, neural outputs / actuator commands, and hashes that let a verifier recompute equality. Newer receipts (v2) tighten the signed field set; legacy samples may exist as historical evidence.",
        ],
        diagram: `  critical tick
       │
       ├─ stack identity (digest / lock)
       ├─ input commitment
       ├─ pre-state commitment
       ├─ outputs / actions
       └─ receipt id (+ optional signature)
              │
              ▼
         NeuroReceipt artifact`,
      },
      {
        heading: "What a receipt is not",
        bullets: [
          "Not proof that a robot moved in the world.",
          "Not by itself a publisher seal or hardware attestation.",
          "Not a license for safety-critical deployment without your own certification process.",
        ],
      },
    ],
  },
  {
    slug: "verify",
    title: "Verify process",
    nav: "Verify",
    summary:
      "Import a stack and receipt, replay locally, and read claims honestly — match or open, never fabricated pass.",
    sections: [
      {
        heading: "Process",
        steps: [
          "Import or select the NeuroStack that produced the event.",
          "Import the NeuroReceipt (and any required side files).",
          "Run local replay: recompute outputs from disclosed input and pre-state.",
          "Read the report: each claim is match, fail, or unverified.",
          "Optionally continue to external checks only after local replay is understood.",
        ],
        diagram: `  Stack + Receipt
         │
         ▼
   load & bind identities
         │
         ▼
   local replay engine
         │
    ┌────┴────┐
    ▼         ▼
  MATCH      FAIL / INCOMPLETE
    │
    ▼
  report (fail-closed on gaps)`,
      },
      {
        heading: "Claim language",
        paragraphs: [
          "Verify lists separate claims (artifact identity, execution path, replay, external, anchor, …). A hash being computed is not the same as matching an expected digest. A local match is not an independent third-party attestation. The UI is required to keep those distinctions visible.",
        ],
      },
    ],
  },
  {
    slug: "packages",
    title: "Packages (.synapse)",
    nav: "Packages",
    summary:
      "What a SynapseVM package contains and how digests protect identity.",
    sections: [
      {
        heading: "Artifact shape",
        paragraphs: [
          "A compose package is canonical structured data (JSON-backed .synapse) including format id, manifest, graph, lockfile, modules, runtime plan, and verification metadata. Digests bind locked content so renaming a download does not forge identity.",
        ],
        diagram: `.synapse
├─ manifest     name · version · stackId · runtime · executable
├─ graph        nodes · edges · policy · deadline
├─ lockfile     module → version + digest
├─ modules      locked bytes / payloads
├─ runtimePlan  order · rates · delivery
└─ verification policy · replay scope · external hooks`,
      },
      {
        heading: "Import rules",
        paragraphs: [
          "Imports are integrity-checked. Unexpected layouts or unlockable modules fail rather than being silently rewritten. Prefer explicit versions when pulling from Discover or a library release.",
        ],
      },
    ],
  },
  {
    slug: "quickstart",
    title: "Quickstart",
    nav: "Quickstart",
    summary: "A short path through NeuroLab from first open to a verified mindset.",
    sections: [
      {
        heading: "In the product",
        steps: [
          "Open Discover — read a NeuroBlock’s ports and provenance.",
          "Open Compose — empty canvas; add sensor → block → actuator; fix checker errors.",
          "Compile and download (or shelve) the .synapse package.",
          "Simulate under Verify — watch the loop on the locked stack.",
          "When you have a receipt, run Verify replay and read each claim.",
        ],
      },
      {
        heading: "Local development",
        paragraphs: [
          "From the monorepo: npm install, then npm run dev:lab for NeuroLab on port 3000. Core determinism: npm run test:core and npm run test:protocol. Python packaging deps: pip install -r compiler/requirements.txt.",
        ],
        diagram: `  npm install
       │
       ▼
  npm run dev:lab  ──▶  http://localhost:3000
       │
       ├── Discover / Compose / Verify
       └── optional .env.local for external services`,
      },
    ],
  },
];

export function docBySlug(slug: string) {
  return DOC_PAGES.find((p) => p.slug === slug);
}

export const DOC_NAV = DOC_PAGES.map((p) => ({ slug: p.slug, label: p.nav }));
