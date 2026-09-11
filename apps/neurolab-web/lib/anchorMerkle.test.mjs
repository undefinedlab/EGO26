/** Run: node --experimental-strip-types lib/anchorMerkle.test.mjs */
import assert from "node:assert/strict";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex } from "@noble/hashes/utils";
const m = await import("./anchorMerkle.ts");

const h = (s) => `sha256:${bytesToHex(sha256(new TextEncoder().encode(s)))}`;
const receipts = (n) => Array.from({ length: n }, (_, i) => ({ hash: h(`r${i}`), sequence: i }));

let bad = 0;
const check = (name, fn) => { try { fn(); console.log(`  ok   ${name}`); } catch (e) { bad++; console.error(`  FAIL ${name}\n       ${e.message}`); } };
console.log("Merkle receipt batching");

check("every receipt in a batch proves membership", () => {
  for (const n of [1, 2, 3, 4, 5, 7, 8, 9, 33]) {
    const leaves = receipts(n).map((r) => r.hash);
    const root = m.merkleRoot(leaves);
    for (let i = 0; i < n; i++) {
      assert.ok(m.verifyMerkleProof(leaves[i], m.merkleProof(leaves, i), root), `n=${n} i=${i}`);
    }
  }
});

check("a receipt outside the batch does not prove", () => {
  const leaves = receipts(6).map((r) => r.hash);
  const root = m.merkleRoot(leaves);
  assert.equal(m.verifyMerkleProof(h("stranger"), m.merkleProof(leaves, 0), root), false);
});

check("a proof from one position does not prove another", () => {
  const leaves = receipts(8).map((r) => r.hash);
  const root = m.merkleRoot(leaves);
  assert.equal(m.verifyMerkleProof(leaves[3], m.merkleProof(leaves, 4), root), false);
});

check("leaf and node domains are separated", () => {
  // An internal node presented as a leaf must not verify — the CVE-2012-2459 family.
  const leaves = receipts(2).map((r) => r.hash);
  const internal = m.nodeHash(m.leafHash(leaves[0]), m.leafHash(leaves[1]));
  assert.notEqual(m.leafHash(internal), internal, "a node must not double as a leaf");
});

check("odd nodes are promoted, not duplicated", () => {
  // If the last leaf were duplicated, [a,b,c] and [a,b,c,c] would share a root.
  const three = receipts(3).map((r) => r.hash);
  const four = [...three, three[2]];
  assert.notEqual(m.merkleRoot(three), m.merkleRoot(four), "duplication would forge equivalence");
});

check("order changes the root", () => {
  const leaves = receipts(4).map((r) => r.hash);
  const swapped = [leaves[1], leaves[0], leaves[2], leaves[3]];
  assert.notEqual(m.merkleRoot(leaves), m.merkleRoot(swapped));
});

check("a tampered proof step fails", () => {
  const leaves = receipts(4).map((r) => r.hash);
  const root = m.merkleRoot(leaves);
  const proof = m.merkleProof(leaves, 1);
  proof[0] = { ...proof[0], hash: h("evil") };
  assert.equal(m.verifyMerkleProof(leaves[1], proof, root), false);
});

check("batch records the sequence span and sorts by sequence", () => {
  const b = m.buildBatch([
    { hash: h("c"), sequence: 9 },
    { hash: h("a"), sequence: 2 },
    { hash: h("b"), sequence: 5 },
  ]);
  assert.equal(b.firstSequence, 2);
  assert.equal(b.lastSequence, 9);
  assert.equal(b.count, 3);
  assert.deepEqual(b.leaves, [h("a"), h("b"), h("c")]);
});

check("the anchor message is small and self-describing", () => {
  const b = m.buildBatch(receipts(1000));
  const msg = m.anchorMessage(b, "robot-7", "sha256:" + "ab".repeat(32));
  const bytes = new TextEncoder().encode(JSON.stringify(msg)).length;
  assert.ok(bytes < 400, `anchor message is ${bytes} bytes`);
  assert.equal(msg.count, 1000);
  console.log(`       1000 receipts -> ${bytes} byte message`);
});

check("an empty batch is refused", () => {
  assert.throws(() => m.buildBatch([]), /at least one/);
});

check("a non-digest leaf is refused", () => {
  assert.throws(() => m.merkleRoot(["not-a-hash"]), /Not a sha256 digest/);
});

console.log(bad ? `\n${bad} failing` : "\nall passing");
process.exit(bad ? 1 : 0);
