/**
 * A tiny leaky integrate-and-fire engine that runs a Motif directly.
 *
 * Motifs ship as complete graphs, so unlike a Brain or a Circuit there is
 * nothing to import before one can run. This is what closes the gap between
 * the library and the Sim Lab: pick a motif, press play, watch it compute.
 *
 * Deliberately small and explicit rather than reusing the Q16.16 runtime —
 * the point here is legibility, not deployment fidelity. Anything derived
 * from a motif still has to go through the real compiler to become a Block.
 */

import type { MotifDef, MotifEdge, MotifNode } from "./motifAtlas";

export type MotifParams = {
  /** Membrane decay per tick. Lower forgets faster. */
  leak: number;
  /** Spike threshold. */
  threshold: number;
  /** Excitatory synapse strength. */
  excite: number;
  /** Inhibitory synapse strength, as a positive magnitude. */
  inhibit: number;
  /**
   * Spike-triggered adaptation. Without this a half-centre oscillator just
   * picks a winner and stays there instead of alternating.
   */
  adaptation: number;
  adaptationDecay: number;
  /** Probability per tick that a driven input fires. 1 = every tick. */
  driveRate: number;
  /** Ticks a neuron stays silent after firing. */
  refractory: number;
};

export const DEFAULT_PARAMS: MotifParams = {
  leak: 0.8,
  threshold: 1,
  excite: 0.62,
  inhibit: 0.95,
  adaptation: 0.5,
  adaptationDecay: 0.88,
  driveRate: 1,
  refractory: 1,
};

export type MotifState = {
  tick: number;
  /** Membrane potential per node. */
  v: Record<string, number>;
  /** Adaptation current per node. */
  a: Record<string, number>;
  /** Fired on this tick. */
  fired: Record<string, boolean>;
  /** Ticks of refractory remaining. */
  rest: Record<string, number>;
  /** Edges that carried a spike into this tick. */
  activeEdges: Record<string, boolean>;
};

export const edgeKey = (e: MotifEdge) => `${e.from}->${e.to}`;

export function initState(motif: MotifDef): MotifState {
  const v: Record<string, number> = {};
  const a: Record<string, number> = {};
  const fired: Record<string, boolean> = {};
  const rest: Record<string, number> = {};
  for (const n of motif.nodes) {
    v[n.id] = 0;
    a[n.id] = 0;
    fired[n.id] = false;
    rest[n.id] = 0;
  }
  return { tick: 0, v, a, fired, rest, activeEdges: {} };
}

/** Deterministic per-tick jitter, so a run replays identically. */
function hash(tick: number, seed: number) {
  let x = (tick * 374761393 + seed * 668265263) >>> 0;
  x = (x ^ (x >>> 13)) >>> 0;
  x = Math.imul(x, 1274126177) >>> 0;
  return (x ^ (x >>> 16)) >>> 0;
}

export type Drive = Record<string, boolean>;

/**
 * One tick. Spikes emitted on the previous tick arrive on this one, which
 * gives every synapse a uniform one-tick delay — the reason feedforward
 * inhibition can gate a signal that shares its own source.
 */
export function step(
  motif: MotifDef,
  prev: MotifState,
  drive: Drive,
  params: MotifParams = DEFAULT_PARAMS,
): MotifState {
  const tick = prev.tick + 1;
  const v: Record<string, number> = {};
  const a: Record<string, number> = {};
  const fired: Record<string, boolean> = {};
  const rest: Record<string, number> = {};
  const activeEdges: Record<string, boolean> = {};

  const current: Record<string, number> = {};
  for (const n of motif.nodes) current[n.id] = 0;

  for (const e of motif.edges) {
    if (!prev.fired[e.from]) continue;
    activeEdges[edgeKey(e)] = true;
    if (e.kind === "electrical") {
      // Gap junctions are bidirectional and cannot invert sign.
      current[e.to] = (current[e.to] ?? 0) + params.excite * 0.8;
      current[e.from] = (current[e.from] ?? 0) + params.excite * 0.3;
    } else {
      const w = e.sign === 1 ? params.excite : -params.inhibit;
      current[e.to] = (current[e.to] ?? 0) + w;
    }
  }

  motif.nodes.forEach((n: MotifNode, i) => {
    // An input node is a stimulus source, not a neuron: it fires when driven
    // and is not subject to leak, refractoriness or adaptation. Modelling it
    // as a neuron makes it fatigue and silences the whole motif.
    if (n.kind === "input") {
      const roll = hash(tick, i) / 4294967296;
      const spikes = Boolean(drive[n.id]) && roll < params.driveRate;
      fired[n.id] = spikes;
      v[n.id] = spikes ? 1 : 0;
      a[n.id] = 0;
      rest[n.id] = 0;
      return;
    }

    const wasResting = prev.rest[n.id] > 0;
    const potential = prev.v[n.id] * params.leak + (current[n.id] ?? 0);
    const adapt = prev.a[n.id] * params.adaptationDecay;

    const spikes = !wasResting && potential - adapt >= params.threshold;

    fired[n.id] = spikes;
    v[n.id] = spikes ? 0 : Math.max(-1.5, potential);
    a[n.id] = spikes ? adapt + params.adaptation : adapt;
    rest[n.id] = spikes ? params.refractory : Math.max(0, prev.rest[n.id] - 1);
  });

  return { tick, v, a, fired, rest, activeEdges };
}

/** Input nodes, which are what a stimulus can drive. */
export function inputNodes(motif: MotifDef) {
  return motif.nodes.filter((n) => n.kind === "input");
}

export function outputNodes(motif: MotifDef) {
  return motif.nodes.filter((n) => n.kind === "output");
}

export type RasterRow = { id: string; label: string; kind: MotifNode["kind"]; spikes: boolean[] };

/** Rolling spike raster, newest last. */
export function pushRaster(rows: RasterRow[], motif: MotifDef, state: MotifState, width: number): RasterRow[] {
  const base =
    rows.length === motif.nodes.length
      ? rows
      : motif.nodes.map((n) => ({ id: n.id, label: n.label || n.id, kind: n.kind, spikes: [] as boolean[] }));
  return base.map((r) => {
    const next = [...r.spikes, Boolean(state.fired[r.id])];
    return { ...r, spikes: next.length > width ? next.slice(next.length - width) : next };
  });
}
