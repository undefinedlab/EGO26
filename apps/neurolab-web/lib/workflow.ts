import {canonical, digest, importStack, type ComposeGraph, type ComposePackage} from "./composeCompiler";
import type {LibraryItem} from "./library";

export const DRAFT_KEY = "synapsevm.compose.draft.v2";
export const BUILD_KEY = "synapsevm.workflow.build.v1";
export type BuildRecord = {pkg:ComposePackage; fingerprint:string; hash:string};
export function draftFingerprint(draft:{graph:ComposeGraph;modules:Record<string,string>}) {
  return canonical({graph:draft.graph,modules:draft.modules});
}
export async function restoreBuild(raw:string, fingerprint:string):Promise<BuildRecord> {
  const saved=JSON.parse(raw) as BuildRecord;
  if(saved.fingerprint!==fingerprint) throw Error("The draft changed after compilation. Compile it again before simulating.");
  const pkg=await importStack(canonical(saved.pkg));
  const hash=await digest(canonical(pkg));
  if(hash!==saved.hash) throw Error("Stored package digest does not match its bytes. Compile again.");
  return {pkg,hash,fingerprint};
}
export function canComposeBlock(item:LibraryItem) {
  return item.kind==="NeuroBlock" && !!item.modelDigest && canonical(item.actualInputs)===canonical(["depth_front","depth_left","depth_right","loom"]);
}
export function composeReleaseHref(item:LibraryItem):string|null {
  if(canComposeBlock(item)) return "/compose?block="+encodeURIComponent(item.id)+"&version="+encodeURIComponent(item.version);
  if(item.kind==="NeuroStack" && item.files.some(f=>f.name==="stack.synapse")) return "/compose?repository="+encodeURIComponent(item.id)+"&version="+encodeURIComponent(item.version);
  if(item.id==="synapsevm/biopilot") return "/compose?template=biopilot";
  return null;
}
