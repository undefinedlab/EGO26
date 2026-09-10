import {canonical,digest,importPackage as importLegacy,NODE_DEFS as LEGACY} from "./stackCompiler";
import {validateBlock,type BlockJson} from "./synapseVm";
export {canonical,digest};
export const ENGINE="synapsevm-compose-js-v1";
export type Family="sensor"|"adapter"|"neuroblock"|"control"|"state"|"actuator";
export type NodeDef={family:Family;inputs:Record<string,string>;outputs:Record<string,string>;description:string;hz:number;ms:number;priority:number;stateful:boolean;module?:string;unsupported?:string;params:Record<string,{value:number;min:number;max:number;label:string}>};
const def=(family:Family,inputs:Record<string,string>,outputs:Record<string,string>,description:string,extra:Partial<NodeDef>={}):NodeDef=>({family,inputs,outputs,description,hz:200,ms:0.1,priority:1,stateful:false,params:{},...extra});
const event="EventVision/v1",avoid="AvoidanceSignal/v1",control="ControlVector/v1",steer="SteeringCommand/v1";
export const DEFINITIONS:Record<string,NodeDef>={
 WorldState:def("sensor",{}, {world:"WorldState/v1"},"Recorded simulator features: obstacle proximity and looming, in Q16.16.",{ms:0.2,priority:0}),
 WorldToEvents:def("adapter",{world:"WorldState/v1"},{events:event},"Explicit simulator feature encoder. Maps proximity and looming to four neural input channels.",{ms:0.3,priority:0}),
 EventCamera:def("sensor",{},{events:event},"Pre-encoded features [depth_front, depth_left, depth_right, loom]. Not raw camera frames.",{ms:1,priority:0}),
 IMU:def("sensor",{},{heading:"HeadingDelta/v1"},"Recorded yaw delta in Q16.16.",{ms:0.2}),
 SteeringInput:def("sensor",{},{steering:steer},"Recorded nominal steering and visibility. Conventional input, not a neural model."),
 LoomGuard:def("neuroblock",{event_vision:event},{avoidance_vector:avoid},"Runs the exact locked LoomGuard model bytes with the fixed-point neural runtime.",{ms:2,priority:0,stateful:true,module:"loomguard"}),
 Arbiter:def("control",{nominal:steer,override:avoid},{command:control},"Safety override wins when triggered or danger meets the configured threshold; otherwise use nominal steering.",{priority:0,params:{threshold:{value:52429,min:0,max:131072,label:"Danger threshold · Q16"},speed:{value:32768,min:0,max:65536,label:"Nominal speed · Q16"}}}),
 SafetyGate:def("control",{safety:avoid},{command:control},"Stop forward motion on a neural trigger or danger threshold. Preserve the neural avoidance direction.",{priority:0,params:{threshold:{value:52429,min:0,max:131072,label:"Danger threshold · Q16"},speed:{value:32768,min:0,max:65536,label:"Cruise speed · Q16"}}}),
 BrakeDecoder:def("adapter",{control},{brake:"BrakeCommand/v1"},"Map emergency or zero-speed commands to full brake.",{priority:0}),
 Clamp:def("control",{control},{command:control},"Limit steering magnitude; preserve speed and emergency flag.",{params:{limit:{value:32768,min:0,max:65536,label:"Steering limit · Q16"}}}),
 PreviousValue:def("state",{control},{previous:control},"One scheduled-update delay. Initial output is STOP. Input is committed after the current graph step.",{stateful:true,priority:0}),
 DroneControl:def("actuator",{control},{},"Simulated drone command: steer, speed and emergency.",{ms:0.5,priority:0}),
 RoverSteering:def("actuator",{control},{},"Simulated rover command: steer, speed and emergency.",{ms:0.5,priority:0}),
 CarBrake:def("actuator",{brake:"BrakeCommand/v1"},{},"Simulated brake command. No physical vehicle driver.",{ms:0.5,priority:0}),
};
for(const type of ["FlowSense","HeadingCell","TargetTrack"]){
 const d=LEGACY[type];DEFINITIONS[type]=def("neuroblock",d.inputs,d.outputs,"Source interface from the building-block specification.",{module:d.module,ms:d.estimatedMs,priority:d.priority,stateful:true,unsupported:"The bundled model exposes the shared reflex decoder, not this declared "+Object.values(d.outputs).join(", ")+" interface."});
}
export type ModuleRef={id:string;version:string;digest:string};
export type ComposeNode={id:string;type:string;params?:Record<string,number>;module?:ModuleRef};
export type ComposeEdge={from:string;to:string;mode?:"LATEST"};
export type ComposeGraph={name:string;version:string;deadlineMs:number;policy:"FAST"|"AUDIT"|"DEBUG";nodes:ComposeNode[];edges:ComposeEdge[]};
export type Issue={code:string;message:string;node?:string;edge?:number};
export const RATES=[25,50,100,125,200,250,500,1000];
export function paramsFor(n:ComposeNode):Record<string,number>{const d=DEFINITIONS[n.type];return {hz:d.hz,...Object.fromEntries(Object.entries(d.params).map(([k,v])=>[k,v.value])),...n.params};}
export function moduleKey(n:ComposeNode){return n.module?n.module.id+"@"+n.module.version:DEFINITIONS[n.type].module!;}
const idPattern=/^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v);
export function checkGraph(value:unknown){
 const errors:Issue[]=[],warnings:Issue[]=[],blocked:Issue[]=[];const fail=(code:string,message:string,node?:string,edge?:number)=>errors.push({code,message,...node?{node}:{},...edge!==undefined?{edge}:{}});
 const empty={errors,warnings,blocked,order:[] as string[],estimatedMs:0};
 if(!record(value)||!Array.isArray(value.nodes)||!Array.isArray(value.edges)){fail("GRAPH","Expected a graph with nodes and edges.");return empty;}
 const g=value as unknown as ComposeGraph;
 if(!idPattern.test(g.name)||typeof g.name!=="string"||typeof g.version!=="string"||!/^(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})$/.test(g.version))fail("IDENTITY","Use a simple name and major.minor.patch version.");
 if(!["FAST","AUDIT","DEBUG"].includes(g.policy))fail("POLICY","Select FAST, AUDIT or DEBUG.");
 if(!Number.isFinite(g.deadlineMs)||g.deadlineMs<=0||g.deadlineMs>1000)fail("DEADLINE","Deadline must be between 0 and 1000 ms.");
 if(g.nodes.length<1||g.nodes.length>64||g.edges.length>256){fail("LIMIT","Use 1–64 nodes and at most 256 connections.");return empty;}
 const nodes=new Map<string,ComposeNode>();
 for(const raw of g.nodes){
  if(!record(raw)||typeof raw.id!=="string"||!idPattern.test(raw.id)||nodes.has(raw.id)||typeof raw.type!=="string"||!Object.hasOwn(DEFINITIONS,raw.type)){fail("NODE","Invalid, unknown or duplicate node.");continue;}
  const n=raw as ComposeNode,d=DEFINITIONS[n.type];nodes.set(n.id,n);
  if(n.params!==undefined&&(!record(n.params)||Object.entries(n.params).some(([k,v])=>!Number.isInteger(v)||(k==="hz"?!RATES.includes(v):!d.params[k]||v<d.params[k].min||v>d.params[k].max))))fail("PARAMETER","Unsupported parameter or value on "+n.id,n.id);
  if(n.module&&(!d.module||!record(n.module)||typeof n.module.id!=="string"||!/^[-a-z0-9_]+\/[-a-z0-9_]+$/.test(n.module.id)||typeof n.module.version!=="string"||!/^\d+\.\d+\.\d+$/.test(n.module.version)||!/^sha256:[a-f0-9]{64}$/.test(n.module.digest)))fail("MODULE","Invalid pinned module reference.",n.id);
  if(d.unsupported)blocked.push({code:"ABI",node:n.id,message:n.id+": "+d.unsupported});
 }
 if(errors.some(e=>e.code==="NODE"||e.code==="PARAMETER"||e.code==="MODULE"))return empty;
 const writers=new Map<string,string>(),next=new Map(g.nodes.map(n=>[n.id,[] as string[]])),indegree=new Map(g.nodes.map(n=>[n.id,0]));
 for(const [i,e] of g.edges.entries()){
  if(!record(e)||typeof e.from!=="string"||typeof e.to!=="string"){fail("EDGE","Malformed connection.",undefined,i);continue;}
  const a=e.from.split("."),b=e.to.split("."),src=nodes.get(a[0]),dst=nodes.get(b[0]);
  const out=src&&DEFINITIONS[src.type].outputs[a[1]],input=dst&&DEFINITIONS[dst.type].inputs[b[1]];
  if(a.length!==2||b.length!==2||!out||!input||out!==input){fail("TYPE",e.from+" → "+e.to+": incompatible ports.",b[0],i);continue;}
  if(e.mode!==undefined&&e.mode!=="LATEST")fail("DELIVERY","Only explicit LATEST delivery is implemented.",undefined,i);
  if(writers.has(e.to))fail("WRITERS",e.to+" already has a source. Insert an arbiter.",b[0],i);
  writers.set(e.to,a[0]);
  if(dst!.type!=="PreviousValue"){next.get(a[0])!.push(b[0]);indegree.set(b[0],indegree.get(b[0])!+1);}
 }
 for(const n of g.nodes){
  const d=DEFINITIONS[n.type];
  for(const p of Object.keys(d.inputs))if(!writers.has(n.id+"."+p))fail("MISSING_INPUT",n.id+"."+p+" needs a source.",n.id);
  if(d.family!=="actuator"&&!g.edges.some(e=>e.from?.startsWith(n.id+".")))warnings.push({code:"UNUSED",node:n.id,message:n.id+" does not feed another node."});
  if(n.type==="LoomGuard"&&paramsFor(n).hz<100)fail("RATE","LoomGuard requires at least 100 Hz.",n.id);
 }
 if(!g.nodes.some(n=>DEFINITIONS[n.type].family==="actuator"))fail("ACTUATOR","Add an actuator.");
 const ready=g.nodes.filter(n=>indegree.get(n.id)===0).map(n=>n.id),order:string[]=[],latency=new Map<string,number>(),effectiveRate=new Map<string,number>();
 while(ready.length){ready.sort((a,b)=>DEFINITIONS[nodes.get(a)!.type].priority-DEFINITIONS[nodes.get(b)!.type].priority||(a<b?-1:1));const id=ready.shift()!,n=nodes.get(id)!,d=DEFINITIONS[n.type];order.push(id);
  const parents=n.type==="PreviousValue"?[]:Object.keys(d.inputs).map(p=>writers.get(id+"."+p)).filter((p):p is string=>!!p);
  latency.set(id,Math.max(0,...parents.map(p=>latency.get(p)??0))+d.ms);
  effectiveRate.set(id,Math.min(paramsFor(n).hz,...parents.map(p=>effectiveRate.get(p)??paramsFor(n).hz)));
  if(n.type==="LoomGuard"&&effectiveRate.get(id)!<100)fail("RATE",id+" receives fresh sensor data below 100 Hz through its adapters.",id);
  for(const parent of parents){const src=nodes.get(parent)!;if(paramsFor(src).hz<paramsFor(n).hz)warnings.push({code:"HELD_INPUT",node:id,message:id+" runs at "+paramsFor(n).hz+" Hz and holds "+parent+"'s "+paramsFor(src).hz+" Hz values."});if(n.type==="LoomGuard"&&paramsFor(src).hz<100)fail("RATE",id+" receives less than 100 Hz.",id);}
  for(const dst of next.get(id)!){indegree.set(dst,indegree.get(dst)!-1);if(indegree.get(dst)===0)ready.push(dst);}
 }
 if(order.length!==g.nodes.length)fail("CYCLE","Implicit cycle. Route feedback through PreviousValue.");
 const estimatedMs=Math.round(Math.max(0,...latency.values())*1000)/1000;
 if(estimatedMs>g.deadlineMs)fail("DEADLINE","Estimated critical path "+estimatedMs+" ms exceeds "+g.deadlineMs+" ms.");
 return {errors,warnings,blocked,order,estimatedMs};
}
export function connectionProblem(g:ComposeGraph,from:string,to:string){
 const candidate={...g,edges:[...g.edges,{from,to,mode:"LATEST" as const}]};
 return checkGraph(candidate).errors.find(e=>e.edge===g.edges.length||e.code==="CYCLE")?.message??null;
}
export function suggestAdapter(g:ComposeGraph,from:string,to:string){
 const [a,p]=from.split("."),[b,q]=to.split("."),src=g.nodes.find(n=>n.id===a),dst=g.nodes.find(n=>n.id===b);if(!src||!dst)return [];
 const out=DEFINITIONS[src.type].outputs[p],input=DEFINITIONS[dst.type].inputs[q];
 return Object.entries(DEFINITIONS).filter(([,d])=>d.family==="adapter"&&Object.values(d.inputs).includes(out)&&Object.values(d.outputs).includes(input)).map(([name])=>name);
}
export type ComposePackage={format:"synapsevm.compose-package.v1";manifest:{kind:"NeuroStack";name:string;version:string;stackId:string;runtime:typeof ENGINE;executable:boolean;signature:null};graph:ComposeGraph;lockfile:Record<string,{version:string;digest:string}>;modules:Record<string,string>;runtimePlan:{order:string[];clockHz:1000;periods:Record<string,number>;delivery:"LATEST";stateCommit:"AFTER_TICK";estimatedCriticalPathMs:number;executable:boolean};verification:{policy:ComposeGraph["policy"];scope:"local-unsigned-replay";};};
export async function buildStack(g:ComposeGraph,load:(key:string)=>Promise<string>):Promise<ComposePackage>{
 const c=checkGraph(g);if(c.errors.length)throw Error(c.errors.map(e=>e.message).join("\n"));
 const graph:ComposeGraph={name:g.name,version:g.version,deadlineMs:g.deadlineMs,policy:g.policy,nodes:g.nodes.map(n=>({id:n.id,type:n.type,params:paramsFor(n),...n.module?{module:{...n.module}}:{}})).sort((a,b)=>a.id<b.id?-1:1),edges:g.edges.map(e=>({from:e.from,to:e.to,mode:"LATEST" as const})).sort((a,b)=>(a.from+">"+a.to)<(b.from+">"+b.to)?-1:1)};
 const modules:Record<string,string>={},lockfile:ComposePackage["lockfile"]={};
 for(const n of graph.nodes.filter(n=>DEFINITIONS[n.type].module)){const key=moduleKey(n);if(Object.hasOwn(modules,key)){if(n.module&&lockfile[key].digest!==n.module.digest)throw Error("Conflicting module locks: "+key);continue;}const raw=await load(key);if(new TextEncoder().encode(raw).length>4_000_000)throw Error("Module exceeds 4 MB.");const b=JSON.parse(raw) as BlockJson;validateBlock(b);if(b.neuronCount>10000||b.csrPres.length>200000)throw Error("Module exceeds browser execution limits.");const hash=await digest(raw);if(n.module?hash!==n.module.digest:b.name.toLowerCase()!==key||b.version!=="1.0.0")throw Error("Locked module identity mismatch: "+key);
 if(n.type==="LoomGuard"&&canonical(b.inputChannels.map(c=>c.name))!==canonical(["depth_front","depth_left","depth_right","loom"]))throw Error("LoomGuard requires the four-channel feature ABI.");
 modules[key]=raw;lockfile[key]={version:n.module?.version??b.version,digest:hash};}
 const executable=c.blocked.length===0,runtimePlan:ComposePackage["runtimePlan"]={order:c.order,clockHz:1000,periods:Object.fromEntries(graph.nodes.map(n=>[n.id,1000/paramsFor(n).hz])),delivery:"LATEST",stateCommit:"AFTER_TICK",estimatedCriticalPathMs:c.estimatedMs,executable};
 const verification:ComposePackage["verification"]={policy:graph.policy,scope:"local-unsigned-replay"};
 const stackId=await digest(canonical({runtime:ENGINE,graph:{nodes:graph.nodes,edges:graph.edges,deadlineMs:graph.deadlineMs,policy:graph.policy},lockfile,runtimePlan,verification}));
 return {format:"synapsevm.compose-package.v1",manifest:{kind:"NeuroStack",name:graph.name,version:graph.version,stackId,runtime:ENGINE,executable,signature:null},graph,lockfile,modules,runtimePlan,verification};
}
export async function importStack(raw:string):Promise<ComposePackage>{
 if(new TextEncoder().encode(raw).length>20_000_000)throw Error("Package exceeds 20 MB.");
 const p=JSON.parse(raw);if(p?.format==="synapsevm.source-package.v1"){const legacy=await importLegacy(raw);return buildStack({...legacy.graph,policy:"AUDIT"},async k=>legacy.modules[k]);}
 if(p?.format!=="synapsevm.compose-package.v1")throw Error("Unsupported Stack package.");
 const rebuilt=await buildStack(p.graph,async key=>{if(typeof p.modules?.[key]!=="string")throw Error("Missing module "+key);return p.modules[key];});
 if(canonical(p)!==canonical(rebuilt))throw Error("Package integrity mismatch.");
 return rebuilt;
}
export function template(kind="shield"):ComposeGraph {
 const graph:ComposeGraph={name:"CollisionShield",version:"0.1.0",deadlineMs:10,policy:"AUDIT",nodes:[],edges:[]};
 const add=(id:string,type=id)=>graph.nodes.push({id,type}),wire=(from:string,to:string)=>graph.edges.push({from,to,mode:"LATEST"});
 if(kind==="biopilot"){graph.name="BioPilot";["EventCamera","IMU","LoomGuard","FlowSense","TargetTrack","HeadingCell","Arbiter","DroneControl"].forEach(x=>add(x));[["EventCamera.events","LoomGuard.event_vision"],["EventCamera.events","FlowSense.event_vision"],["EventCamera.events","TargetTrack.event_vision"],["IMU.heading","HeadingCell.heading_delta"],["FlowSense.optic_flow","HeadingCell.optic_flow"],["TargetTrack.target_bearing","HeadingCell.target_bearing"],["HeadingCell.steering_command","Arbiter.nominal"],["LoomGuard.avoidance_vector","Arbiter.override"],["Arbiter.command","DroneControl.control"]].forEach(([a,b])=>wire(a,b));return graph;}
 if(kind==="empty"){graph.name="Untitled";return graph;}
 ["WorldState","WorldToEvents","LoomGuard"].forEach(x=>add(x));wire("WorldState.world","WorldToEvents.world");wire("WorldToEvents.events","LoomGuard.event_vision");
 if(kind==="arbiter"){graph.name="SafetyOverride";["SteeringInput","Arbiter","RoverSteering"].forEach(x=>add(x));wire("SteeringInput.steering","Arbiter.nominal");wire("LoomGuard.avoidance_vector","Arbiter.override");wire("Arbiter.command","RoverSteering.control");}
 else {add("SafetyGate");wire("LoomGuard.avoidance_vector","SafetyGate.safety");if(kind==="brake"){graph.name="EmergencyBrake";add("BrakeDecoder");add("CarBrake");wire("SafetyGate.command","BrakeDecoder.control");wire("BrakeDecoder.brake","CarBrake.brake");}else {add("DroneControl");wire("SafetyGate.command","DroneControl.control");}}
 return graph;
}
