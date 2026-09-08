/**
 * Motifs — the only tier that ships complete.
 *
 * A brain needs its dataset and a circuit needs its connectivity, but a motif
 * is three to eight neurons and a handful of signed edges. That fits here, in
 * full, as real graph data. Nothing to download, nothing to derive: a motif
 * card *is* the motif.
 *
 * Which also makes motifs the shortest path to a runnable NeuroBlock — the
 * structure is already present, and only the LIF parameters are missing.
 */

export type MotifNodeKind = "input" | "excitatory" | "inhibitory" | "output";

export type MotifNode = {
  id: string;
  label: string;
  kind: MotifNodeKind;
  /** Layout in a 120 x 72 grid, so diagrams render identically everywhere. */
  x: number;
  y: number;
};

export type MotifEdge = {
  from: string;
  to: string;
  /** +1 excitatory, -1 inhibitory. */
  sign: 1 | -1;
  kind?: "chemical" | "electrical";
  /** Draw as a curve rather than a straight line, for reciprocal pairs. */
  curve?: number;
};

export type MotifDef = {
  slug: string;
  name: string;
  /** What it computes, in one line. */
  computes: string;
  summary: string;
  nodes: MotifNode[];
  edges: MotifEdge[];
  /** Real occurrences, as circuit slugs from circuitAtlas. */
  appearsIn: { circuit: string; note: string }[];
  /** Engineering equivalent, for people who think in signal processing. */
  analogue: string;
  notes: string[];
};

const n = (id: string, label: string, kind: MotifNodeKind, x: number, y: number): MotifNode => ({ id, label, kind, x, y });
const e = (from: string, to: string, sign: 1 | -1, curve = 0): MotifEdge => ({ from, to, sign, curve });
const gap = (from: string, to: string): MotifEdge => ({ from, to, sign: 1, kind: "electrical" });

