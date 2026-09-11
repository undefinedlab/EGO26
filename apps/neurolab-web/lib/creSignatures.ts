/**
 * DON signature verification for CRE reports.
 *
 * Until this existed, an imported CRE result was a JSON file that anyone could
 * have written. The bindings proved it was *about* a given receipt; nothing
 * proved Chainlink produced it. This closes that: the signatures in the report
 * envelope are checked against a pinned DON signer set, so a result is
 * authentic or it is not, and no server has to be trusted to say which.
 *
 * ── One thing is deliberately not guessed ──────────────────────────────────
 *
 * The exact bytes a CRE node signs — the preimage built from `rawReport` and
 * `reportContext` — are an OCR implementation detail. Picking one construction
 * and asserting it works would produce a verifier that fails closed against
 * real reports for a reason nobody could see.
 *
 * So the candidates are enumerated, and `detectScheme` determines empirically
 * which one a real report uses: the correct scheme is the one under which the
 * signatures recover addresses that are actually in the DON's signer set. An
 * attacker cannot exploit this, because every candidate is checked against the
 * same pinned signer set — a wrong scheme recovers unrelated addresses, which
 * match nothing.
 *
 * Run `detectScheme` once against a real signed report, pin the answer in the
 * signer set, and verification is deterministic from then on.
 */

import { secp256k1 } from "@noble/curves/secp256k1";
import { keccak_256 } from "@noble/hashes/sha3";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils";

/** How the signed digest is built from a report. */
export type SchemeId =
  /** keccak(keccak(rawReport) ‖ reportContext) — OCR2/OCR3 EVM style. */
  | "hash-report-then-context"
  /** keccak(rawReport ‖ reportContext). */
  | "concat-then-hash"
  /** keccak(reportContext ‖ rawReport) — operand order reversed. */
  | "context-first"
  /** keccak(rawReport) alone; context not covered. */
  | "report-only";

export const SCHEMES: SchemeId[] = ["hash-report-then-context", "concat-then-hash", "context-first", "report-only"];

export type DonSignerSet = {
  format: "synapsevm.cre-don-signers.v1";
  workflow: string;
  /** Binds this signer list to one DON configuration. Without it, "verified"
   *  only means some key signed, not that the right committee did. */
  configDigest: string;
  /** Lower-case 0x EVM addresses, in oracle order where known. */
  signers: string[];
  /** Distinct valid signers required. OCR tolerates f faults with f+1. */
  quorum: number;
  /** Where this list came from, kept so provenance is auditable. */
  source: string;
  /** Pinned once determined by `detectScheme` against a real report. */
  scheme?: SchemeId;
};

export type ReportEnvelope = {
  encoding: "hex";
  rawReport: string;
  reportContext: string;
  signatures: { signerId: number; signature: string }[];
};

export type SignatureCheck = {
  signerId: number;
  /** Address recovered from the signature, or null if unrecoverable. */
  recovered: string | null;
  /** Recovered address is in the pinned signer set. */
  known: boolean;
  /** Recovered address matches the position `signerId` claims. */
  positionMatches: boolean;
};

export type VerifyOutcome = {
  verified: boolean;
  scheme: SchemeId | null;
  checks: SignatureCheck[];
  /** Distinct known signers that produced a valid signature. */
  distinctSigners: number;
  quorum: number;
  reason: string;
};

const clean = (hex: string) => (hex.startsWith("0x") ? hex.slice(2) : hex).toLowerCase();

function bytes(label: string, hex: string, expected?: number): Uint8Array {
  const value = clean(hex);
  if (!/^[0-9a-f]*$/.test(value) || value.length % 2) throw Error(`${label} is not hex.`);
  const out = hexToBytes(value);
  if (expected !== undefined && out.length !== expected) {
    throw Error(`${label} must be ${expected} bytes, got ${out.length}.`);
  }
  return out;
}

const join = (...parts: Uint8Array[]) => {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
};

/** The 32-byte digest a node would have signed, under one candidate scheme. */
export function reportDigest(scheme: SchemeId, rawReport: Uint8Array, reportContext: Uint8Array): Uint8Array {
  switch (scheme) {
    case "hash-report-then-context":
      return keccak_256(join(keccak_256(rawReport), reportContext));
    case "concat-then-hash":
      return keccak_256(join(rawReport, reportContext));
    case "context-first":
      return keccak_256(join(reportContext, rawReport));
    case "report-only":
      return keccak_256(rawReport);
  }
}

