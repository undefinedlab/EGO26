/**
 * Exercises the registry decoding against synthetic returndata laid out to the
 * documented offsets, plus the report header and signing digest.
 * Run: node --experimental-strip-types lib/creRegistry.test.mjs
 */
import assert from "node:assert/strict";
import { keccak_256 } from "@noble/hashes/sha3";
import { bytesToHex } from "@noble/hashes/utils";
const m = await import("./creRegistry.ts");

const W = (n) => BigInt(n).toString(16).padStart(64, "0");
let bad = 0;
const check = (name, fn) => { try { fn(); console.log(`  ok   ${name}`); } catch (e) { bad++; console.error(`  FAIL ${name}\n       ${e.message}`); } };

console.log("CRE registry decoding");

check("report header yields the DON id from bytes 37-40", () => {
  const raw = new Uint8Array(140);
  new DataView(raw.buffer).setUint32(37, 4242, false);
  raw.set(new Uint8Array(32).fill(0xab), 45);
  raw.set(new Uint8Array(20).fill(0xcd), 87);
  const h = m.parseReportHeader(raw);
  assert.equal(h.donId, 4242);
  assert.equal(h.workflowId, "0x" + "ab".repeat(32));
  assert.equal(h.workflowOwner, "0x" + "cd".repeat(20));
  assert.equal(h.bodyBytes, 31);
});

check("a short report is refused", () => {
  assert.throws(() => m.parseReportHeader(new Uint8Array(50)), /109 bytes/);
});

check("getDON calldata matches the documented selector", () => {
  assert.equal(m.encodeGetDon(7), "0x23537405" + W(7));
});

check("getDON decodes f and the node ids", () => {
  // struct at word 1; f in struct slot 3; array ptr in struct slot 6
  const struct = [W(0), W(0), W(0), W(2), W(0), W(0), W(8 * 32), W(0)];
  const array = [W(3), "aa".repeat(32), "bb".repeat(32), "cc".repeat(32)];
  const data = "0x" + W(32) + struct.join("") + array.join("");
  const out = m.decodeGetDon(data);
  assert.equal(out.f, 2);
  assert.deepEqual(out.p2pIds, ["0x" + "aa".repeat(32), "0x" + "bb".repeat(32), "0x" + "cc".repeat(32)]);
});

check("an implausible fault tolerance is refused", () => {
  const struct = [W(0), W(0), W(0), W(9999), W(0), W(0), W(8 * 32), W(0)];
  const data = "0x" + W(32) + struct.join("") + W(0);
  assert.throws(() => m.decodeGetDon(data), /fault tolerance/);
});

check("getNodesByP2PIds calldata is well formed", () => {
  const call = m.encodeGetNodes(["0x" + "11".repeat(32), "0x" + "22".repeat(32)]);
  assert.ok(call.startsWith("0x05a51966"));
  assert.equal(call.slice(10, 74), W(32));
  assert.equal(call.slice(74, 138), W(2));
});

check("node tuples give up the signer at slot 3", () => {
  const tuple = (addr) => [W(0), W(0), W(0), addr.padEnd(64, "0"), W(0), W(0), W(0), W(0), W(0)].join("");
  const data = "0x" + W(32) + W(2) + tuple("11".repeat(20)) + tuple("22".repeat(20));
  assert.deepEqual(m.decodeGetNodes(data, 2), ["0x" + "11".repeat(20), "0x" + "22".repeat(20)]);
});

check("a node count mismatch is refused", () => {
  const data = "0x" + W(32) + W(1) + [W(0),W(0),W(0),"33".repeat(20).padEnd(64,"0"),W(0),W(0),W(0),W(0),W(0)].join("");
  assert.throws(() => m.decodeGetNodes(data, 3), /3 requested/);
});

check("signing digest is keccak(keccak(report) || context)", () => {
  const raw = new Uint8Array(120).fill(1);
  const ctx = new Uint8Array(40).fill(2);
  const inner = keccak_256(raw);
  const joined = new Uint8Array(inner.length + ctx.length);
  joined.set(inner, 0); joined.set(ctx, inner.length);
  assert.equal(bytesToHex(m.reportSigningDigest(raw, ctx)), bytesToHex(keccak_256(joined)));
});

console.log(bad ? `\n${bad} failing` : "\nall passing");
process.exit(bad ? 1 : 0);
