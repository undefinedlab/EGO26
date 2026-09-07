/**
 * Public connectome datasets, packaged as reference cards.
 *
 * Nothing here is hosted by SynapseVM. Each entry is a pointer: what the
 * dataset covers, how complete it is, what it costs to download, and under
 * what licence. Figures are taken from the publishers' own pages; where a
 * number could not be verified it is left null rather than estimated.
 */

/** How much of a nervous system the volume actually contains. */
export type Coverage = "complete-cns" | "complete-brain" | "region" | "sample" | "projections";

export const COVERAGE_LABELS: Record<Coverage, string> = {
  "complete-cns": "Complete nervous system",
  "complete-brain": "Complete brain",
  region: "Brain region",
  sample: "Tissue sample",
  projections: "Projections · mesoscale",
};

export const COVERAGE_HELP: Record<Coverage, string> = {
  "complete-cns": "Every neuron of the animal's central nervous system, brain and nerve cord.",
  "complete-brain": "Every neuron of the brain, but not the nerve cord or body.",
  region: "One anatomical area reconstructed densely; the rest of the animal is absent.",
  sample: "A block of tissue. Dense and complete inside its own volume, but not a nervous system.",
  projections: "Long-range wiring between areas, without synapse-level detail.",
};

export type DatasetDownload = {
  label: string;
  format: string;
  /** null when the publisher does not state a size. */
  bytes: number | null;
  url: string;
};

export type DatasetMeta = {
  slug: string;
  name: string;
  organism: string;
  common: string;
  scope: string;
  coverage: Coverage;
  /**
   * Whether a complete sensory-to-motor circuit can be extracted. False for
   * tissue samples: dense, but with no pathway that starts and ends inside
   * the volume.
   */
  derivable: boolean;
  neurons: number | null;
  connections: number | null;
  synapses: number | null;
  released: string | null;
  version: string;
  license: string;
  licenseNote?: string;
  producer: string;
  homepage: string;
  doi?: string;
  citation: string;
  /** Raw image volume, when the publisher states one. Never the download size. */
  imagery?: string;
  downloads: DatasetDownload[];
  summary: string;
  notes?: string[];
};

const GB = 1024 ** 3;
const MB = 1024 ** 2;