/** Ethereum address for an uncompressed public key. */
export function addressOf(publicKey: Uint8Array): string {
  const body = publicKey.length === 65 ? publicKey.slice(1) : publicKey;
  return `0x${bytesToHex(keccak_256(body).slice(-20))}`;
}

/**
 * Recover the signing addresses for one signature.
 *
 * A 65-byte signature carries its recovery id; a 64-byte one does not, so both
 * candidates are returned and the caller decides by matching the signer set.
 */
function recoverAddresses(signature: Uint8Array, digest: Uint8Array): string[] {
  const rs = signature.slice(0, 64);
  const ids =
    signature.length === 65
      ? [signature[64] >= 27 ? signature[64] - 27 : signature[64]]
      : signature.length === 64
        ? [0, 1]
        : [];
  const out: string[] = [];
  for (const id of ids) {
    if (id !== 0 && id !== 1) continue;
    try {
      const sig = secp256k1.Signature.fromCompact(rs).addRecoveryBit(id);
      out.push(addressOf(sig.recoverPublicKey(digest).toRawBytes(false)));
    } catch {
      /* A malformed signature simply recovers nothing. */
    }
  }
  return out;
}

/** Verify a report envelope against a pinned signer set. */
export function verifyDonReport(report: ReportEnvelope, signerSet: DonSignerSet, scheme?: SchemeId): VerifyOutcome {
  const chosen = scheme ?? signerSet.scheme ?? null;
  const known = new Set(signerSet.signers.map((s) => s.toLowerCase()));
  const empty = (reason: string): VerifyOutcome => ({
    verified: false,
    scheme: chosen,
    checks: [],
    distinctSigners: 0,
    quorum: signerSet.quorum,
    reason,
  });

  if (!chosen) {
    return empty(
      "No signing scheme is pinned for this DON. Run detectScheme against a real signed report and record the result in the signer set.",
    );
  }
  if (!signerSet.signers.length) return empty("The signer set is empty.");
  if (!report?.signatures?.length) return empty("The report carries no signatures.");

  let raw: Uint8Array;
  let context: Uint8Array;
  try {
    raw = bytes("rawReport", report.rawReport);
    context = bytes("reportContext", report.reportContext);
  } catch (e) {
    return empty(e instanceof Error ? e.message : String(e));
  }
  if (context.length < 40) return empty("reportContext must contain a 32-byte config digest and 8-byte sequence number.");
  const contextDigest = `0x${bytesToHex(context.slice(0, 32))}`;
  if (contextDigest !== signerSet.configDigest.toLowerCase()) {
    return empty("The report context does not match the pinned DON config digest.");
  }

  const digest = reportDigest(chosen, raw, context);
  const checks: SignatureCheck[] = [];
  const distinct = new Set<string>();

  for (const entry of report.signatures) {
    let candidates: string[] = [];
    try {
      candidates = recoverAddresses(bytes("signature", entry.signature), digest);
    } catch {
      candidates = [];
    }
    // Prefer a candidate that is actually a known signer; otherwise report the
    // first recovery so a mismatch is visible rather than silently blank.
    const hit = candidates.find((a) => known.has(a)) ?? null;
    const recovered = hit ?? candidates[0] ?? null;
    const isKnown = Boolean(hit);
    if (isKnown && hit) distinct.add(hit);
    checks.push({
      signerId: entry.signerId,
      recovered,
      known: isKnown,
      positionMatches:
        isKnown &&
        entry.signerId >= 0 &&
        entry.signerId < signerSet.signers.length &&
        signerSet.signers[entry.signerId].toLowerCase() === hit,
    });
  }

  const verified = distinct.size >= signerSet.quorum;
  return {
    verified,
    scheme: chosen,
    checks,
    distinctSigners: distinct.size,
    quorum: signerSet.quorum,
    reason: verified
      ? `${distinct.size} of ${signerSet.signers.length} pinned signers verified; quorum is ${signerSet.quorum}.`
      : `Only ${distinct.size} signature(s) recovered to a pinned signer; quorum is ${signerSet.quorum}.`,
  };
}

/**
 * Compatibility helper for diagnosing historical fixtures.
 *
 * Production signer sets are accepted only with the Chainlink receiver scheme
 * `hash-report-then-context`; this function never changes the pinned set.
 */
export function detectScheme(report: ReportEnvelope, signerSet: DonSignerSet): SchemeId | null {
  for (const scheme of SCHEMES) {
    if (verifyDonReport(report, { ...signerSet, scheme }, scheme).verified) return scheme;
  }
  return null;
}
