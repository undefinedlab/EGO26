import {importStack} from "./composeCompiler";
import {replayStack,type ReplayBundle} from "./composeRuntime";
import {canonical,digest,importPackage} from "./stackCompiler";
import {SynapseVmJs,validateBlock,type StepView,type BlockJson} from "./synapseVm";
export type Claim={id:string;layer:string;label:string;status:"match"|"fail"|"missing"|"unsupported"|"computed";detail:string};
export type VerificationReport={format:"synapsevm.verification-report.v1";verifierId:string;subject:string;mode:string;outcome:"MATCH"|"MISMATCH"|"INCOMPLETE";claims:Claim[];identities:Record<string,string>;scope:string};
export type BrowserEvidence={format:"synapsevm.browser-replay.v1";runtime:"synapsevm-fixed-v1";model:string;tick:number;input:number[];stateBefore:number[];output:StepView;commitments:{model:string;input:string;stateBefore:string;output:string;stateAfter:string};signature:null};
const match=(id:string,layer:string,label:string,ok:boolean,detail:string):Claim=>({id,layer,label,status:ok?"match":"fail",detail});
export const missingTrust=():Claim[]=>[
 {id:"source",layer:"Source",label:"Scientific provenance",status:"missing",detail:"No independently checked source lineage accompanies this evidence."},
 {id:"build",layer:"Build",label:"Independent build reproduction",status:"missing",detail:"No separately reproduced executable build has been supplied."},
 {id:"device",layer:"Deployment",label:"Trusted device identity",status:"missing",detail:"No trusted deployment key or hardware attestation."},
 {id:"control",layer:"Execution",label:"Composed control path",status:"unsupported",detail:"This evidence covers a neural module, not arbitration or a physical actuator."},
 {id:"chain",layer:"Execution",label:"Receipt chain continuity",status:"missing",detail:"An individual receipt does not establish a complete ordered chain."},
 {id:"external",layer:"External",label:"Chainlink CRE validation",status:"missing",detail:"No authenticated CRE workflow result has been obtained. Preparing or exporting a request does not satisfy this claim."},
 {id:"anchor",layer:"Anchor",label:"Public inclusion",status:"missing",detail:"No checked transaction, trusted root or inclusion proof."}
];

/** Claims that only belong on execution receipts — omit from package/module artifact reports. */
const RECEIPT_ONLY_TRUST=new Set(["source","build","device","control","chain","external","signature"]);

export function claimsForEvidence(
  claims:Claim[],
  kind:"receipt"|"package"|"module",
):Claim[]{
  if(kind==="receipt")return claims;
  return claims.filter((c)=>!RECEIPT_ONLY_TRUST.has(c.id));
}

/** A batch root committed to a public ledger, readable by anyone. */
export type LedgerAnchor = {
  network: string;
  topicId: string;
  sequenceNumber: string;
  consensusTimestamp: string;
  receiptRoot: string;
  /** Receipt hashes in the anchored batch — needed to re-prove inclusion. */
  leaves?: string[];
};

/**
 * Replace the default missing anchor claim.
 *
 * Three outcomes, and the distinction matters more than it looks:
 *
 * A ledger anchor is public inclusion — a consensus timestamp anyone can fetch
 * from a mirror node without our software or an account. That earns `match`.
 *
 * A subgraph row reflects an indexed on-chain transaction, so it earns `match`
 * too.
 *
 * A Graph *partner index* row is a local record we wrote ourselves. It is
 * useful bookkeeping, but calling it public inclusion would be the exact
 * self-attestation this trust graph exists to expose, so it reports as
 * `computed`: an identity we hold, not one anyone else can check.
 */
