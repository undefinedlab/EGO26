/**
 * Anchoring a batch, and checking one afterwards.
 *
 * The asymmetry here is the point. Submitting needs the operator key and goes
 * through our server. Checking needs nothing at all: Hedera mirror nodes are
 * public REST endpoints, so anyone holding a receipt can confirm it was
 * anchored without our software, our server, or an account of their own.
 *
 * That is what makes the anchor worth having. Evidence that only we can verify
 * is not evidence.
 */

import { merkleProof, verifyMerkleProof, type MerkleProofStep } from "./anchorMerkle";

export type AnchorResult = {
  anchored: boolean;
  receiptRoot: string;
  firstSequence: number;
  lastSequence: number;
  count: number;
  topicId?: string;
  network?: string;
  topicSequenceNumber?: string | null;
  consensusTimestamp?: string | null;
  transactionId?: string | null;
  reason?: string;
  error?: string;
};

export type AnchoredMessage = {
  format: "synapsevm.receipt-anchor.v1";
  deviceId: string;
  stackId: string;
  receiptRoot: string;
  firstSequence: number;
  lastSequence: number;
  count: number;
};

/** Submit a batch. The server holds the key; this only sends hashes. */
export async function anchorReceipts(
  receipts: { hash: string; sequence: number }[],
  deviceId: string,
  stackId: string,
): Promise<AnchorResult> {
  const res = await fetch("/api/anchor", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ receipts, deviceId, stackId }),
  });
  return (await res.json()) as AnchorResult;
}

const mirror = (network: string) =>
  `https://${network === "mainnet" ? "mainnet-public" : network}.mirrornode.hedera.com/api/v1`;

/**
 * Read an anchored batch straight from a public mirror node.
 *
 * No key, no account, no dependency on us — which is exactly the point of
 * anchoring in the first place.
 */
export async function readAnchoredMessage(
  topicId: string,
  sequenceNumber: string | number,
  network = "testnet",
): Promise<{ message: AnchoredMessage; consensusTimestamp: string; url: string }> {
  const url = `${mirror(network)}/topics/${topicId}/messages/${sequenceNumber}`;
  const res = await fetch(url);
  if (!res.ok) throw Error(`The mirror node returned ${res.status} for ${topicId}/${sequenceNumber}.`);

  const body = (await res.json()) as { message?: string; consensus_timestamp?: string };
  if (!body.message) throw Error("That topic message carries no payload.");

  // Mirror nodes return the payload base64-encoded.
  const decoded = typeof atob === "function" ? atob(body.message) : Buffer.from(body.message, "base64").toString("utf8");
  const message = JSON.parse(decoded) as AnchoredMessage;
  if (message.format !== "synapsevm.receipt-anchor.v1") throw Error("That message is not a SynapseVM receipt anchor.");

  return { message, consensusTimestamp: body.consensus_timestamp ?? "", url };
}

export type InclusionCheck = {
  included: boolean;
  receiptRoot: string;
  consensusTimestamp: string;
  proof: MerkleProofStep[];
  reason: string;
};

/**
 * Prove one receipt belongs to an anchored batch.
 *
 * The batch's leaves are needed to build the path — they are not on the ledger,
 * and should not be: the ledger carries one root, not a list of everything a
 * machine decided.
 */
export async function checkInclusion(
  receiptHash: string,
  batchLeaves: string[],
  topicId: string,
  sequenceNumber: string | number,
  network = "testnet",
): Promise<InclusionCheck> {
  const index = batchLeaves.indexOf(receiptHash);
  const { message, consensusTimestamp } = await readAnchoredMessage(topicId, sequenceNumber, network);

  if (index < 0) {
    return {
      included: false,
      receiptRoot: message.receiptRoot,
      consensusTimestamp,
      proof: [],
      reason: "That receipt is not among the batch's leaves.",
    };
  }

  const proof = merkleProof(batchLeaves, index);
  const included = verifyMerkleProof(receiptHash, proof, message.receiptRoot);
  return {
    included,
    receiptRoot: message.receiptRoot,
    consensusTimestamp,
    proof,
    reason: included
      ? `Anchored in ${topicId} at sequence ${sequenceNumber}, consensus ${consensusTimestamp}.`
      : "The Merkle path does not reach the anchored root — these leaves are not the batch that was anchored.",
  };
}

/**
 * Anchor one shelf receipt and return the evidence the anchor claim wants.
 *
 * Returns null rather than throwing when Hedera is unconfigured: an anchor is
 * additional evidence, and its absence must never fail the verification that
 * already succeeded.
 */
export async function anchorReceiptToLedger(
  receiptHash: string,
  sequence: number,
  deviceId: string,
  stackId: string,
): Promise<{
  network: string;
  topicId: string;
  sequenceNumber: string;
  consensusTimestamp: string;
  receiptRoot: string;
  leaves: string[];
} | null> {
  const result = await anchorReceipts([{ hash: receiptHash, sequence }], deviceId, stackId);
  if (!result.anchored || !result.topicId || !result.topicSequenceNumber) {
    // Unconfigured is expected in local/dev without keys — soft miss.
    if (result.reason?.includes("not configured")) return null;
    throw Error(result.error ?? result.reason ?? "Hedera anchor failed.");
  }
  return {
    network: result.network ?? "testnet",
    topicId: result.topicId,
    sequenceNumber: result.topicSequenceNumber,
    consensusTimestamp: result.consensusTimestamp ?? "",
    receiptRoot: result.receiptRoot,
    // Kept so inclusion can be re-proved later; the ledger holds only the root.
    leaves: [receiptHash],
  };
}
