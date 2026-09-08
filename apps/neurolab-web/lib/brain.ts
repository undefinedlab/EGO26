/**
 * Brain — a connectome normalised into one canonical graph.
 *
 * The point of this tier is comparability and addressability. A Codex feather
 * export and a spreadsheet from a 1986 paper arrive in different shapes; once
 * imported they are the same schema, so a selection written against one works
 * against the other.
 *
 * The digest is taken over a deterministic byte serialisation, not over the
 * JSON object, so two imports of the same source produce the same hash on any
 * machine regardless of key order or float formatting.
 */

export const BRAIN_SCHEMA = "synapsevm.brain.v1";

export type Side = "L" | "R" | "C" | "";
export type EdgeKind = "chemical" | "electrical";

export type BrainNode = {
  /** Stable identifier from the source (root id, neuron name, cell number). */
  id: string;
  /** Human label; falls back to id. */
  label: string;
  /** Cell type or class, when the source annotates one. */
  type: string;
  /** Neuropil, ganglion or segment. Drives Region selection later. */
  region: string;
  side: Side;
  /**
   * Neurotransmitter. In most datasets this is *predicted*, not measured —
   * `ntPredicted` records which, because sign decides whether a derived
   * circuit behaves at all.
   */
  nt: string;
  ntPredicted: boolean;
};

export type BrainEdge = {
  pre: string;
  post: string;
  /** Synapse count, or connection strength where the source gives one. */
  weight: number;
  region: string;
  kind: EdgeKind;
};

export type BrainStats = {
  nodes: number;
  edges: number;
  totalWeight: number;
  regions: number;
  types: number;
  /** Nodes with no incoming edges — candidate sensory inputs. */
  sources: number;
  /** Nodes with no outgoing edges — candidate motor outputs. */
  sinks: number;
  isolated: number;
  electrical: number;
  ntCoverage: number;
  regionCoverage: number;
};

export type BrainGraph = {
  schema: typeof BRAIN_SCHEMA;
  /** Library id of the Dataset this was imported from, e.g. "datasets/c-elegans". */
  datasetId: string;
  datasetVersion: string;
  /** Adapter that produced it, so the import is reproducible. */
  adapter: string;
  sourceFile: string;
  importedAt: string;
  nodes: BrainNode[];
  edges: BrainEdge[];
  stats: BrainStats;
  /** sha256 over the canonical serialisation of nodes + edges. */
  digest: string;
  notes: string[];
};

/* ------------------------------------------------------------------ *
 * Canonical form
 * ------------------------------------------------------------------ */

const TAB = "\t";
const NL = "\n";

/**
 * Sorting is what makes the byte stream independent of row order in the
 * source file. The edge key must be the full identity — (pre, post, kind,
 * region) — or two rows that differ only by region would sort equal and keep
 * whatever order the file happened to have.
 */
export function sortGraph(nodes: BrainNode[], edges: BrainEdge[]) {
  nodes.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  edges.sort(
    (a, b) =>
      (a.pre < b.pre ? -1 : a.pre > b.pre ? 1 : 0) ||
      (a.post < b.post ? -1 : a.post > b.post ? 1 : 0) ||
      (a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : 0) ||
      (a.region < b.region ? -1 : a.region > b.region ? 1 : 0),
  );
}

/** Weights are integers where possible, else fixed to 6dp — never raw floats. */
function num(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(6);
}

const esc = (s: string) => s.replace(/[\t\n\r]/g, " ");

/**
 * Deterministic byte stream. Emitted in chunks so a large graph never has to
 * exist as a single string.
 */
export function* canonicalChunks(g: Pick<BrainGraph, "nodes" | "edges">): Generator<string> {
  yield `${BRAIN_SCHEMA}${NL}`;
  yield `#nodes${TAB}${g.nodes.length}${NL}`;
  for (const n of g.nodes) {
    yield [n.id, esc(n.label), esc(n.type), esc(n.region), n.side, esc(n.nt), n.ntPredicted ? "1" : "0"].join(TAB) + NL;
  }
  yield `#edges${TAB}${g.edges.length}${NL}`;
  for (const e of g.edges) {
    yield [e.pre, e.post, num(e.weight), esc(e.region), e.kind].join(TAB) + NL;
  }
}

export async function digestGraph(g: Pick<BrainGraph, "nodes" | "edges">): Promise<string> {
  const parts: string[] = [];
  for (const chunk of canonicalChunks(g)) parts.push(chunk);
  const bytes = await new Blob(parts).arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  const hex = Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return "sha256:" + hex;
}

/** Size of the canonical form, which is what the digest covers. */
export function canonicalBytes(g: Pick<BrainGraph, "nodes" | "edges">) {
  let total = 0;
  const enc = new TextEncoder();
  for (const chunk of canonicalChunks(g)) total += enc.encode(chunk).length;
  return total;
}

/* ------------------------------------------------------------------ *
 * Stats
 * ------------------------------------------------------------------ */

export function computeStats(nodes: BrainNode[], edges: BrainEdge[]): BrainStats {
  const indeg = new Map<string, number>();
  const outdeg = new Map<string, number>();
  const regions = new Set<string>();
  const types = new Set<string>();
  let totalWeight = 0;
  let electrical = 0;

  for (const e of edges) {
    outdeg.set(e.pre, (outdeg.get(e.pre) ?? 0) + 1);
    indeg.set(e.post, (indeg.get(e.post) ?? 0) + 1);
    totalWeight += e.weight;
    if (e.kind === "electrical") electrical++;
  }

  let sources = 0;
  let sinks = 0;
  let isolated = 0;
  let withNt = 0;
  let withRegion = 0;

  for (const n of nodes) {
    const i = indeg.get(n.id) ?? 0;
    const o = outdeg.get(n.id) ?? 0;
    if (!i && !o) isolated++;
    else if (!i) sources++;
    else if (!o) sinks++;
    if (n.nt) withNt++;
    if (n.region) {
      withRegion++;
      regions.add(n.region);
    }
    if (n.type) types.add(n.type);
  }

  for (const e of edges) if (e.region) regions.add(e.region);

  return {
    nodes: nodes.length,
    edges: edges.length,
    totalWeight,
    regions: regions.size,
    types: types.size,
    sources,
    sinks,
    isolated,
    electrical,
    ntCoverage: nodes.length ? withNt / nodes.length : 0,
    regionCoverage: nodes.length ? withRegion / nodes.length : 0,
  };
}

/** Top regions by node count — what the Region tier will select over. */
export function regionHistogram(nodes: BrainNode[], edges: BrainEdge[], limit = 12) {
  const counts = new Map<string, number>();
  for (const n of nodes) if (n.region) counts.set(n.region, (counts.get(n.region) ?? 0) + 1);
  if (!counts.size) for (const e of edges) if (e.region) counts.set(e.region, (counts.get(e.region) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
}

export function formatCount(n: number) {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e4) return (n / 1e3).toFixed(0) + "k";
  return n.toLocaleString();
}