export function withAnchorClaim(
  claims: Claim[],
  anchor: { txHash: string; score: number; source: string; requestHash: string } | null,
  ledger?: LedgerAnchor | null,
): Claim[] {
  const rest = claims.filter((c) => c.id !== "anchor");
  const anchorClaim = (status: Claim["status"], detail: string): Claim => ({
    id: "anchor",
    layer: "Anchor",
    label: "Public inclusion",
    status,
    detail,
  });

  if (ledger) {
    const mirror = `https://${ledger.network === "mainnet" ? "mainnet-public" : ledger.network}.mirrornode.hedera.com/api/v1/topics/${ledger.topicId}/messages/${ledger.sequenceNumber}`;
    return [
      ...rest,
      anchorClaim(
        "match",
        `Batch root ${ledger.receiptRoot.slice(0, 18)}… committed to Hedera topic ${ledger.topicId} at sequence ${ledger.sequenceNumber}, consensus ${ledger.consensusTimestamp}. Readable without an account: ${mirror}`,
      ),
    ];
  }

  if (!anchor) {
    return [...rest, anchorClaim("missing", "No checked transaction, trusted root or inclusion proof.")];
  }

  if (anchor.source === "subgraph") {
    return [
      ...rest,
      anchorClaim(
        "match",
        `Indexed validation for ${anchor.requestHash.slice(0, 18)}… (score ${anchor.score}). Inclusion id ${anchor.txHash}.`,
      ),
    ];
  }

  return [
    ...rest,
    anchorClaim(
      "computed",
      `Recorded in our own Graph partner index (score ${anchor.score}, id ${anchor.txHash}). That is a local record, not public inclusion — anchor the batch to a ledger, or deploy NeuroRegistry and the subgraph, for a claim someone else can check.`,
    ),
  ];
}
async function bytesHash(bytes:Uint8Array){const copy=new Uint8Array(bytes);const raw=await crypto.subtle.digest("SHA-256",copy);return "sha256:"+Array.from(new Uint8Array(raw),v=>v.toString(16).padStart(2,"0")).join("");}
function inputBytes(input:number[]){if(!Array.isArray(input)||input.length>64||input.some(n=>!Number.isInteger(n)||n< -2147483648||n>2147483647))throw Error("Input must contain at most 64 int32 channels.");const bytes=new Uint8Array(input.length*4),view=new DataView(bytes.buffer);input.forEach((n,i)=>view.setInt32(i*4,n,true));return bytes;}
function boundedModel(raw:string){if(typeof raw!=="string"||new TextEncoder().encode(raw).length>4_000_000)throw Error("Model must be JSON under 4 MB.");const model=JSON.parse(raw) as BlockJson;if(typeof model?.name!=="string"||!model.name||typeof model.version!=="string"||!/^\d+\.\d+\.\d+$/.test(model.version))throw Error("Model identity is missing or invalid.");validateBlock(model);if(model.neuronCount>10000||model.csrPres.length>200000)throw Error("Model exceeds browser replay limits.");return model;}
export async function captureEvidence(model:string,tick:number,input:number[],stateBefore:number[],output:StepView,stateAfter:number[]):Promise<BrowserEvidence>{
 return {format:"synapsevm.browser-replay.v1",runtime:"synapsevm-fixed-v1",model,tick,input:[...input],stateBefore:[...stateBefore],output:structuredClone(output),commitments:{model:await digest(model),input:await bytesHash(inputBytes(input)),stateBefore:await bytesHash(new Uint8Array(stateBefore)),output:await digest(canonical(output)),stateAfter:await bytesHash(new Uint8Array(stateAfter))},signature:null};
}
export async function verifyBrowserEvidence(value:unknown):Promise<VerificationReport>{
 const e=value as BrowserEvidence;
 if(!e||e.format!=="synapsevm.browser-replay.v1"||e.runtime!=="synapsevm-fixed-v1")throw Error("Unsupported browser replay format or runtime.");
 if(e.signature!==null)throw Error("Browser replay v1 is unsigned; signature claims are not supported.");
 if(!Number.isSafeInteger(e.tick)||e.tick<0||!e.commitments||Object.values(e.commitments).some(v=>typeof v!=="string"||!/^sha256:[a-f0-9]{64}$/.test(v)))throw Error("Invalid replay metadata.");
 const model=boundedModel(e.model);
 if(!Array.isArray(e.stateBefore)||e.stateBefore.length!==12+model.neuronCount*5||e.stateBefore.some(v=>!Number.isInteger(v)||v<0||v>255))throw Error("Invalid exact pre-state bytes.");
 const input=inputBytes(e.input),before=new Uint8Array(e.stateBefore);
 const claims:Claim[]=[
 match("model","Artifact","Exact captured model",await digest(e.model)===e.commitments.model,"SHA-256 of captured model JSON bytes; not a publisher signature."),
 match("input","Execution","Input commitment",await bytesHash(input)===e.commitments.input,"Canonical little-endian int32 input bytes."),
 match("before","Execution","Pre-state commitment",await bytesHash(before)===e.commitments.stateBefore,"Complete neural state: tick, voltages and spike bytes."),
 match("output-commitment","Execution","Recorded output commitment",await digest(canonical(e.output))===e.commitments.output,"Complete recorded StepView, including trace arrays.")
 ];
 if(claims.every(c=>c.status==="match")){
  const vm=new SynapseVmJs(model);vm.restore(before);const out=vm.step(e.input,e.tick);
  claims.push(match("output","Replay","Neural output and full trace",canonical(out)===canonical(e.output),"Exact equality of every output field; no approximate spike matching."));
  claims.push(match("after","Replay","Post-state commitment",await bytesHash(vm.snapshot())===e.commitments.stateAfter,"Full post-execution neural state bytes."));
 }else claims.push({id:"replay",layer:"Replay",label:"Deterministic execution",status:"missing",detail:"Replay withheld because supplied commitments do not match."});
 claims.push({id:"signature",layer:"Deployment",label:"Receipt signature",status:"missing",detail:"Browser evidence is unsigned."},...missingTrust());
 return {format:"synapsevm.verification-report.v1",verifierId:"synapsevm-browser-module-verifier-v1",subject:model.name+"@"+model.version,mode:"Local module replay",outcome:claims.some(c=>c.status==="fail")?"MISMATCH":"MATCH",claims:claimsForEvidence(claims,"module"),identities:{model:e.commitments.model,input:e.commitments.input,stateBefore:e.commitments.stateBefore,stateAfter:e.commitments.stateAfter},scope:"A fresh instance of the same JavaScript runtime reproduced the disclosed module execution. This does not establish independent implementation, device identity, sensor truth, or actuator behavior."};
}
export async function verifyArtifact(raw:string,expected=""):Promise<VerificationReport>{
 if(new TextEncoder().encode(raw).length>20_000_000)throw Error("Artifact exceeds 20 MB.");
 const hash=await digest(raw),value=JSON.parse(raw),claims:Claim[]=[],identities:Record<string,string>={packageHash:hash};
 if(expected&&!/^sha256:[a-f0-9]{64}$/.test(expected.trim()))throw Error("Expected hash must be sha256: followed by 64 lowercase hex characters.");
 claims.push(expected?match("package","Artifact","Expected package hash",hash===expected.trim(),"Exact uploaded bytes compared with the expected digest."): {id:"package",layer:"Artifact",label:"Package hash",status:"computed",detail:"Digest computed. Supply a digest from a trusted source to compare expected bytes."});
 let subject="";
 const isPackage=["synapsevm.source-package.v1","synapsevm.compose-package.v1"].includes(value?.format);
 if(isPackage){const pkg=value.format==="synapsevm.compose-package.v1"?await importStack(raw):await importPackage(raw);subject=pkg.manifest.name+"@"+pkg.manifest.version;identities.stackId=pkg.manifest.stackId;claims.push(match("stack","Artifact","Canonical Stack identity",true,"Recomputed graph, lockfile and source execution plan."),match("modules","Artifact","Locked module bytes",true,"Every included module digest and identity matched."),{id:"runtime",layer:"Build",label:"Executable target",status:pkg.manifest.executable?"match":"unsupported",detail:pkg.manifest.executable?"Deterministic JavaScript execution plan and all module locks reproduced.":"This is a source package. No composed executable has been checked."});}
 else {const model=boundedModel(raw);subject=model.name+"@"+model.version;claims.push(match("schema","Artifact","Model structure",true,"Topology, numeric parameters and channel mappings passed structural validation."));}
 /* Package/module verifies only report claims this path can establish. Receipt-only
    trust rows (publisher sig, provenance, device, CRE, …) stay on receipt reports. */
 claims.push({id:"anchor",layer:"Anchor",label:"Public inclusion",status:"missing",detail:"No checked transaction, trusted root or inclusion proof."});
 const failed=claims.some(c=>c.status==="fail");
 const outcome=failed?"MISMATCH":expected||identities.stackId?"MATCH":"INCOMPLETE";
 const kind=isPackage?"package":"module";
 return {format:"synapsevm.verification-report.v1",verifierId:"synapsevm-artifact-verifier-v1",subject,mode:"Artifact integrity",outcome,claims:claimsForEvidence(claims,kind),identities,scope:"Internal structure and declared identities are checked. An external expected hash establishes comparison to expected bytes; independent build reproduction is separate."};
}
export function signedReplayReport(result:Record<string,unknown>,receipt:Record<string,unknown>):VerificationReport{
 const fields=[["receiptIdMatch","Execution","Receipt identity"],["signatureValid","Deployment","Ed25519 signature"],["blockRootMatch","Artifact","Module identity"],["runtimeMatch","Build","Runtime identity"],["inputMatch","Execution","Input commitments"],["stateBeforeMatch","Execution","Pre-state"],["actionMatch","Replay","Module result and declared action"],["traceRootMatch","Replay","Trace root"],["stateAfterMatch","Replay","Post-state"]];
 const claims:Claim[]=fields.map(([key,layer,label])=>typeof result[key]==="boolean"?match(key,layer,label,result[key]===true,key==="signatureValid"?"Signature checked against the key supplied in the evidence bundle. Key ownership is not authenticated.":"Reported by the local Rust verifier."):{id:key,layer,label,status:"missing",detail:"Validator did not return this check."});
 claims.push(...missingTrust());
 const incomplete=fields.some(([key])=>typeof result[key]!=="boolean"),failed=result.valid===false||claims.some(c=>c.status==="fail");
 return {format:"synapsevm.verification-report.v1",verifierId:"synapsevm-rust-neuroreceipt-v2",subject:String(receipt.receiptId??"Receipt"),mode:"Local Rust replay",outcome:failed?"MISMATCH":incomplete||result.valid!==true?"INCOMPLETE":"MATCH",claims,identities:{receiptId:String(receipt.receiptId??""),blockRoot:String(receipt.blockRoot??""),stackRoot:String(receipt.stackRoot??"")},scope:"Local Rust replay of a module receipt. Signature validity is relative to the bundled key. No composed Stack, physical action, external validation or public anchor is established."};
}

