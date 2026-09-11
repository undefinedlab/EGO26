/**
 * What to put in the faucet, and whether this key is usable as an operator.
 *
 * Reads HEDERA_OPERATOR_KEY (or CONTRACTS_PRIVATE_KEY, so the existing Sepolia
 * deployer key can be reused) and prints only the derived public address. The
 * private key is never printed, logged or sent anywhere.
 *
 *   HEDERA_OPERATOR_KEY=<key> node scripts/hedera-whoami.mjs
 */

import { PrivateKey, Client, AccountBalanceQuery } from "@hashgraph/sdk";
import { parseOperatorKey } from "../lib/hederaKey.ts";

const raw = process.env.HEDERA_OPERATOR_KEY ?? process.env.CONTRACTS_PRIVATE_KEY;
const accountId = process.env.HEDERA_OPERATOR_ID;
const network = (process.env.HEDERA_NETWORK ?? "testnet").toLowerCase();

if (!raw) {
  console.error("Set HEDERA_OPERATOR_KEY (or CONTRACTS_PRIVATE_KEY) to inspect a key.");
  process.exit(1);
}

let parsed;
try {
  parsed = parseOperatorKey(PrivateKey, raw);
} catch (e) {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
}

const { key, kind } = parsed;
const evm = `0x${key.publicKey.toEvmAddress()}`;

console.log(`\nKey type        ${kind}`);
console.log(`EVM address     ${evm}`);
console.log(`Network         ${network}`);

if (kind !== "ecdsa-hex" && kind !== "der") {
  console.log("\nNote: only ECDSA keys get an EVM address the faucet can auto-create from.");
}

console.log(`\nFund it here — this auto-creates the Hedera account:`);
console.log(`  https://portal.hedera.com   (1,000 HBAR / 24h, sign in)`);
console.log(`  or the anonymous faucet     (100 HBAR / 24h, paste the EVM address above)`);

if (!accountId) {
  console.log(`\nOnce funded, look up the account id for that address:`);
  console.log(`  https://${network}.mirrornode.hedera.com/api/v1/accounts/${evm}`);
  console.log(`Then set HEDERA_OPERATOR_ID=0.0.<id> and run scripts/hedera-create-topic.mjs.`);
  process.exit(0);
}

// If an account id is already set, confirm the pairing actually works.
const client =
  network === "mainnet" ? Client.forMainnet() : network === "previewnet" ? Client.forPreviewnet() : Client.forTestnet();
try {
  client.setOperator(accountId, key);
  const balance = await new AccountBalanceQuery().setAccountId(accountId).execute(client);
  console.log(`\nAccount ${accountId} balance: ${balance.hbars.toString()}`);
  console.log("The key and account id match — ready to create a topic.");
} catch (e) {
  console.error(`\nCould not query ${accountId}: ${e instanceof Error ? e.message : String(e)}`);
  console.error("If the account exists, check that this key is the one that controls it.");
  process.exitCode = 1;
} finally {
  client.close();
}
