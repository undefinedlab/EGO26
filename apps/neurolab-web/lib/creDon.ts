/**
 * The pinned DON signer set.
 *
 * Pinning is the point. If the signer list were fetched from a mutable
 * endpoint at verification time, "verified" would mean "whatever that endpoint
 * said today" — which is trust, wearing a cryptography costume. So the list
 * ships as a static file with the build, and a change to it is a change to the
 * application.
 *
 * Honest limit: served from our own origin, this is only as trustworthy as the
 * build a reader is running. A third party who wants independence should take
 * the signer set from Chainlink's own registry and compare. The `source` and
 * `configDigest` fields exist so that comparison is possible.
 *
 * Until a DON is deployed this file is deliberately unconfigured: no signers,
 * no scheme. Verification then fails closed and says why, which is the correct
 * behaviour for evidence that does not exist yet.
 */

import type { DonSignerSet } from "./creSignatures";

export const DON_SIGNERS_PATH = "/cre/don-signers.json";

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const DIGEST = /^0x[0-9a-fA-F]{64}$/;

export type DonSetState =
  | { configured: true; set: DonSignerSet }
  | { configured: false; reason: string };

/** Reject a malformed or placeholder signer set rather than half-trusting it. */
export function readSignerSet(value: unknown): DonSetState {
  if (!value || typeof value !== "object") return { configured: false, reason: "No DON signer set is present." };
  const v = value as Partial<DonSignerSet>;

  if (v.format !== "synapsevm.cre-don-signers.v1") {
    return { configured: false, reason: "The DON signer file has an unsupported format." };
  }
  if (!Array.isArray(v.signers) || !v.signers.length) {
    return {
      configured: false,
      reason: "No DON signers are pinned yet. Deploy the neuroproof workflow, then record its signer set.",
    };
  }
  if (!v.signers.every((s) => typeof s === "string" && ADDRESS.test(s))) {
    return { configured: false, reason: "Every DON signer must be a 20-byte 0x address." };
  }
  if (new Set(v.signers.map((s) => s.toLowerCase())).size !== v.signers.length) {
    return { configured: false, reason: "The DON signer set contains duplicates." };
  }
  if (typeof v.configDigest !== "string" || !DIGEST.test(v.configDigest)) {
    return {
      configured: false,
      reason: "A DON config digest is required, otherwise a verified signature says nothing about which committee signed.",
    };
  }
  if (typeof v.quorum !== "number" || !Number.isInteger(v.quorum) || v.quorum < 1 || v.quorum > v.signers.length) {
    return { configured: false, reason: "Quorum must be a whole number between 1 and the number of signers." };
  }
  if (typeof v.workflow !== "string" || !v.workflow) {
    return { configured: false, reason: "The signer set must name the workflow it belongs to." };
  }
  if (v.workflow !== "synapsevm-neuroproof-v1") {
    return { configured: false, reason: "The DON signer set belongs to a different workflow." };
  }
  if (v.scheme !== "hash-report-then-context") {
    return {
      configured: false,
      reason: "The DON signer set must use the CRE report digest defined by the Chainlink receiver specification.",
    };
  }
  if (typeof v.source !== "string" || !v.source.trim()) {
    return { configured: false, reason: "The signer set must record its registry source." };
  }

  return {
    configured: true,
    set: {
      format: "synapsevm.cre-don-signers.v1",
      workflow: v.workflow,
      configDigest: v.configDigest,
      signers: v.signers.map((s) => s.toLowerCase()),
      quorum: v.quorum,
      source: v.source,
      scheme: v.scheme,
    },
  };
}

let cached: Promise<DonSetState> | null = null;

/** Load the pinned set. Cached: it ships with the build and cannot change. */
export function loadSignerSet(): Promise<DonSetState> {
  cached ??= fetch(DON_SIGNERS_PATH)
    .then((r) => (r.ok ? r.json() : null))
    .then(readSignerSet)
    .catch(() => ({ configured: false, reason: "The DON signer set could not be read." }) as DonSetState);
  return cached;
}

/* ── Registry-backed signer sets ──────────────────────────────────────────
   The pinned file above is the fallback. The real answer comes from the
   Chainlink Capabilities Registry, keyed by the DON id carried inside the
   signed report, so nobody has to be told — or trusted about — which
   committee to check against. */

import { parseReportHeader, CAPABILITIES_REGISTRY } from "./creRegistry";

export type RegistryLookup =
  | { ok: true; set: DonSignerSet; donId: number; cached: boolean }
  | { ok: false; reason: string; donId?: number };

const registryCache = new Map<number, DonSignerSet>();

/**
 * Look up the signers for whichever DON signed this report.
 *
 * The scheme is pinned to Chainlink's documented construction rather than
 * detected, now that the guide states it: keccak256(keccak256(rawReport) ‖
 * reportContext).
 */
export async function signersForReport(rawReport: Uint8Array, reportContext: Uint8Array): Promise<RegistryLookup> {
  let donId: number;
  try {
    if (reportContext.length < 40) throw Error("The CRE report context must be at least 40 bytes.");
    donId = parseReportHeader(rawReport).donId;
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }

  const hit = registryCache.get(donId);
  if (hit) return { ok: true, set: hit, donId, cached: true };

  try {
    const res = await fetch(`/api/cre/signers?donId=${donId}`);
    const body = (await res.json()) as {
      configured?: boolean; error?: string; f?: number; quorum?: number; signers?: string[]; nodeCount?: number;
    };
    if (!res.ok || body.error) {
      return { ok: false, donId, reason: body.error ?? `The registry lookup failed (${res.status}).` };
    }
    if (!Array.isArray(body.signers) || !body.signers.length || typeof body.quorum !== "number") {
      return { ok: false, donId, reason: `The registry returned no signers for DON ${donId}.` };
    }
    const set: DonSignerSet = {
      format: "synapsevm.cre-don-signers.v1",
      workflow: "synapsevm-neuroproof-v1",
      // The registry authorizes the signer addresses. The context digest is
      // cryptographically covered by their signatures and retained for audit.
      configDigest: `0x${Array.from(reportContext.slice(0, 32), (byte) => byte.toString(16).padStart(2, "0")).join("")}`,
      signers: body.signers.map((s) => s.toLowerCase()),
      quorum: body.quorum,
      source: `Capabilities Registry ${CAPABILITIES_REGISTRY} (Ethereum Mainnet), DON ${donId}, f=${body.f}`,
      scheme: "hash-report-then-context",
    };
    registryCache.set(donId, set);
    return { ok: true, set, donId, cached: false };
  } catch (e) {
    return { ok: false, donId, reason: e instanceof Error ? e.message : String(e) };
  }
}
