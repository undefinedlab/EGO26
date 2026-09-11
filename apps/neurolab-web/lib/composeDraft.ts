import {checkGraph,DEFINITIONS,moduleKey,type ComposeGraph} from "./composeCompiler";
export type Position={x:number;y:number};
export type Draft={graph:ComposeGraph;positions:Record<string,Position>;modules:Record<string,string>};
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v);
export function layout(g:ComposeGraph):Record<string,Position>{
 const levels=new Map<string,number>(),ordered=checkGraph(g).order;
 for(const id of [...ordered,...g.nodes.map(n=>n.id).filter(id=>!ordered.includes(id))]){
  const n=g.nodes.find(n=>n.id===id)!;
  const parents=n.type==="PreviousValue"?[]:g.edges.filter(e=>e.to.startsWith(id+".")).map(e=>e.from.split(".")[0]);
  levels.set(id,Math.max(0,...parents.map(id=>(levels.get(id)??-1)+1)));
 }
 const count:Record<number,number>={};
 return Object.fromEntries(g.nodes.map(n=>{const level=levels.get(n.id)??0,row=count[level]??0;count[level]=row+1;return [n.id,{x:40+level*285,y:50+row*250}];}));
}
/** A draft may be incomplete or fail compilation; its structure must remain editable. */
export function checkedDraft(value:unknown):Draft {
 if(!record(value)||!record(value.graph))throw Error("Unsupported draft structure.");
 const g=value.graph;
 if(typeof g.name!=="string"||typeof g.version!=="string"||typeof g.policy!=="string"||typeof g.deadlineMs!=="number"||!Number.isFinite(g.deadlineMs)||!Array.isArray(g.nodes)||!Array.isArray(g.edges)||g.nodes.length>64||g.edges.length>256)throw Error("Invalid draft graph or size limit.");
 const ids=new Set<string>();
 for(const n of g.nodes){
  if(!record(n)||typeof n.id!=="string"||!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(n.id)||ids.has(n.id)||typeof n.type!=="string"||!Object.hasOwn(DEFINITIONS,n.type))throw Error("Unknown, duplicate or malformed draft node.");
  ids.add(n.id);
  if(n.params!==undefined&&(!record(n.params)||Object.entries(n.params).some(([k,v])=>(k!=="hz"&&!Object.hasOwn(DEFINITIONS[n.type as string].params,k))||typeof v!=="number"||!Number.isFinite(v))))throw Error("Malformed draft parameters.");
  if(n.module!==undefined&&(!record(n.module)||typeof n.module.id!=="string"||!/^[-a-z0-9_]+\/[-a-z0-9_]+$/.test(n.module.id)||typeof n.module.version!=="string"||!/^\d+\.\d+\.\d+$/.test(n.module.version)||typeof n.module.digest!=="string"||!/^sha256:[a-f0-9]{64}$/.test(n.module.digest)))throw Error("Malformed draft module reference.");
 }
 if(g.edges.some(e=>!record(e)||typeof e.from!=="string"||typeof e.to!=="string"||(e.mode!==undefined&&typeof e.mode!=="string")))throw Error("Malformed draft connection.");
 if(!record(value.modules)||Object.values(value.modules).some(v=>typeof v!=="string"||new TextEncoder().encode(v).length>4_000_000))throw Error("Invalid draft modules.");
 if(new TextEncoder().encode(JSON.stringify(value)).length>20_000_000)throw Error("Draft exceeds 20 MB.");
 const graph=g as unknown as ComposeGraph,fallback=layout(graph),positions=Object.fromEntries(graph.nodes.map(n=>{const p=record(value.positions)?value.positions[n.id]:null;return [n.id,record(p)&&typeof p.x==="number"&&typeof p.y==="number"&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&Math.abs(p.x)<100000&&Math.abs(p.y)<100000?{x:p.x,y:p.y}:fallback[n.id]];}));
 return {graph,positions,modules:value.modules as Record<string,string>};
}
export function pruneDraft(draft:Draft):Draft {
 const keys=new Set(draft.graph.nodes.filter(n=>DEFINITIONS[n.type]?.module).map(moduleKey));
 return {...draft,positions:Object.fromEntries(draft.graph.nodes.filter(n=>draft.positions[n.id]).map(n=>[n.id,draft.positions[n.id]])),modules:Object.fromEntries(Object.entries(draft.modules).filter(([key])=>keys.has(key)))};
}
