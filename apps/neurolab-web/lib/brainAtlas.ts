/**
 * The atlas — brains and their regions, already sliced.
 *
 * A user should not have to download 336 MB to find out what is inside a
 * connectome. The anatomy is published, stable and citable, so it ships with
 * the library: every brain lists its regions, what each region does, and which
 * circuits are known to live there.
 *
 * Downloading the dataset is only required to *compute* over it — to get exact
 * per-region counts, or to derive a circuit. Until then the structure is here.
 *
 * Region names follow the standard nomenclatures: Ito et al. 2014 for the
 * insect brain, the Court et al. 2020 nomenclature for the ventral nerve cord,
 * and WormAtlas ganglia for C. elegans. Counts appear only where a publisher
 * states them; everything else is null and filled in by an import.
 */

export type RegionRole =
  | "sensory"
  | "integration"
  | "navigation"
  | "memory"
  | "premotor"
  | "motor"
  | "neuroendocrine";

export const ROLE_LABELS: Record<RegionRole, string> = {
  sensory: "Sensory",
  integration: "Integration",
  navigation: "Navigation",
  memory: "Learning and memory",
  premotor: "Premotor",
  motor: "Motor output",
  neuroendocrine: "Neuroendocrine",
};

export type RegionDef = {
  slug: string;
  abbr: string;
  name: string;
  /** Superstructure this belongs to, e.g. "Optic lobe". */
  group: string;
  role: RegionRole;
  /** Stated by a publisher, else null — an import computes it. */
  neurons: number | null;
  summary: string;
  /** Circuits known to live here. Seeds the Circuit tier. */
  hosts: string[];
};

export type Superclass = {
  name: string;
  count: number;
  note: string;
};

export type RegionSet = "fly-brain" | "fly-vnc" | "worm" | "ciona" | "larval-fly";

export type BrainDef = {
  slug: string;
  name: string;
  /** Dataset slug in lib/datasets.ts. */
  datasetSlug: string;
  organism: string;
  common: string;
  scope: string;
  neurons: number | null;
  connections: number | null;
  synapses: number | null;
  regionSets: RegionSet[];
  /** Role breakdown where a publisher gives one. */
  superclasses: Superclass[] | null;
  summary: string;
  notes: string[];
};

/* ------------------------------------------------------------------ *
 * Fly brain — Ito et al. 2014 superstructures
 * ------------------------------------------------------------------ */

