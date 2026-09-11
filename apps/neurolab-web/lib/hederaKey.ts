/**
 * Accept whichever key format you already have.
 *
 * A Hedera portal account hands you a DER string; an EVM wallet hands you raw
 * secp256k1 hex. Both are usable as an operator key, and guessing wrong is an
 * opaque failure at submit time, so the format is detected once here.
 *
 * The existing Sepolia deployer key works: Hedera accepts ECDSA keys, and the
 * faucet auto-creates an account when it funds that key's EVM address.
 */

import type { PrivateKey } from "@hashgraph/sdk";

export type KeyKind = "ecdsa-hex" | "der" | "ed25519-hex";

export function detectKeyKind(raw: string): KeyKind {
  const value = raw.trim().replace(/^0x/i, "");
  // DER encodings are long and start with a SEQUENCE tag.
  if (/^30[0-9a-f]{2}/i.test(value) && value.length > 80) return "der";
  if (/^[0-9a-f]{64}$/i.test(value)) return raw.trim().startsWith("0x") ? "ecdsa-hex" : "ecdsa-hex";
  return "der";
}

/** Parse an operator key without caring which wallet produced it. */
export function parseOperatorKey(
  PrivateKeyCtor: typeof PrivateKey,
  raw: string,
): { key: PrivateKey; kind: KeyKind } {
  const value = raw.trim();
  const kind = detectKeyKind(value);
  const attempts: [KeyKind, () => PrivateKey][] = [
    [kind, () => (kind === "der" ? PrivateKeyCtor.fromStringDer(value) : PrivateKeyCtor.fromStringECDSA(value))],
    ["ecdsa-hex", () => PrivateKeyCtor.fromStringECDSA(value)],
    ["der", () => PrivateKeyCtor.fromStringDer(value)],
    ["ed25519-hex", () => PrivateKeyCtor.fromStringED25519(value)],
  ];
  for (const [attempted, parse] of attempts) {
    try {
      return { key: parse(), kind: attempted };
    } catch {
      /* try the next encoding */
    }
  }
  throw Error("HEDERA_OPERATOR_KEY is not a recognised DER, ECDSA hex or ED25519 key.");
}
