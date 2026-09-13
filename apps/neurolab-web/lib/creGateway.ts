import { createHash, randomUUID } from "node:crypto";
import { Wallet } from "ethers";

const WORKFLOW_ID = /^[a-fA-F0-9]{64}$/;
const PRIVATE_KEY = /^0x[a-fA-F0-9]{64}$/;
const DEFAULT_GATEWAY = "https://01.gateway.zone-a.cre.chain.link";

export type CreGatewayRun = {
  format: "synapsevm.cre-run-response.v1";
  mode: "deployed-cre-gateway";
  workflow: "synapsevm-neuroproof-v1";
  accepted: true;
  requestId: string;
  workflowId: string;
  workflowExecutionId: string;
  status: string;
};

export type CreGatewayConfig = {
  gatewayUrl: string;
  workflowId: string;
  triggerPrivateKey: string;
};

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, sortValue(nested)]),
    );
  }
  return value;
}

/** Chainlink requires recursive lexicographic key ordering before hashing. */
export function canonicalCreJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function base64url(value: string | Uint8Array): string {
  return Buffer.from(value).toString("base64url");
}

export function resolveCreGatewayConfig(): { value?: CreGatewayConfig; missing: string[] } {
  const workflowId = process.env.SYNAPSEVM_CRE_WORKFLOW_ID?.trim();
  const triggerPrivateKey = process.env.SYNAPSEVM_CRE_TRIGGER_PRIVATE_KEY?.trim();
  const gatewayUrl = (process.env.SYNAPSEVM_CRE_GATEWAY_URL ?? DEFAULT_GATEWAY).trim().replace(/\/$/, "");
  const missing = [
    !workflowId && "SYNAPSEVM_CRE_WORKFLOW_ID",
    !triggerPrivateKey && "SYNAPSEVM_CRE_TRIGGER_PRIVATE_KEY",
  ].filter(Boolean) as string[];
  if (missing.length) return { missing };
  if (!WORKFLOW_ID.test(workflowId!)) throw Error("SYNAPSEVM_CRE_WORKFLOW_ID must be 64 hexadecimal characters without 0x.");
  if (!PRIVATE_KEY.test(triggerPrivateKey!)) throw Error("SYNAPSEVM_CRE_TRIGGER_PRIVATE_KEY must be a 32-byte EVM private key.");
  const parsed = new URL(gatewayUrl);
  if (parsed.protocol !== "https:") throw Error("SYNAPSEVM_CRE_GATEWAY_URL must use HTTPS.");
  return { missing, value: { gatewayUrl, workflowId: workflowId!.toLowerCase(), triggerPrivateKey: triggerPrivateKey! } };
}

export async function createCreJwt(
  body: unknown,
  privateKey: string,
  nowSeconds = Math.floor(Date.now() / 1000),
  jwtId = randomUUID(),
): Promise<{ token: string; issuer: string; digest: string }> {
  if (!PRIVATE_KEY.test(privateKey)) throw Error("CRE JWT signing key must be a 32-byte EVM private key.");
  const wallet = new Wallet(privateKey);
  const digest = `0x${createHash("sha256").update(canonicalCreJson(body), "utf8").digest("hex")}`;
  const encodedHeader = base64url(JSON.stringify({ alg: "ETH", typ: "JWT" }));
  const encodedPayload = base64url(JSON.stringify({
    digest,
    iss: wallet.address,
    iat: nowSeconds,
    exp: nowSeconds + 300,
    jti: jwtId,
  }));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = await wallet.signMessage(signingInput);
  return {
    token: `${signingInput}.${base64url(Buffer.from(signature.slice(2), "hex"))}`,
    issuer: wallet.address,
    digest,
  };
}

export async function runCreGateway(request: unknown): Promise<CreGatewayRun> {
  const resolved = resolveCreGatewayConfig();
  if (!resolved.value) throw Error(`CRE production gateway is not configured: ${resolved.missing.join(", ")}.`);
  const requestId = randomUUID();
  const body = {
    id: requestId,
    jsonrpc: "2.0",
    method: "workflows.execute",
    params: { input: request, workflow: { workflowID: resolved.value.workflowId } },
  };
  const serialized = canonicalCreJson(body);
  const { token } = await createCreJwt(body, resolved.value.triggerPrivateKey);
  const response = await fetch(resolved.value.gatewayUrl, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: serialized,
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  const payload = (await response.json()) as {
    error?: { code?: number; message?: string };
    result?: { workflow_id?: string; workflow_execution_id?: string; status?: string };
  };
  if (!response.ok || payload.error || !payload.result?.workflow_execution_id) {
    throw Error(payload.error?.message ?? `CRE gateway rejected the execution (${response.status}).`);
  }
  return {
    format: "synapsevm.cre-run-response.v1",
    mode: "deployed-cre-gateway",
    workflow: "synapsevm-neuroproof-v1",
    accepted: true,
    requestId,
    workflowId: payload.result.workflow_id ?? resolved.value.workflowId,
    workflowExecutionId: payload.result.workflow_execution_id,
    status: payload.result.status ?? "ACCEPTED",
  };
}