const FLY_BRAIN: RegionDef[] = [
  {
    slug: "lamina",
    abbr: "LA",
    name: "Lamina",
    group: "Optic lobe",
    role: "sensory",
    neurons: null,
    summary: "First visual neuropil. Photoreceptor input arrives here and is sharpened for contrast and motion.",
    hosts: ["Photoreceptor relay", "Contrast normalisation"],
  },
  {
    slug: "medulla",
    abbr: "ME",
    name: "Medulla",
    group: "Optic lobe",
    role: "sensory",
    neurons: null,
    summary: "The largest optic neuropil. Splits the visual scene into ON and OFF pathways, retinotopically.",
    hosts: ["ON/OFF pathway split", "T4/T5 input"],
  },
  {
    slug: "lobula",
    abbr: "LO",
    name: "Lobula",
    group: "Optic lobe",
    role: "integration",
    neurons: null,
    summary: "Feature detection. Home of the lobula columnar cells, including the looming-sensitive populations.",
    hosts: ["LC4 looming", "LPLC2 looming", "LC11 small-object motion"],
  },
  {
    slug: "lobula-plate",
    abbr: "LOP",
    name: "Lobula plate",
    group: "Optic lobe",
    role: "integration",
    neurons: null,
    summary: "Wide-field optic flow. Tangential cells here encode self-motion across the whole visual field.",
    hosts: ["HS/VS optic flow", "Ego-motion estimate"],
  },
  {
    slug: "antennal-lobe",
    abbr: "AL",
    name: "Antennal lobe",
    group: "Chemosensory",
    role: "sensory",
    neurons: null,
    summary: "First olfactory relay. Receptor input is organised into glomeruli, one per odorant channel.",
    hosts: ["Glomerular odour coding", "PN output to MB and LH"],
  },
  {
    slug: "mushroom-body",
    abbr: "MB",
    name: "Mushroom body",
    group: "Learning centre",
    role: "memory",
    neurons: null,
    summary:
      "Associative learning. Roughly 2,000–3,000 Kenyon cells expand odour input into a sparse code read out by a small set of output neurons.",
    hosts: ["PN → KC → MBON", "Valence assignment", "Sparse expansion coding"],
  },
  {
    slug: "central-complex",
    abbr: "CX",
    name: "Central complex",
    group: "Navigation centre",
    role: "navigation",
    neurons: null,
    summary:
      "Heading and steering. The ellipsoid body holds a ring attractor that tracks orientation; the fan-shaped body converts it into steering.",
    hosts: ["EPG ring attractor", "PEN angular velocity", "Goal-directed steering"],
  },
  {
    slug: "lateral-horn",
    abbr: "LH",
    name: "Lateral horn",
    group: "Chemosensory",
    role: "integration",
    neurons: null,
    summary: "Innate odour valence. The hard-wired counterpart to the mushroom body's learned pathway.",
    hosts: ["Innate odour responses"],
  },
  {
    slug: "ventrolateral-neuropils",
    abbr: "PVLP / PLP",
    name: "Ventrolateral neuropils",
    group: "Visual projection targets",
    role: "integration",
    neurons: null,
    summary:
      "Where visual projection neurons terminate. The looming pathway converges here before reaching descending neurons.",
    hosts: ["LC4 → giant fibre", "Escape decision"],
  },
  {
    slug: "lateral-accessory-lobe",
    abbr: "LAL",
    name: "Lateral accessory lobe",
    group: "Premotor",
    role: "premotor",
    neurons: null,
    summary: "The main output stage of the central complex. Steering commands are formed here before descending.",
    hosts: ["Steering command formation"],
  },
  {
    slug: "superior-neuropils",
    abbr: "SLP / SIP / SMP",
    name: "Superior neuropils",
    group: "Higher integration",
    role: "integration",
    neurons: null,
    summary: "Multimodal association above the mushroom body, including much of its output territory.",
    hosts: ["MBON convergence", "State modulation"],
  },
  {
    slug: "inferior-neuropils",
    abbr: "CRE / ICL / IB / ATL",
    name: "Inferior neuropils",
    group: "Higher integration",
    role: "integration",
    neurons: null,
    summary: "Association territory linking the central complex, mushroom body output and premotor areas.",
    hosts: ["CX ↔ MB coupling"],
  },
  {
    slug: "ammc-wedge",
    abbr: "AMMC / WED",
    name: "Antennal mechanosensory centre and wedge",
    group: "Mechanosensory",
    role: "sensory",
    neurons: null,
    summary: "Hearing, wind and antennal position. The fly's inertial and airflow sense.",
    hosts: ["Wind direction", "Auditory input"],
  },
  {
    slug: "gnathal-ganglia",
    abbr: "GNG",
    name: "Gnathal ganglia",
    group: "Motor output",
    role: "motor",
    neurons: null,
    summary:
      "Feeding motor control and the gateway to the nerve cord. Most descending neurons pass through here.",
    hosts: ["Proboscis extension", "Descending pathway gateway"],
  },
];

/* ------------------------------------------------------------------ *
 * Fly ventral nerve cord — Court et al. 2020 nomenclature
 * ------------------------------------------------------------------ */

const FLY_VNC: RegionDef[] = [
  {
    slug: "t1-leg-neuropil",
    abbr: "T1 LegNp",
    name: "Prothoracic leg neuropil",
    group: "Leg neuromeres",
    role: "motor",
    neurons: null,
    summary: "Front leg sensory input and motor output, one neuromere per side.",
    hosts: ["Front leg reflexes", "Proprioceptive feedback"],
  },
  {
    slug: "t2-leg-neuropil",
    abbr: "T2 LegNp",
    name: "Mesothoracic leg neuropil",
    group: "Leg neuromeres",
    role: "motor",
    neurons: null,
    summary: "Middle leg control, adjacent to the wing circuitry it coordinates with.",
    hosts: ["Middle leg reflexes", "Inter-leg coordination"],
  },
  {
    slug: "t3-leg-neuropil",
    abbr: "T3 LegNp",
    name: "Metathoracic leg neuropil",
    group: "Leg neuromeres",
    role: "motor",
    neurons: null,
    summary: "Hind leg control, including the take-off extension used in escape.",
    hosts: ["Hind leg extension", "Take-off"],
  },
  {
    slug: "wing-tectulum",
    abbr: "WTct",
    name: "Wing tectulum",
    group: "Tectulum",
    role: "motor",
    neurons: null,
    summary: "Flight power and steering muscles. Where descending steering commands become wingbeats.",
    hosts: ["Flight steering", "Wingbeat amplitude"],
  },
  {
    slug: "haltere-tectulum",
    abbr: "HTct",
    name: "Haltere tectulum",
    group: "Tectulum",
    role: "sensory",
    neurons: null,
    summary: "The fly's gyroscope. Haltere mechanoreceptors report body rotation at very short latency.",
    hosts: ["Gyroscopic feedback", "Flight stabilisation"],
  },
  {
    slug: "neck-tectulum",
    abbr: "NTct",
    name: "Neck tectulum",
    group: "Tectulum",
    role: "motor",
    neurons: null,
    summary: "Head stabilisation — gaze holding against body movement.",
    hosts: ["Gaze stabilisation"],
  },
  {
    slug: "abdominal-neuromere",
    abbr: "ANm",
    name: "Abdominal neuromere",
    group: "Abdominal",
    role: "motor",
    neurons: null,
    summary: "Abdominal movement, and the reproductive and postural circuits that differ most between sexes.",
    hosts: ["Abdominal posture", "Sexually dimorphic circuits"],
  },
];

