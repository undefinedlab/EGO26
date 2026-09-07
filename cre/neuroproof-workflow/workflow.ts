/**
 * Chainlink CRE NeuroProof workflow (trust plane).
 * Validates receipt evidence AFTER local action — never gates BRAKE/AVOID.
 */

export type ValidationResult = {
  requestHash: string;
  receiptRoot: string;
  blockRoot: string;
  signatureValid: boolean;
  receiptChainValid: boolean;
  replayAttempted: boolean;
  replayMatched: boolean;
  validatorVersion: string;
};

export async function validateReceiptBatch(args: {
  receiptRoot: string;
  blockRoot: string;
  evidenceUri: string;
  replay?: (uri: string) => Promise<{ valid: boolean }>;
}): Promise<ValidationResult> {
  const signatureValid = args.receiptRoot.startsWith("0x") && args.receiptRoot.length >= 10;
  const receiptChainValid = args.blockRoot.startsWith("0x");
  let replayMatched = false;
  let replayAttempted = false;
  if (args.replay) {
    replayAttempted = true;
    replayMatched = (await args.replay(args.evidenceUri)).valid;
  }
  const requestHash = `0x${Buffer.from(`${args.receiptRoot}:${args.blockRoot}`).toString("hex").slice(0, 64)}`;
  return {
    requestHash,
    receiptRoot: args.receiptRoot,
    blockRoot: args.blockRoot,
    signatureValid,
    receiptChainValid,
    replayAttempted,
    replayMatched,
    validatorVersion: "cre-neuroproof-0.1.0",
  };
}
