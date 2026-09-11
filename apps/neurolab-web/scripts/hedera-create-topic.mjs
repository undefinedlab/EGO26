/**
 * Create the HCS topic that receipt batches are anchored to.
 *
 * Run once, then put the printed topic id in HEDERA_TOPIC_ID.
 *
 *   HEDERA_OPERATOR_ID=0.0.xxxxx \
 *   HEDERA_OPERATOR_KEY=302e... \
 *   node scripts/hedera-create-topic.mjs
 *
 * The topic is created with a submit key, so only this operator can append to
 * it. Without one the topic is public and anyone could write plausible-looking
 * anchors into your history — which would not break any individual proof, but
 * would make the topic useless as a record of what you actually ran.
 */

import { Client, PrivateKey, TopicCreateTransaction } from "@hashgraph/sdk";
import { parseOperatorKey } from "../lib/hederaKey.ts";

const id = process.env.HEDERA_OPERATOR_ID;
const key = process.env.HEDERA_OPERATOR_KEY;
const network = (process.env.HEDERA_NETWORK ?? "testnet").toLowerCase();

if (!id || !key) {
  console.error("Set HEDERA_OPERATOR_ID and HEDERA_OPERATOR_KEY first.");
  console.error("Get both free at https://portal.hedera.com (testnet).");
  process.exit(1);
}

const { key: operatorKey, kind } = parseOperatorKey(PrivateKey, key);
console.log(`Using a ${kind} operator key.`);
const client =
  network === "mainnet" ? Client.forMainnet() : network === "previewnet" ? Client.forPreviewnet() : Client.forTestnet();
client.setOperator(id, operatorKey);

try {
  const tx = await new TopicCreateTransaction()
    .setTopicMemo("SynapseVM receipt anchors — synapsevm.receipt-anchor.v1")
    .setSubmitKey(operatorKey.publicKey)
    .execute(client);

  const receipt = await tx.getReceipt(client);
  const topicId = receipt.topicId?.toString();

  console.log(`\nTopic created on ${network}: ${topicId}`);
  console.log(`\nAdd to your environment:\n  HEDERA_TOPIC_ID=${topicId}`);
  console.log(
    `\nRead it back any time (no key needed):\n  https://${network}.mirrornode.hedera.com/api/v1/topics/${topicId}/messages\n`,
  );
} catch (e) {
  console.error(`Could not create the topic: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
} finally {
  client.close();
}
