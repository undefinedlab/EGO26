/**
 * Compose → receipt → verify with Graph + Hedera (+ CRE when available).
 * Run: node --experimental-strip-types scripts/e2e-compose-verify.mjs
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { canonical, importStack } from "../lib/composeCompiler.ts";
import { loadCompiledStack, scenarioInput } from "../lib/composeRuntime.ts";
import { verifyArtifact, verifyStackEvidence, withAnchorClaim } from "../lib/verification.ts";
import { createCreValidationRequest, assessCreResult } from "../lib/creValidation.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const DEMO = path.join(ROOT, "public", "demo", "EmergencyBrake-0.1.0.synapse");

const ok = (label) => console.log(`  ✓ ${label}`);
const fail = (label, err) => {
  console.error(`  ✗ ${label}`);
  throw err instanceof Error ? err : Error(String(err));
};

async function postJson(url, body, timeoutMs = 90_000) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", origin: BASE },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function waitMirror(topicId, seq, network = "testnet") {
  const host = network === "mainnet" ? "mainnet-public" : network;
  const url = `https://${host}.mirrornode.hedera.com/api/v1/topics/${topicId}/messages/${seq}`;
  for (let i = 0; i < 15; i++) {
    const res = await fetch(url);
    if (res.ok) {
      const body = await res.json();
      const message = JSON.parse(Buffer.from(body.message, "base64").toString("utf8"));
      return { message, consensusTimestamp: body.consensus_timestamp, url };
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw Error(`Mirror timeout for ${topicId}/${seq}`);
}

async function main() {
  console.log("\n=== E2E compose → verify (all partners) ===\n");
  console.log(`base=${BASE}`);

  // 0) Partners up
  console.log("\n[0] Partner readiness");
  const anchorCfg = await (await fetch(`${BASE}/api/anchor`)).json();
  if (!anchorCfg.configured) fail("Hedera configured", Error(JSON.stringify(anchorCfg)));
  ok(`Hedera ${anchorCfg.network} topic ${anchorCfg.topicId}`);

  const graphCfg = await (await fetch(`${BASE}/api/graph`)).json();
  ok(`Graph index validations=${graphCfg.counts?.validations ?? "?"} stacks=${graphCfg.counts?.stacks ?? "?"}`);

  // 1) Load composed demo Stack (Compose artifact)
  console.log("\n[1] Compose artifact");
  const raw = await readFile(DEMO, "utf8");
  const pkg = await importStack(raw);
  ok(`${pkg.manifest.name}@${pkg.manifest.version} executable=${pkg.manifest.executable}`);
  ok(`stackId ${pkg.manifest.stackId.slice(0, 22)}…`);

  // 2) Verify NeuroStack: local + Graph + Hedera
  console.log("\n[2] NeuroStack verify path");
  const stackReport = await verifyArtifact(canonical(pkg));
  if (stackReport.outcome === "MISMATCH") fail("local artifact", Error(stackReport.outcome));
  ok(`local artifact ${stackReport.outcome} · claims=${stackReport.claims.map((c) => c.id).join(",")}`);

  const reg = await postJson(`${BASE}/api/graph`, {
    action: "registerStack",
    stackRoot: pkg.manifest.stackId,
    name: pkg.manifest.name,
    version: pkg.manifest.version,
    manifestURI: `e2e://${pkg.manifest.stackId}`,
  });
  if (reg.status >= 400) fail("Graph registerStack", Error(JSON.stringify(reg.json)));
  ok(`Graph registerStack ${reg.json.stack?.stackRoot?.slice(0, 18) ?? "ok"}…`);

  const stackAnchor = await postJson(`${BASE}/api/anchor`, {
    receipts: [{ hash: pkg.manifest.stackId, sequence: 0 }],
    deviceId: "e2e-compose",
    stackId: pkg.manifest.stackId,
  });
  if (!stackAnchor.json.anchored) fail("Hedera stack anchor", Error(JSON.stringify(stackAnchor.json)));
  ok(`Hedera stack seq ${stackAnchor.json.topicSequenceNumber} root ${stackAnchor.json.receiptRoot.slice(0, 22)}…`);
  const stackMirror = await waitMirror(stackAnchor.json.topicId, stackAnchor.json.topicSequenceNumber, stackAnchor.json.network);
  if (stackMirror.message.receiptRoot !== stackAnchor.json.receiptRoot) fail("stack mirror root", Error("mismatch"));
  ok(`mirror stack message ${stackMirror.url}`);

  const stackClaims = withAnchorClaim(stackReport.claims, null, {
    network: stackAnchor.json.network,
    topicId: stackAnchor.json.topicId,
    sequenceNumber: String(stackAnchor.json.topicSequenceNumber),
    consensusTimestamp: stackAnchor.json.consensusTimestamp ?? "",
    receiptRoot: stackAnchor.json.receiptRoot,
    leaves: [pkg.manifest.stackId],
  });
  const stackAnchorClaim = stackClaims.find((c) => c.id === "anchor");
  if (stackAnchorClaim?.status !== "match") fail("stack anchor claim", Error(stackAnchorClaim?.status));
  ok(`public inclusion claim = ${stackAnchorClaim.status}`);

  // 3) Simulate: step until a decision receipt is captured
  console.log("\n[3] Compose simulate → receipt");
  const runtime = await loadCompiledStack(pkg);
  let replay = null;
  for (let i = 0; i < 40 && !replay; i++) {
    const input = scenarioInput(pkg, true);
    const step = await runtime.step(input);
    if (step.replay) replay = step.replay;
  }
  if (!replay) fail("capture receipt", Error("No receipt after 40 obstacle steps — check policy/triggers."));
  ok(`receipt tick=${replay.receipt.tick} seq=${replay.receipt.sequence} hash=${replay.receipt.hash.slice(0, 22)}…`);

  // 4) Receipt local replay
  console.log("\n[4] Receipt local replay");
  const receiptReport = await verifyStackEvidence(canonical(pkg), replay);
  if (receiptReport.outcome !== "MATCH") fail("local replay", Error(receiptReport.outcome));
  ok(`local replay ${receiptReport.outcome}`);

  // 5) CRE partner
  console.log("\n[5] Chainlink CRE");
  const creRequest = await createCreValidationRequest(pkg, replay);
  ok(`CRE request ${creRequest.requestHash.slice(0, 22)}…`);
  let creAssessment = null;
  const creRes = await postJson(`${BASE}/api/verify/cre`, creRequest, 120_000);
  if (creRes.status >= 400 || !creRes.json.result) {
    console.log(`  ⚠ CRE unavailable (${creRes.status}): ${creRes.json.message ?? creRes.json.error ?? "no result"}`);
    console.log("    continuing Graph + Hedera for the receipt…");
  } else {
    creAssessment = await assessCreResult(creRequest, creRes.json.result);
    ok(`CRE ${creAssessment.status} · ${creAssessment.outcome} (${creRes.json.durationMs ?? "?"}ms)`);
    if (creAssessment.outcome !== "COMMITMENTS_MATCH") {
      fail("CRE commitments", Error(creAssessment.outcome));
    }
  }

  // 6) Graph validation index
  console.log("\n[6] Graph partner validation");
  const requestHash = creAssessment?.validation.requestHash ?? creRequest.requestHash;
  const graphAnchor = await postJson(`${BASE}/api/graph`, {
    action: "anchor",
    requestHash,
    receiptRoot: replay.receipt.hash,
    blockRoot: replay.receipt.packageHash,
    score: 100,
    tag: "e2e",
    evidenceURI: `data:application/json,${encodeURIComponent(JSON.stringify({ source: "e2e-compose-verify" }))}`,
  });
  if (graphAnchor.status >= 400) fail("Graph anchor", Error(JSON.stringify(graphAnchor.json)));
  ok(`Graph validation ${graphAnchor.json.validation?.requestHash?.slice(0, 18) ?? "ok"}… source=${graphAnchor.json.validation?.source ?? "?"}`);

  // 7) Hedera receipt batch
  console.log("\n[7] Hedera receipt anchor");
  const receiptAnchor = await postJson(`${BASE}/api/anchor`, {
    receipts: [{ hash: replay.receipt.hash, sequence: replay.receipt.sequence }],
    deviceId: "e2e-compose",
    stackId: pkg.manifest.stackId,
  });
  if (!receiptAnchor.json.anchored) fail("Hedera receipt anchor", Error(JSON.stringify(receiptAnchor.json)));
  ok(`Hedera receipt seq ${receiptAnchor.json.topicSequenceNumber}`);
  const receiptMirror = await waitMirror(
    receiptAnchor.json.topicId,
    receiptAnchor.json.topicSequenceNumber,
    receiptAnchor.json.network,
  );
  if (receiptMirror.message.receiptRoot !== receiptAnchor.json.receiptRoot) fail("receipt mirror root", Error("mismatch"));
  ok(`mirror receipt message consensus=${receiptMirror.consensusTimestamp}`);

  const finalClaims = withAnchorClaim(
    receiptReport.claims,
    graphAnchor.json.validation ?? null,
    {
      network: receiptAnchor.json.network,
      topicId: receiptAnchor.json.topicId,
      sequenceNumber: String(receiptAnchor.json.topicSequenceNumber),
      consensusTimestamp: receiptAnchor.json.consensusTimestamp ?? "",
      receiptRoot: receiptAnchor.json.receiptRoot,
      leaves: [replay.receipt.hash],
    },
  );
  const pub = finalClaims.find((c) => c.id === "anchor");
  ok(`receipt public inclusion = ${pub?.status}`);

  console.log("\n=== E2E_OK ===");
  console.log(
    JSON.stringify(
      {
        stack: pkg.manifest.name,
        stackId: pkg.manifest.stackId,
        receiptHash: replay.receipt.hash,
        hederaTopic: receiptAnchor.json.topicId,
        stackSeq: stackAnchor.json.topicSequenceNumber,
        receiptSeq: receiptAnchor.json.topicSequenceNumber,
        cre: creAssessment
          ? { status: creAssessment.status, outcome: creAssessment.outcome }
          : { status: "skipped" },
        hashscan: `https://hashscan.io/testnet/topic/${receiptAnchor.json.topicId}`,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error("\nE2E_FAILED", e);
  process.exit(1);
});