/* ------------------------------------------------------------------ *
 * C. elegans — WormAtlas ganglia
 * ------------------------------------------------------------------ */

const WORM: RegionDef[] = [
  { slug: "pharyngeal", abbr: "PH", name: "Pharyngeal nervous system", group: "Pharynx", role: "motor", neurons: 20, summary: "A self-contained 20-neuron nervous system driving feeding, almost entirely separate from the somatic one.", hosts: ["Pumping rhythm", "Feeding control"] },
  { slug: "anterior-ganglion", abbr: "G1", name: "Anterior ganglion", group: "Head", role: "sensory", neurons: null, summary: "Anterior sensory endings — the nose. Touch, chemical and thermal input enters here.", hosts: ["Nose touch", "Chemosensation"] },
  { slug: "dorsal-ganglion", abbr: "G2", name: "Dorsal ganglion", group: "Head", role: "integration", neurons: null, summary: "Small dorsal head cluster feeding the nerve ring.", hosts: [] },
  { slug: "lateral-ganglion", abbr: "G3", name: "Lateral ganglion", group: "Head", role: "integration", neurons: null, summary: "The largest head ganglion and the main interneuron hub, including the command interneurons.", hosts: ["AVA/AVB command interneurons", "Locomotion state"] },
  { slug: "ventral-ganglion", abbr: "G4", name: "Ventral ganglion", group: "Head", role: "integration", neurons: null, summary: "Sits at the nerve ring, carrying much of the sensory-to-command relay.", hosts: ["Sensory → command relay"] },
  { slug: "retrovesicular-ganglion", abbr: "G5", name: "Retrovesicular ganglion", group: "Head", role: "premotor", neurons: null, summary: "Transition from head circuitry into the ventral cord motor system.", hosts: ["Head-to-cord transition"] },
  { slug: "posterolateral-ganglion", abbr: "G6", name: "Posterolateral ganglion", group: "Body", role: "sensory", neurons: null, summary: "Body-wall mechanosensory neurons, including the posterior touch cells.", hosts: ["PLM posterior touch"] },
  { slug: "ventral-cord", abbr: "G7", name: "Ventral cord", group: "Body", role: "motor", neurons: null, summary: "The motor cord: repeating A/B/D-type motor neurons that produce the undulating body wave.", hosts: ["Undulatory wave", "Forward/backward locomotion"] },
  { slug: "preanal-ganglion", abbr: "G8", name: "Preanal ganglion", group: "Tail", role: "motor", neurons: null, summary: "Tail motor control; substantially larger in the male, where it drives mating.", hosts: ["Male mating circuits"] },
  { slug: "dorsorectal-ganglion", abbr: "G9", name: "Dorsorectal ganglion", group: "Tail", role: "motor", neurons: null, summary: "Small tail ganglion associated with defecation.", hosts: [] },
  { slug: "lumbar-ganglion", abbr: "G10", name: "Lumbar ganglion", group: "Tail", role: "sensory", neurons: null, summary: "Tail sensory neurons, including harsh-touch and the male ray neurons.", hosts: ["Tail touch", "Male ray sensilla"] },
];

/* ------------------------------------------------------------------ *
 * Ciona larva
 * ------------------------------------------------------------------ */

