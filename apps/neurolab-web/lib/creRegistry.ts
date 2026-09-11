/**
 * Chainlink Capabilities Registry reads, for DON signer sets.
 *
 * This is what makes a verified report mean something. A pinned signer file
 * says "these are the signers because we said so"; reading the registry says
 * "these are the signers because Ethereum says so", and the DON id comes out
 * of the report itself rather than being asserted alongside it.
 *
 * Per Chainlink's offchain verification guide:
 *   registry  0x76c9cf548b4179F8901cda1f8623568b58215E62 (Ethereum Mainnet)
 *   getDON(uint32)             0x23537405  → f at slot 3, nodeP2PIds ptr at slot 6
 *   getNodesByP2PIds(bytes32[]) 0x05a51966 → NodeInfo tuples of 9 slots,
 *                                            signer in slot 3 (first 20 bytes)
 *   digest    keccak256(keccak256(rawReport) ‖ reportContext)
 *   quorum    f + 1
 *
 * The decoding here follows those documented offsets rather than a full ABI
 * decoder, which keeps the dependency surface at zero. The safety property
 * that makes that acceptable: a decoding mistake yields addresses that match
 * no signature, so verification fails closed. It cannot invent a pass.
 */

import { keccak_256 } from "@noble/hashes/sha3";
import { bytesToHex } from "@noble/hashes/utils";

export const CAPABILITIES_REGISTRY = "0x76c9cf548b4179F8901cda1f8623568b58215E62";
export const ETHEREUM_MAINNET_CHAIN_SELECTOR = "5009297550715157269";

export const SELECTOR_GET_DON = "0x23537405";
export const SELECTOR_GET_NODES = "0x05a51966";

/** The fixed-layout header every CRE report carries. */
export type ReportHeader = {
  donId: number;
  workflowId: string;
  workflowOwner: string;
  /** Byte length of the payload after the 109-byte header. */
  bodyBytes: number;
};

const HEADER_BYTES = 109;

/**
 * Read the header. The DON id is the part that matters here: it says which
 * committee to ask the registry about, and it is inside the signed bytes, so
 * it cannot be swapped without breaking the signatures.
 */
export function parseReportHeader(rawReport: Uint8Array): ReportHeader {
  if (rawReport.length < HEADER_BYTES) {
    throw Error(`A CRE report header is ${HEADER_BYTES} bytes; got ${rawReport.length}.`);
  }
  const view = new DataView(rawReport.buffer, rawReport.byteOffset, rawReport.byteLength);
  return {
    donId: view.getUint32(37, false),
    workflowId: `0x${bytesToHex(rawReport.slice(45, 77))}`,
    workflowOwner: `0x${bytesToHex(rawReport.slice(87, 107))}`,
    bodyBytes: rawReport.length - HEADER_BYTES,
  };
}

const strip = (hex: string) => (hex.startsWith("0x") ? hex.slice(2) : hex).toLowerCase();

/** One 32-byte word of returndata, as hex without 0x. */
function word(data: string, slot: number): string {
  const body = strip(data);
  const at = slot * 64;
  if (body.length < at + 64) throw Error(`Registry returndata is too short for slot ${slot}.`);
  return body.slice(at, at + 64);
}

const wordToNumber = (w: string) => {
  const value = BigInt(`0x${w}`);
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw Error("Registry returned an implausible value.");
  return Number(value);
};

/** `getDON(uint32)` calldata. */
export const encodeGetDon = (donId: number) =>
  `${SELECTOR_GET_DON}${donId.toString(16).padStart(64, "0")}`;

/**
 * Pull `f` and the node P2P ids out of a `getDON` response.
 *
 * The struct is dynamic, so returndata opens with an offset to it; the
 * documented slots are counted from the struct's own start.
 */
export function decodeGetDon(data: string): { f: number; p2pIds: string[] } {
  const base = wordToNumber(word(data, 0)) / 32;
  if (!Number.isInteger(base)) throw Error("Registry struct offset is not word aligned.");

  const f = wordToNumber(word(data, base + 3));
  if (f < 0 || f > 100) throw Error(`Registry reported an implausible fault tolerance (${f}).`);

  // Slot 6 holds a byte offset to the array, relative to the struct start.
  const arrayAt = base + wordToNumber(word(data, base + 6)) / 32;
  const count = wordToNumber(word(data, arrayAt));
  if (count > 256) throw Error(`Registry reported an implausible node count (${count}).`);

  const p2pIds: string[] = [];
  for (let i = 0; i < count; i++) p2pIds.push(`0x${word(data, arrayAt + 1 + i)}`);
  return { f, p2pIds };
}

/** `getNodesByP2PIds(bytes32[])` calldata. */
export function encodeGetNodes(p2pIds: string[]): string {
  const head = (32).toString(16).padStart(64, "0");
  const length = p2pIds.length.toString(16).padStart(64, "0");
  return `${SELECTOR_GET_NODES}${head}${length}${p2pIds.map((id) => strip(id).padStart(64, "0")).join("")}`;
}

/** NodeInfo tuples are 9 words; the signer address sits in slot 3. */
const NODE_WORDS = 9;

export function decodeGetNodes(data: string, expected: number): string[] {
  const base = wordToNumber(word(data, 0)) / 32;
  if (!Number.isInteger(base)) throw Error("Registry node array offset is not word aligned.");
  const count = wordToNumber(word(data, base));
  if (expected && count !== expected) {
    throw Error(`Registry returned ${count} nodes for ${expected} requested ids.`);
  }

  const signers: string[] = [];
  for (let i = 0; i < count; i++) {
    const tuple = base + 1 + i * NODE_WORDS;
    // Address is left-aligned in its word: first 20 bytes.
    signers.push(`0x${word(data, tuple + 3).slice(0, 40)}`);
  }
  return signers;
}

/** The digest a DON node signs, per Chainlink's offchain verification guide. */
export function reportSigningDigest(rawReport: Uint8Array, reportContext: Uint8Array): Uint8Array {
  const inner = keccak_256(rawReport);
  const joined = new Uint8Array(inner.length + reportContext.length);
  joined.set(inner, 0);
  joined.set(reportContext, inner.length);
  return keccak_256(joined);
}