export const DATASETS: DatasetMeta[] = [
  {
    slug: "banc",
    name: "BANC — Brain and Nerve Cord",
    organism: "Drosophila melanogaster",
    common: "Fruit fly",
    scope: "Adult female · brain and ventral nerve cord",
    coverage: "complete-cns",
    derivable: true,
    neurons: 158262,
    connections: 3037361,
    synapses: null,
    released: "2026-05-20",
    version: "v888",
    license: "Not verified",
    licenseNote:
      "FlyWire's earlier FAFB release is CC BY-NC 4.0. The BANC terms were not stated on the pages checked — confirm before any commercial use.",
    producer: "FlyWire · Harvard Medical School · Princeton",
    homepage: "https://codex.flywire.ai/?dataset=banc",
    citation: "The BANC: Drosophila brain and nerve cord (FlyWire, 2026).",
    summary:
      "The first complete adult fly central nervous system: brain joined to nerve cord, so sensory input can be traced all the way to motor output.",
    downloads: [
      { label: "Neuron-to-neuron edgelist", format: "feather", bytes: Math.round(336 * MB), url: "https://codex.flywire.ai/api/download" },
      { label: "Compartment edgelist", format: "feather", bytes: Math.round(321 * MB), url: "https://codex.flywire.ai/api/download" },
      { label: "Neuron metadata", format: "csv", bytes: Math.round(48 * MB), url: "https://codex.flywire.ai/api/download" },
      { label: "Individual synapses", format: "parquet", bytes: Math.round(9.6 * GB), url: "https://codex.flywire.ai/api/download" },
    ],
    notes: [
      "Neuron counts differ between sources depending on proofreading status; Codex reports 158,262.",
    ],
  },
  {
    slug: "male-cns",
    name: "MaleCNS",
    organism: "Drosophila melanogaster",
    common: "Fruit fly",
    scope: "Adult male · brain, optic lobes and ventral nerve cord",
    coverage: "complete-cns",
    derivable: true,
    neurons: 166691,
    connections: null,
    synapses: null,
    released: "2026-06-08",
    version: "v1.0",
    license: "CC-BY",
    producer: "Janelia FlyEM · Cambridge Connectomics · Google Research",
    homepage: "https://male-cns.janelia.org/",
    citation:
      "Sexual dimorphism in the complete Drosophila male central nervous system connectome. Cell, 3 September 2026.",
    summary:
      "The male counterpart to BANC, built by a different consortium. Together they make male and female nervous systems directly comparable.",
    downloads: [
      { label: "Connectivity", format: "feather / parquet", bytes: Math.round(4.6 * GB), url: "https://male-cns.janelia.org/" },
      { label: "Google Cloud bucket", format: "bucket", bytes: null, url: "https://male-cns.janelia.org/" },
    ],
    notes: ["Ships a Dimorphism Explorer for male–female comparison."],
  },
  {
    slug: "flywire-fafb",
    name: "FlyWire FAFB",
    organism: "Drosophila melanogaster",
    common: "Fruit fly",
    scope: "Adult female · whole brain, no nerve cord",
    coverage: "complete-brain",
    derivable: true,
    neurons: 139255,
    connections: 2613129,
    synapses: 50000000,
    released: "2023-10-01",
    version: "v783",
    license: "CC BY-NC 4.0",
    licenseNote:
      "Non-commercial. This is the dataset the bundled LoomGuard block cites as its source — worth resolving before any commercial release.",
    producer: "Princeton · FlyWire consortium",
    homepage: "https://codex.flywire.ai/",
    citation: "The FlyWire connectome: neuronal wiring diagram of a complete fly brain. Nature, October 2024.",
    summary:
      "The first complete adult brain connectome. Superseded in scope by BANC, but far more widely annotated and cited.",
    downloads: [
      { label: "Connections, unfiltered", format: "csv.gz", bytes: Math.round(277 * MB), url: "https://codex.flywire.ai/api/download" },
      { label: "Neuron-to-neuron edgelist", format: "feather", bytes: Math.round(289 * MB), url: "https://codex.flywire.ai/api/download" },
      { label: "Consolidated cell types", format: "csv.gz", bytes: Math.round(0.888 * MB), url: "https://codex.flywire.ai/api/download" },
      { label: "Individual synapses", format: "parquet", bytes: Math.round(1.7 * GB), url: "https://codex.flywire.ai/api/download" },
    ],
    notes: ["Connection count is at a threshold of five synapses per pair."],
  },
  {
    slug: "hemibrain",
    name: "Hemibrain",
    organism: "Drosophila melanogaster",
    common: "Fruit fly",
    scope: "Adult female · central brain, one hemisphere",
    coverage: "region",
    derivable: true,
    neurons: 25000,
    connections: null,
    synapses: 20000000,
    released: "2020-12-23",
    version: "v1.2",
    license: "CC-BY",
    producer: "Janelia FlyEM",
    homepage: "https://www.janelia.org/project-team/flyem/hemibrain",
    citation: "A connectome and analysis of the adult Drosophila central brain. eLife, 2020.",
    summary:
      "The dataset that made fly connectomics practical. Partial in scope, but the cleanest cell typing and the most mature tooling.",
    downloads: [
      { label: "Connectivity", format: "feather", bytes: Math.round(88 * MB), url: "https://neuprint.janelia.org/" },
      { label: "Neuron metadata", format: "csv", bytes: Math.round(1.9 * MB), url: "https://neuprint.janelia.org/" },
    ],
  },
  {
    slug: "c-elegans",
    name: "C. elegans connectomes",
    organism: "Caenorhabditis elegans",
    common: "Nematode worm",
    scope: "Whole animal · hermaphrodite and male, neurons plus muscle and end organs",
    coverage: "complete-cns",
    derivable: true,
    neurons: 302,
    connections: null,
    synapses: null,
    released: "2019-07-03",
    version: "cook-2019",
    license: "Not verified",
    producer: "Emmons lab · WormWiring · OpenWorm",
    homepage: "https://openworm.org/ConnectomeToolbox/",
    citation: "Cook et al. Whole-animal connectomes of both Caenorhabditis elegans sexes. Nature, 2019.",
    summary:
      "The smallest complete nervous system there is, and the only one with a developmental time series. 302 neurons in the hermaphrodite, 385 in the male.",
    downloads: [
      { label: "Adjacency matrices (SI 5)", format: "xlsx", bytes: null, url: "https://www.nature.com/articles/s41586-019-1352-7" },
      { label: "Structured datasets", format: "json / csv", bytes: null, url: "https://openworm.org/ConnectomeToolbox/" },
      { label: "WormWiring matrices", format: "web / csv", bytes: null, url: "https://wormwiring.org/pages/adjacency.html" },
    ],
    notes: [
      "Hermaphrodite graph: 460 nodes (302 neurons, 132 muscles, 26 end organs). Male: 579 nodes (385 neurons).",
      "Eleven overlapping releases exist — White 1986, Varshney 2011, Cook 2019, Witvliet 2021 and others — aggregated by the OpenWorm toolbox.",
    ],
  },
  {
    slug: "larval-fly-brain",
    name: "Drosophila larval brain",
    organism: "Drosophila melanogaster",
    common: "Fruit fly larva",
    scope: "Larva · complete brain",
    coverage: "complete-brain",
    derivable: true,
    neurons: 3016,
    connections: null,
    synapses: 548000,
    released: "2023-03-10",
    version: "winding-2023",
    license: "Not verified",
    producer: "MRC Laboratory of Molecular Biology · Johns Hopkins",
    homepage: "https://www.science.org/doi/full/10.1126/science.add9330",
    doi: "10.1126/science.add9330",
    citation: "Winding et al. The connectome of an insect brain. Science, 2023.",
    summary:
      "A complete insect brain small enough to hold in your head: 3,016 neurons, with 93 neuron types recovered by spectral clustering.",
    downloads: [
      { label: "Connectivity matrices", format: "supplementary", bytes: null, url: "https://www.science.org/doi/full/10.1126/science.add9330" },
    ],
    notes: ["480 input neurons and 2,536 differentiated brain neurons."],
  },
  {
    slug: "ciona-larva",
    name: "Ciona intestinalis larva",
    organism: "Ciona intestinalis",
    common: "Sea squirt tadpole",
    scope: "Larva · complete central nervous system",
    coverage: "complete-cns",
    derivable: true,
    neurons: 177,
    connections: 3105,
    synapses: 6618,
    released: "2016-12-06",
    version: "ryan-2016",
    license: "Not verified",
    licenseNote: "Published in eLife, which is CC-BY; the supplementary data terms were not separately confirmed.",
    producer: "Meinertzhagen lab",
    homepage: "https://elifesciences.org/articles/16962",
    doi: "10.7554/eLife.16962",
    citation:
      "Ryan et al. The CNS connectome of a tadpole larva of Ciona intestinalis highlights sidedness in the brain of a chordate sibling. eLife, 2016.",
    summary:
      "A complete nervous system in 177 neurons — and a chordate, our own phylum. The strongest provenance available for anything claiming vertebrate relevance.",
    downloads: [
      { label: "Connectome tables", format: "supplementary", bytes: null, url: "https://elifesciences.org/articles/16962/figures" },
    ],
    notes: ["6,618 synapses including 1,772 neuromuscular junctions, plus 1,206 gap junctions."],
  },
  {
    slug: "h01-human-cortex",
    name: "H01 human cortex",
    organism: "Homo sapiens",
    common: "Human",
    scope: "~1 mm³ of temporal cortex, surgical sample",
    coverage: "sample",
    derivable: false,
    neurons: 57000,
    connections: null,
    synapses: 150000000,
    released: "2024-05-09",
    version: "h01-release",
    license: "CC BY 4.0",
    producer: "Lichtman lab, Harvard · Google Research",
    homepage: "https://h01-release.storage.googleapis.com/landing.html",
    doi: "10.1126/science.adk4858",
    citation:
      "Shapson-Coe et al. A petavoxel fragment of human cerebral cortex reconstructed at nanoscale resolution. Science, 2024.",
    imagery: "1.4 PB",
    summary:
      "The largest piece of human brain ever reconstructed at synapse resolution. Dense and complete inside its cube — and still only a cube.",
    downloads: [
      { label: "Neuroglancer volume", format: "precomputed", bytes: null, url: "https://h01-release.storage.googleapis.com/landing.html" },
      { label: "Segmentation and annotations", format: "bucket", bytes: null, url: "https://h01-release.storage.googleapis.com/data.html" },
    ],
    notes: [
      "Reported synapse counts vary by release: 130M, ~150M and 183M annotated appear in different write-ups.",
      "No complete pathway starts and ends inside the volume, so no circuit can be derived from it.",
    ],
  },

  /* ---------------- reference tier: scale, but not derivable ------------- */

  {
    slug: "microns",
    name: "MICrONS cubic millimetre",
    organism: "Mus musculus",
    common: "Mouse",
    scope: "1 mm³ of visual cortex, six layers and three visual areas",
    coverage: "sample",
    derivable: false,
    neurons: 120000,
    connections: null,
    synapses: 523000000,
    released: "2025-04-09",
    version: "cortical-mm3",
    license: "Not verified",
    producer: "MICrONS consortium · Allen Institute · Baylor · Princeton",
    homepage: "https://www.microns-explorer.org/cortical-mm3",
    doi: "10.1038/s41586-025-08790-w",
    citation:
      "The MICrONS Consortium. Functional connectomics spanning multiple areas of mouse visual cortex. Nature, 2025.",
    imagery: ">1 PB",
    summary:
      "200,000 cells and 523 million synapses, co-registered with calcium imaging of 75,000 of those neurons while the mouse was awake. Structure and function in the same volume.",
    downloads: [
      { label: "AWS / Google buckets", format: "precomputed", bytes: null, url: "https://www.microns-explorer.org/cortical-mm3" },
      { label: "Functional data (MySQL)", format: "container", bytes: Math.round(97 * GB), url: "https://www.microns-explorer.org/cortical-mm3" },
    ],
    notes: ["Access via CAVE, cloud-volume, BossDB or Neuroglancer."],
  },
  {
    slug: "manc",
    name: "MANC — Male Adult Nerve Cord",
    organism: "Drosophila melanogaster",
    common: "Fruit fly",
    scope: "Adult male · ventral nerve cord only",
    coverage: "region",
    derivable: true,
    neurons: 23000,
    connections: null,
    synapses: null,
    released: "2023-06-01",
    version: "v1.0",
    license: "Not verified",
    producer: "Janelia FlyEM",
    homepage: "https://www.janelia.org/project-team/flyem/manc-connectome",
    citation: "Takemura et al. A connectome of the male Drosophila ventral nerve cord. eLife, 2023.",
    summary: "The motor half of the male fly, later folded into MaleCNS.",
    downloads: [
      { label: "Connectivity", format: "feather", bytes: Math.round(83 * MB), url: "https://neuprint.janelia.org/" },
      { label: "Neuron metadata", format: "csv", bytes: Math.round(1.4 * MB), url: "https://neuprint.janelia.org/" },
    ],
    notes: ["10 million pre-synaptic sites and 74 million post-synaptic densities."],
  },
  {
    slug: "platynereis-larva",
    name: "Platynereis dumerilii larva",
    organism: "Platynereis dumerilii",
    common: "Marine annelid larva",
    scope: "Three-day larva · whole body",
    coverage: "complete-cns",
    derivable: true,
    neurons: null,
    connections: null,
    synapses: null,
    released: "2024-01-01",
    version: "whole-body",
    license: "Not verified",
    producer: "Jékely lab",
    homepage: "https://elifesciences.org/reviewed-preprints/97964",
    citation: "Whole-body connectome of a segmented annelid larva. eLife (reviewed preprint).",
    summary:
      "A whole-body connectome including the cell-type complement — one of very few animals mapped beyond the nervous system.",
    downloads: [
      { label: "Connectome data", format: "supplementary", bytes: null, url: "https://elifesciences.org/reviewed-preprints/97964" },
    ],
  },
  {
    slug: "eyewire-ii-retina",
    name: "Eyewire II mouse retina",
    organism: "Mus musculus",
    common: "Mouse",
    scope: "~1 mm² of adult retina",
    coverage: "sample",
    derivable: false,
    neurons: 25000,
    connections: null,
    synapses: null,
    released: "2025-01-01",
    version: "eyewire-ii",
    license: "Not verified",
    producer: "Seung lab · Princeton",
    homepage: "https://pmc.ncbi.nlm.nih.gov/articles/PMC13252113/",
    citation: "Eyewire II: a connectomic resource for resolving cell types and circuits of the mouse retina.",
    summary:
      "10–100× larger than earlier retinal volumes: 8,000 bipolar cells, 13,000 amacrine cells and 4,000 ganglion cells proofread.",
    downloads: [
      { label: "Reconstructions", format: "precomputed", bytes: null, url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC13252113/" },
    ],
    notes: ["The retina is a self-contained circuit, which makes this the most derivable of the mammalian volumes."],
  },
  {
    slug: "zebrafish-larva",
    name: "Larval zebrafish brain",
    organism: "Danio rerio",
    common: "Zebrafish larva",
    scope: "Whole brain and anterior spinal cord",
    coverage: "complete-brain",
    derivable: false,
    neurons: 40000,
    connections: null,
    synapses: 30000000,
    released: "2025-06-10",
    version: "clem-2025",
    license: "Not verified",
    producer: "Multiple groups · CLEM resource",
    homepage: "https://www.biorxiv.org/content/10.1101/2025.06.10.658982v1.full",
    citation: "A connectomic resource for neural cataloguing and circuit dissection of the larval zebrafish brain. bioRxiv, 2025.",
    summary:
      "The first vertebrate whole brain at synapse resolution: 180,000 segmented somas, 40,000 molecularly annotated neurons, 30 million synapses.",
    downloads: [
      { label: "CLEM resource", format: "precomputed", bytes: null, url: "https://www.biorxiv.org/content/10.1101/2025.06.10.658982v1.full" },
    ],
    notes: [
      "Segmentation is complete but comprehensive proofreading is expected to take several more years — treat connectivity as provisional.",
    ],
  },
  {
    slug: "allen-mouse-connectivity",
    name: "Allen Mouse Brain Connectivity Atlas",
    organism: "Mus musculus",
    common: "Mouse",
    scope: "Whole brain · long-range projections",
    coverage: "projections",
    derivable: false,
    neurons: null,
    connections: null,
    synapses: null,
    released: "2014-04-02",
    version: "mesoscale",
    license: "Not verified",
    producer: "Allen Institute for Brain Science",
    homepage: "https://www.nature.com/articles/nature13186",
    doi: "10.1038/nature13186",
    citation: "Oh et al. A mesoscale connectome of the mouse brain. Nature, 2014.",
    summary:
      "428 anterograde tracing experiments covering the whole mouse brain. Region-to-region wiring, not synapses.",
    downloads: [
      { label: "Projection data", format: "api", bytes: null, url: "https://connectivity.brain-map.org/" },
    ],
    notes: ["Not synapse resolution — cannot yield a circuit, but useful for anatomical context."],
  },
  {
    slug: "mouselight",
    name: "Janelia MouseLight",
    organism: "Mus musculus",
    common: "Mouse",
    scope: "Whole brain · single-neuron axonal arbors",
    coverage: "projections",
    derivable: false,
    neurons: 1000,
    connections: null,
    synapses: null,
    released: "2019-01-01",
    version: "neuronbrowser",
    license: "Not verified",
    producer: "Janelia MouseLight team",
    homepage: "https://www.janelia.org/project-team/mouselight",
    citation: "MouseLight NeuronBrowser, Janelia Research Campus.",
    summary:
      "Complete axonal arbors for over a thousand individual neurons, traced across the whole mouse brain at submicron resolution.",
    downloads: [
      { label: "Neuron reconstructions", format: "swc / json", bytes: null, url: "https://registry.opendata.aws/janelia-mouselight/" },
    ],
    notes: ["Light microscopy, not EM — morphology and projection targets, no synapses."],
  },
];

/** The eight promoted to the front of the Datasets tab. */
export const FEATURED = [
  "banc",
  "male-cns",
  "flywire-fafb",
  "hemibrain",
  "c-elegans",
  "larval-fly-brain",
  "ciona-larva",
  "h01-human-cortex",
];

export function totalDownloadBytes(d: DatasetMeta) {
  const known = d.downloads.filter((f) => f.bytes !== null);
  return known.length ? known.reduce((sum, f) => sum + (f.bytes ?? 0), 0) : null;
}

/**
 * The download you would actually need to import the graph. Entries are
 * ordered connectivity-first, so this is the head of the list rather than
 * the smallest file — a 900 kB cell-type table is not the dataset.
 */
export function primaryDownload(d: DatasetMeta) {
  return d.downloads.find((f) => f.bytes !== null) ?? null;
}
