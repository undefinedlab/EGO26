import { HTTPCapability, Runner, bytesToBase64, bytesToHex, decodeJson, handler, type HTTPPayload, type Runtime } from "@chainlink/cre-sdk";
import { validateCreRequest, type CreValidationRequest } from "./validation";

type Config = { authorizedEVMAddress?: string };

const onHttpTrigger = (runtime: Runtime<Config>, payload: HTTPPayload): string => {
  runtime.log(`NeuroProof request received: ${payload.input.length} bytes`);
  const result = validateCreRequest(decodeJson(payload.input) as CreValidationRequest);
  runtime.log(`NeuroProof outcome: ${result.outcome}`);
  const signed = runtime.report({
    encodedPayload: bytesToBase64(new TextEncoder().encode(JSON.stringify(result))),
    encoderName: "evm",
    signingAlgo: "ecdsa",
    hashingAlgo: "keccak256",
  }).result().x_generatedCodeOnly_unwrap();
  const withoutPrefix = (value: Uint8Array) => bytesToHex(value).slice(2);
  return JSON.stringify({
    format: "synapsevm.cre-execution-result.v1",
    validation: result,
    report: {
      encoding: "hex",
      rawReport: withoutPrefix(signed.rawReport),
      reportContext: withoutPrefix(signed.reportContext),
      signatures: signed.sigs.map((signature) => ({
        signerId: signature.signerId,
        signature: withoutPrefix(signature.signature),
      })),
    },
  });
};

const initWorkflow = (config: Config) => {
  const http = new HTTPCapability();
  const trigger = config.authorizedEVMAddress
    ? http.trigger({ authorizedKeys: [{ type: "KEY_TYPE_ECDSA_EVM", publicKey: config.authorizedEVMAddress }] })
    : http.trigger({});
  return [handler(trigger, onHttpTrigger)];
};

export async function main() {
  const runner = await Runner.newRunner<Config>();
  await runner.run(initWorkflow);
}
