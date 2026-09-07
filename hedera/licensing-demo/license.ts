/**
 * Hedera licensing demo — outside the control loop.
 * Option A: prepaid license entitlement for LoomGuard download.
 */

export type LicenseEntitlement = {
  block: string;
  licensee: string;
  expiresAt: number;
  signature: string;
};

export function issueDemoLicense(licensee: string): LicenseEntitlement {
  return {
    block: "LoomGuard@1.0.0",
    licensee,
    expiresAt: Date.now() + 30 * 24 * 3600 * 1000,
    signature: "hedera-demo-sig",
  };
}

export function settleBatchUsage(executionCount: number, merkleRoot: string) {
  return {
    network: "hedera-testnet",
    executions: executionCount,
    usageRoot: merkleRoot,
    note: "One settlement tx for many offline reflex executions — never pay-per-brake",
  };
}
