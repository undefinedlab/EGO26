import { Contract, JsonRpcProvider, NonceManager, Wallet } from "ethers";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BYTES32 = /^0x[a-f0-9]{64}$/;
const ADDRESS = /^0x[a-fA-F0-9]{40}$/;
const TX = /^0x[a-f0-9]{64}$/;
const MAX_BODY_BYTES = 32_000;
const SEPOLIA_CHAIN_ID = 11_155_111n;
const DEFAULT_START_BLOCK = 11_684_923;

const ABI = [
  "function validations(bytes32) view returns (bytes32 requestHash, bytes32 receiptRoot, bytes32 blockRoot, uint8 score, string evidenceURI, address validator, uint64 timestamp)",
  "function stacks(bytes32) view returns (bytes32 blockRoot, string manifestURI, address publisher, uint64 createdAt, bool active)",
  "function recordValidation(bytes32 requestHash, bytes32 receiptRoot, bytes32 blockRoot, uint8 score, string evidenceURI)",
  "function registerStack(bytes32 stackRoot, string manifestURI)",
  "event ValidationRecorded(bytes32 indexed requestHash, bytes32 indexed receiptRoot, bytes32 indexed blockRoot, uint8 score, string evidenceURI)",
  "event NeuroStackRegistered(bytes32 indexed stackRoot, address indexed publisher, string manifestURI)",
] as const;

type ValidationInput = {
  action: "validation";
  requestHash: string;
  receiptRoot: string;
  blockRoot: string;
  score: number;
  evidenceURI: string;
};

type StackInput = {
  action: "stack";
  stackRoot: string;
  manifestURI: string;
  name?: string;
  version?: string;
};

type Body = ValidationInput | StackInput;

type Config = {
  rpc: string;
  registry: string;
  relayerKey: string;
  expectedRelayer?: string;
  subgraph?: string;
  startBlock: number;
};

let writeTail: Promise<void> = Promise.resolve();

function serialize<T>(run: () => Promise<T>): Promise<T> {
  const next = writeTail.then(run, run);
  writeTail = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

function config(): { value?: Config; missing: string[] } {
  const rpc = process.env.SYNAPSEVM_SEPOLIA_RPC_URL;
  const registry = process.env.NEXT_PUBLIC_NEURO_REGISTRY_ADDRESS;
  const relayerKey = process.env.NEURO_REGISTRY_RELAYER_KEY;
  const expectedRelayer = process.env.NEURO_REGISTRY_DEPLOYER;
  const subgraph = process.env.NEXT_PUBLIC_SUBGRAPH_URL;
  const missing = [
    !rpc && "SYNAPSEVM_SEPOLIA_RPC_URL",
    !registry && "NEXT_PUBLIC_NEURO_REGISTRY_ADDRESS",
    !relayerKey && "NEURO_REGISTRY_RELAYER_KEY",
    !subgraph && "NEXT_PUBLIC_SUBGRAPH_URL",
  ].filter(Boolean) as string[];
  if (missing.length) return { missing };
  return {
    missing,
    value: {
      rpc: rpc!,
      registry: registry!,
      relayerKey: relayerKey!,
      expectedRelayer: expectedRelayer || undefined,
      subgraph,
      startBlock: Number(process.env.NEURO_REGISTRY_START_BLOCK ?? DEFAULT_START_BLOCK),
    },
  };
}

function rejectUnsafePost(request: Request): NextResponse | null {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    return NextResponse.json({ error: "Content-Type must be application/json." }, { status: 415 });
  }
  const origin = request.headers.get("origin");
  if (!origin) return null;
  try {
    if (new URL(origin).host !== new URL(request.url).host) {
      return NextResponse.json({ error: "Cross-origin registry request rejected." }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  return null;
}

function bytes32(label: string, value: unknown): string {
  const normalized = String(value ?? "").trim().replace(/^sha256:/i, "0x").toLowerCase();
  if (!BYTES32.test(normalized)) throw Error(`${label} must be a 32-byte digest.`);
  return normalized;
}

function boundedUri(label: string, value: unknown, max: number): string {
  const text = String(value ?? "").trim();
  if (!text || text.length > max) throw Error(`${label} must contain 1-${max} characters.`);
  if (!/^(https:\/\/|ipfs:\/\/|data:application\/json,|shelf:\/\/)/.test(text)) {
    throw Error(`${label} uses an unsupported URI scheme.`);
  }
  return text;
}

async function parseBody(request: Request): Promise<Body> {
  const raw = await request.text();
  if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) throw Error("Registry request exceeds 32 KB.");
  const body = JSON.parse(raw) as Record<string, unknown>;
  if (body.action === "validation") {
    const score = Number(body.score);
    if (!Number.isInteger(score) || score < 0 || score > 100) throw Error("score must be a whole number from 0 to 100.");
    return {
      action: "validation",
      requestHash: bytes32("requestHash", body.requestHash),
      receiptRoot: bytes32("receiptRoot", body.receiptRoot),
      blockRoot: bytes32("blockRoot", body.blockRoot),
      score,
      evidenceURI: boundedUri("evidenceURI", body.evidenceURI, 8_192),
    };
  }
  if (body.action === "stack") {
    return {
      action: "stack",
      stackRoot: bytes32("stackRoot", body.stackRoot),
      manifestURI: boundedUri("manifestURI", body.manifestURI, 2_048),
      name: body.name == null ? undefined : String(body.name).slice(0, 128),
      version: body.version == null ? undefined : String(body.version).slice(0, 32),
    };
  }
  throw Error("action must be validation or stack.");
}

async function subgraphValidation(url: string, requestHash: string) {
  const query = `{
    validations(where: { requestHash: "${requestHash}" }, first: 1) {
      id requestHash receiptRoot blockRoot validator score tag evidenceURI timestamp txHash
    }
  }`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query }),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw Error(`Subgraph query failed (${response.status}).`);
  const json = (await response.json()) as {
    data?: { validations?: Record<string, unknown>[] };
    errors?: { message?: string }[];
  };
  if (json.errors?.length) throw Error(json.errors[0].message || "Subgraph query failed.");
  return json.data?.validations?.[0] ?? null;
}

