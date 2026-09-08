/**
 * Circuits — named functional pathways.
 *
 * A circuit is the first tier that has an input and an output, which is what
 * makes it the first thing shaped like a NeuroBlock. Each entry ships the
 * *pathway*: the populations in order, the regions they span, what the circuit
 * computes and which behaviour it drives. All of that is published anatomy.
 *
 * What does not ship is the connectivity itself — the actual neurons and
 * weights come from the source dataset, which is why a circuit records the
 * selection needed to extract it rather than pretending to contain it.
 */

export type CircuitStage = {
  /** Population name as used in the literature, e.g. "LC4", "AVA". */
  population: string;
  role: "input" | "relay" | "decision" | "output";
  region: string;
  note: string;
};

export type CircuitDef = {
  slug: string;
  name: string;
  /** Brain slugs from lib/brainAtlas.ts that contain this circuit. */
  brains: string[];
  organism: string;
  common: string;
  /** Region slugs it spans. */
  regions: string[];
  stages: CircuitStage[];
  computes: string;
  behaviour: string;
  /** Reflex latency, or something slower. */
  timescale: "reflex" | "fast" | "deliberative";
  /** NeuroBlock in this library derived from it, if any. */
  block: string | null;
  summary: string;
  citation: string;
  notes: string[];
};

export const TIMESCALE_LABELS: Record<CircuitDef["timescale"], string> = {
  reflex: "Reflex",
  fast: "Fast",
  deliberative: "Deliberative",
};

