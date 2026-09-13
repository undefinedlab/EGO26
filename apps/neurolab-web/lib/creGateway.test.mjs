import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { verifyMessage, Wallet } from "ethers";
import { canonicalCreJson, createCreJwt } from "./creGateway.ts";

const KEY = "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

test("canonical CRE JSON sorts keys recursively without reordering arrays", () => {
  assert.equal(
    canonicalCreJson({ z: 1, a: { z: 2, a: 3 }, list: [{ y: 1, x: 2 }, 4] }),
    '{"a":{"a":3,"z":2},"list":[{"x":2,"y":1},4],"z":1}',
  );
});

test("CRE JWT binds the canonical request body and recovers the configured signer", async () => {
  const body = { method: "workflows.execute", id: "request-1", params: { workflow: { workflowID: "a".repeat(64) }, input: { z: 1, a: 2 } }, jsonrpc: "2.0" };
  const created = await createCreJwt(body, KEY, 1_700_000_000, "550e8400-e29b-41d4-a716-446655440000");
  const [headerPart, payloadPart, signaturePart] = created.token.split(".");
  const header = JSON.parse(Buffer.from(headerPart, "base64url").toString("utf8"));
  const payload = JSON.parse(Buffer.from(payloadPart, "base64url").toString("utf8"));
  const signature = `0x${Buffer.from(signaturePart, "base64url").toString("hex")}`;
  assert.deepEqual(header, { alg: "ETH", typ: "JWT" });
  assert.equal(payload.digest, `0x${createHash("sha256").update(canonicalCreJson(body)).digest("hex")}`);
  assert.equal(payload.iss, new Wallet(KEY).address);
  assert.equal(payload.iat, 1_700_000_000);
  assert.equal(payload.exp, 1_700_000_300);
  assert.equal(payload.jti, "550e8400-e29b-41d4-a716-446655440000");
  assert.equal(verifyMessage(`${headerPart}.${payloadPart}`, signature), new Wallet(KEY).address);
});
