/**
 * Graph partner — discovery + audit index for SynapseVM validations.
 *
 * Writes prefer the Sepolia NeuroRegistry relayer and wait for The Graph to
 * index the resulting event. A local index remains available for offline
 * development, but its rows are marked as local evidence rather than public
 * inclusion.
 */

export type GraphValidation = {
  id: string;
  requestHash: string;
  receiptRoot: string;
  blockRoot: string;
  validator: string;
  score: number;
  tag: string | null;
  evidenceURI: string;
  timestamp: string;
  txHash: string;
  source: "local" | "chain" | "subgraph";
};

export type GraphNeuroStack = {
  id: string;
  stackRoot: string;
  manifestURI: string;
  publisher: string;
  createdAt: string;
  active: boolean;
  name: string;
  version: string;
  source: "local" | "chain" | "subgraph";
};

export type GraphIndexSnapshot = {
  format: "synapsevm.graph-index.v1";
  validations: GraphValidation[];
  stacks: GraphNeuroStack[];
  blocks: GraphNeuroStack[];
};

export type AnchorInput = {
  requestHash: string;
  receiptRoot: string;
  blockRoot: string;
  score: number;
  evidenceURI?: string;
  validator?: string;
  tag?: string | null;
  /** Optional on-chain tx once a wallet/relayer submits recordValidation. */
  txHash?: string;
};

const DB = "synapsevm.graph-partner";
const VERSION = 1;
const STORE = "index";
const KEY = "snapshot";
const ZERO = "0x0000000000000000000000000000000000000000";

export function emptyIndex(): GraphIndexSnapshot {
  return { format: "synapsevm.graph-index.v1", validations: [], stacks: [], blocks: [] };
}

/** Accept sha256:… or 0x… and return lowercase 0x + 64 hex. */
export function toBytes32(value: string): string {
  const raw = value.trim().replace(/^sha256:/i, "").replace(/^0x/i, "");
  if (!/^[a-fA-F0-9]{64}$/.test(raw)) throw Error("Expected a 32-byte hex digest.");
  return `0x${raw.toLowerCase()}`;
}

export function digestEquals(a: string, b: string): boolean {
  try {
    return toBytes32(a) === toBytes32(b);
  } catch {
    return false;
  }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Could not open the Graph partner store."));
  });
}

async function readLocal(): Promise<GraphIndexSnapshot> {
  if (typeof indexedDB === "undefined") return emptyIndex();
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(KEY);
    req.onsuccess = () => {
      const value = req.result as GraphIndexSnapshot | undefined;
      resolve(value?.format === "synapsevm.graph-index.v1" ? value : emptyIndex());
    };
    req.onerror = () => reject(req.error ?? new Error("Graph partner read failed."));
    tx.oncomplete = () => db.close();
  });
}

async function writeLocal(snap: GraphIndexSnapshot): Promise<GraphIndexSnapshot> {
  if (typeof indexedDB === "undefined") return snap;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(snap, KEY);
    tx.oncomplete = () => {
      db.close();
      resolve(snap);
    };
    tx.onerror = () => reject(tx.error ?? new Error("Graph partner write failed."));
  });
}

export function upsertValidation(snap: GraphIndexSnapshot, input: AnchorInput): GraphIndexSnapshot {
  const requestHash = toBytes32(input.requestHash);
  const receiptRoot = toBytes32(input.receiptRoot);
  const blockRoot = toBytes32(input.blockRoot);
  let txHash = input.txHash?.trim() || "";
  if (txHash && /^0x[a-fA-F0-9]{64}$/.test(txHash)) txHash = txHash.toLowerCase();
  else if (txHash) {
    /* keep opaque inclusion ids from wallets/relayers */
  } else {
    txHash = `local:${requestHash.slice(2, 18)}`;
  }
  const row: GraphValidation = {
    id: requestHash,
    requestHash,
    receiptRoot,
    blockRoot,
    validator: input.validator ?? ZERO,
    score: Math.max(0, Math.min(100, Math.round(input.score))),
    tag: input.tag ?? null,
    evidenceURI: input.evidenceURI ?? "",
    timestamp: String(Math.floor(Date.now() / 1000)),
    txHash,
    source: "local",
  };

  const validations = [row, ...snap.validations.filter((v) => v.requestHash !== requestHash)];
  return { ...snap, validations };
}

