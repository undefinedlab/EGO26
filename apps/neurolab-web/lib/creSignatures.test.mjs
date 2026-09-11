/**
 * Proves the signature path end to end against generated keys.
 *
 * This cannot prove CRE's real preimage — only a real signed report can do
 * that. What it does prove is that recovery, address derivation, signer-set
 * matching, quorum and scheme detection all behave, so when a real report
 * arrives the only unknown left is which construction it used.
 *
 * Run: node lib/creSignatures.test.mjs
 */

import assert from "node:assert/strict";
import { secp256k1 } from "@noble/curves/secp256k1";
import { keccak_256 } from "@noble/hashes/sha3";
import { bytesToHex } from "@noble/hashes/utils";

const mod = await import("./creSignatures.ts").catch(() => null);
if (!mod) {
  console.error("Run through a TS-aware loader, or import the compiled module.");
  process.exit(1);
}
const { addressOf, detectScheme, reportDigest, verifyDonReport } = mod;

/* ── a fake DON ─────────────────────────────────────────────────────────── */
const keys = Array.from({ length: 4 }, () => secp256k1.utils.randomPrivateKey());
const signers = keys.map((k) => addressOf(secp256k1.getPublicKey(k, false)));

const rawReport = keccak_256(new TextEncoder().encode("neuroproof result")).slice(0, 32);
const reportContext = new Uint8Array(40).fill(7);
reportContext.fill(0xab, 0, 32);

/** Sign as the DON would, under a chosen scheme. */
function sign(scheme, indexes) {
  const digest = reportDigest(scheme, rawReport, reportContext);
  return {
    encoding: "hex",
    rawReport: bytesToHex(rawReport),
    reportContext: bytesToHex(reportContext),
    signatures: indexes.map((i) => {
      const sig = secp256k1.sign(digest, keys[i]);
      const packed = new Uint8Array(65);
      packed.set(sig.toCompactRawBytes(), 0);
      packed[64] = sig.recovery;
      return { signerId: i, signature: bytesToHex(packed) };
    }),
  };
}

const base = {
  format: "synapsevm.cre-don-signers.v1",
  workflow: "synapsevm-neuroproof-v1",
  configDigest: "0x" + "ab".repeat(32),
  signers,
  quorum: 3,
  source: "test fixture",
};

let failures = 0;
const check = (name, fn) => {
  try {
    fn();
    console.log(`  ok   ${name}`);
  } catch (e) {
    failures++;
    console.error(`  FAIL ${name}\n       ${e.message}`);
  }
};

console.log("DON signature verification");

check("a quorum of genuine signatures verifies", () => {
  const report = sign("hash-report-then-context", [0, 1, 2]);
  const out = verifyDonReport(report, { ...base, scheme: "hash-report-then-context" });
  assert.equal(out.verified, true, out.reason);
  assert.equal(out.distinctSigners, 3);
  assert.ok(out.checks.every((c) => c.known && c.positionMatches));
});

check("below quorum is refused", () => {
  const report = sign("hash-report-then-context", [0, 1]);
  const out = verifyDonReport(report, { ...base, scheme: "hash-report-then-context" });
  assert.equal(out.verified, false);
  assert.equal(out.distinctSigners, 2);
});

check("a different DON config digest is refused", () => {
  const report = sign("hash-report-then-context", [0, 1, 2]);
  const out = verifyDonReport(report, { ...base, configDigest: "0x" + "cd".repeat(32), scheme: "hash-report-then-context" });
  assert.equal(out.verified, false);
  assert.match(out.reason, /config digest/);
});

check("a stranger's signature is not counted", () => {
  const outsider = secp256k1.utils.randomPrivateKey();
  const digest = reportDigest("hash-report-then-context", rawReport, reportContext);
  const sig = secp256k1.sign(digest, outsider);
  const packed = new Uint8Array(65);
  packed.set(sig.toCompactRawBytes(), 0);
  packed[64] = sig.recovery;
  const report = sign("hash-report-then-context", [0, 1]);
  report.signatures.push({ signerId: 9, signature: bytesToHex(packed) });
  const out = verifyDonReport(report, { ...base, scheme: "hash-report-then-context" });
  assert.equal(out.verified, false, "an outsider must not make quorum");
  assert.equal(out.checks.filter((c) => c.known).length, 2);
});

check("a tampered report fails", () => {
  const report = sign("hash-report-then-context", [0, 1, 2]);
  report.rawReport = bytesToHex(keccak_256(new TextEncoder().encode("tampered")).slice(0, 32));
  const out = verifyDonReport(report, { ...base, scheme: "hash-report-then-context" });
  assert.equal(out.verified, false);
});

check("the wrong scheme does not verify", () => {
  const report = sign("hash-report-then-context", [0, 1, 2]);
  const out = verifyDonReport(report, { ...base, scheme: "concat-then-hash" });
  assert.equal(out.verified, false, "a different construction must not accept");
});

check("detectScheme finds the construction actually used", () => {
  for (const scheme of ["hash-report-then-context", "concat-then-hash", "context-first", "report-only"]) {
    const report = sign(scheme, [0, 1, 2]);
    assert.equal(detectScheme(report, base), scheme, `expected ${scheme}`);
  }
});

check("detectScheme returns null against an unrelated signer set", () => {
  const others = Array.from({ length: 4 }, () => addressOf(secp256k1.getPublicKey(secp256k1.utils.randomPrivateKey(), false)));
  const report = sign("hash-report-then-context", [0, 1, 2]);
  assert.equal(detectScheme(report, { ...base, signers: others }), null);
});

check("64-byte signatures recover by trying both recovery ids", () => {
  const digest = reportDigest("hash-report-then-context", rawReport, reportContext);
  const report = {
    encoding: "hex",
    rawReport: bytesToHex(rawReport),
    reportContext: bytesToHex(reportContext),
    signatures: [0, 1, 2].map((i) => ({
      signerId: i,
      signature: bytesToHex(secp256k1.sign(digest, keys[i]).toCompactRawBytes()),
    })),
  };
  const out = verifyDonReport(report, { ...base, scheme: "hash-report-then-context" });
  assert.equal(out.verified, true, out.reason);
});

check("an unpinned scheme refuses rather than guessing", () => {
  const report = sign("hash-report-then-context", [0, 1, 2]);
  const { scheme, ...noScheme } = { ...base };
  const out = verifyDonReport(report, noScheme);
  assert.equal(out.verified, false);
  assert.match(out.reason, /detectScheme/);
});

console.log(failures ? `\n${failures} failing` : "\nall passing");
process.exit(failures ? 1 : 0);