const CIONA: RegionDef[] = [
  { slug: "sensory-vesicle", abbr: "SV", name: "Sensory vesicle", group: "Brain", role: "sensory", neurons: null, summary: "The larval brain. Contains the ocellus (light) and otolith (gravity) — two sensors, one vesicle.", hosts: ["Phototaxis", "Gravity sensing"] },
  { slug: "neck", abbr: "NK", name: "Neck", group: "Brain", role: "integration", neurons: null, summary: "A short relay between the sensory vesicle and the motor ganglion.", hosts: ["Sensory → motor relay"] },
  { slug: "motor-ganglion", abbr: "MG", name: "Motor ganglion", group: "Motor", role: "premotor", neurons: null, summary: "Five pairs of motor neurons generating the swimming rhythm. A vertebrate hindbrain in miniature.", hosts: ["Swimming central pattern generator"] },
  { slug: "caudal-nerve-cord", abbr: "CNC", name: "Caudal nerve cord", group: "Motor", role: "motor", neurons: null, summary: "The tail cord carrying motor output to the swimming musculature.", hosts: ["Tail muscle drive"] },
];

/* ------------------------------------------------------------------ *
 * Larval fly brain
 * ------------------------------------------------------------------ */

const LARVAL_FLY: RegionDef[] = [
  { slug: "larval-mushroom-body", abbr: "MB", name: "Larval mushroom body", group: "Learning centre", role: "memory", neurons: null, summary: "Roughly 110 Kenyon cells — the smallest complete associative learning circuit mapped in any animal.", hosts: ["Larval odour learning", "MBIN/MBON valence"] },
  { slug: "larval-antennal-lobe", abbr: "AL", name: "Larval antennal lobe", group: "Chemosensory", role: "sensory", neurons: null, summary: "21 olfactory receptor neurons, one per glomerulus. The simplest complete olfactory front end known.", hosts: ["One-receptor-per-glomerulus coding"] },
  { slug: "larval-optic-neuropil", abbr: "LON", name: "Larval optic neuropil", group: "Visual", role: "sensory", neurons: null, summary: "Minimal visual input from the Bolwig organ — light detection rather than imaging.", hosts: ["Light avoidance"] },
  { slug: "larval-sez", abbr: "SEZ", name: "Larval subesophageal zone", group: "Motor output", role: "motor", neurons: null, summary: "Feeding and the descending gateway to the larval nerve cord.", hosts: ["Feeding motor programs", "Descending output"] },
];

export const REGION_SETS: Record<RegionSet, RegionDef[]> = {
  "fly-brain": FLY_BRAIN,
  "fly-vnc": FLY_VNC,
  worm: WORM,
  ciona: CIONA,
  "larval-fly": LARVAL_FLY,
};

/* ------------------------------------------------------------------ *
 * Brains
 * ------------------------------------------------------------------ */