async function subgraphStack(url: string, stackRoot: string) {
  const query = `{
    neuroStack(id: "${stackRoot}") {
      id stackRoot manifestURI publisher createdAt active name version
    }
  }`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query }),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw Error(`Subgraph query failed (${response.status}).`);
  const json = (await response.json()) as {
    data?: { neuroStack?: Record<string, unknown> | null };
    errors?: { message?: string }[];
  };
  if (json.errors?.length) throw Error(json.errors[0].message || "Subgraph query failed.");
  return json.data?.neuroStack ?? null;
}

async function waitForIndex<T>(read: () => Promise<T | null>, timeoutMs = 60_000): Promise<T | null> {
  const deadline = Date.now() + timeoutMs;
  do {
    try {
      const row = await read();
      if (row) return row;
    } catch {
      // The chain receipt remains authoritative while the index catches up.
    }
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  } while (Date.now() < deadline);
  return null;
}

async function resources(settings: Config) {
  if (!ADDRESS.test(settings.registry)) throw Error("The NeuroRegistry address is invalid.");
  if (!/^0x[a-fA-F0-9]{64}$/.test(settings.relayerKey)) throw Error("The registry relayer key is invalid.");
  const provider = new JsonRpcProvider(settings.rpc, Number(SEPOLIA_CHAIN_ID), { staticNetwork: true });
  const network = await provider.getNetwork();
  if (network.chainId !== SEPOLIA_CHAIN_ID) throw Error(`Expected Sepolia chain 11155111, received ${network.chainId}.`);
  const baseWallet = new Wallet(settings.relayerKey, provider);
  if (settings.expectedRelayer && baseWallet.address.toLowerCase() !== settings.expectedRelayer.toLowerCase()) {
    throw Error("The configured relayer key does not match NEURO_REGISTRY_DEPLOYER.");
  }
  const code = await provider.getCode(settings.registry);
  if (code === "0x") throw Error("No NeuroRegistry bytecode exists at the configured address.");
  const signer = new NonceManager(baseWallet);
  return { provider, baseWallet, contract: new Contract(settings.registry, ABI, signer) };
}

function txFromLogs(logs: readonly { transactionHash?: string }[]): string {
  const value = logs.at(-1)?.transactionHash?.toLowerCase() ?? "";
  return TX.test(value) ? value : "";
}

