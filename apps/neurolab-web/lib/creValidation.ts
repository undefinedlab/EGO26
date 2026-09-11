import { canonical, digest, importStack, type ComposePackage } from "./composeCompiler";
import { replayStack, type ReplayBundle } from "./composeRuntime";
import { loadSignerSet, signersForReport } from "./creDon";
import { verifyDonReport, type VerifyOutcome } from "./creSignatures";

const HASH = /^sha256:[a-f0-9]{64}$/;

export type CreValidationRequestBody = {
  format: "synapsevm.cre-validation-request.v1";
  workflow: "synapsevm-neuroproof-v1";
  stack: {
    stackId: string;
    packageHash: string;
    runtime: string;
    artifactVerifier: string;
    replayVerifier: string;
  };
  receipt: {
    receiptHash: string;
    stackId: string;
    packageHash: string;
    runtime: string;
    tick: number;
    sequence: number;
    previousReceiptHash: string | null;
    inputCommitment: string;
    stateBeforeRoot: string;
    stateAfterRoot: string;
    eventCommitment: string;
    actionCommitment: string;
    signature: null;
  };
  requestedClaims: [
    "request-integrity",
    "receipt-stack-link",
    "receipt-package-link",
    "receipt-chain-link-shape",
  ];
  privacy: {
    containsRawSensorInput: false;
    containsReplayState: false;
    containsExecutionEvents: false;
    containsActuatorValues: false;
  };
};

export type CreValidationRequest = CreValidationRequestBody & { requestHash: string };

export type CreValidationResultBody = {
  format: "synapsevm.cre-validation-result.v2";
  requestHash: string;
  receiptHash: string;
  stackId: string;
  packageHash: string;
  verifier: {
    id: "synapsevm-cre-commitment-validator-v1";
    workflow: "synapsevm-neuroproof-v1";
    sdk: "@chainlink/cre-sdk@1.20.1";
    validationPolicy: "commitments-only-v1";
  };
  claims: {
    requestIntegrity: boolean;
    receiptStackLink: boolean;
    receiptPackageLink: boolean;
    receiptChainLinkShape: boolean;
    receiptSignatureVerified: false;
    replayAttempted: false;
    replayMatched: false;
  };
  outcome: "COMMITMENTS_MATCH" | "MISMATCH";
  limitations: string[];
};

export type CreValidationResult = CreValidationResultBody & { resultHash: string };

export type CreExecutionEnvelope = {
  format: "synapsevm.cre-execution-result.v1";
  validation: CreValidationResult;
  report: {
    encoding: "hex";
    rawReport: string;
    reportContext: string;
    signatures: { signerId: number; signature: string }[];
  };
};

export type CreResultAssessment = {
  format: "synapsevm.cre-result-assessment.v1";
  receiptHash: string;
  importedAt: string;
  status: "RESULT_UNAUTHENTICATED" | "REPORT_UNVERIFIED" | "REPORT_VERIFIED";
  outcome: "COMMITMENTS_MATCH" | "MISMATCH";
  validation: CreValidationResult;
  report?: CreExecutionEnvelope["report"];
  /** Why the DON signatures did or did not check out. */
  donVerification?: VerifyOutcome & { reasonDetail?: string };
  checks: {
    resultIntegrity: true;
    exactRequestBinding: true;
    exactReceiptBinding: true;
    exactStackBinding: true;
    exactPackageBinding: true;
    reportPayloadBinding: boolean;
    /** Now a real result: false until a pinned DON signer set says otherwise. */
    donSignaturesVerified: boolean;
  };
};

function requireHash(label: string, value: string | null) {
  if (value !== null && !HASH.test(value)) throw Error(`${label} is not a SHA-256 digest.`);
}

/**
 * Produce the public, commitment-only envelope accepted by the NeuroProof CRE workflow.
 * The full local replay is checked before export, but its sensor values, state and
 * execution details never enter the envelope.
 */
