/**
 * Graph partner pure helpers.
 * Run: node --experimental-strip-types lib/graphPartner.test.mjs
 */
import assert from "node:assert/strict";
const {
  emptyIndex,
  upsertValidation,
  findValidation,
  findValidationByReceipt,
  upsertStack,
  toBytes32,
  digestEquals,
} = await import("./graphPartner.ts");

const requestHash = "sha256:" + "ab".repeat(32);
const receiptRoot = "sha256:" + "cd".repeat(32);
const blockRoot = "sha256:" + "ef".repeat(32);

assert.equal(toBytes32(requestHash), "0x" + "ab".repeat(32));
assert.equal(digestEquals(requestHash, "0x" + "ab".repeat(32)), true);

let snap = emptyIndex();
snap = upsertValidation(snap, {
  requestHash,
  receiptRoot,
  blockRoot,
  score: 100,
  evidenceURI: "data:application/json,{}",
  tag: "cre",
});

const found = findValidation(snap, requestHash);
assert.ok(found);
assert.equal(found.score, 100);
assert.equal(found.source, "local");
assert.equal(findValidationByReceipt(snap, receiptRoot)?.id, found.id);

snap = upsertStack(snap, {
  stackRoot: blockRoot,
  name: "EmergencyBrake",
  version: "0.1.0",
  manifestURI: "ipfs://demo",
});
assert.equal(snap.stacks[0].name, "EmergencyBrake");

snap = upsertValidation(snap, {
  requestHash,
  receiptRoot,
  blockRoot,
  score: 80,
});
assert.equal(snap.validations.length, 1);
assert.equal(snap.validations[0].score, 80);

console.log("graphPartner.test.mjs: ok");