export const BRAINS: BrainDef[] = [
  {
    slug: "fly-female-cns",
    name: "Adult fly · female CNS",
    datasetSlug: "banc",
    organism: "Drosophila melanogaster",
    common: "Fruit fly",
    scope: "Brain and ventral nerve cord, adult female",
    neurons: 158262,
    connections: 3037361,
    synapses: null,
    regionSets: ["fly-brain", "fly-vnc"],
    superclasses: null,
    summary:
      "Brain joined to nerve cord, so a pathway can be followed from photoreceptor to leg muscle without leaving the volume.",
    notes: ["Per-region counts are not published for BANC — import the dataset to compute them."],
  },
  {
    slug: "fly-male-cns",
    name: "Adult fly · male CNS",
    datasetSlug: "male-cns",
    organism: "Drosophila melanogaster",
    common: "Fruit fly",
    scope: "Brain, optic lobes and ventral nerve cord, adult male",
    neurons: 166691,
    connections: null,
    synapses: null,
    regionSets: ["fly-brain", "fly-vnc"],
    superclasses: null,
    summary:
      "The male counterpart. Same regions as the female CNS, and the abdominal neuromere is where the two differ most.",
    notes: ["Sexual dimorphism is concentrated in the abdominal neuromere and mating circuits."],
  },
  {
    slug: "fly-female-brain",
    name: "Adult fly · female brain",
    datasetSlug: "flywire-fafb",
    organism: "Drosophila melanogaster",
    common: "Fruit fly",
    scope: "Whole brain, adult female. No nerve cord.",
    neurons: 139255,
    connections: 2613129,
    synapses: 50000000,
    regionSets: ["fly-brain"],
    superclasses: [
      { name: "Optic", count: 76765, note: "Intrinsic to the optic lobes — 58% of the brain is vision" },
      { name: "Central", count: 32298, note: "Intrinsic to the central brain" },
      { name: "Sensory", count: 11415, note: "Periphery into the brain" },
      { name: "Visual projection", count: 8046, note: "Optic lobes into the central brain" },
      { name: "Ascending", count: 1989, note: "Nerve cord into the brain" },
      { name: "Descending", count: 1276, note: "Brain out to the nerve cord — the motor bottleneck" },
      { name: "Visual centrifugal", count: 519, note: "Central brain back into the optic lobes" },
      { name: "Motor", count: 106, note: "Brain directly to muscle" },
      { name: "Endocrine", count: 69, note: "Brain to corpora allata and cardiaca" },
    ],
    summary:
      "The most heavily annotated connectome in existence. Descending neurons number only 1,276 — every behaviour the body performs passes through that bottleneck.",
    notes: ["Superclass counts total 132,483 annotated neurons of the 139,255 segmented."],
  },
  {
    slug: "fly-hemibrain",
    name: "Adult fly · central brain",
    datasetSlug: "hemibrain",
    organism: "Drosophila melanogaster",
    common: "Fruit fly",
    scope: "Central brain, one hemisphere, adult female",
    neurons: 25000,
    connections: null,
    synapses: 20000000,
    regionSets: ["fly-brain"],
    superclasses: null,
    summary:
      "Partial in coverage but the cleanest cell typing anywhere. The mushroom body and central complex are best characterised here.",
    notes: ["Optic lobes and nerve cord are outside the volume; peripheral partners are truncated."],
  },
  {
    slug: "worm-hermaphrodite",
    name: "C. elegans · hermaphrodite",
    datasetSlug: "c-elegans",
    organism: "Caenorhabditis elegans",
    common: "Nematode worm",
    scope: "Whole animal, including muscle and end organs",
    neurons: 302,
    connections: null,
    synapses: null,
    regionSets: ["worm"],
    superclasses: [
      { name: "Somatic neurons", count: 282, note: "The connected somatic nervous system" },
      { name: "Pharyngeal neurons", count: 20, note: "A near-independent feeding nervous system" },
    ],
    summary:
      "Every neuron named, every connection known, in an animal you could simulate in full. 302 neurons across ten ganglia plus the pharynx.",
    notes: [
      "279 neurons form the connected somatic network; the rest are unconnected or pharyngeal.",
      "The male has 385 neurons, with the extra cells concentrated in the tail.",
    ],
  },
  {
    slug: "ciona-larva-cns",
    name: "Ciona larva · CNS",
    datasetSlug: "ciona-larva",
    organism: "Ciona intestinalis",
    common: "Sea squirt tadpole",
    scope: "Complete central nervous system of the larva",
    neurons: 177,
    connections: 3105,
    synapses: 6618,
    regionSets: ["ciona"],
    superclasses: null,
    summary:
      "A complete chordate nervous system in 177 neurons. Light and gravity in, swimming out, with a motor ganglion that prefigures the vertebrate hindbrain.",
    notes: ["6,618 synapses including 1,772 neuromuscular junctions, plus 1,206 gap junctions."],
  },
  {
    slug: "larval-fly-brain",
    name: "Fly larva · brain",
    datasetSlug: "larval-fly-brain",
    organism: "Drosophila melanogaster",
    common: "Fruit fly larva",
    scope: "Complete brain of the larva",
    neurons: 3016,
    connections: null,
    synapses: 548000,
    regionSets: ["larval-fly"],
    superclasses: [
      { name: "Brain neurons", count: 2536, note: "Differentiated brain neurons" },
      { name: "Input neurons", count: 480, note: "Sensory and ascending input" },
    ],
    summary:
      "Small enough to hold in your head, complete enough to be a brain. 93 neuron types recovered by clustering connectivity alone.",
    notes: ["Nerve cord is outside the volume."],
  },
];

export function brainsForDataset(datasetSlug: string) {
  return BRAINS.filter((b) => b.datasetSlug === datasetSlug);
}

export function regionsForBrain(b: BrainDef): RegionDef[] {
  return b.regionSets.flatMap((s) => REGION_SETS[s]);
}

export const regionCount = (b: BrainDef) => regionsForBrain(b).length;

/** True when the volume includes the nerve cord, not just the brain. */
export const hasNerveCord = (b: BrainDef) => b.regionSets.includes("fly-vnc");
