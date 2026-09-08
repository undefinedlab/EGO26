/**
 * What a Block or Stack is made of.
 *
 * The chain runs Dataset → Brain → Region → Circuit → Motif → Block → Stack,
 * but the *relation* at each step matters more than the step itself. Only
 * LoomGuard is derived from a connectome: its provenance carries 780 FlyWire
 * root IDs. The other three blocks reproduce a circuit's function with an
 * engineered topology, which is a different claim and is labelled as one.
 *
 * `verified` means the claim is backed by something in this repository — a
 * neuron list, a runtime, a graph — rather than by attribution alone.
 */

export type Relation = "derived-from" | "models" | "uses" | "contains" | "runs-on";

export const RELATION_LABELS: Record<Relation, string> = {
  "derived-from": "Derived from",
  models: "Models",
  uses: "Uses",
  contains: "Contains",
  "runs-on": "Runs on",
};

export const RELATION_HELP: Record<Relation, string> = {
  "derived-from": "Connectivity was extracted from this source and the identifiers are recorded.",
  models: "Engineered to reproduce this function. Nothing was extracted from a connectome.",
  uses: "This connectivity pattern is present in the module's topology.",
  contains: "Included as a dependency.",
  "runs-on": "Execution environment.",
};

export type CompositionLink = {
  relation: Relation;
  kind: "Dataset" | "Brain" | "Region" | "Circuit" | "Motif" | "NeuroBlock" | "Runtime";
  /** Library id, used to build the link. Empty for runtimes. */
  id: string;
  name: string;
  detail: string;
  /** Backed by data in this repository, not just attribution. */
  verified: boolean;
};

export type Composition = {
  summary: string;
  links: CompositionLink[];
  /** What is deliberately *not* claimed. */
  gaps: string[];
};

const runtime: CompositionLink = {
  relation: "runs-on",
  kind: "Runtime",
  id: "",
  name: "SynapseVM · Q16.16 fixed-point",
  detail: "Deterministic fixed-point LIF execution",
  verified: true,
};

