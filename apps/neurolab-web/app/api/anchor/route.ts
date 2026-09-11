import { NextResponse } from "next/server";
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

type Receipt = { hash: string; sequence: number };

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
    missing,
    hint: missing.length
      ? "Create a testnet account at portal.hedera.com, create a topic, then set these."
      : undefined,
  });
}

export async function POST(request: Request) {
  const { operatorId, operatorKey, topicId, network, missing } = config();

  let body: { receipts?: Receipt[]; deviceId?: string; stackId?: string };
  try {
    body = (await request.json()) as typeof body;
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
  const message = anchorMessage(batch, body.deviceId ?? "unspecified", body.stackId ?? "unspecified");

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
    /* Imported lazily so an unconfigured deployment never pays to load the SDK. */
    const { Client, PrivateKey, TopicMessageSubmitTransaction } = await import("@hashgraph/sdk");
    const client =
      network === "mainnet" ? Client.forMainnet() : network === "previewnet" ? Client.forPreviewnet() : Client.forTestnet();
    client.setOperator(operatorId!, parseOperatorKey(PrivateKey, operatorKey!).key);

    const submit = await new TopicMessageSubmitTransaction({
      topicId: topicId!,
      message: JSON.stringify(message),
    }).execute(client);

    const receipt = await submit.getReceipt(client);
    const record = await submit.getRecord(client);
    client.close();

    return NextResponse.json({
      anchored: true,
      network,
      topicId,
      receiptRoot: batch.receiptRoot,
      firstSequence: batch.firstSequence,
      lastSequence: batch.lastSequence,
      count: batch.count,
      /** Where this batch sits in the topic's own ordered history. */
      topicSequenceNumber: receipt.topicSequenceNumber?.toString() ?? null,
      consensusTimestamp: record.consensusTimestamp?.toString() ?? null,
      transactionId: submit.transactionId?.toString() ?? null,
      message,
    });
  } catch (e) {
    return NextResponse.json(
      { anchored: false, error: e instanceof Error ? e.message : String(e), receiptRoot: batch.receiptRoot },
      { status: 502 },
    );
  }
}
