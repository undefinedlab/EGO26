"use client";

/**
 * Imported brains live in the browser, not on a server.
 *
 * The summary is small enough to read on every page load; the graph itself
 * can be tens of megabytes, so it is kept in a separate store and fetched
 * only when something actually needs to traverse it.
 */

import type { BrainGraph, BrainStats } from "./brain";

const DB = "synapsevm.brains";
const VERSION = 1;
const SUMMARIES = "summaries";
const GRAPHS = "graphs";

export type BrainSummary = {
  /** Slug used in the library, e.g. "c-elegans-cook2019". */
  id: string;
  name: string;
  datasetId: string;
  datasetVersion: string;
  adapter: string;
  sourceFile: string;
  importedAt: string;
  digest: string;
  stats: BrainStats;
  notes: string[];
  /** Size of the canonical form the digest covers. */
  canonicalBytes: number;
};

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(SUMMARIES)) db.createObjectStore(SUMMARIES, { keyPath: "id" });
      if (!db.objectStoreNames.contains(GRAPHS)) db.createObjectStore(GRAPHS);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Could not open the local brain store."));
  });
}

function run<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(store, mode);
        const req = fn(tx.objectStore(store));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error("Local brain store write failed."));
        tx.oncomplete = () => db.close();
      }),
  );
}

export const available = () => typeof indexedDB !== "undefined";

export async function listBrains(): Promise<BrainSummary[]> {
  if (!available()) return [];
  try {
    const rows = await run<BrainSummary[]>(SUMMARIES, "readonly", (s) => s.getAll() as IDBRequest<BrainSummary[]>);
    return rows.sort((a, b) => b.importedAt.localeCompare(a.importedAt));
  } catch {
    return [];
  }
}

export async function saveBrain(id: string, name: string, graph: BrainGraph, canonicalBytes: number) {
  const summary: BrainSummary = {
    id,
    name,
    datasetId: graph.datasetId,
    datasetVersion: graph.datasetVersion,
    adapter: graph.adapter,
    sourceFile: graph.sourceFile,
    importedAt: graph.importedAt,
    digest: graph.digest,
    stats: graph.stats,
    notes: graph.notes,
    canonicalBytes,
  };
  await run(GRAPHS, "readwrite", (s) => s.put(graph, id));
  await run(SUMMARIES, "readwrite", (s) => s.put(summary));
  return summary;
}

export async function loadBrain(id: string): Promise<BrainGraph | null> {
  if (!available()) return null;
  try {
    return (await run<BrainGraph | undefined>(GRAPHS, "readonly", (s) => s.get(id) as IDBRequest<BrainGraph | undefined>)) ?? null;
  } catch {
    return null;
  }
}

export async function deleteBrain(id: string) {
  await run(GRAPHS, "readwrite", (s) => s.delete(id) as unknown as IDBRequest<undefined>);
  await run(SUMMARIES, "readwrite", (s) => s.delete(id) as unknown as IDBRequest<undefined>);
}

/** Re-hash a stored graph and compare, so a claimed digest can be checked. */
export async function verifyBrain(id: string) {
  const graph = await loadBrain(id);
  if (!graph) return { ok: false, reason: "Not found in this browser." as const };
  const { digestGraph } = await import("./brain");
  const recomputed = await digestGraph(graph);
  return recomputed === graph.digest
    ? { ok: true as const, digest: recomputed }
    : { ok: false as const, reason: "Digest mismatch", digest: recomputed, expected: graph.digest };
}