export async function verifyStackEvidence(raw:string,e:ReplayBundle):Promise<VerificationReport>{
 const pkg=await importStack(raw),identities={stackId:pkg.manifest.stackId,packageHash:await digest(raw),receiptHash:e?.receipt?.hash??""};
 const claims:Claim[]=[match("artifact","Artifact","Stack, plan and locked modules",true,"Canonical package rebuilt from included model bytes."),match("stack","Execution","Receipt Stack identity",e?.stackId===pkg.manifest.stackId,"Receipt must refer to this exact graph and control policy.")];
 let outcome:VerificationReport["outcome"]="MATCH";
 try { await replayStack(pkg,e);for(const [id,label] of [["input","Input commitment"],["before","Complete pre-state"],["events","Neural outputs and control decisions"],["actions","Final actuator commands"],["after","Post-state commitment"],["receipt","Receipt hash and sequence context"]])claims.push(match(id,"Replay",label,true,"Reproduced by a fresh local JavaScript Stack runtime.")); }
 catch(error){outcome="MISMATCH";claims.push(match("replay","Replay","Full Stack replay",false,error instanceof Error?error.message:String(error)));}
 claims.push({id:"signature",layer:"Deployment",label:"Receipt signature",status:"missing",detail:"Compose receipts are unsigned local execution evidence."},...missingTrust().filter(c=>c.id!=="control"));
 return {format:"synapsevm.verification-report.v1",verifierId:"synapsevm-compose-verifier-v1",subject:pkg.graph.name+"@"+pkg.graph.version,mode:"Local Stack replay",outcome,claims,identities,scope:"Reproduces the recorded graph decision, including arbitration and final commands. It does not establish physical actuation, trusted sensors, independent implementation or authenticated device identity."};
}
