import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { anchorMessage, buildBatch } from "@/lib/anchorMerkle";
import { parseOperatorKey } from "@/lib/hederaKey";

/**
 * Anchor a batch of receipt hashes to a Hedera Consensus Service topic.
 *
 * Server-side because the operator key is a credential. Nothing secret leaves
 * here either way: the message is a Merkle root and a sequence span, so the
 * ledger learns that a batch existed, never what the machine saw or did.
 *
 * The batching is the point. One message covers a whole run, which keeps the
 * ledger strictly outside the control loop — a decision is never waiting on a
 * transaction.
 *
 * Configure with HEDERA_OPERATOR_ID, HEDERA_OPERATOR_KEY, HEDERA_TOPIC_ID and
 * optionally HEDERA_NETWORK (testnet by default). Unset, the route reports what
 * is missing instead of pretending an anchor happened.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Receipt = { hash: string; sequence: number };
type AnchorMessage = ReturnType<typeof anchorMessage>;
type AnchorRecord = {
  network: string;
  topicId: string;
  topicSequenceNumber: string;
  consensusTimestamp: string;
  transactionId: string;
  message: AnchorMessage;
  anchoredAt: string;
};
type AnchorIndex = { format: "synapsevm.hedera-anchor-index.v1"; anchors: Record<string, AnchorRecord> };

const MAX_BODY_BYTES = 2_000_000;
const EMPTY_INDEX: AnchorIndex = { format: "synapsevm.hedera-anchor-index.v1", anchors: {} };
let anchorTail: Promise<void> = Promise.resolve();

function serialize<T>(run: () => Promise<T>): Promise<T> {
  const next = anchorTail.then(run, run);
  anchorTail = next.then(() => undefined, () => undefined);
  return next;
}

function indexPath() {
  if (process.env.SYNAPSEVM_ANCHOR_INDEX_PATH) return process.env.SYNAPSEVM_ANCHOR_INDEX_PATH;
  const cwd = process.cwd();
  const webRoot = cwd.endsWith(`${join("apps", "neurolab-web")}`) ? cwd : join(cwd, "apps", "neurolab-web");
  return join(webRoot, ".data", "hedera-anchor-index.json");
}

async function readIndex(): Promise<AnchorIndex> {
  try {
    const parsed = JSON.parse(await readFile(indexPath(), "utf8")) as AnchorIndex;
    return parsed?.format === EMPTY_INDEX.format && parsed.anchors ? parsed : structuredClone(EMPTY_INDEX);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return structuredClone(EMPTY_INDEX);
    throw error;
  }
}

async function writeIndex(index: AnchorIndex) {
  const target = indexPath();
  await mkdir(dirname(target), { recursive: true });
  const temporary = `${target}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(index, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  await rename(temporary, target);
}

function anchorKey(network: string, topicId: string, message: AnchorMessage) {
  return createHash("sha256")
    .update(`${network}\n${topicId}\n${JSON.stringify(message)}`)
    .digest("hex");
}

function mirrorBase(network: string) {
  return `https://${network === "mainnet" ? "mainnet-public" : network}.mirrornode.hedera.com/api/v1`;
}

function sameMessage(actual: unknown, expected: AnchorMessage): boolean {
  if (!actual || typeof actual !== "object") return false;
  const row = actual as Record<string, unknown>;
  return row.format === expected.format &&
    row.deviceId === expected.deviceId &&
    row.stackId === expected.stackId &&
    row.receiptRoot === expected.receiptRoot &&
    row.firstSequence === expected.firstSequence &&
    row.lastSequence === expected.lastSequence &&
    row.count === expected.count;
}

async function mirrorConfirms(record: AnchorRecord): Promise<boolean> {
  const url = `${mirrorBase(record.network)}/topics/${record.topicId}/messages/${record.topicSequenceNumber}`;
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
  if (!response.ok) return false;
  const body = (await response.json()) as { message?: string };
  if (!body.message) return false;
  try {
    return sameMessage(JSON.parse(Buffer.from(body.message, "base64").toString("utf8")), record.message);
  } catch {
    return false;
  }
}

async function waitForMirror(record: AnchorRecord, timeoutMs = 30_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  do {
    try {
      if (await mirrorConfirms(record)) return true;
    } catch {
      // Consensus succeeded; the public mirror can lag briefly.
    }
    await new Promise((resolve) => setTimeout(resolve, 1_500));
  } while (Date.now() < deadline);
  return false;
}

function responseFor(record: AnchorRecord, batch: ReturnType<typeof buildBatch>, reused: boolean, mirrorVerified: boolean) {
  return {
    anchored: true,
    network: record.network,
    topicId: record.topicId,
    receiptRoot: batch.receiptRoot,
    firstSequence: batch.firstSequence,
    lastSequence: batch.lastSequence,
    count: batch.count,
    topicSequenceNumber: record.topicSequenceNumber,
    consensusTimestamp: record.consensusTimestamp,
    transactionId: record.transactionId,
    message: record.message,
    reused,
    mirrorVerified,
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
      return NextResponse.json({ error: "Cross-origin anchor request rejected." }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  return null;
}

function config() {
  const operatorId = process.env.HEDERA_OPERATOR_ID;
  const operatorKey = process.env.HEDERA_OPERATOR_KEY;
  const topicId = process.env.HEDERA_TOPIC_ID;
  const network = (process.env.HEDERA_NETWORK ?? "testnet").toLowerCase();
  const missing = [
    !operatorId && "HEDERA_OPERATOR_ID",
    !operatorKey && "HEDERA_OPERATOR_KEY",
    !topicId && "HEDERA_TOPIC_ID",
  ].filter(Boolean) as string[];
  return { operatorId, operatorKey, topicId, network, missing };
}

export async function GET() {
  const { missing, network, topicId } = config();
  return NextResponse.json({
    configured: missing.length === 0,
    network,
    topicId: topicId ?? null,
    idempotency: "persistent-local",
    missing,
    hint: missing.length
      ? "Create a testnet account at portal.hedera.com, create a topic, then set these."
      : undefined,
  });
}

export async function POST(request: Request) {
  const rejected = rejectUnsafePost(request);
  if (rejected) return rejected;
  const { operatorId, operatorKey, topicId, network, missing } = config();

  let body: { receipts?: Receipt[]; deviceId?: string; stackId?: string };
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Anchor request exceeds 2 MB." }, { status: 413 });
    }
    body = JSON.parse(raw) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON body required." }, { status: 400 });
  }

  const receipts = Array.isArray(body.receipts) ? body.receipts : [];
  if (!receipts.length) return NextResponse.json({ error: "receipts[] is required." }, { status: 400 });
  if (receipts.length > 100_000) return NextResponse.json({ error: "Batch is too large." }, { status: 400 });

  /* The root is computed either way: a caller with no Hedera credentials still
     gets a verifiable batch they can anchor elsewhere or later. */
  let batch;
  try {
    batch = buildBatch(receipts);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
  const deviceId = String(body.deviceId ?? "unspecified").trim();
  const stackId = String(body.stackId ?? "unspecified").trim();
  if (!deviceId || deviceId.length > 256 || !stackId || stackId.length > 256) {
    return NextResponse.json({ error: "deviceId and stackId must contain 1-256 characters." }, { status: 400 });
  }
  const message = anchorMessage(batch, deviceId, stackId);

  if (missing.length) {
    return NextResponse.json(
      {
        anchored: false,
        reason: `Hedera is not configured (${missing.join(", ")}). The batch root was computed but nothing was submitted.`,
        receiptRoot: batch.receiptRoot,
        firstSequence: batch.firstSequence,
        lastSequence: batch.lastSequence,
        count: batch.count,
        message,
      },
      { status: 503 },
    );
  }

  try {
    const result = await serialize(async () => {
      const key = anchorKey(network, topicId!, message);
      const index = await readIndex();
      const existing = index.anchors[key];
      if (existing) {
        return responseFor(existing, batch, true, await waitForMirror(existing));
      }

      /* Imported lazily so an unconfigured deployment never loads the SDK. */
      const { Client, PrivateKey, TopicMessageSubmitTransaction } = await import("@hashgraph/sdk");
      const client = network === "mainnet"
        ? Client.forMainnet()
        : network === "previewnet"
          ? Client.forPreviewnet()
          : Client.forTestnet();
      try {
        client.setOperator(operatorId!, parseOperatorKey(PrivateKey, operatorKey!).key);
        const submit = await new TopicMessageSubmitTransaction({
          topicId: topicId!,
          message: JSON.stringify(message),
        }).execute(client);
        const receipt = await submit.getReceipt(client);
        const transactionRecord = await submit.getRecord(client);
        const sequence = receipt.topicSequenceNumber?.toString();
        if (!sequence) throw Error("Hedera returned no topic sequence number.");
        const stored: AnchorRecord = {
          network,
          topicId: topicId!,
          topicSequenceNumber: sequence,
          consensusTimestamp: transactionRecord.consensusTimestamp?.toString() ?? "",
          transactionId: submit.transactionId?.toString() ?? "",
          message,
          anchoredAt: new Date().toISOString(),
        };
        index.anchors[key] = stored;
        await writeIndex(index);
        return responseFor(stored, batch, false, await waitForMirror(stored));
      } finally {
        client.close();
      }
    });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json(
      { anchored: false, error: e instanceof Error ? e.message : String(e), receiptRoot: batch.receiptRoot },
      { status: 502 },
    );
  }
}
