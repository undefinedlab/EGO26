import type {DatasetMeta} from "./datasets";
export const KINDS = ["NeuroBlock", "NeuroStack", "Dataset", "Brain", "Region", "Circuit", "Motif"] as const;
export type ArtifactKind = typeof KINDS[number];
export const KIND_LABELS: Record<ArtifactKind,string> = {NeuroBlock:"Blocks",NeuroStack:"Stacks",Dataset:"Datasets",Brain:"Brains",Region:"Regions",Circuit:"Circuits",Motif:"Motifs"};
export const KIND_HELP: Record<ArtifactKind,string> = {
 NeuroBlock:"A reusable neural module with a defined input and output.",NeuroStack:"A composition of modules, adapters, and control rules.",Dataset:"Scientific source data and versioned references.",Brain:"A whole nervous-system model from a source dataset.",Region:"An anatomical area selected from a brain.",Circuit:"A functional pathway that can be used to derive a module.",Motif:"A small, reusable neural computation within a circuit."};
export type LibraryFile = {name:string;bytes:number;digest:string};
export type Release = {version:string;digest:string;publishedAt:string|null;origin:"bundled"|"local"|"reference"};
export type LibraryItem = {
 id:string;owner:string;slug:string;name:string;kind:ArtifactKind;description:string;task:string;tags:string[];
 version:string;origin:Release["origin"];publishedAt:string|null;license:string;sourceType:string;runtime:string;
 digest:string;modelDigest:string|null;bytes:number;neurons:number|null;synapses:number|null;
 inputs:string[];outputs:string[];actualInputs:string[];actualOutputs:string[];
 readme:string;lineage:{kind:string;name:string;note:string;href?:string}[];
 files:LibraryFile[];releases:Release[];testCount:number;testsRun:boolean;
 benchmark:{p50:number;p95:number;samples:number;note:string}|null;
 simulator:string|null;parent:{id:string;version:string;digest:string}|null;
 /** Present only on Dataset cards: the public source this entry points at. */
 dataset?:DatasetMeta;
};
export function repoHref(item:Pick<LibraryItem,"owner"|"slug">,version?:string){return "/explore/"+encodeURIComponent(item.owner)+"/"+encodeURIComponent(item.slug)+(version?"?version="+encodeURIComponent(version):"");}
export function formatBytes(n:number){return n<1024?n+" B":n<1048576?(n/1024).toFixed(1)+" kB":n<1073741824?(n/1048576).toFixed(1)+" MB":(n/1073741824).toFixed(1)+" GB";}
export function releaseDate(value:string|null){return value?new Date(value).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"}):"Bundled release";}
export function versionCompare(a:string,b:string){const aa=a.split(".").map(Number),bb=b.split(".").map(Number);for(let i=0;i<3;i++){if(aa[i]!==bb[i])return aa[i]-bb[i];}return 0;}
export type LibraryFilters = {kind:ArtifactKind;q:string;task:string;origin:string;source:string;sort:string;savedOnly:boolean;saved:string[];coverage?:string;organism?:string};
export function filterLibrary(items:LibraryItem[],f:LibraryFilters){
 const query=f.q.trim().toLowerCase();
 return items.filter(i=>i.kind===f.kind&&(!f.task||i.task===f.task)&&(!f.origin||i.origin===f.origin)&&(!f.source||i.sourceType===f.source)&&(!f.coverage||i.dataset?.coverage===f.coverage)&&(!f.organism||i.dataset?.common===f.organism)&&(!f.savedOnly||f.saved.includes(i.id))&&(!query||[i.id,i.name,i.description,i.license,i.sourceType,i.dataset?.organism??"",i.dataset?.scope??"",...i.tags,...i.inputs,...i.outputs].join(" ").toLowerCase().includes(query))).sort((a,b)=> f.sort==="name"?a.name.localeCompare(b.name):f.sort==="smallest"?a.bytes-b.bytes:f.sort==="neurons"?(a.neurons??Infinity)-(b.neurons??Infinity):(b.publishedAt??"").localeCompare(a.publishedAt??"")||a.name.localeCompare(b.name));
}