export async function createCreValidationRequest(
  packageValue: ComposePackage,
  bundle: ReplayBundle,
): Promise<CreValidationRequest> {
  const pkg = await importStack(canonical(packageValue));
  if (bundle.stackId !== pkg.manifest.stackId || bundle.receipt.stackId !== pkg.manifest.stackId) {
    throw Error("The receipt belongs to a different Stack.");
  }
  const packageHash = await digest(canonical(pkg));
  if (bundle.receipt.packageHash !== packageHash) throw Error("The receipt names different package bytes.");
  if (bundle.receipt.runtime !== pkg.manifest.runtime) throw Error("The receipt names a different runtime.");
  if (bundle.receipt.format !== (pkg.verification.receiptFormat ?? "synapsevm.stack-receipt.v1")) throw Error("The receipt format is not declared by this Stack.");
  if (bundle.receipt.signature !== null) throw Error("This exporter only supports unsigned local receipts.");

  requireHash("Stack ID", pkg.manifest.stackId);
  requireHash("Package hash", packageHash);
  requireHash("Receipt hash", bundle.receipt.hash);
  requireHash("Previous receipt hash", bundle.receipt.previousReceiptHash);
  requireHash("Input commitment", bundle.receipt.inputCommitment);
  requireHash("State-before root", bundle.receipt.stateBeforeRoot);
  requireHash("State-after root", bundle.receipt.stateAfterRoot);

  // Fail closed if the private evidence cannot reproduce the exact receipt.
  await replayStack(pkg, bundle);

  const body: CreValidationRequestBody = {
    format: "synapsevm.cre-validation-request.v1",
    workflow: "synapsevm-neuroproof-v1",
    stack: {
      stackId: pkg.manifest.stackId,
      packageHash,
      runtime: pkg.manifest.runtime,
      artifactVerifier: pkg.verification.artifactVerifier ?? "synapsevm-artifact-verifier-v1",
      replayVerifier: pkg.verification.replayVerifier ?? "synapsevm-compose-verifier-v1",
    },
    receipt: {
      receiptHash: bundle.receipt.hash,
      stackId: bundle.receipt.stackId,
      packageHash: bundle.receipt.packageHash,
      runtime: bundle.receipt.runtime,
      tick: bundle.receipt.tick,
      sequence: bundle.receipt.sequence,
      previousReceiptHash: bundle.receipt.previousReceiptHash,
      inputCommitment: bundle.receipt.inputCommitment,
      stateBeforeRoot: bundle.receipt.stateBeforeRoot,
      stateAfterRoot: bundle.receipt.stateAfterRoot,
      eventCommitment: await digest(canonical(bundle.receipt.events)),
      actionCommitment: await digest(canonical(bundle.receipt.actions)),
      signature: null,
    },
    requestedClaims: [
      "request-integrity",
      "receipt-stack-link",
      "receipt-package-link",
      "receipt-chain-link-shape",
    ],
    privacy: {
      containsRawSensorInput: false,
      containsReplayState: false,
      containsExecutionEvents: false,
      containsActuatorValues: false,
    },
  };
  return { ...body, requestHash: await digest(canonical(body)) };
}

const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

function resultFrom(value: unknown): { validation: CreValidationResult; report?: CreExecutionEnvelope["report"] } {
  if (!object(value)) throw Error("Expected a CRE validation result object.");
  if (value.format === "synapsevm.cre-execution-result.v1") {
    if (!object(value.validation) || !object(value.report)) throw Error("The CRE execution envelope is incomplete.");
    return {
      validation: value.validation as CreValidationResult,
      report: value.report as CreExecutionEnvelope["report"],
    };
  }
  return { validation: value as CreValidationResult };
}

function hexBytes(label: string, value: unknown, minimumBytes = 0) {
  if (typeof value !== "string" || !/^[a-f0-9]*$/i.test(value) || value.length % 2 !== 0) {
    throw Error(`${label} must be hex without a 0x prefix.`);
  }
  if (value.length < minimumBytes * 2) throw Error(`${label} is shorter than ${minimumBytes} bytes.`);
}