export const CIRCUITS: CircuitDef[] = [
  {
    slug: "looming-escape-giant-fibre",
    name: "Looming escape · giant fibre",
    brains: ["fly-female-brain", "fly-female-cns", "fly-male-cns"],
    organism: "Drosophila melanogaster",
    common: "Fruit fly",
    regions: ["lobula", "ventrolateral-neuropils", "gnathal-ganglia", "t3-leg-neuropil"],
    stages: [
      { population: "LC4", role: "input", region: "lobula", note: "Angular size and expansion rate" },
      { population: "LPLC2", role: "input", region: "lobula", note: "Looming edges expanding outward" },
      { population: "Giant fibre (DNp01)", role: "decision", region: "ventrolateral-neuropils", note: "One descending neuron per side; pools both inputs" },
      { population: "TTMn / PSI", role: "output", region: "t3-leg-neuropil", note: "Tergotrochanteral motor neuron drives leg extension" },
    ],
    computes: "Time-to-collision from visual expansion, thresholded into a go/no-go escape decision.",
    behaviour: "Short-latency take-off. The fastest escape the fly has.",
    timescale: "reflex",
    block: "loomguard",
    summary:
      "The canonical escape reflex: two looming-sensitive populations converge on a single descending neuron that fires once and commits the animal to a jump.",
    citation: "von Reyn et al. 2014; Ache et al. 2019; Dombrovski et al. 2023.",
    notes: [
      "The convergence of many LC4/LPLC2 cells onto one giant fibre is a pooling motif with a hard threshold.",
      "A slower, non-giant-fibre escape runs in parallel and produces a better-coordinated take-off.",
    ],
  },
  {
    slug: "looming-escape-slow",
    name: "Looming escape · non-giant-fibre",
    brains: ["fly-female-brain", "fly-female-cns", "fly-male-cns"],
    organism: "Drosophila melanogaster",
    common: "Fruit fly",
    regions: ["lobula", "ventrolateral-neuropils", "t3-leg-neuropil"],
    stages: [
      { population: "LPLC2", role: "input", region: "lobula", note: "Looming selective" },
      { population: "DNp02 / DNp11", role: "decision", region: "ventrolateral-neuropils", note: "Descending neurons with longer integration" },
      { population: "Leg and wing motor neurons", role: "output", region: "t3-leg-neuropil", note: "Postural preparation before take-off" },
    ],
    computes: "Slower integration of the same looming evidence, allowing a planned escape.",
    behaviour: "Longer-latency take-off with wing positioning and a directed jump.",
    timescale: "fast",
    block: null,
    summary:
      "The parallel escape route. Same stimulus, more time, better outcome — a worked example of two circuits trading latency against quality.",
    citation: "von Reyn et al. 2014; Card & Dickinson 2008.",
    notes: ["Runs concurrently with the giant fibre pathway; which one wins depends on approach speed."],
  },
  {
    slug: "optic-flow-stabilisation",
    name: "Optic flow stabilisation",
    brains: ["fly-female-brain", "fly-female-cns", "fly-male-cns"],
    organism: "Drosophila melanogaster",
    common: "Fruit fly",
    regions: ["medulla", "lobula-plate", "neck-tectulum", "wing-tectulum"],
    stages: [
      { population: "T4 / T5", role: "input", region: "medulla", note: "Local ON and OFF direction-selective motion detectors" },
      { population: "HS / VS tangential cells", role: "relay", region: "lobula-plate", note: "Wide-field pooling into horizontal and vertical flow" },
      { population: "Descending neurons", role: "decision", region: "neck-tectulum", note: "Gaze and body correction commands" },
      { population: "Neck and wing motor neurons", role: "output", region: "wing-tectulum", note: "Head and wing compensation" },
    ],
    computes: "Self-motion estimate from wide-field visual flow.",
    behaviour: "Course stabilisation against drift and gusts; gaze holding.",
    timescale: "reflex",
    block: "flowsense",
    summary:
      "Local motion detectors pooled into a global flow field, then turned into a correction. The insect answer to an inertial measurement unit.",
    citation: "Borst 2014; Maisak et al. 2013.",
    notes: ["Halteres supply a faster mechanical rotation signal that fuses with this visual estimate."],
  },
  {
    slug: "heading-ring-attractor",
    name: "Head direction ring attractor",
    brains: ["fly-female-brain", "fly-hemibrain", "fly-female-cns", "fly-male-cns"],
    organism: "Drosophila melanogaster",
    common: "Fruit fly",
    regions: ["central-complex", "lateral-accessory-lobe"],
    stages: [
      { population: "Ring neurons (ER)", role: "input", region: "central-complex", note: "Visual landmarks, inhibitory onto the compass" },
      { population: "EPG", role: "relay", region: "central-complex", note: "The compass itself — a single activity bump on a ring" },
      { population: "PEN / PEG", role: "relay", region: "central-complex", note: "Rotate the bump using angular velocity" },
      { population: "PFL3 / DNa02", role: "output", region: "lateral-accessory-lobe", note: "Convert heading error into a turn" },
    ],
    computes: "Maintains an internal heading estimate and integrates angular velocity when landmarks are absent.",
    behaviour: "Straight-line holding, menotaxis, return-to-goal navigation.",
    timescale: "fast",
    block: "headingcell",
    summary:
      "A ring of neurons holding one bump of activity that tracks which way the animal faces. It survives darkness by dead reckoning.",
    citation: "Seelig & Jayaraman 2015; Turner-Evans et al. 2017; Hulse et al. 2021.",
    notes: [
      "The best-characterised recurrent circuit in any brain — the hemibrain is the reference for it.",
      "Ring neurons are inhibitory: landmarks pin the bump by suppressing everywhere else.",
    ],
  },
  {
    slug: "small-object-tracking",
    name: "Small object tracking",
    brains: ["fly-female-brain", "fly-female-cns", "fly-male-cns"],
    organism: "Drosophila melanogaster",
    common: "Fruit fly",
    regions: ["lobula", "ventrolateral-neuropils", "lateral-accessory-lobe"],
    stages: [
      { population: "LC11", role: "input", region: "lobula", note: "Small moving object, suppressed by wide-field motion" },
      { population: "Central brain targets", role: "relay", region: "ventrolateral-neuropils", note: "Bearing extraction" },
      { population: "Steering descending neurons", role: "output", region: "lateral-accessory-lobe", note: "Turn toward the target" },
    ],
    computes: "Selects a small moving target against a moving background and reports its bearing.",
    behaviour: "Pursuit and body-size discrimination.",
    timescale: "fast",
    block: "targettrack",
    summary:
      "Figure-ground separation done with almost no machinery: a cell type that fires for small objects and is actively silenced by whole-field motion.",
    citation: "Keleş & Frye 2017; Ribeiro et al. 2018.",
    notes: ["The wide-field suppression is a lateral inhibition motif."],
  },
  {
    slug: "olfactory-learning",
    name: "Olfactory associative learning",
    brains: ["fly-female-brain", "fly-hemibrain", "fly-female-cns", "fly-male-cns"],
    organism: "Drosophila melanogaster",
    common: "Fruit fly",
    regions: ["antennal-lobe", "mushroom-body", "superior-neuropils"],
    stages: [
      { population: "ORN", role: "input", region: "antennal-lobe", note: "One receptor type per glomerulus" },
      { population: "Projection neurons", role: "relay", region: "antennal-lobe", note: "~50 channels out of the antennal lobe" },
      { population: "Kenyon cells", role: "relay", region: "mushroom-body", note: "~2,000 cells, sparse random sampling of PN input" },
      { population: "MBON", role: "output", region: "superior-neuropils", note: "~34 output neurons carrying learned valence" },
    ],
    computes: "Expands a dense odour code into a sparse one, then learns a valence readout at the KC→MBON synapse.",
    behaviour: "Approach or avoid a learned odour.",
    timescale: "deliberative",
    block: null,
    summary:
      "50 channels in, 2,000 cells wide, 34 outputs. The expansion-then-readout architecture that keeps being reinvented in machine learning.",
    citation: "Aso et al. 2014; Li et al. 2020.",
    notes: [
      "APL provides global feedback inhibition that enforces sparseness — a recurrent inhibition motif.",
      "Dopaminergic neurons supply the teaching signal that gates plasticity.",
    ],
  },
  {
    slug: "wind-mechanosensation",
    name: "Wind and antennal mechanosensation",
    brains: ["fly-female-brain", "fly-female-cns", "fly-male-cns"],
    organism: "Drosophila melanogaster",
    common: "Fruit fly",
    regions: ["ammc-wedge", "central-complex"],
    stages: [
      { population: "Johnston's organ neurons", role: "input", region: "ammc-wedge", note: "Antennal displacement — wind, sound, gravity" },
      { population: "AMMC / wedge interneurons", role: "relay", region: "ammc-wedge", note: "Separate steady deflection from vibration" },
      { population: "Central complex input", role: "output", region: "central-complex", note: "Wind direction as a navigational cue" },
    ],
    computes: "Direction and strength of airflow from differential antennal displacement.",
    behaviour: "Upwind orientation during odour tracking.",
    timescale: "fast",
    block: null,
    summary:
      "Two antennae, a difference operation, and a heading cue. Wind becomes a compass reference the central complex can use.",
    citation: "Yorozu et al. 2009; Okubo et al. 2020.",
    notes: [],
  },
  {
    slug: "worm-touch-withdrawal",
    name: "Gentle touch withdrawal",
    brains: ["worm-hermaphrodite"],
    organism: "Caenorhabditis elegans",
    common: "Nematode worm",
    regions: ["anterior-ganglion", "lateral-ganglion", "posterolateral-ganglion", "ventral-cord"],
    stages: [
      { population: "ALM / AVM", role: "input", region: "anterior-ganglion", note: "Anterior touch receptors" },
      { population: "PLM", role: "input", region: "posterolateral-ganglion", note: "Posterior touch receptors" },
      { population: "AVD / PVC", role: "relay", region: "lateral-ganglion", note: "Interneurons routing to the command layer" },
      { population: "AVA / AVB", role: "decision", region: "lateral-ganglion", note: "Command interneurons: backward vs forward" },
      { population: "A-type / B-type motor neurons", role: "output", region: "ventral-cord", note: "Drive the body wave in either direction" },
    ],
    computes: "Where the touch was, and therefore which way to move away from it.",
    behaviour: "Touch the head, it reverses. Touch the tail, it accelerates forward.",
    timescale: "reflex",
    block: null,
    summary:
      "Six touch neurons, a handful of interneurons, and a binary decision — the most completely understood behaviour in any animal.",
    citation: "Chalfie et al. 1985; Cook et al. 2019.",
    notes: [
      "Small enough to run in full: every neuron and connection in this pathway is known by name.",
      "AVA and AVB are mutually antagonistic — a winner-take-all motif deciding direction.",
    ],
  },
  {
    slug: "worm-chemotaxis",
    name: "Chemotaxis",
    brains: ["worm-hermaphrodite"],
    organism: "Caenorhabditis elegans",
    common: "Nematode worm",
    regions: ["anterior-ganglion", "lateral-ganglion", "ventral-cord"],
    stages: [
      { population: "AWC / AWA", role: "input", region: "anterior-ganglion", note: "Odour sensing, responding to changes rather than levels" },
      { population: "AIY / AIB / AIZ", role: "relay", region: "lateral-ganglion", note: "Opposed interneurons setting turn probability" },
      { population: "RIA / RIM", role: "decision", region: "lateral-ganglion", note: "Steering and reversal bias" },
      { population: "Motor neurons", role: "output", region: "ventral-cord", note: "Pirouettes and gradual steering" },
    ],
    computes: "Temporal gradient — is the concentration rising or falling as I move?",
    behaviour: "Biased random walk up an attractant gradient.",
    timescale: "fast",
    block: null,
    summary:
      "Navigation without a map or a compass: modulate turn rate by whether things are getting better, and you climb any gradient.",
    citation: "Pierce-Shimomura et al. 1999; Gray et al. 2005.",
    notes: ["A derivative-and-threshold strategy that transfers directly to any scalar-gradient robot."],
  },
  {
    slug: "worm-nociceptive-escape",
    name: "Nociceptive escape",
    brains: ["worm-hermaphrodite"],
    organism: "Caenorhabditis elegans",
    common: "Nematode worm",
    regions: ["anterior-ganglion", "lateral-ganglion", "ventral-cord"],
    stages: [
      { population: "ASH", role: "input", region: "anterior-ganglion", note: "Polymodal nociceptor: osmotic, chemical, mechanical" },
      { population: "AVA", role: "decision", region: "lateral-ganglion", note: "Backward command interneuron" },
      { population: "A-type motor neurons", role: "output", region: "ventral-cord", note: "Reversal" },
    ],
    computes: "Aversive stimulus present, threshold crossed, reverse.",
    behaviour: "Rapid reversal followed by a turn.",
    timescale: "reflex",
    block: null,
    summary: "The shortest escape reflex in the catalogue: sensor, command neuron, motor. Three layers.",
    citation: "Kaplan & Horvitz 1993; Cook et al. 2019.",
    notes: ["A good first target for extraction — it is genuinely small enough to compile whole."],
  },
  {
    slug: "worm-locomotion-cpg",
    name: "Undulatory locomotion",
    brains: ["worm-hermaphrodite"],
    organism: "Caenorhabditis elegans",
    common: "Nematode worm",
    regions: ["ventral-cord", "lateral-ganglion"],
    stages: [
      { population: "AVB / AVA", role: "input", region: "lateral-ganglion", note: "Set direction and drive" },
      { population: "B-type / A-type motor neurons", role: "relay", region: "ventral-cord", note: "Repeating units along the body" },
      { population: "D-type motor neurons", role: "relay", region: "ventral-cord", note: "Cross-inhibition between dorsal and ventral" },
      { population: "Body wall muscle", role: "output", region: "ventral-cord", note: "Alternating contraction" },
    ],
    computes: "A travelling wave from coupled local oscillators plus proprioceptive feedback.",
    behaviour: "Forward and backward swimming and crawling.",
    timescale: "fast",
    block: null,
    summary:
      "Dorsal and ventral units inhibit each other locally and couple to their neighbours. Out of that falls a body wave.",
    citation: "Wen et al. 2012; Cook et al. 2019.",
    notes: ["Built from half-centre oscillator motifs repeated down the body."],
  },
  {
    slug: "ciona-phototaxis",
    name: "Phototaxis and gravity response",
    brains: ["ciona-larva-cns"],
    organism: "Ciona intestinalis",
    common: "Sea squirt tadpole",
    regions: ["sensory-vesicle", "neck", "motor-ganglion", "caudal-nerve-cord"],
    stages: [
      { population: "Ocellus photoreceptors", role: "input", region: "sensory-vesicle", note: "Directional light via a pigment cup" },
      { population: "Otolith antenna cells", role: "input", region: "sensory-vesicle", note: "Gravity via a single dense granule" },
      { population: "Relay neurons", role: "relay", region: "neck", note: "Sensory vesicle to motor ganglion" },
      { population: "Motor ganglion neurons", role: "decision", region: "motor-ganglion", note: "Five pairs generating the swim rhythm" },
      { population: "Tail muscle", role: "output", region: "caudal-nerve-cord", note: "Alternating tail beats" },
    ],
    computes: "Light direction and body orientation, combined into a swim command.",
    behaviour: "Swim up, then swim away from light, then settle.",
    timescale: "fast",
    block: null,
    summary:
      "A whole chordate behaviour in under 180 neurons, from two sensors to a tail. The complete pathway fits on one page.",
    citation: "Ryan et al. 2016; Bostwick et al. 2020.",
    notes: ["The only complete sensory-to-motor pathway in a chordate that is entirely mapped."],
  },
  {
    slug: "larval-nociceptive-rolling",
    name: "Nociceptive rolling",
    brains: ["larval-fly-brain"],
    organism: "Drosophila melanogaster",
    common: "Fruit fly larva",
    regions: ["larval-sez"],
    stages: [
      { population: "mdIV nociceptors", role: "input", region: "larval-sez", note: "Body-wall noxious touch and heat" },
      { population: "Basin neurons", role: "relay", region: "larval-sez", note: "Multisensory integration of touch and nociception" },
      { population: "Goro", role: "decision", region: "larval-sez", note: "Command-like neuron for rolling" },
      { population: "Motor neurons", role: "output", region: "larval-sez", note: "Corkscrew body roll" },
    ],
    computes: "Combines nociception with vibration; the two together lower the threshold for rolling.",
    behaviour: "Corkscrew rolling escape from a parasitoid wasp.",
    timescale: "reflex",
    block: null,
    summary:
      "A complete escape circuit found by connectomics and then confirmed by optogenetics — sensor to command neuron to behaviour.",
    citation: "Ohyama et al. 2015; Winding et al. 2023.",
    notes: ["One of the few circuits discovered from a connectome rather than confirmed in one."],
  },
];

export function circuitsForBrain(slug: string) {
  return CIRCUITS.filter((c) => c.brains.includes(slug));
}

export function circuitsForRegion(slug: string) {
  return CIRCUITS.filter((c) => c.regions.includes(slug));
}
