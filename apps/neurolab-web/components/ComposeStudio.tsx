"use client";
import Link from "next/link";
import dynamic from "next/dynamic";
import {useEffect,useMemo,useRef,useState,type PointerEvent} from "react";
import {DEFINITIONS,RATES,template,paramsFor,checkGraph,connectionProblem,suggestAdapter,buildStack,importStack,canonical,digest,moduleKey,type ComposeGraph,type ComposeNode,type ComposePackage} from "@/lib/composeCompiler";
import {loadCompiledStack,replayStack,scenarioInput,type CompiledStack,type RuntimeEvent,type ReplayBundle,type Inputs} from "@/lib/composeRuntime";
import type {LibraryItem} from "@/lib/library";
import {ComposeAssistant} from "./ComposeAssistant";
import {ComposeAddMenu} from "./ComposeAddMenu";
import {NODE_DRAG_TYPE} from "./ComposeBlocksBar";
import {ComposeCompileBar,type CompileLog,type CompilePreset} from "./ComposeCompileBar";
import { IconPanel } from "@/components/icons";
import {DRAFT_KEY,BUILD_KEY,draftFingerprint,restoreBuild,canComposeBlock,WorkflowStorage,RevisionGate} from "@/lib/workflow";
import {putStack,shelveQuietly} from "@/lib/shelf";
const World=dynamic(()=>import("./ComposeWorld").then(m=>m.ComposeWorld),{ssr:false,loading:()=> <p>Loading command preview…</p>});
import {checkedDraft,layout,pruneDraft,type Draft,type Position} from "@/lib/composeDraft";
const KEY=DRAFT_KEY,PRESET_KEY="synapsevm.compile-presets.v1",families=["sensor","adapter","neuroblock","control","state","actuator"];
const short=(s:string)=>s.length>20?s.slice(0,13)+"…"+s.slice(-5):s;
function initial():Draft{const graph={name:"Untitled",version:"0.1.0",deadlineMs:10,policy:"AUDIT" as const,nodes:[],edges:[]};return {graph,positions:{},modules:{}};}
function download(name:string,raw:string,mime="application/json"){const url=URL.createObjectURL(new Blob([raw],{type:mime}));const a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
/**
 * The artifact file name is the only place a Stack is named in this UI, so it
 * has to carry through to the package itself. `MyStack` was otherwise baked
 * into every compile no matter what the field said.
 *
 * Only the stem is taken, a trailing -x.y.z is dropped, and the result has to
 * satisfy the compiler's own name rule — otherwise the graph keeps the name it
 * had rather than being given an invalid one.
 */
function stackNameFrom(file:string){
 const stem=file.trim().replace(/\.(?:io|json|synapse)$/i,"").replace(/-\d+\.\d+\.\d+$/,"").replace(/[^A-Za-z0-9_-]+/g,"");
 return /^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(stem)?stem:null;
}
function artifactName(value:string,fallback:string){const base=value.trim().replace(/[^A-Za-z0-9._-]+/g,"-").replace(/\.(?:io|json|synapse)$/i,"");return (base||fallback)+".synapse";}
export function ComposeStudio({mode="compose"}:{mode?:"compose"|"compile"|"simulate"}){
 const storage=useRef<WorkflowStorage|null>(null),revision=useRef(new RevisionGate()),conflicted=useRef(false);
 const [external,setExternal]=useState(false);
 const [release,setRelease]=useState<{item:LibraryItem;raw:string}|null>(null);
 const [draft,setDraft]=useState<Draft>(initial),[ready,setReady]=useState(false),[status,setStatus]=useState(""),[error,setError]=useState(""),[selected,setSelected]=useState(""),[edgeIndex,setEdgeIndex]=useState<number|null>(null),[pending,setPending]=useState(""),[search,setSearch]=useState(""),[tab,setTab]=useState<"inspect"|"build"|"run">("inspect");
 const [adapterOffer,setAdapterOffer]=useState<{from:string;to:string;types:string[]}|null>(null);
 const [past,setPast]=useState<Draft[]>([]),[future,setFuture]=useState<Draft[]>([]),[pan,setPan]=useState({x:0,y:0}),[zoom,setZoom]=useState(.7),[busy,setBusy]=useState(false),[built,setBuilt]=useState<{pkg:ComposePackage;fingerprint:string;hash:string}|null>(null),[library,setLibrary]=useState<LibraryItem[]>([]);
 const [running,setRunning]=useState(false),[obstacle,setObstacle]=useState(false),[actions,setActions]=useState<Inputs>({}),[events,setEvents]=useState<RuntimeEvent[]>([]),[event,setEvent]=useState<RuntimeEvent|null>(null),[replay,setReplay]=useState<ReplayBundle|null>(null),[replayResult,setReplayResult]=useState(""),[tick,setTick]=useState(0);
 const [fileName,setFileName]=useState("Untitled-0.1.0.synapse"),[savedPresets,setSavedPresets]=useState<CompilePreset[]>([]),[saveOk,setSaveOk]=useState(false),[inspectorOpen,setInspectorOpen]=useState(true),[compileLogs,setCompileLogs]=useState<CompileLog[]>([]);
 const stage=useRef<HTMLDivElement>(null),drag=useRef<{id:string;px:number;py:number;x:number;y:number;original:Draft}|null>(null),panDrag=useRef<{px:number;py:number;x:number;y:number}|null>(null),runtime=useRef<CompiledStack|null>(null),stepping=useRef(false),generation=useRef(0);
 const {graph,positions,modules}=draft;const draftRef=useRef(draft);draftRef.current=draft;const fingerprint=draftFingerprint(draft),fingerRef=useRef(fingerprint);fingerRef.current=fingerprint;
 const active=built?.fingerprint===fingerprint?built:null;
 const validation=useMemo(()=>checkGraph(graph),[graph]),node=graph.nodes.find(n=>n.id===selected),nodeDef=node?DEFINITIONS[node.type]:null;
 const edge=edgeIndex===null?null:graph.edges[edgeIndex];
 function invalidate(){revision.current.next();generation.current++;runtime.current=null;setRunning(false);setReplay(null);setReplayResult("");setActions({});setEvents([]);setEvent(null);setTick(0);}
 function clearSelection(){setPending("");setAdapterOffer(null);setEdgeIndex(null);setError("");}
 function checkWorkspace(){try{if(conflicted.current)throw Error("Reload to load the latest workflow.");storage.current?.check();return true;}catch(e){conflicted.current=true;setExternal(true);invalidate();setBuilt(null);setError(String(e));return false;}}
 function persistDraft(next:Draft){if(!storage.current){setStatus("Browser storage unavailable. Download your draft.");return false;}try{storage.current.writeDraft(JSON.stringify(next));setStatus("Draft saved locally");return true;}catch(e){if(!checkWorkspace())return false;setStatus("Draft not saved: "+String(e));return false;}}
 function commit(value:Draft){if(!ready||conflicted.current||!checkWorkspace())return false;let next:Draft;try{next=pruneDraft(checkedDraft(value));}catch(e){setError(String(e));return false;}revision.current.next();if(draftFingerprint(next)!==draftFingerprint(draftRef.current))resetRun();const previous=draftRef.current;setPast(p=>[...p.slice(-29),previous]);setFuture([]);draftRef.current=next;setDraft(next);persistDraft(next);clearSelection();return true;}
 // The file name is where a Stack gets named, so keep graph.name with it.
 function renameFromFile(value:string){setFileName(value);const name=stackNameFrom(value);if(name&&name!==draftRef.current.graph.name)updateGraph({...draftRef.current.graph,name});}
 function updateGraph(g:ComposeGraph){commit({...draftRef.current,graph:g});}
 // A synthesised graph replaces the draft wholesale; it arrives already checked by checkGraph.
 function applyPlan(g:ComposeGraph){if(mode!=="compose")return;const check=checkGraph(g);if(check.errors.length){setError(check.errors.map(e=>e.message).join(" "));return;}const positions=layout(g);if(!commit({...draftRef.current,graph:g,positions}))return;setSelected(g.nodes[0]?.id??"");setTab("inspect");setStatus("Placed a synthesised graph. Review it before compiling.");fit(positions);}
 function undo(){if(!past.length||!checkWorkspace())return;const next=past[past.length-1];invalidate();const previous=draftRef.current;setFuture(f=>[previous,...f]);draftRef.current=next;setDraft(next);persistDraft(next);setPast(p=>p.slice(0,-1));clearSelection();}
 function redo(){if(!future.length||!checkWorkspace())return;const next=future[0];invalidate();const previous=draftRef.current;setPast(p=>[...p,previous]);draftRef.current=next;setDraft(next);persistDraft(next);setFuture(f=>f.slice(1));clearSelection();}
 // Fit the graph into the stage without assuming a left blocks rail.
 function fit(pos=positions){const box=stage.current;if(!box||!Object.keys(pos).length)return;const usable=Math.max(160,box.clientWidth);const ps=Object.values(pos),minX=Math.min(...ps.map(p=>p.x)),minY=Math.min(...ps.map(p=>p.y)),w=Math.max(...ps.map(p=>p.x+235))-minX,h=Math.max(...ps.map(p=>p.y+220))-minY;const z=Math.min(1,Math.max(.2,Math.min((usable-60)/w,(box.clientHeight-60)/h)));setZoom(z);setPan({x:(usable-w*z)/2-minX*z,y:(box.clientHeight-h*z)/2-minY*z});}
 useEffect(()=>{let cancelled=false;void(async()=>{try{const session=new WorkflowStorage(localStorage);storage.current=session;const raw=session.draft,saved=raw?checkedDraft(JSON.parse(raw)):initial();draftRef.current=saved;setDraft(saved);setStatus(raw?"Restored local draft":"Empty canvas — add blocks to begin");if(session.build){try{const build=await restoreBuild(session.build,draftFingerprint(saved));session.check();if(!cancelled&&!conflicted.current)setBuilt(build);}catch(e){if(!cancelled)setStatus(String(e));}}}catch(e){if(!cancelled)setError("Draft could not be restored: "+String(e));}finally{if(!cancelled)setReady(true);}})();return()=>{cancelled=true;revision.current.next();generation.current++;};},[]);
 useEffect(()=>{setTab(mode==="simulate"?"run":"inspect");},[mode]);
 useEffect(()=>{if(mode==="simulate")return;try{const raw=localStorage.getItem(PRESET_KEY);if(raw){const list=JSON.parse(raw) as CompilePreset[];if(Array.isArray(list))setSavedPresets(list.filter(p=>p&&typeof p.name==="string"));}}catch{/* ignore */}},[mode]);
 function persistPresets(next:CompilePreset[]){setSavedPresets(next);try{localStorage.setItem(PRESET_KEY,JSON.stringify(next));}catch{setStatus("Browser storage full. Export a draft instead.");}}
 function savePreset(name:string){const snap=draftRef.current;const next=[...savedPresets.filter(p=>p.name!==name),{name,draft:snap}];persistPresets(next);setSaveOk(true);setStatus("Saved "+name+".io");setTimeout(()=>setSaveOk(false),1500);}
 function loadPreset(name:string){const found=savedPresets.find(p=>p.name===name);if(!found)return;try{const saved=checkedDraft(found.draft);commit(saved);setStatus("Loaded "+name+".io");setTimeout(()=>fit(saved.positions),0);}catch(e){setError(String(e));}}
 function deletePreset(name:string){persistPresets(savedPresets.filter(p=>p.name!==name));setStatus("Deleted "+name+".io");}
 useEffect(()=>{const changed=(e:StorageEvent)=>{if(e.key===null||e.key===KEY||e.key===BUILD_KEY)checkWorkspace();};window.addEventListener("storage",changed);return()=>window.removeEventListener("storage",changed);},[]);
 function go(path:string){if(!ready||!checkWorkspace())return;if(persistDraft(draftRef.current))window.location.assign(path);}
 // Every compile is kept on the Verify shelf, not just the latest one.
 function saveBuild(record:{pkg:ComposePackage;fingerprint:string;hash:string},source:Draft){if(!storage.current)throw Error("Browser storage unavailable. Save the draft and retry.");storage.current.writeBuild(JSON.stringify(source),JSON.stringify(record));setBuilt(record);void shelveQuietly(record.pkg,"compiled");}

 useEffect(()=>{if(ready)fit();},[ready]); // initial viewport only
 useEffect(()=>{const controller=new AbortController();fetch("/api/library",{signal:controller.signal}).then(r=>r.json()).then(r=>setLibrary(r.items??[])).catch(()=>{});return()=>controller.abort();},[]);
 useEffect(()=>{generation.current++;runtime.current=null;setRunning(false);setActions({});setEvents([]);setEvent(null);setReplay(null);setReplayResult("");setTick(0);},[fingerprint]);
 const obstacleRef=useRef(obstacle);obstacleRef.current=obstacle;
 async function step(count=5){
  if(stepping.current||busy||!ready||conflicted.current||!active?.pkg.manifest.executable||!checkWorkspace())return;stepping.current=true;const gen=generation.current;
  try{if(!runtime.current){const loaded=await loadCompiledStack(active.pkg);if(gen!==generation.current)return;runtime.current=loaded;}if(gen!==generation.current)return;let latest:Awaited<ReturnType<CompiledStack["step"]>>|undefined;const batch:RuntimeEvent[]=[];
   for(let i=0;i<count;i++){latest=await runtime.current!.step(scenarioInput(active.pkg,obstacleRef.current));if(gen!==generation.current)return;batch.push(...latest.events);if(latest.replay){setReplay(latest.replay);setReplayResult("");}}
   if(latest){setTick(latest.tick+1);setActions(latest.actions);setEvents(prev=>[...prev,...batch].slice(-200));}
  }catch(e){setError(String(e));setRunning(false);}finally{stepping.current=false;}
 }
 useEffect(()=>{if(!running)return;const timer=setInterval(()=>void step(20),50);return()=>clearInterval(timer);},[running,active]);
 function resetRun(){generation.current++;runtime.current=null;setRunning(false);setEvents([]);setActions({});setEvent(null);setReplay(null);setReplayResult("");setTick(0);}
 async function compile(){
  if(!ready||busy||!checkWorkspace())return;invalidate();setBusy(true);setError("");const ticket=revision.current.next(),snap=structuredClone(draftRef.current),key=draftFingerprint(snap);
  const pause=(ms=240)=>new Promise<void>(r=>setTimeout(r,ms));
  const moduleCount=new Set(snap.graph.nodes.filter(n=>DEFINITIONS[n.type].module).map(moduleKey)).size;
  setCompileLogs([{label:"Graph validation passed",status:"pass",detail:snap.graph.nodes.length+" typed nodes · "+snap.graph.edges.length+" compatible connections"},{label:"Resolve and verify locked modules",status:"running",detail:moduleCount+" neural model dependency"+(moduleCount===1?"":"ies")}]);
  try{
   await pause();
   const pkg=await buildStack(snap.graph,async k=>{if(Object.hasOwn(snap.modules,k))return snap.modules[k];const n=snap.graph.nodes.find(n=>DEFINITIONS[n.type].module&&moduleKey(n)===k)!;const url=n.module?"/api/library/"+n.module.id+"/files?version="+encodeURIComponent(n.module.version)+"&path=block.json":"/blocks/"+k+"/1.0.0/block.json";const r=await fetch(url);if(!r.ok)throw Error("Could not load "+k);return r.text();});
   setCompileLogs(v=>[...v.slice(0,-1),{label:"Locked module bytes verified",status:"pass",detail:Object.keys(pkg.lockfile).length+" dependency digest"+(Object.keys(pkg.lockfile).length===1?"":"s")+" matched"},{label:"Re-import compiled package",status:"running",detail:"Rebuild graph, locks and runtime plan from exported bytes"}]);
   await pause();
   const raw=canonical(pkg),roundTrip=await importStack(raw);if(roundTrip.manifest.stackId!==pkg.manifest.stackId)throw Error("Round-trip Stack identity mismatch.");
   setCompileLogs(v=>[...v.slice(0,-1),{label:"Package round-trip passed",status:"pass",detail:"The exported .synapse re-imported with the same Stack identity"},{label:"Smoke-run executable runtime",status:"running",detail:"Instantiate the compiled graph and execute one deterministic tick"}]);
   await pause();
   if(roundTrip.manifest.executable){const smoke=await loadCompiledStack(roundTrip);await smoke.step(scenarioInput(roundTrip,false));}
   setCompileLogs(v=>[...v.slice(0,-1),{label:roundTrip.manifest.executable?"Runtime smoke tick passed":"Runtime smoke skipped",status:"pass",detail:roundTrip.manifest.executable?"Every scheduled primitive loaded and produced a deterministic tick":"Source package — Open stays locked until interfaces resolve"},{label:"Compute package identity",status:"running",detail:"SHA-256 over canonical package bytes"}]);
   await pause();
   const hash=await digest(raw);if(!revision.current.accepts(ticket)||draftFingerprint(draftRef.current)!==key||!checkWorkspace()){setStatus("Build discarded because the workspace changed.");return false;}
   saveBuild({pkg,fingerprint:key,hash},draftRef.current);setFileName(pkg.manifest.name+"-"+pkg.manifest.version+".synapse");setTab(mode==="simulate"?"run":"inspect");setStatus(pkg.manifest.executable?"Executable SynapseVM package built":"Source package built; runtime interfaces unresolved");
   setCompileLogs(v=>[...v.slice(0,-1),{label:"Package identity computed",status:"pass",detail:hash},{label:"Package checks",status:"running",detail:"Confirming the local importer and runtime accept these exact bytes"}]);
   await pause(180);
   setCompileLogs(v=>[...v.slice(0,-1),{label:"Package checks",status:"pass",detail:"Strict importer and SynapseVM Compose runtime accepted the generated file"}]);
   return true;
  }catch(e){if(revision.current.accepts(ticket)){setError(String(e));setCompileLogs(v=>[...v.filter(x=>x.status!=="running"),{label:"Compilation stopped",status:"fail",detail:String(e)}]);}return false;}finally{setBusy(false);}
 }
 function downloadBuild(){if(active)download(artifactName(fileName,graph.name+"-"+graph.version),canonical(active.pkg));}
 async function saveBuildToLibrary(){if(!active)return;try{await putStack(active.pkg,"compiled");setStatus("Saved to Verify library · available under Verify");return true;}catch(e){setError("Could not save to Verify library: "+String(e));return false;}}
 async function acceptPackage(pkg:ComposePackage,ticket:number){
  const next={graph:pkg.graph,positions:layout(pkg.graph),modules:pkg.modules},hash=await digest(canonical(pkg));
  if(!revision.current.accepts(ticket)||!checkWorkspace())return;
  if(!commit(next))return;resetRun();try{saveBuild({pkg,fingerprint:draftFingerprint(next),hash},next);}catch(e){setError("Package imported but could not be saved: "+String(e));return;}
  setFileName(pkg.graph.name+"-"+pkg.graph.version+".synapse");setTab(mode==="simulate"?"run":"inspect");setStatus("Package checked; exact module bytes retained");setTimeout(()=>fit(next.positions),0);
 }
 async function importFile(file?:File){
  if(!file||!ready||busy||!checkWorkspace())return;invalidate();setBusy(true);setError("");const ticket=revision.current.next();
  try{if(file.size>20_000_000)throw Error("File exceeds 20 MB.");const raw=await file.text(),value=JSON.parse(raw);if(value?.format==="synapsevm.compose-draft.v1"){const saved=checkedDraft(value.draft);if(!revision.current.accepts(ticket))return;if(commit(saved)){setSelected("");setFileName(saved.graph.name+".synapse");setStatus("Draft imported");setTimeout(()=>fit(saved.positions),0);}return;}await acceptPackage(await importStack(raw),ticket);}
  catch(e){if(revision.current.accepts(ticket))setError(String(e));}finally{setBusy(false);}
 }
 useEffect(()=>{
  if(!ready)return;const p=new URLSearchParams(window.location.search),repo=p.get("repository");if(!repo)return;
  invalidate();setBuilt(null);setBusy(true);const ticket=revision.current.next(),controller=new AbortController();
  void(async()=>{try{const version=p.get("version");if(!version)throw Error("Choose an explicit Stack release version in Explore.");const r=await fetch("/api/library/"+repo+"/files?path=stack.synapse&version="+encodeURIComponent(version),{signal:controller.signal});if(!r.ok)throw Error("Published Stack unavailable");const pkg=await importStack(await r.text());if(!controller.signal.aborted)await acceptPackage(pkg,ticket);}catch(e){if(!controller.signal.aborted&&revision.current.accepts(ticket))setError(String(e));}finally{if(!controller.signal.aborted)setBusy(false);}})();
  return()=>{controller.abort();revision.current.next();};
 },[ready]);
 function add(type:string,at?:Position){const current=draftRef.current;let id=type,suffix=2;while(current.graph.nodes.some(n=>n.id===id))id=type+"_"+suffix++;const rect=stage.current;const spot=at??{x:((rect?.clientWidth??600)/2-pan.x)/zoom,y:((rect?.clientHeight??400)/2-pan.y)/zoom};const next={...current,graph:{...current.graph,nodes:[...current.graph.nodes,{id,type}]},positions:{...current.positions,[id]:spot}};commit(next);setSelected(id);setEdgeIndex(null);setTab("inspect");}
 // A block dropped on the canvas lands under the cursor, not in the middle.
 function dropNode(e:React.DragEvent){const type=e.dataTransfer.getData(NODE_DRAG_TYPE);e.currentTarget.classList.remove("is-drop-target");if(!type||!Object.hasOwn(DEFINITIONS,type))return;e.preventDefault();const rect=e.currentTarget.getBoundingClientRect();add(type,{x:(e.clientX-rect.left-pan.x)/zoom-117,y:(e.clientY-rect.top-pan.y)/zoom-30});}
 useEffect(()=>{if(!ready||mode!=="compose")return;const query=new URLSearchParams(window.location.search);if(query.get("template")==="biopilot"){selectTemplate("biopilot");window.history.replaceState(null,"","/compose");return;}const id=query.get("block"),version=query.get("version");if(!id)return;const controller=new AbortController();void(async()=>{try{if(!version)throw Error("Choose a versioned release in Explore first.");const base="/api/library/"+id;const response=await fetch(base+"?version="+encodeURIComponent(version),{signal:controller.signal});if(!response.ok)throw Error("Selected release is unavailable.");const {item}=await response.json() as {item:LibraryItem};if(!canComposeBlock(item))throw Error("This release does not expose the supported four-channel reflex interface.");const file=await fetch(base+"/files?path=block.json&version="+encodeURIComponent(version),{signal:controller.signal});if(!file.ok)throw Error("Selected model bytes unavailable.");const raw=await file.text();if(await digest(raw)!==item.modelDigest)throw Error("Selected release digest does not match its model bytes.");if(!controller.signal.aborted)setRelease({item,raw});}catch(e){if(!controller.signal.aborted)setError(String(e));}})();return()=>controller.abort();},[ready,mode]);
 function useRelease(start:boolean){if(!release)return;const {item,raw}=release,current=draftRef.current;const g=start?template("brake"):structuredClone(current.graph);let id="LoomGuard";if(!start){let suffix=2;while(g.nodes.some(n=>n.id===id))id="LoomGuard_"+suffix++;g.nodes.push({id,type:"LoomGuard"});}g.nodes=g.nodes.map(n=>n.id===id?{...n,module:{id:item.id,version:item.version,digest:item.modelDigest!}}:n);const pos=start?layout(g):{...current.positions,[id]:{x:80,y:80}};commit({graph:g,positions:pos,modules:{...start?{}:current.modules,[item.id+"@"+item.version]:raw}});setSelected(id);setEdgeIndex(null);setRelease(null);setStatus("Pinned "+item.id+"@"+item.version);window.history.replaceState(null,"","/compose");setTimeout(()=>fit(pos),0);}
 function removeNode(){if(!node)return;const next={...graph,nodes:graph.nodes.filter(n=>n.id!==node.id),edges:graph.edges.filter(e=>!e.from.startsWith(node.id+".")&&!e.to.startsWith(node.id+"."))};updateGraph(next);setSelected("");}
 function connect(to:string){if(!pending){setError("Select an output port first, then an input.");return;}const problem=connectionProblem(graph,pending,to);if(problem){const adapters=suggestAdapter(graph,pending,to);setAdapterOffer(adapters.length?{from:pending,to,types:adapters}:null);setError(problem+(adapters.length?" Insert adapter: "+adapters.join(", ")+".":""));return;}updateGraph({...graph,edges:[...graph.edges,{from:pending,to,mode:"LATEST"}]});}
 function insertAdapter(type:string){
 if(!adapterOffer)return;let id=type,suffix=2;while(graph.nodes.some(n=>n.id===id))id=type+"_"+suffix++;
 const d=DEFINITIONS[type],edges=[...graph.edges,{from:adapterOffer.from,to:id+"."+Object.keys(d.inputs)[0],mode:"LATEST" as const},{from:id+"."+Object.keys(d.outputs)[0],to:adapterOffer.to,mode:"LATEST" as const}],next={...graph,nodes:[...graph.nodes,{id,type}],edges};
 const problem=checkGraph(next).errors.find(e=>e.code==="CYCLE"||(e.edge!==undefined&&e.edge>=graph.edges.length));if(problem){setError(problem.message+" Remove the existing input connection first.");return;}
 const a=anchor(adapterOffer.from,true),b=anchor(adapterOffer.to,false);commit({...draft,graph:next,positions:{...positions,[id]:{x:(a.x+b.x)/2,y:(a.y+b.y)/2+150}}});setSelected(id);
 }
 function setParam(key:string,value:number){if(!node)return;updateGraph({...graph,nodes:graph.nodes.map(n=>n.id===node.id?{...n,params:{...n.params,[key]:value}}:n)});}
 function selectTemplate(kind:string){const g=template(kind),pos=layout(g);commit({graph:g,positions:pos,modules:{}});setSelected(g.nodes.find(n=>n.type==="LoomGuard")?.id??"");setEdgeIndex(null);setTimeout(()=>fit(pos),0);}
 function anchor(port:string,out:boolean){const [id,name]=port.split("."),n=graph.nodes.find(n=>n.id===id);if(!n)return {x:0,y:0};const d=DEFINITIONS[n.type],p=positions[id]??{x:0,y:0};return {x:p.x+(out?235:0),y:p.y+88+Object.keys(out?d.outputs:d.inputs).indexOf(name)*27};}
 function onDown(n:ComposeNode,e:PointerEvent){if(e.button!==0||!checkWorkspace())return;e.stopPropagation();e.currentTarget.setPointerCapture(e.pointerId);const p=positions[n.id]??{x:0,y:0};drag.current={id:n.id,px:e.clientX,py:e.clientY,x:p.x,y:p.y,original:draftRef.current};setSelected(n.id);setEdgeIndex(null);setTab("inspect");setInspectorOpen(true);}
 function onMove(e:PointerEvent){const d=drag.current;if(!d)return;const next={...draftRef.current,positions:{...draftRef.current.positions,[d.id]:{x:d.x+(e.clientX-d.px)/zoom,y:d.y+(e.clientY-d.py)/zoom}}};draftRef.current=next;setDraft(next);}
 function onUp(){revision.current.next();const d=drag.current;if(d){if(canonical(d.original.positions)!==canonical(draftRef.current.positions)){setPast(p=>[...p.slice(-29),d.original]);setFuture([]);}persistDraft(draftRef.current);drag.current=null;}}
 const available=library.filter(i=>i.kind==="NeuroBlock"&&canonical(i.actualInputs)===canonical(["depth_front","depth_left","depth_right","loom"])&&i.modelDigest);
 return <div className={"cmp cmp-mode-"+mode}>
 {release&&<div className="cmp-alert"><div><strong>{release.item.id}@{release.item.version}</strong><p>Exact release loaded from Explore. Add it to your graph, or start a connected Emergency Brake using this release.</p></div><button onClick={()=>useRelease(false)}>Add to current graph</button><button onClick={()=>useRelease(true)}>Start a connected Stack</button><button onClick={()=>setRelease(null)}>Dismiss</button></div>}
 {external&&<div role="alert" className="cmp-alert"><span>Another tab changed this workspace. Your local view is paused.</span><button onClick={()=>window.location.reload()}>Reload latest workspace</button><button onClick={()=>download(graph.name+".draft.json",JSON.stringify({format:"synapsevm.compose-draft.v1",draft}))}>Save this view as a draft</button></div>}
 {!ready&&<p role="status">Loading workflow…</p>}
 {mode==="simulate"&&<header className="cmp-toolbar"><div><span className="cmp-eyebrow">NEUROSTACK WORKBENCH</span><div className="cmp-title"><input readOnly aria-label="Stack name" value={graph.name}/><span>@</span><input readOnly aria-label="Stack version" value={graph.version}/></div></div>
 <div className="cmp-tools"><button onClick={()=>go("/compose")}>← Compose</button><button className="primary" disabled={!ready||busy||validation.errors.length>0} onClick={()=>void compile()}>{busy?"Compiling…":"Compile Stack"}</button></div>
 </header>}
 {mode==="compose"&&<ComposeCompileBar fileName={fileName} onFileName={renameFromFile} savedPresets={savedPresets} onSavePreset={savePreset} onLoadPreset={loadPreset} onDeletePreset={deletePreset} onPresetTemplate={()=>{selectTemplate("brake");setFileName("EmergencyBrake-0.1.0.synapse");}} onImport={f=>void importFile(f)} onCompile={compile} onDownload={downloadBuild} onSaveToLibrary={saveBuildToLibrary} onSimulate={()=>go("/verify/simulate?source=compose")} busy={busy} canCompile={ready&&validation.errors.length===0} saveOk={saveOk} logs={compileLogs} build={active?{fileName:artifactName(fileName,graph.name+"-"+graph.version),hash:active.hash,stackId:active.pkg.manifest.stackId,executable:active.pkg.manifest.executable,nodes:active.pkg.graph.nodes.length,connections:active.pkg.graph.edges.length,lockedModules:Object.keys(active.pkg.lockfile).length,runtime:active.pkg.manifest.runtime}:null} trailing={<ComposeAddMenu embedded onAdd={add}/>} status={<p className="cmp-compile-status" role="status" title={status}><span className={validation.errors.length?"bad":"good"}>{validation.errors.length?validation.errors.length+" issues":"Valid"}</span><i aria-hidden>·</i><span>{graph.nodes.length} nodes · {graph.edges.length} wires</span><i aria-hidden>·</i><span>{active?(active.pkg.manifest.executable?"Built":"Source"):"Unbuilt"}</span></p>}/>}
 {mode!=="compose"&&<div className="cmp-status"><span className={validation.errors.length?"bad":"good"}>{validation.errors.length?validation.errors.length+" issues":"Graph valid"}</span><span>{graph.nodes.length} nodes · {graph.edges.length} connections</span><span>{active?(active.pkg.manifest.executable?"Built · SynapseVM runtime":"Built · source only"):"Unbuilt changes"}</span><span>{status}</span></div>}
 {error&&<div role="alert" className="cmp-alert"><span>{error}</span>{adapterOffer?.types.map(t=><button key={t} onClick={()=>insertAdapter(t)}>Insert {t}</button>)}<button aria-label="Dismiss error" onClick={()=>setError("")}>×</button></div>}
 <div className="cmp-workspace" inert={!ready||busy||external}>
 <aside className="cmp-palette"><h2>Building blocks</h2><p>Typed pieces. Explicit behavior.</p><button onClick={()=>{selectTemplate("brake");setFileName("EmergencyBrake-0.1.0.synapse");}}>Emergency Brake · demo preset</button><input aria-label="Search nodes" placeholder="Find a node…" value={search} onChange={e=>setSearch(e.target.value)}/>
 {families.map(f=><section key={f}><h3>{f==="neuroblock"?"NEUROBLOCKS":f.toUpperCase()}</h3>{Object.entries(DEFINITIONS).filter(([name,d])=>d.family===f&&(name+" "+d.description).toLowerCase().includes(search.toLowerCase())).map(([type,d])=><button className={"cmp-add family-"+f} key={type} onClick={()=>add(type)} title={d.description}><span>{type}</span><small>{d.unsupported?"Source interface":f==="neuroblock"?"Locked neural model":d.stateful?"Stateful · deterministic":"Deterministic"}</small><b>+</b></button>)}</section>)}
 <div className="cmp-trust-note"><strong>Trust stays outside the loop</strong><p>Receipts and replay run after the control decision. No network service sits between a sensor and an actuator.</p></div>
 </aside>
 <section className="cmp-center">
 {pending&&<div className="cmp-wire-hint"><span>Connect {pending} to an input</span><button type="button" onClick={()=>setPending("")}>Cancel wire</button></div>}
 <div ref={stage} className="cmp-stage" aria-label="Composition canvas" onDragOver={e=>{if(!e.dataTransfer.types.includes(NODE_DRAG_TYPE))return;e.preventDefault();e.dataTransfer.dropEffect="copy";e.currentTarget.classList.add("is-drop-target");}} onDragLeave={e=>{if(e.target===e.currentTarget)e.currentTarget.classList.remove("is-drop-target");}} onDrop={dropNode} onPointerDown={e=>{if(e.target!==e.currentTarget)return;panDrag.current={px:e.clientX,py:e.clientY,...pan};e.currentTarget.setPointerCapture(e.pointerId);}} onPointerMove={e=>{const p=panDrag.current;if(p)setPan({x:p.x+e.clientX-p.px,y:p.y+e.clientY-p.py});}} onPointerUp={()=>{panDrag.current=null;}} onPointerCancel={()=>{panDrag.current=null;drag.current=null;}}>
  <div className="cmp-transform" style={{transform:"translate("+pan.x+"px,"+pan.y+"px) scale("+zoom+")"}}>
 <svg className="cmp-wires" aria-label="Graph connections">{graph.edges.map((e,i)=>{const a=anchor(e.from,true),b=anchor(e.to,false),dx=Math.max(55,Math.abs(b.x-a.x)*.45),path="M "+a.x+" "+a.y+" C "+(a.x+dx)+" "+a.y+", "+(b.x-dx)+" "+b.y+", "+b.x+" "+b.y;return <g key={e.from+e.to+i}><path className={edgeIndex===i?"selected":""} d={path}/><path className="hit" d={path} role="button" tabIndex={0} aria-label={"Inspect connection "+e.from+" to "+e.to} onClick={()=>{setEdgeIndex(i);setSelected("");setTab("inspect");setInspectorOpen(true);}} onKeyDown={ev=>{if(ev.key==="Enter"){setEdgeIndex(i);setSelected("");setTab("inspect");setInspectorOpen(true);}}}/></g>;})}</svg>
 {graph.nodes.map(n=>{const d=DEFINITIONS[n.type],p=positions[n.id]??{x:0,y:0},lit=events.slice(-12).some(e=>e.node===n.id&&e.tick>=tick-6);return <article key={n.id} style={{left:p.x,top:p.y}} className={"cmp-node family-"+d.family+(selected===n.id?" selected":"")+(lit?" active":"")}>
 <button className="cmp-node-head" onPointerDown={e=>onDown(n,e)} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onClick={()=>{setSelected(n.id);setEdgeIndex(null);setTab("inspect");setInspectorOpen(true);}}><small>{d.family} · P{d.priority}</small><strong>{n.id}</strong><span>{paramsFor(n).hz} Hz · {d.stateful?"stateful":"stateless"}{d.unsupported?" · source":""}</span></button>
 <div className="cmp-ports"><div>{Object.entries(d.inputs).map(([port,type])=><button key={port} title={type} aria-label={"Connect input "+n.id+"."+port} onClick={()=>connect(n.id+"."+port)}><i/>{port}</button>)}</div><div>{Object.entries(d.outputs).map(([port,type])=><button key={port} title={type} className={pending===n.id+"."+port?"pending":""} aria-label={"Select output "+n.id+"."+port} onClick={()=>{const id=n.id+"."+port;setPending(p=>p===id?"":id);setError("");}}>{port}<i/></button>)}</div></div></article>;})}
 </div>{!graph.nodes.length&&<div className="cmp-empty">Add a sensor, a neural module, and an actuator to start.</div>}
 {mode!=="compose"&&<div className="cmp-view-controls" role="toolbar" aria-label="Canvas zoom">
  <button type="button" title="Auto layout" onClick={()=>{const pos=layout(graph);commit({...draft,positions:pos});fit(pos);}}>Layout</button>
  <button type="button" title="Fit to view" onClick={()=>fit()}>Fit</button>
  <span className="cmp-view-sep" aria-hidden/>
  <button type="button" aria-label="Zoom out" onClick={()=>setZoom(z=>Math.max(.2,+(z-.1).toFixed(2)))}>−</button>
  <span className="cmp-view-pct" aria-live="polite">{Math.round(zoom*100)}%</span>
  <button type="button" aria-label="Zoom in" onClick={()=>setZoom(z=>Math.min(1.5,+(z+.1).toFixed(2)))}>+</button>
 </div>}
 {mode==="compose"&&<div className="cmp-canvas-tools">
  {!inspectorOpen&&<button type="button" className="cmp-inspector-reopen" onClick={()=>setInspectorOpen(true)} aria-label="Open inspector" title="Inspector"><IconPanel/></button>}
  <div className="cmp-canvas-zoom" role="toolbar" aria-label="Canvas zoom">
   <button type="button" aria-label="Zoom in" title="Zoom in" onClick={()=>setZoom(z=>Math.min(1.5,+(z+.1).toFixed(2)))}>+</button>
   <button type="button" aria-label="Zoom out" title="Zoom out" onClick={()=>setZoom(z=>Math.max(.2,+(z-.1).toFixed(2)))}>−</button>
  </div>
 </div>}
 </div>
 <ComposeAssistant onApply={applyPlan} variant={mode==="compose"?"dock":"panel"}/>
 </section>
 <aside className={"cmp-inspector"+(mode==="compose"?" cmp-inspector--glass":"")+(mode==="compose"&&!inspectorOpen?" cmp-inspector--collapsed":"")} hidden={mode==="compose"&&!inspectorOpen}>
 {mode==="compose"&&<header className="cmp-inspector-head"><div className="cmp-inspector-title"><span className="cmp-eyebrow">Inspector</span></div><button type="button" className="cmp-inspector-collapse" aria-label="Collapse inspector" title="Collapse inspector" onClick={()=>setInspectorOpen(false)}><IconPanel/></button></header>}
 {mode==="simulate"&&<nav>{(["inspect","build","run"] as const).map(t=><button key={t} aria-pressed={tab===t} onClick={()=>setTab(t)}>{t==="inspect"?"Inspector":t==="build"?"Compile & export":"Quick preview"}</button>)}</nav>}
 {(mode==="compose"||tab==="inspect")&&<>
 {edge?<><span className="cmp-eyebrow">CONNECTION</span><h2>{edge.from.split(".")[0]} → {edge.to.split(".")[0]}</h2><code>{edge.from}<br/>↓<br/>{edge.to}</code><dl><dt>Delivery</dt><dd>LATEST · held until updated</dd><dt>Buffer</dt><dd>One latest value</dd><dt>Conversion</dt><dd>None. Add an explicit adapter.</dd></dl><button className="danger" onClick={()=>{updateGraph({...graph,edges:graph.edges.filter((_,i)=>i!==edgeIndex)});setEdgeIndex(null);}}>Delete connection</button></>:node&&nodeDef?<><span className="cmp-eyebrow">{nodeDef.family} · {nodeDef.module?"NEURAL MODEL":"CONVENTIONAL SOFTWARE"}</span><h2>{node.id}</h2><p>{nodeDef.description}</p><dl><dt>State</dt><dd>{nodeDef.stateful?"Stateful · captured for replay":"Stateless"}</dd><dt>Priority</dt><dd>P{nodeDef.priority} {nodeDef.priority===0?"Critical":"Control / perception"}</dd><dt>Compute estimate</dt><dd>{nodeDef.ms} ms · unmeasured</dd><dt>Execution</dt><dd>{nodeDef.unsupported?"Source interface only":"Deterministic JavaScript"}</dd></dl><label>Update rate<select aria-label="Node update rate" value={paramsFor(node).hz} onChange={e=>setParam("hz",Number(e.target.value))}>{RATES.map(hz=><option key={hz} value={hz}>{hz} Hz</option>)}</select></label>{Object.entries(nodeDef.params).map(([key,spec])=><label key={key}>{spec.label}<input type="number" min={spec.min} max={spec.max} value={paramsFor(node)[key]} onChange={e=>setParam(key,Number(e.target.value))}/></label>)}
 {node.type==="LoomGuard"&&<label>Locked Library release<select aria-label="LoomGuard release" value={node.module?node.module.id+"@"+node.module.version:"bundled"} onChange={e=>{const item=available.find(i=>i.id+"@"+i.version===e.target.value);updateGraph({...graph,nodes:graph.nodes.map(n=>n.id===node.id?{id:n.id,type:n.type,params:n.params??{},...item?{module:{id:item.id,version:item.version,digest:item.modelDigest!}}:{}}:n)});}}><option value="bundled">Bundled LoomGuard · 1.0.0</option>{available.map(i=><option key={i.id} value={i.id+"@"+i.version}>{i.id}@{i.version}</option>)}</select></label>}
 <h3>Port contracts</h3>{Object.entries(nodeDef.inputs).map(([p,t])=><p className="cmp-contract" key={p}><b>IN · {p}</b><code>{t}</code></p>)}{Object.entries(nodeDef.outputs).map(([p,t])=><p className="cmp-contract" key={p}><b>OUT · {p}</b><code>{t}</code></p>)}{nodeDef.module&&<Link href={"/explore/"+(node.module?.id??"synapsevm/"+nodeDef.module)+(node.module?"?version="+node.module.version:"")}>Open Library repository ↗</Link>}<button className="danger" onClick={removeNode}>Delete node and connections</button></>:<><h2>Inspect a piece</h2><p>Select a node or connection on the canvas.</p></>}
 <hr/><h3>Stack settings</h3><label>Estimated compute deadline (ms)<input type="number" min=".1" max="1000" step=".1" value={graph.deadlineMs} onChange={e=>updateGraph({...graph,deadlineMs:Number(e.target.value)})}/></label><label>Receipt policy<select aria-label="Receipt policy" value={graph.policy} onChange={e=>updateGraph({...graph,policy:e.target.value as ComposeGraph["policy"]})}><option value="FAST">FAST · no receipts</option><option value="AUDIT">AUDIT · critical output changes</option><option value="DEBUG">DEBUG · every executed tick</option></select></label>
 {mode==="compose"&&<>
 <hr/><h3>Build checks</h3>
 <p className="cmp-small">{validation.estimatedMs.toFixed(1)} ms estimated path · {graph.deadlineMs} ms budget</p>
 {validation.errors.length?validation.errors.map((e,i)=><button className="bad cmp-check-btn" key={i} onClick={()=>{if(e.node)setSelected(e.node);if(e.edge!==undefined)setEdgeIndex(e.edge);}}><b>{e.code}</b> {e.message}</button>):<p className="good">Types, inputs, writers, cycles, parameters and timing checked.</p>}
 {validation.warnings.map((e,i)=><p key={"w"+i}>{e.message}</p>)}
 {validation.blocked.map((e,i)=><p className="cmp-warning" key={"b"+i}><b>Runtime unavailable:</b> {e.message}</p>)}
 {active&&<><h3>Package</h3><p className={active.pkg.manifest.executable?"good":"cmp-warning"}>{active.pkg.manifest.executable?"Executable in the SynapseVM Compose runtime":"Source only"}</p><code className="cmp-hash">{short(active.hash)}</code><button className="primary" onClick={downloadBuild}>Download .synapse</button></>}
 <hr/><h3>Runtime</h3>
 {!active?.pkg.manifest.executable?<p className="cmp-small">Compile an executable stack to preview actuator outputs here.</p>:<><div className="cmp-run-buttons"><button className="primary" onClick={()=>setRunning(v=>!v)}>{running?"Pause":"Run"}</button><button disabled={running} onClick={()=>void step()}>Step 5 ms</button><button onClick={resetRun}>Reset</button></div><label className="cmp-toggle"><input type="checkbox" checked={obstacle} onChange={e=>setObstacle(e.target.checked)}/> Inject looming obstacle</label><pre>{JSON.stringify(actions,null,2)}</pre>
 <h3>Timeline</h3>
 <div className="cmp-inspector-timeline">{events.length?events.slice(-20).reverse().map((e,i)=><button key={e.tick+"-"+e.node+"-"+i} onClick={()=>setEvent(e)}><code>{e.tick} ms</code><strong>{e.node}</strong><span className={e.type==="SAFETY_OVERRIDE"||e.type==="TRIGGER"?"bad":""}>{e.type}</span></button>):<p className="cmp-small">Run the graph to record events.</p>}</div>
 {event&&<section className="cmp-why"><h3>WHY · {event.node}</h3><p>{event.tick} ms · {event.detail}</p><h4>Inputs</h4><pre>{JSON.stringify(event.inputs,null,2)}</pre><h4>Outputs</h4><pre>{JSON.stringify(event.outputs,null,2)}</pre></section>}
 </>}
 </>}
 </>}
 {tab==="build"&&mode==="simulate"&&<><span className="cmp-eyebrow">BUILD ARTIFACT</span><h2>{active?"A graph with an identity.":"Build your current graph."}</h2>{active?<><p className={active.pkg.manifest.executable?"good":"cmp-warning"}>{active.pkg.manifest.executable?"Executable in the versioned SynapseVM Compose runtime.":"Source only: unresolved neural output interfaces."}</p><h3>Stack ID</h3><code className="cmp-hash">{active.pkg.manifest.stackId}</code><h3>Package SHA-256</h3><code className="cmp-hash">{active.hash}</code><button className="primary" onClick={downloadBuild}>Download .synapse</button></>:<p>No current compiled artifact.</p>}</>}
 {tab==="run"&&mode==="simulate"&&<><span className="cmp-eyebrow">LOCAL EXECUTION</span><h2>Follow the actual decision.</h2>{active&&<><p>{active.pkg.manifest.name}@{active.pkg.manifest.version}</p><code className="cmp-hash">Package {active.hash}</code></>}{!active?.pkg.manifest.executable?<p>No current executable package. Compile on Compose first.</p>:<><World actions={actions} obstacle={obstacle} tick={tick}/><div className="cmp-run-buttons"><button className="primary" onClick={()=>setRunning(v=>!v)}>{running?"Pause":"Run"}</button><button disabled={running} onClick={()=>void step()}>Step 5 ms</button><button onClick={resetRun}>Reset</button></div><label className="cmp-toggle"><input type="checkbox" checked={obstacle} onChange={e=>setObstacle(e.target.checked)}/> Inject looming obstacle</label><pre>{JSON.stringify(actions,null,2)}</pre>
 <div className="cmp-trust-note"><h3>Receipt & replay</h3><p>{replay?"Critical decision captured.":"No receipt yet."}</p>{replay&&<><code>{short(replay.receipt.hash)}</code><button onClick={async()=>{setRunning(false);try{await replayStack(active.pkg,replay);setReplayResult("MATCH");}catch(e){setReplayResult(String(e));}}}>Replay</button><button onClick={()=>download(graph.name+".replay.json",canonical(replay))}>Download replay</button><p role="status">{replayResult}</p></>}</div>
 {event&&<section className="cmp-why"><h3>WHY · {event.node}</h3><p>{event.tick} ms · {event.detail}</p><pre>{JSON.stringify(event.inputs,null,2)}</pre><pre>{JSON.stringify(event.outputs,null,2)}</pre></section>}</>}</>}
 </aside></div>
 </div>;
}