export const COMPOSITIONS: Record<string, Composition> = {
  "synapsevm/loomguard": {
    summary:
      "The one block in this library with connectome-derived connectivity. Its provenance records 780 FlyWire root IDs.",
    links: [
      {
        relation: "derived-from",
        kind: "Dataset",
        id: "datasets/flywire-fafb",
        name: "FlyWire FAFB v783",
        detail: "780 neuron root IDs listed in provenance.json",
        verified: true,
      },
      {
        relation: "derived-from",
        kind: "Brain",
        id: "brains/fly-female-brain",
        name: "Adult fly · female brain",
        detail: "The segmentation those root IDs index into",
        verified: true,
      },
      {
        relation: "models",
        kind: "Region",
        id: "regions/lobula",
        name: "Lobula",
        detail: "Attributed to optic escape circuitry; per-neuron region mapping is not recorded here",
        verified: false,
      },
      {
        relation: "models",
        kind: "Circuit",
        id: "circuits/looming-escape-giant-fibre",
        name: "Looming escape · giant fibre",
        detail: "The pathway this block stands in for",
        verified: false,
      },
      {
        relation: "uses",
        kind: "Motif",
        id: "motifs/convergent-pooling",
        name: "Convergent pooling",
        detail: "Many looming detectors summed against one threshold",
        verified: false,
      },
      runtime,
    ],
    gaps: [
      "Fixed-point LIF parameters and the runtime assist rules are engineered, not measured.",
      "Independent re-derivation from the source dataset has not been performed.",
      "The neuron list is recorded; the extraction that produced it is not reproducible from this repository.",
    ],
  },

  "synapsevm/flowsense": {
    summary:
      "An engineered optic-flow primitive. It reproduces what the fly's flow pathway computes without extracting any of it.",
    links: [
      {
        relation: "models",
        kind: "Circuit",
        id: "circuits/optic-flow-stabilisation",
        name: "Optic flow stabilisation",
        detail: "Function reproduced; topology is engineered",
        verified: false,
      },
      {
        relation: "models",
        kind: "Region",
        id: "regions/lobula-plate",
        name: "Lobula plate",
        detail: "Where the biological equivalent lives",
        verified: false,
      },
      {
        relation: "uses",
        kind: "Motif",
        id: "motifs/convergent-pooling",
        name: "Convergent pooling",
        detail: "Local motion detectors pooled into a wide-field estimate",
        verified: false,
      },
      runtime,
    ],
    gaps: [
      "No connectome extraction is claimed. Provenance records: engineered optic-flow primitive, honest non-connectome topology.",
    ],
  },

  "synapsevm/headingcell": {
    summary:
      "A heading fragment inspired by the central complex. The ring-attractor idea is biological; this implementation is not.",
    links: [
      {
        relation: "models",
        kind: "Circuit",
        id: "circuits/heading-ring-attractor",
        name: "Head direction ring attractor",
        detail: "Function reproduced; dynamics and adapters engineered",
        verified: false,
      },
      {
        relation: "models",
        kind: "Region",
        id: "regions/central-complex",
        name: "Central complex",
        detail: "Where the biological equivalent lives",
        verified: false,
      },
      {
        relation: "uses",
        kind: "Motif",
        id: "motifs/recurrent-excitation",
        name: "Recurrent excitation",
        detail: "Holds the heading estimate when landmarks disappear",
        verified: false,
      },
      {
        relation: "uses",
        kind: "Motif",
        id: "motifs/feedback-inhibition",
        name: "Feedback inhibition",
        detail: "Keeps a single bump rather than many",
        verified: false,
      },
      runtime,
    ],
    gaps: ["Provenance records: CX/heading-inspired fragment; dynamics and adapters engineered."],
  },

  "synapsevm/targettrack": {
    summary: "An engineered small-target tracker. Biological derivation is not established.",
    links: [
      {
        relation: "models",
        kind: "Circuit",
        id: "circuits/small-object-tracking",
        name: "Small object tracking",
        detail: "Function reproduced; topology is engineered",
        verified: false,
      },
      {
        relation: "models",
        kind: "Region",
        id: "regions/lobula",
        name: "Lobula",
        detail: "Where LC11 and its relatives sit",
        verified: false,
      },
      {
        relation: "uses",
        kind: "Motif",
        id: "motifs/lateral-inhibition",
        name: "Lateral inhibition",
        detail: "Wide-field motion suppresses the small-object channel",
        verified: false,
      },
      runtime,
    ],
    gaps: ["Provenance records: engineered small-target tracker, honest provenance."],
  },

  "synapsevm/biopilot": {
    summary:
      "Four blocks under one priority arbiter, with the safety reflex holding a hard override over everything else.",
    links: [
      {
        relation: "contains",
        kind: "NeuroBlock",
        id: "synapsevm/loomguard",
        name: "LoomGuard",
        detail: "Safety reflex · hard override",
        verified: true,
      },
      {
        relation: "contains",
        kind: "NeuroBlock",
        id: "synapsevm/flowsense",
        name: "FlowSense",
        detail: "Self-motion estimate",
        verified: true,
      },
      {
        relation: "contains",
        kind: "NeuroBlock",
        id: "synapsevm/headingcell",
        name: "HeadingCell",
        detail: "Heading and steer error",
        verified: true,
      },
      {
        relation: "contains",
        kind: "NeuroBlock",
        id: "synapsevm/targettrack",
        name: "TargetTrack",
        detail: "Target bearing",
        verified: true,
      },
      {
        relation: "uses",
        kind: "Motif",
        id: "motifs/mutual-inhibition",
        name: "Mutual inhibition",
        detail: "The arbiter: one action wins and suppresses the rest",
        verified: false,
      },
      runtime,
    ],
    gaps: [
      "Composed execution is not implemented. This is a source graph, not an executable Stack release.",
      "Because one dependency is connectome-derived and three are engineered, the Stack as a whole is not connectome-derived.",
    ],
  },
};

export function compositionFor(id: string) {
  return COMPOSITIONS[id] ?? null;
}

/**
 * The compact chain shown on a card.
 *
 * A Stack is defined by what it contains, so it shows its dependencies. A
 * Block is defined by where it came from, so it shows the Dataset → … → Motif
 * spine, one step per tier.
 */
export function chainFor(c: Composition) {
  const contains = c.links.filter((l) => l.relation === "contains");
  if (contains.length) return contains;

  const order: CompositionLink["kind"][] = ["Dataset", "Brain", "Region", "Circuit", "Motif"];
  return order
    .map((k) => c.links.find((l) => l.kind === k))
    .filter((l): l is CompositionLink => Boolean(l));
}

export function verifiedCount(c: Composition) {
  const claims = c.links.filter((l) => l.kind !== "Runtime");
  return { verified: claims.filter((l) => l.verified).length, total: claims.length };
}