function decodeHex(value: string) {
  const bytes = new Uint8Array(value.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = Number.parseInt(value.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

/**
 * Bind an imported CRE result to the exact request produced by this browser.
 * A report package proves that CRE generated report bytes, but it is deliberately
 * kept in REPORT_UNVERIFIED until its DON signatures are checked against the
 * Capability Registry by a trusted receiver.
 */
export async function assessCreResult(
  request: CreValidationRequest,
  value: unknown,
): Promise<CreResultAssessment> {
  const { validation, report } = resultFrom(value);
  if (validation.format !== "synapsevm.cre-validation-result.v2") throw Error("Unsupported CRE result format.");
  const { resultHash, ...resultBody } = validation;
  if (!HASH.test(resultHash) || (await digest(canonical(resultBody))) !== resultHash) {
    throw Error("The CRE result hash does not match its contents.");
  }
  if (
    validation.verifier?.id !== "synapsevm-cre-commitment-validator-v1" ||
    validation.verifier?.workflow !== request.workflow ||
    validation.verifier?.sdk !== "@chainlink/cre-sdk@1.20.1" ||
    validation.verifier?.validationPolicy !== "commitments-only-v1"
  ) {
    throw Error("The CRE result names an unsupported verifier.");
  }
  if (validation.requestHash !== request.requestHash) throw Error("The CRE result belongs to a different request.");
  if (validation.receiptHash !== request.receipt.receiptHash) throw Error("The CRE result belongs to a different receipt.");
  if (validation.stackId !== request.stack.stackId) throw Error("The CRE result belongs to a different Stack.");
  if (validation.packageHash !== request.stack.packageHash) throw Error("The CRE result belongs to different package bytes.");

  const structuralMatch =
    validation.claims?.requestIntegrity === true &&
    validation.claims?.receiptStackLink === true &&
    validation.claims?.receiptPackageLink === true &&
    validation.claims?.receiptChainLinkShape === true;
  if ((validation.outcome === "COMMITMENTS_MATCH") !== structuralMatch) {
    throw Error("The CRE outcome contradicts its named claims.");
  }
  if (
    validation.claims?.receiptSignatureVerified !== false ||
    validation.claims?.replayAttempted !== false ||
    validation.claims?.replayMatched !== false
  ) {
    throw Error("This commitment-only validator may not claim signature or replay verification.");
  }

  let reportPayloadBinding = false;
  if (report) {
    if (report.encoding !== "hex") throw Error("Unsupported CRE report encoding.");
    hexBytes("CRE raw report", report.rawReport, 109);
    hexBytes("CRE report context", report.reportContext, 40);
    if (!Array.isArray(report.signatures) || !report.signatures.length) throw Error("The CRE report has no signatures.");
    for (const signature of report.signatures) {
      if (!Number.isSafeInteger(signature.signerId) || signature.signerId < 0) throw Error("The CRE report has an invalid signer ID.");
      hexBytes("CRE report signature", signature.signature, 65);
      if (signature.signature.length !== 130) throw Error("A CRE report signature must be exactly 65 bytes.");
    }
    const body = decodeHex(report.rawReport).slice(109);
    let embedded: unknown;
    try {
      embedded = JSON.parse(new TextDecoder().decode(body));
    } catch {
      throw Error("The CRE report body is not a validation result.");
    }
    reportPayloadBinding = canonical(embedded) === canonical(validation);
    if (!reportPayloadBinding) throw Error("The CRE report body does not contain this validation result.");
  }

  /* The signatures are the only part of a CRE result that cannot be forged by
     whoever handed you the file, so they decide whether this is evidence. */
  let donVerification: (VerifyOutcome & { reasonDetail?: string }) | undefined;
  let donVerified = false;
  if (report) {
    /* Registry first — it is the only source that does not rest on our word.
       The pinned file is a fallback for an air-gapped check. */
    const lookup = await signersForReport(decodeHex(report.rawReport), decodeHex(report.reportContext));
    const pinned = lookup.ok ? null : await loadSignerSet();
    const set = lookup.ok ? lookup.set : pinned?.configured ? pinned.set : null;
    if (!set) {
      donVerification = {
        verified: false,
        scheme: null,
        checks: [],
        distinctSigners: 0,
        quorum: 0,
        reason: lookup.ok ? "" : `${lookup.reason}${pinned && !pinned.configured ? ` ${pinned.reason}` : ""}`,
      };
    } else {
      const outcome = verifyDonReport(report, set);
      donVerified = outcome.verified;
      donVerification = {
        ...outcome,
        reasonDetail: `Signers from ${set.source}.`,
      };
    }
  }

  return {
    format: "synapsevm.cre-result-assessment.v1",
    receiptHash: request.receipt.receiptHash,
    importedAt: new Date().toISOString(),
    status: report ? (donVerified ? "REPORT_VERIFIED" : "REPORT_UNVERIFIED") : "RESULT_UNAUTHENTICATED",
    outcome: validation.outcome,
    validation,
    ...(report ? { report } : {}),
    ...(donVerification ? { donVerification } : {}),
    checks: {
      resultIntegrity: true,
      exactRequestBinding: true,
      exactReceiptBinding: true,
      exactStackBinding: true,
      exactPackageBinding: true,
      reportPayloadBinding,
      donSignaturesVerified: donVerified,
    },
  };
}