export const MOTIFS: MotifDef[] = [
  {
    slug: "feedforward-inhibition",
    name: "Feedforward inhibition",
    computes: "Passes a signal only if it arrives before the inhibition catches up — a coincidence and timing filter.",
    summary:
      "The same input drives both an excitatory path and a slower inhibitory one. Only the leading edge gets through, so the output reports change rather than level.",
    nodes: [
      n("in", "IN", "input", 12, 36),
      n("e", "E", "excitatory", 58, 16),
      n("i", "I", "inhibitory", 58, 56),
      n("out", "OUT", "output", 104, 36),
    ],
    edges: [e("in", "e", 1), e("in", "i", 1), e("e", "out", 1), e("i", "out", -1)],
    appearsIn: [
      { circuit: "olfactory-learning", note: "Sharpens Kenyon cell responses to odour onset" },
      { circuit: "optic-flow-stabilisation", note: "Temporal differentiation in the motion pathway" },
    ],
    analogue: "High-pass filter / edge detector.",
    notes: ["The delay on the inhibitory arm sets the width of the window that passes."],
  },
  {
    slug: "feedback-inhibition",
    name: "Feedback inhibition",
    computes: "Divides activity by its own total — automatic gain control.",
    summary:
      "The population excites an inhibitory neuron that projects back onto all of it. The more that fires, the harder everything is suppressed, so only the strongest survive.",
    nodes: [
      n("in", "IN", "input", 12, 36),
      n("e", "E", "excitatory", 58, 20),
      n("i", "I", "inhibitory", 58, 60),
      n("out", "OUT", "output", 104, 20),
    ],
    edges: [e("in", "e", 1), e("e", "out", 1), e("e", "i", 1, 18), e("i", "e", -1, 18)],
    appearsIn: [
      { circuit: "olfactory-learning", note: "APL inhibits all Kenyon cells, enforcing a sparse code" },
      { circuit: "heading-ring-attractor", note: "Keeps a single activity bump on the ring" },
    ],
    analogue: "Automatic gain control / divisive normalisation / softmax temperature.",
    notes: ["This is what keeps a sparse code sparse regardless of input strength."],
  },
  {
    slug: "mutual-inhibition",
    name: "Mutual inhibition",
    computes: "Two options, one winner — the decision is made by whichever suppresses the other first.",
    summary:
      "Two units inhibit each other. Small differences in input amplify into a clean binary outcome, and the state persists after the inputs stop.",
    nodes: [
      n("a_in", "A in", "input", 12, 14),
      n("b_in", "B in", "input", 12, 58),
      n("a", "A", "inhibitory", 58, 14),
      n("b", "B", "inhibitory", 58, 58),
      n("a_out", "A out", "output", 104, 14),
      n("b_out", "B out", "output", 104, 58),
    ],
    edges: [
      e("a_in", "a", 1), e("b_in", "b", 1),
      e("a", "b", -1, 10), e("b", "a", -1, 10),
      e("a", "a_out", 1), e("b", "b_out", 1),
    ],
    appearsIn: [
      { circuit: "worm-touch-withdrawal", note: "AVA and AVB decide forward against backward" },
      { circuit: "looming-escape-giant-fibre", note: "Escape commits and suppresses competing actions" },
    ],
    analogue: "Winner-take-all / flip-flop / bistable latch.",
    notes: ["Add adaptation to either side and this becomes an oscillator instead of a latch."],
  },
  {
    slug: "recurrent-excitation",
    name: "Recurrent excitation",
    computes: "Holds a value after the input is gone — short-term memory by self-sustaining activity.",
    summary:
      "A loop that feeds itself. Once driven above threshold the activity persists, which turns a transient input into a maintained state.",
    nodes: [
      n("in", "IN", "input", 12, 36),
      n("a", "A", "excitatory", 54, 20),
      n("b", "B", "excitatory", 54, 56),
      n("out", "OUT", "output", 104, 36),
    ],
    edges: [e("in", "a", 1), e("a", "b", 1, 14), e("b", "a", 1, 14), e("a", "out", 1)],
    appearsIn: [
      { circuit: "heading-ring-attractor", note: "EPG and PEN sustain the heading bump in darkness" },
      { circuit: "worm-chemotaxis", note: "Maintains the current locomotion state between decisions" },
    ],
    analogue: "Integrator / latch / persistent state register.",
    notes: ["Without inhibition to bound it, recurrent excitation saturates — it is almost always paired with feedback inhibition."],
  },
  {
    slug: "convergent-pooling",
    name: "Convergent pooling",
    computes: "Sums many weak pieces of evidence and fires once the total crosses a threshold.",
    summary:
      "Many inputs onto one target. No single input is enough; agreement across the population is. Where an all-or-nothing decision comes from.",
    nodes: [
      n("i1", "", "input", 14, 8),
      n("i2", "", "input", 14, 28),
      n("i3", "", "input", 14, 48),
      n("i4", "", "input", 14, 66),
      n("g", "Σ", "excitatory", 62, 36),
      n("out", "OUT", "output", 104, 36),
    ],
    edges: [e("i1", "g", 1), e("i2", "g", 1), e("i3", "g", 1), e("i4", "g", 1), e("g", "out", 1)],
    appearsIn: [
      { circuit: "looming-escape-giant-fibre", note: "LC4 and LPLC2 populations converge on one giant fibre" },
      { circuit: "optic-flow-stabilisation", note: "T4/T5 pooled into wide-field tangential cells" },
    ],
    analogue: "Accumulator with threshold / matched filter.",
    notes: ["The threshold is the decision. Everything upstream is just evidence."],
  },
  {
    slug: "divergent-expansion",
    name: "Divergent expansion",
    computes: "Projects a dense code into a much wider, sparser one where categories become separable.",
    summary:
      "A few channels fan out onto many cells, each sampling a random subset. Overlapping inputs become near-orthogonal patterns, which is what makes them easy to learn on.",
    nodes: [
      n("i1", "", "input", 14, 24),
      n("i2", "", "input", 14, 48),
      n("k1", "", "excitatory", 62, 6),
      n("k2", "", "excitatory", 62, 24),
      n("k3", "", "excitatory", 62, 42),
      n("k4", "", "excitatory", 62, 60),
      n("out", "OUT", "output", 104, 36),
    ],
    edges: [
      e("i1", "k1", 1), e("i1", "k2", 1), e("i1", "k4", 1),
      e("i2", "k2", 1), e("i2", "k3", 1), e("i2", "k4", 1),
      e("k1", "out", 1), e("k2", "out", 1), e("k3", "out", 1), e("k4", "out", 1),
    ],
    appearsIn: [
      { circuit: "olfactory-learning", note: "50 projection neurons onto ~2,000 Kenyon cells" },
    ],
    analogue: "Random projection / kernel expansion / reservoir.",
    notes: ["Only useful when paired with inhibition to keep the expanded code sparse."],
  },
  {
    slug: "lateral-inhibition",
    name: "Lateral inhibition",
    computes: "Sharpens contrast between neighbouring channels by having each suppress its neighbours.",
    summary:
      "Parallel channels that inhibit sideways. Uniform input cancels out; a local difference is amplified. Figure separates from ground.",
    nodes: [
      n("i1", "", "input", 14, 10),
      n("i2", "", "input", 14, 36),
      n("i3", "", "input", 14, 62),
      n("a", "A", "excitatory", 60, 10),
      n("b", "B", "excitatory", 60, 36),
      n("c", "C", "excitatory", 60, 62),
      n("out", "OUT", "output", 104, 36),
    ],
    edges: [
      e("i1", "a", 1), e("i2", "b", 1), e("i3", "c", 1),
      e("a", "b", -1), e("c", "b", -1), e("b", "a", -1), e("b", "c", -1),
      e("b", "out", 1),
    ],
    appearsIn: [
      { circuit: "small-object-tracking", note: "Wide-field motion suppresses LC11, leaving small objects" },
      { circuit: "olfactory-learning", note: "Glomerular cross-inhibition in the antennal lobe" },
    ],
    analogue: "Centre-surround filter / unsharp mask / band-pass in space.",
    notes: ["Same operation as feedback inhibition, applied across space instead of across time."],
  },
  {
    slug: "disinhibition",
    name: "Disinhibition",
    computes: "Opens a gate by suppressing whatever was holding it shut.",
    summary:
      "Two inhibitory neurons in series. Driving the first releases the output from the second, so an inhibitory input produces an excitatory effect.",
    nodes: [
      n("in", "IN", "input", 12, 36),
      n("i1", "I₁", "inhibitory", 46, 36),
      n("i2", "I₂", "inhibitory", 76, 36),
      n("out", "OUT", "output", 106, 36),
      n("drive", "drive", "input", 76, 8),
    ],
    edges: [e("in", "i1", 1), e("i1", "i2", -1), e("i2", "out", -1), e("drive", "out", 1)],
    appearsIn: [
      { circuit: "larval-nociceptive-rolling", note: "Gating that lets vibration lower the rolling threshold" },
      { circuit: "worm-locomotion-cpg", note: "Release of motor neurons from tonic inhibition" },
    ],
    analogue: "Enable line / gated pass-through.",
    notes: ["Two inversions make a permission. The gate is normally closed."],
  },
  {
    slug: "half-centre-oscillator",
    name: "Half-centre oscillator",
    computes: "Turns a constant drive into an alternating rhythm, with no clock anywhere.",
    summary:
      "Mutual inhibition plus fatigue. Whichever side wins gradually adapts, loses its grip, and hands over — producing an alternation that repeats for as long as the drive lasts.",
    nodes: [
      n("drive", "drive", "input", 12, 36),
      n("a", "A", "inhibitory", 56, 14),
      n("b", "B", "inhibitory", 56, 58),
      n("a_out", "dorsal", "output", 104, 14),
      n("b_out", "ventral", "output", 104, 58),
    ],
    edges: [
      e("drive", "a", 1), e("drive", "b", 1),
      e("a", "b", -1, 10), e("b", "a", -1, 10),
      e("a", "a_out", 1), e("b", "b_out", 1),
    ],
    appearsIn: [
      { circuit: "worm-locomotion-cpg", note: "Dorsal/ventral alternation repeated down the body" },
      { circuit: "ciona-phototaxis", note: "Motor ganglion swim rhythm" },
    ],
    analogue: "Relaxation oscillator / astable multivibrator.",
    notes: [
      "The period is set by the adaptation time constant, not by any external timing signal.",
      "Chain several with a phase lag and you get a travelling wave.",
    ],
  },
  {
    slug: "electrical-coupling",
    name: "Electrical coupling",
    computes: "Synchronises a group so it acts as one unit, with almost no delay.",
    summary:
      "Gap junctions pass current directly and bidirectionally. Faster than chemical transmission and impossible to make inhibitory — used where timing matters more than computation.",
    nodes: [
      n("in", "IN", "input", 12, 36),
      n("a", "A", "excitatory", 52, 16),
      n("b", "B", "excitatory", 52, 56),
      n("out", "OUT", "output", 104, 36),
    ],
    edges: [e("in", "a", 1), gap("a", "b"), e("a", "out", 1), e("b", "out", 1)],
    appearsIn: [
      { circuit: "worm-touch-withdrawal", note: "Command interneurons coupled for synchronous onset" },
      { circuit: "looming-escape-giant-fibre", note: "Giant fibre output uses electrical synapses for speed" },
    ],
    analogue: "Shared bus / direct wire.",
    notes: ["Most connectome edge lists mark these separately; the importer keeps them as a distinct edge kind."],
  },
  {
    slug: "sign-inversion",
    name: "Sign inversion",
    computes: "Flips an excitatory signal into an inhibitory one so downstream can subtract instead of add.",
    summary:
      "A single inhibitory interneuron in the path. Trivial as structure, but it is the only way a purely excitatory input can end up subtracting — and it costs one synapse of delay.",
    nodes: [
      n("in", "IN", "input", 14, 36),
      n("i", "I", "inhibitory", 60, 36),
      n("out", "OUT", "output", 106, 36),
    ],
    edges: [e("in", "i", 1), e("i", "out", -1)],
    appearsIn: [
      { circuit: "heading-ring-attractor", note: "Ring neurons invert visual input to pin the bump" },
      { circuit: "optic-flow-stabilisation", note: "Opponent subtraction between direction channels" },
    ],
    analogue: "Inverter / unary minus.",
    notes: [
      "Neurotransmitter prediction matters most here: get the sign wrong and the circuit computes the opposite.",
    ],
  },
];

export function motifsForCircuit(slug: string) {
  return MOTIFS.filter((m) => m.appearsIn.some((a) => a.circuit === slug));
}

export const NODE_KIND_LABELS: Record<MotifNodeKind, string> = {
  input: "Input",
  excitatory: "Excitatory",
  inhibitory: "Inhibitory",
  output: "Output",
};
