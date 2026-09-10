"use client";

/**
 * The shelf — everything you have built or imported, kept in this browser.
 *
 * Compiling only ever kept one package (BUILD_KEY), which is enough to hand
 * the current draft to Simulate but loses everything you made before it. The
 * shelf keeps them all so Verify has something to be a library of.
 *
 * Summaries are small and read on every page load; payloads embed the module
 * JSON and run to megabytes, so they live in a separate store and are fetched
 * only when something actually opens one. Same split as the brain store.
 *
 * Identity is the artifact's own digest, not a counter: recompiling the same
 * graph yields the same stackId and updates the row instead of adding a
 * near-duplicate. Two entries mean two genuinely different artifacts.
 */

import { canonical, digest, type ComposePackage } from "./composeCompiler";
import type { ReplayBundle } from "./composeRuntime";

const DB = "synapsevm.shelf";
const VERSION = 1;
const ITEMS = "items";
const PAYLOADS = "payloads";

export type ShelfKind = "stack" | "receipt";
export type ShelfSource = "compiled" | "imported" | "captured";

export type ShelfItem = {
  /** stackId for a Stack, receipt hash for a receipt. */
  id: string;
  kind: ShelfKind;
  name: string;
  addedAt: string;
  source: ShelfSource;

  /* Stacks */
  version?: string;
  stackId?: string;
  packageHash?: string;
  executable?: boolean;
  policy?: string;
  nodeCount?: number;
  edgeCount?: number;
  nodes?: string[];
  blocks?: string[];
  criticalPathMs?: number;
  deadlineMs?: number;
  modules?: string[];

  /* Receipts */
  stackName?: string;
  tick?: number;
  sequence?: number;
  receiptHash?: string;
  eventCount?: number;
};

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(ITEMS)) db.createObjectStore(ITEMS, { keyPath: "id" });
      if (!db.objectStoreNames.contains(PAYLOADS)) db.createObjectStore(PAYLOADS);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Could not open the local shelf."));
  });
}

function run<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(store, mode);
        const req = fn(tx.objectStore(store));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error("Shelf request failed."));
        tx.oncomplete = () => db.close();
      }),
  );
}

/** Newest first. */
export async function listShelf(): Promise<ShelfItem[]> {
  const rows = await run<ShelfItem[]>(ITEMS, "readonly", (s) => s.getAll() as IDBRequest<ShelfItem[]>);
  return rows.sort((a, b) => (a.addedAt < b.addedAt ? 1 : -1));
}

export function readStack(id: string): Promise<ComposePackage | undefined> {
  return run<ComposePackage | undefined>(PAYLOADS, "readonly", (s) => s.get(id) as IDBRequest<ComposePackage | undefined>);
}

export function readReceipt(id: string): Promise<ReplayBundle | undefined> {
  return run<ReplayBundle | undefined>(PAYLOADS, "readonly", (s) => s.get(id) as IDBRequest<ReplayBundle | undefined>);
}

async function write(item: ShelfItem, payload: unknown) {
  await run(PAYLOADS, "readwrite", (s) => s.put(payload, item.id));
  await run(ITEMS, "readwrite", (s) => s.put(item));
  return item;
}

export async function putStack(pkg: ComposePackage, source: ShelfSource): Promise<ShelfItem> {
  const packageHash = await digest(canonical(pkg));
  const item: ShelfItem = {
    id: pkg.manifest.stackId,
    kind: "stack",
    name: pkg.manifest.name,
    version: pkg.manifest.version,
    addedAt: new Date().toISOString(),
    source,
    stackId: pkg.manifest.stackId,
    packageHash,
    executable: pkg.manifest.executable,
    policy: pkg.graph.policy,
    nodeCount: pkg.graph.nodes.length,
    edgeCount: pkg.graph.edges.length,
    nodes: pkg.graph.nodes.map((n) => n.id),
    blocks: Object.keys(pkg.lockfile),
    criticalPathMs: pkg.runtimePlan.estimatedCriticalPathMs,
    deadlineMs: pkg.graph.deadlineMs,
    modules: Object.keys(pkg.modules ?? {}),
  };
  return write(item, pkg);
}

export async function putReceipt(bundle: ReplayBundle, source: ShelfSource, stackName?: string): Promise<ShelfItem> {
  const item: ShelfItem = {
    id: bundle.receipt.hash,
    kind: "receipt",
    name: stackName ? `${stackName} · tick ${bundle.receipt.tick}` : `Receipt · tick ${bundle.receipt.tick}`,
    addedAt: new Date().toISOString(),
    source,
    stackId: bundle.stackId,
    packageHash: bundle.receipt.packageHash,
    receiptHash: bundle.receipt.hash,
    tick: bundle.receipt.tick,
    sequence: bundle.receipt.sequence,
    eventCount: bundle.receipt.events.length,
    stackName,
  };
  return write(item, bundle);
}

export async function removeItem(id: string) {
  await run(ITEMS, "readwrite", (s) => s.delete(id));
  await run(PAYLOADS, "readwrite", (s) => s.delete(id));
}

export async function clearShelf() {
  await run(ITEMS, "readwrite", (s) => s.clear());
  await run(PAYLOADS, "readwrite", (s) => s.clear());
}

/** Best-effort: a failed shelf write must never break a compile. */
export async function shelveQuietly(pkg: ComposePackage, source: ShelfSource) {
  try {
    return await putStack(pkg, source);
  } catch {
    return null;
  }
}