export function upsertStack(
  snap: GraphIndexSnapshot,
  input: { stackRoot: string; manifestURI?: string; name?: string; version?: string; publisher?: string },
): GraphIndexSnapshot {
  const stackRoot = toBytes32(input.stackRoot);
  const row: GraphNeuroStack = {
    id: stackRoot,
    stackRoot,
    manifestURI: input.manifestURI ?? "",
    publisher: input.publisher ?? ZERO,
    createdAt: String(Math.floor(Date.now() / 1000)),
    active: true,
    name: input.name ?? "",
    version: input.version ?? "",
    source: "local",
  };
  const stacks = [row, ...snap.stacks.filter((s) => s.stackRoot !== stackRoot)];
  return { ...snap, stacks };
}

export function findValidation(
  snap: GraphIndexSnapshot,
  requestHash: string,
): GraphValidation | null {
  const key = toBytes32(requestHash);
  return snap.validations.find((v) => v.requestHash === key) ?? null;
}

export function findValidationByReceipt(
  snap: GraphIndexSnapshot,
  receiptRoot: string,
): GraphValidation | null {
  const key = toBytes32(receiptRoot);
  return snap.validations.find((v) => v.receiptRoot === key) ?? null;
}

async function keccak256Hex(data: Uint8Array): Promise<string> {
  const { keccak_256 } = await import("@noble/hashes/sha3");
  const out = keccak_256(data);
  return Array.from(out, (b) => b.toString(16).padStart(2, "0")).join("");
}

function pad32(hex: string): string {
  return hex.replace(/^0x/, "").toLowerCase().padStart(64, "0");
}

function encodeString(value: string): { head: string; tail: string } {
  const bytes = new TextEncoder().encode(value);
  const len = bytes.length.toString(16).padStart(64, "0");
  const body = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  const padded = body + "0".repeat((64 - (body.length % 64 || 64)) % 64);
  return { head: len, tail: padded };
}

export async function recordValidationSelector(): Promise<string> {
  const sig = new TextEncoder().encode("recordValidation(bytes32,bytes32,bytes32,uint8,string)");
  const hash = await keccak256Hex(sig);
  return `0x${hash.slice(0, 8)}`;
}

export async function encodeRecordValidation(input: AnchorInput): Promise<string> {
  const selector = await recordValidationSelector();
  const str = encodeString(input.evidenceURI ?? "");
  // dynamic string offset = 5 * 32 = 160 = 0xa0
  const parts = [
    pad32(toBytes32(input.requestHash)),
    pad32(toBytes32(input.receiptRoot)),
    pad32(toBytes32(input.blockRoot)),
    pad32(input.score.toString(16)),
    pad32("a0"),
    str.head,
    str.tail,
  ];
  return selector + parts.join("");
}

type SubgraphValidationNode = {
  id: string;
  requestHash: string;
  receiptRoot: string;
  blockRoot: string;
  validator: string;
  score: number;
  tag?: string | null;
  evidenceURI?: string;
  timestamp: string;
  txHash?: string;
};

function mapSubgraphValidation(node: SubgraphValidationNode): GraphValidation {
  return {
    id: node.id,
    requestHash: node.requestHash,
    receiptRoot: node.receiptRoot,
    blockRoot: node.blockRoot,
    validator: node.validator,
    score: node.score,
    tag: node.tag ?? null,
    evidenceURI: node.evidenceURI ?? "",
    timestamp: node.timestamp,
    txHash: node.txHash ?? "",
    source: "subgraph",
  };
}

