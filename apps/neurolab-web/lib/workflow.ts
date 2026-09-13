import {buildStack, canonical, digest, importStack, type ComposeGraph, type ComposePackage} from "./composeCompiler";
import type {LibraryItem} from "./library";

export const DRAFT_KEY = "synapsevm.compose.draft.v3";
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
  const source=JSON.parse(fingerprint) as {graph:ComposeGraph;modules:Record<string,string>};
  const expected=await buildStack(source.graph,async key=>Object.hasOwn(source.modules,key)?source.modules[key]:pkg.modules[key]);
  if(canonical(expected)!==canonical(pkg)) throw Error("Stored package belongs to a different draft. Compile again.");
  return {pkg,hash,fingerprint};
}

/** Reject writes from tabs that have not loaded the latest workspace. */
export class WorkflowStorage {
  draft:string|null; build:string|null;
  constructor(private storage:Pick<Storage,"getItem"|"setItem">){this.draft=storage.getItem(DRAFT_KEY);this.build=storage.getItem(BUILD_KEY);}
  check(){if(this.storage.getItem(DRAFT_KEY)!==this.draft||this.storage.getItem(BUILD_KEY)!==this.build)throw Error("The workflow changed in another tab. Reload before editing or compiling.");}
  writeDraft(raw:string){this.check();this.storage.setItem(DRAFT_KEY,raw);this.draft=raw;}
  writeBuild(draft:string,build:string){this.writeDraft(draft);this.check();this.storage.setItem(BUILD_KEY,build);this.build=build;}
}

/** An async completion is only valid for the revision that started it. */
export class RevisionGate {
  private revision=0;
  next(){return ++this.revision;}
  accepts(ticket:number){return ticket===this.revision;}
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