async function commitValidation(settings: Config, input: ValidationInput) {
  const { provider, baseWallet, contract } = await resources(settings);
  const existing = await contract.validations(input.requestHash);
  let txHash = "";
  let reused = false;
  let indexedBefore: Record<string, unknown> | null = null;
  if (Number(existing.timestamp) > 0) {
    if (
      String(existing.receiptRoot).toLowerCase() !== input.receiptRoot ||
      String(existing.blockRoot).toLowerCase() !== input.blockRoot ||
      Number(existing.score) !== input.score ||
      String(existing.evidenceURI) !== input.evidenceURI
    ) {
      throw Error("This requestHash is already registered with different evidence.");
    }
    try {
      indexedBefore = await subgraphValidation(settings.subgraph!, input.requestHash);
    } catch {
      // Fall back to the contract event log when the index is unavailable.
    }
    if (indexedBefore) txHash = String(indexedBefore.txHash ?? "").toLowerCase();
    if (!TX.test(txHash)) {
      const events = await contract.queryFilter(contract.filters.ValidationRecorded(input.requestHash), settings.startBlock, "latest");
      txHash = txFromLogs(events);
    }
    reused = true;
  } else {
    const tx = await contract.recordValidation(
      input.requestHash,
      input.receiptRoot,
      input.blockRoot,
      input.score,
      input.evidenceURI,
    );
    txHash = String(tx.hash).toLowerCase();
    const receipt = await tx.wait(1, 90_000);
    if (!receipt || receipt.status !== 1) throw Error("Sepolia rejected the validation transaction.");
  }

  const block = await provider.getBlock("latest");
  const indexed = indexedBefore ?? await waitForIndex(() => subgraphValidation(settings.subgraph!, input.requestHash));
  const fallback = {
    id: input.requestHash,
    requestHash: input.requestHash,
    receiptRoot: input.receiptRoot,
    blockRoot: input.blockRoot,
    validator: baseWallet.address.toLowerCase(),
    score: input.score,
    tag: "cre",
    evidenceURI: input.evidenceURI,
    timestamp: String(block?.timestamp ?? Math.floor(Date.now() / 1000)),
    txHash,
    source: "chain",
  };
  return {
    validation: indexed ? { ...indexed, source: "subgraph" } : fallback,
    chainConfirmed: true,
    graphIndexed: Boolean(indexed),
    reused,
    explorer: txHash ? `https://sepolia.etherscan.io/tx/${txHash}` : null,
  };
}

async function commitStack(settings: Config, input: StackInput) {
  const { provider, baseWallet, contract } = await resources(settings);
  const existing = await contract.stacks(input.stackRoot);
  let txHash = "";
  let reused = false;
  if (Boolean(existing.active)) {
    if (String(existing.manifestURI) !== input.manifestURI) {
      throw Error("This stackRoot is already registered with a different manifest URI.");
    }
    const events = await contract.queryFilter(contract.filters.NeuroStackRegistered(input.stackRoot), settings.startBlock, "latest");
    txHash = txFromLogs(events);
    reused = true;
  } else {
    const tx = await contract.registerStack(input.stackRoot, input.manifestURI);
    txHash = String(tx.hash).toLowerCase();
    const receipt = await tx.wait(1, 90_000);
    if (!receipt || receipt.status !== 1) throw Error("Sepolia rejected the Stack registration transaction.");
  }

  const block = await provider.getBlock("latest");
  const indexed = await waitForIndex(() => subgraphStack(settings.subgraph!, input.stackRoot));
  const fallback = {
    id: input.stackRoot,
    stackRoot: input.stackRoot,
    manifestURI: input.manifestURI,
    publisher: baseWallet.address.toLowerCase(),
    createdAt: String(block?.timestamp ?? Math.floor(Date.now() / 1000)),
    active: true,
    name: input.name ?? "",
    version: input.version ?? "",
    txHash,
    source: "chain",
  };
  return {
    stack: indexed ? { ...indexed, source: "subgraph", txHash } : fallback,
    chainConfirmed: true,
    graphIndexed: Boolean(indexed),
    reused,
    explorer: txHash ? `https://sepolia.etherscan.io/tx/${txHash}` : null,
  };
}

export async function GET() {
  const resolved = config();
  if (!resolved.value) {
    return NextResponse.json({ configured: false, ready: false, missing: resolved.missing });
  }
  try {
    const { provider, baseWallet } = await resources(resolved.value);
    const balance = await provider.getBalance(baseWallet.address);
    return NextResponse.json({
      configured: true,
      ready: balance > 0n,
      network: "sepolia",
      chainId: Number(SEPOLIA_CHAIN_ID),
      registry: resolved.value.registry,
      relayer: baseWallet.address,
      balanceWei: balance.toString(),
      subgraphConfigured: Boolean(resolved.value.subgraph),
    });
  } catch (error) {
    return NextResponse.json(
      { configured: true, ready: false, error: error instanceof Error ? error.message : String(error) },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  const rejected = rejectUnsafePost(request);
  if (rejected) return rejected;
  const resolved = config();
  if (!resolved.value) {
    return NextResponse.json(
      { configured: false, error: `Onchain Graph anchoring is not configured: ${resolved.missing.join(", ")}.` },
      { status: 503 },
    );
  }
  try {
    const input = await parseBody(request);
    const result = input.action === "validation"
      ? await serialize(() => commitValidation(resolved.value!, input))
      : await serialize(() => commitStack(resolved.value!, input));
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