export async function querySubgraphValidation(requestHash: string): Promise<GraphValidation | null> {
  const url = process.env.NEXT_PUBLIC_SUBGRAPH_URL;
  if (!url) return null;
  const hex = toBytes32(requestHash);
  const query = `{
    validations(where: { requestHash: "${hex}" }, first: 1) {
      id requestHash receiptRoot blockRoot validator score tag evidenceURI timestamp txHash
    }
  }`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw Error(`Subgraph query failed (${res.status}).`);
  const json = (await res.json()) as { data?: { validations?: SubgraphValidationNode[] }; errors?: { message: string }[] };
  if (json.errors?.length) throw Error(json.errors[0].message);
  const row = json.data?.validations?.[0];
  return row ? mapSubgraphValidation(row) : null;
}

/** Resolve an anchor: live subgraph first, then local browser index, then server index. */
export async function lookupValidation(requestHash: string): Promise<GraphValidation | null> {
  try {
    const live = await querySubgraphValidation(requestHash);
    if (live) return live;
  } catch {
    /* fall through to local */
  }
  const local = findValidation(await readLocal(), requestHash);
  if (local) return local;
  try {
    const res = await fetch("/api/graph", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "lookup", requestHash }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { validation?: GraphValidation | null };
    return json.validation ?? null;
  } catch {
    return null;
  }
}

export async function anchorValidation(input: AnchorInput): Promise<GraphValidation> {
  try {
    const response = await fetch("/api/graph/anchor", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "validation", ...input }),
      cache: "no-store",
    });
    const body = (await response.json()) as { validation?: GraphValidation; error?: string };
    if (!response.ok || !body.validation) {
      throw Error(body.error ?? `Sepolia registry write failed (${response.status}).`);
    }
    const snap = await readLocal();
    await writeLocal({
      ...snap,
      validations: [
        body.validation,
        ...snap.validations.filter((row) => row.requestHash !== body.validation!.requestHash),
      ],
    });
    return body.validation;
  } catch (error) {
    if (process.env.NEXT_PUBLIC_GRAPH_WRITE_MODE === "onchain") throw error;
  }

  const snap = upsertValidation(await readLocal(), input);
  await writeLocal(snap);
  const row = findValidation(snap, input.requestHash)!;
  try {
    await fetch("/api/graph", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "anchor", ...input }),
    });
  } catch {
    /* browser-local anchor still counts for UI */
  }
  return row;
}

export async function registerStackLocal(input: {
  stackRoot: string;
  manifestURI?: string;
  name?: string;
  version?: string;
}): Promise<GraphNeuroStack> {
  try {
    const response = await fetch("/api/graph/anchor", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "stack", ...input }),
      cache: "no-store",
    });
    const body = (await response.json()) as { stack?: GraphNeuroStack; error?: string };
    if (!response.ok || !body.stack) {
      throw Error(body.error ?? `Sepolia registry write failed (${response.status}).`);
    }
    const snap = await readLocal();
    await writeLocal({
      ...snap,
      stacks: [body.stack, ...snap.stacks.filter((row) => row.stackRoot !== body.stack!.stackRoot)],
    });
    return body.stack;
  } catch (error) {
    if (process.env.NEXT_PUBLIC_GRAPH_WRITE_MODE === "onchain") throw error;
  }

  const snap = upsertStack(await readLocal(), input);
  await writeLocal(snap);
  try {
    await fetch("/api/graph", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "registerStack", ...input }),
    });
  } catch {
    /* ignore */
  }
  return snap.stacks[0];
}

export async function readGraphIndex(): Promise<GraphIndexSnapshot> {
  return readLocal();
}

/** Pure helpers exported for tests (no IndexedDB). */
export const graphPartnerPure = {
  emptyIndex,
  upsertValidation,
  upsertStack,
  findValidation,
  findValidationByReceipt,
  toBytes32,
  digestEquals,
};
