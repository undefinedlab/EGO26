/**
 * Merkle batching for receipt anchoring.
 *
 * Anchoring every receipt individually would cost a message per decision and
 * put the ledger in the loop, which is exactly what the spec forbids. Instead a
 * run's receipts are folded into one root, one message carries it, and any
 * single receipt is later shown to belong to that batch with a short proof.
 *
 * Two details that are easy to get wrong and expensive to get wrong:
 *
 * Leaves and internal nodes are hashed with different prefixes. Without that
 * separation an attacker can present an internal node as if it were a leaf and
 * forge membership for data that was never in the tree.
 *
 * An odd node is promoted unchanged rather than duplicated. Duplicating the
 * last leaf is the Bitcoin behaviour (CVE-2012-2459) and lets two different
 * leaf sets produce the same root, which would make a proof meaningless.
 *
 * SHA-256 throughout, matching every other digest in the system, so a receipt
 * hash can be used as a leaf without re-encoding.
 */

import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils";

const LEAF = 0x00;
const NODE = 0x01;

export type MerkleProofStep = { hash: string; side: "left" | "right" };

export type ReceiptBatch = {
  /** The value that goes on the ledger. */
  receiptRoot: string;
  /** Receipt hashes in the order they were folded. */
  leaves: string[];
  /** Receipt sequence numbers covered, for the ReceiptBatch record. */
  firstSequence: number;
  lastSequence: number;
  count: number;
};

const HASH = /^sha256:[0-9a-f]{64}$/;

const strip = (value: string) => (value.startsWith("sha256:") ? value.slice(7) : value).toLowerCase();

function digestBytes(value: string): Uint8Array {
  const hex = strip(value);
  if (!/^[0-9a-f]{64}$/.test(hex)) throw Error(`Not a sha256 digest: ${value}`);
  return hexToBytes(hex);
}

/** Hash one receipt digest into a leaf. */
export function leafHash(receiptHash: string): string {
  return `sha256:${bytesToHex(sha256(new Uint8Array([LEAF, ...digestBytes(receiptHash)])))}`;
}

/** Hash two children into their parent. */
export function nodeHash(left: string, right: string): string {
  const l = digestBytes(left);
  const r = digestBytes(right);
  const buf = new Uint8Array(1 + l.length + r.length);
  buf[0] = NODE;
  buf.set(l, 1);
  buf.set(r, 1 + l.length);
  return `sha256:${bytesToHex(sha256(buf))}`;
}

/** Build every level of the tree, leaves first. */
function levels(leaves: string[]): string[][] {
  if (!leaves.length) throw Error("A batch needs at least one receipt.");
  const all: string[][] = [leaves];
  let current = leaves;
  while (current.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < current.length; i += 2) {
      // An unpaired node rises unchanged; duplicating it would let two
      // different leaf sets share a root.
      next.push(i + 1 < current.length ? nodeHash(current[i], current[i + 1]) : current[i]);
    }
    all.push(next);
    current = next;
  }
  return all;
}

export function merkleRoot(receiptHashes: string[]): string {
  return levels(receiptHashes.map(leafHash)).at(-1)![0];
}

/** The sibling path proving `index` belongs to the tree. */
export function merkleProof(receiptHashes: string[], index: number): MerkleProofStep[] {
  if (index < 0 || index >= receiptHashes.length) throw Error("Receipt index is outside the batch.");
  const tree = levels(receiptHashes.map(leafHash));
  const proof: MerkleProofStep[] = [];
  let at = index;
  for (let depth = 0; depth < tree.length - 1; depth++) {
    const row = tree[depth];
    const pair = at % 2 === 0 ? at + 1 : at - 1;
    // A promoted node has no sibling at this level and contributes no step.
    if (pair < row.length) proof.push({ hash: row[pair], side: at % 2 === 0 ? "right" : "left" });
    at = Math.floor(at / 2);
  }
  return proof;
}

/** Recompute the root from one receipt and its path. */
export function verifyMerkleProof(receiptHash: string, proof: MerkleProofStep[], root: string): boolean {
  let node: string;
  try {
    node = leafHash(receiptHash);
  } catch {
    return false;
  }
  for (const step of proof) {
    if (!HASH.test(step.hash)) return false;
    node = step.side === "right" ? nodeHash(node, step.hash) : nodeHash(step.hash, node);
  }
  return node === root.toLowerCase();
}

/** Fold a run's receipts into one anchorable batch. */
export function buildBatch(
  receipts: { hash: string; sequence: number }[],
): ReceiptBatch {
  if (!receipts.length) throw Error("A batch needs at least one receipt.");
  const ordered = [...receipts].sort((a, b) => a.sequence - b.sequence);
  const leaves = ordered.map((r) => r.hash);
  return {
    receiptRoot: merkleRoot(leaves),
    leaves,
    firstSequence: ordered[0].sequence,
    lastSequence: ordered.at(-1)!.sequence,
    count: ordered.length,
  };
}

/** Exactly what gets submitted as an HCS message — small and self-describing. */
export function anchorMessage(batch: ReceiptBatch, deviceId: string, stackId: string) {
  return {
    format: "synapsevm.receipt-anchor.v1" as const,
    deviceId,
    stackId,
    receiptRoot: batch.receiptRoot,
    firstSequence: batch.firstSequence,
    lastSequence: batch.lastSequence,
    count: batch.count,
  };
}
