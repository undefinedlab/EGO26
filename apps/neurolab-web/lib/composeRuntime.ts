import {DEFINITIONS,ENGINE,canonical,digest,importStack,moduleKey,paramsFor,type ComposePackage} from "./composeCompiler";
import {SynapseVmJs,type StepView} from "./synapseVm";
export type Signal={kind:string;values:number[]};
export type Inputs=Record<string,Signal>;
export type RuntimeEvent={node:string;tick:number;type:string;inputs:Inputs;outputs:Inputs;detail:string;moduleId?:string;fired?:number;trace?:number[]};
export type StackState={tick:number;neurons:Record<string,number[]>;values:Inputs;delays:Inputs;lastActions:Inputs;receiptSequence:number;previousReceiptHash:string|null};
export type StackReceipt={format:"synapsevm.stack-receipt.v1";stackId:string;packageHash:string;runtime:string;tick:number;sequence:number;previousReceiptHash:string|null;inputCommitment:string;stateBeforeRoot:string;stateAfterRoot:string;events:RuntimeEvent[];actions:Inputs;signature:null;hash:string};
export type ReplayBundle={format:"synapsevm.stack-replay.v1";stackId:string;input:Inputs;before:StackState;receipt:StackReceipt};
export type StepResult={tick:number;events:RuntimeEvent[];actions:Inputs;receipt:StackReceipt|null;replay:ReplayBundle|null};
const int=(x:number)=>Number.isInteger(x)&&x>=-2147483648&&x<=2147483647;
const signal=(kind:string,...values:number[]):Signal=>({kind,values});
const stop=()=>signal("ControlVector/v1",0,0,0);
const emergency=(s:Signal)=>s.kind==="BrakeCommand/v1"?s.values[0]>0:!!s.values[2];
function validateSignal(s:Signal,kind:string){
 const lengths:Record<string,number>={"WorldState/v1":4,"EventVision/v1":4,"HeadingDelta/v1":1,"SteeringCommand/v1":2,"AvoidanceSignal/v1":4,"ControlVector/v1":3,"BrakeCommand/v1":1};
 if(!s||s.kind!==kind||!Array.isArray(s.values)||s.values.length!==lengths[kind]||!s.values.every(int))throw Error("Invalid "+kind+" signal.");
 if(["WorldState/v1","EventVision/v1"].includes(kind)&&s.values.some(v=>v<0||v>65536))throw Error("Sensor features must be Q16 values between 0 and 65536.");
 if(kind==="SteeringCommand/v1"&&(Math.abs(s.values[0])>65536||![0,1].includes(s.values[1])))throw Error("Steering input requires [-65536,65536] steer and 0/1 visibility.");
}
export class CompiledStack {
 private pkg:ComposePackage;private packageHash:Promise<string>;private vms=new Map<string,SynapseVmJs>();private busy=false;
 private state:StackState={tick:0,neurons:{},values:{},delays:{},lastActions:{},receiptSequence:0,previousReceiptHash:null};
 constructor(pkg:ComposePackage){
  this.pkg=structuredClone(pkg);this.packageHash=digest(canonical(this.pkg));if(!pkg.manifest.executable)throw Error("This package has unresolved runtime interfaces. It is source-only.");
  for(const n of pkg.graph.nodes){if(DEFINITIONS[n.type].module)this.vms.set(n.id,new SynapseVmJs(JSON.parse(pkg.modules[moduleKey(n)])));if(n.type==="PreviousValue")this.state.delays[n.id]=stop();}
 }
 snapshot():StackState{if(this.busy)throw Error("Runtime is stepping.");return this.capture();}
 private capture():StackState{return structuredClone({...this.state,neurons:Object.fromEntries([...this.vms].map(([id,vm])=>[id,Array.from(vm.snapshot())]))});}
 restore(s:StackState){
  if(this.busy)throw Error("Runtime is stepping.");
  if(!s||!Number.isSafeInteger(s.tick)||s.tick<0||!Number.isSafeInteger(s.receiptSequence)||s.receiptSequence<0||!(s.previousReceiptHash===null||/^sha256:[a-f0-9]{64}$/.test(s.previousReceiptHash)))throw Error("Invalid Stack state.");
  if(canonical(Object.keys(s.neurons).sort())!==canonical([...this.vms.keys()].sort()))throw Error("State modules do not match.");
  const expectedDelays=this.pkg.graph.nodes.filter(n=>n.type==="PreviousValue").map(n=>n.id).sort();if(canonical(Object.keys(s.delays).sort())!==canonical(expectedDelays))throw Error("State delays do not match.");
  for(const v of Object.values(s.delays))validateSignal(v,"ControlVector/v1");
  for(const [port,v] of Object.entries(s.values)){const [id,p]=port.split(".");const n=this.pkg.graph.nodes.find(n=>n.id===id);const type=n&&DEFINITIONS[n.type].outputs[p];if(!type)throw Error("Unknown state port.");validateSignal(v,type);}
  for(const [id,v] of Object.entries(s.lastActions)){const n=this.pkg.graph.nodes.find(n=>n.id===id);if(!n||DEFINITIONS[n.type].family!=="actuator")throw Error("Unknown state actuator.");validateSignal(v,Object.values(DEFINITIONS[n.type].inputs)[0]);}
  const testVms=new Map<string,SynapseVmJs>();
  for(const [id,vm] of this.vms){if(!Array.isArray(s.neurons[id])||!s.neurons[id].every(v=>Number.isInteger(v)&&v>=0&&v<=255))throw Error("Invalid neural state bytes.");const temp=new SynapseVmJs(vm.block);temp.restore(new Uint8Array(s.neurons[id]));testVms.set(id,temp);}
  this.vms=testVms;this.state=structuredClone(s);
 }
 reset(){if(this.busy)throw Error("Runtime is stepping.");for(const vm of this.vms.values())vm.reset();this.state={tick:0,neurons:{},values:{},delays:Object.fromEntries(this.pkg.graph.nodes.filter(n=>n.type==="PreviousValue").map(n=>[n.id,stop()])),lastActions:{},receiptSequence:0,previousReceiptHash:null};}
 async step(input:Inputs):Promise<StepResult>{
  if(this.busy)throw Error("Concurrent step is not supported.");
  if(!input||typeof input!=="object")throw Error("Expected recorded sensor inputs.");
  input=structuredClone(input);
  // Validate every due sensor before touching neural or graph state.
  for(const n of this.pkg.graph.nodes.filter(n=>DEFINITIONS[n.type].family==="sensor"&&this.state.tick%this.pkg.runtimePlan.periods[n.id]===0)){validateSignal(input[n.id],Object.values(DEFINITIONS[n.type].outputs)[0]);}
  this.busy=true;const before=this.capture(),tick=this.state.tick,events:RuntimeEvent[]=[];
  try{
   for(const id of this.pkg.runtimePlan.order){
    if(tick%this.pkg.runtimePlan.periods[id]!==0)continue;
    const n=this.pkg.graph.nodes.find(n=>n.id===id)!,d=DEFINITIONS[n.type],p=paramsFor(n),inputs:Inputs={},outputs:Inputs={};
    if(n.type!=="PreviousValue")for(const port of Object.keys(d.inputs)){const e=this.pkg.graph.edges.find(e=>e.to===id+"."+port)!;const v=this.state.values[e.from];if(!v)throw Error("No value available for "+id+"."+port);inputs[port]=structuredClone(v);}
    let detail="",type="UPDATE",view:StepView|undefined;
    if(d.family==="sensor"){outputs[Object.keys(d.outputs)[0]]=structuredClone(input[id]);detail="Recorded sensor input";}
    else switch(n.type){
     case "WorldToEvents":outputs.events=signal("EventVision/v1",...inputs.world.values);detail="Encoded four simulator features";break;
     case "LoomGuard":view=this.vms.get(id)!.step(inputs.event_vision.values,tick);outputs.avoidance_vector=signal("AvoidanceSignal/v1",view.danger,view.avoidX,view.avoidY,Number(view.trigger));type=view.trigger?"TRIGGER":"NEURAL_STEP";detail=view.trigger?"Neural trigger active":"Neural state advanced";break;
     case "Arbiter":case "SafetyGate":{
      const safety=inputs[n.type==="Arbiter"?"override":"safety"].values,nominal=inputs.nominal?.values??[0,1],active=!!safety[3]||safety[0]>=p.threshold;
      outputs.command=signal("ControlVector/v1",active?safety[1]:nominal[1]?nominal[0]:0,active?0:p.speed,Number(active));type=active?"SAFETY_OVERRIDE":"NOMINAL";detail=active?"Safety selected; forward speed set to zero":nominal[1]?"Nominal control selected":"No visible target; maintain heading";break;}
     case "BrakeDecoder":outputs.brake=signal("BrakeCommand/v1",inputs.control.values[2]||inputs.control.values[1]===0?65536:0);detail="Decoded brake command";break;
     case "Clamp":outputs.command=signal("ControlVector/v1",Math.max(-p.limit,Math.min(p.limit,inputs.control.values[0])),...inputs.control.values.slice(1));detail="Steering clamped";break;
     case "PreviousValue":outputs.previous=structuredClone(this.state.delays[id]);detail="Previous scheduled value";break;
     case "DroneControl":case "RoverSteering":case "CarBrake":this.state.lastActions[id]=structuredClone(Object.values(inputs)[0]);type="ACTUATOR";detail=emergency(this.state.lastActions[id])?"STOP / safety action":"Nominal action";break;
     default:throw Error("Unsupported runtime node "+n.type);
    }
    for(const [port,v] of Object.entries(outputs)){validateSignal(v,d.outputs[port]);this.state.values[id+"."+port]=v;}
    events.push({node:id,tick,type,inputs,outputs,detail,...view?{moduleId:this.pkg.lockfile[moduleKey(n)].digest,fired:view.firedCount,trace:view.traceNeuronIds.slice(0,64)}:{}});
   }
   for(const n of this.pkg.graph.nodes.filter(n=>n.type==="PreviousValue"&&tick%this.pkg.runtimePlan.periods[n.id]===0)){const e=this.pkg.graph.edges.find(e=>e.to===n.id+".control")!;const v=this.state.values[e.from];if(!v)throw Error("No delayed input value.");this.state.delays[n.id]=structuredClone(v);}
   this.state.tick++;
   const actions=structuredClone(this.state.lastActions),changed=canonical(actions)!==canonical(before.lastActions),critical=changed&&Object.values(actions).some(emergency);
   let receipt:StackReceipt|null=null,replay:ReplayBundle|null=null;
   if(this.pkg.graph.policy==="DEBUG"&&events.length||this.pkg.graph.policy==="AUDIT"&&critical){
    const content={format:"synapsevm.stack-receipt.v1" as const,stackId:this.pkg.manifest.stackId,packageHash:await this.packageHash,runtime:ENGINE,tick,sequence:this.state.receiptSequence,previousReceiptHash:this.state.previousReceiptHash,inputCommitment:await digest(canonical(input)),stateBeforeRoot:await digest(canonical(before)),stateAfterRoot:await digest(canonical(this.capture())),events,actions,signature:null};
    receipt={...content,hash:await digest(canonical(content))};replay={format:"synapsevm.stack-replay.v1",stackId:this.pkg.manifest.stackId,input:structuredClone(input),before,receipt};this.state.receiptSequence++;this.state.previousReceiptHash=receipt.hash;
   }
   return {tick,events,actions,receipt,replay};
  }catch(e){this.busy=false;this.restore(before);throw e;}finally{this.busy=false;}
 }
}
export async function loadCompiledStack(raw:string|ComposePackage){const pkg=await importStack(typeof raw==="string"?raw:canonical(raw));return new CompiledStack(pkg);}
export async function replayStack(pkg:ComposePackage,bundle:ReplayBundle){
 if(!bundle||bundle.format!=="synapsevm.stack-replay.v1"||bundle.stackId!==pkg.manifest.stackId)throw Error("Replay belongs to a different Stack.");
 const runtime=await loadCompiledStack(pkg);runtime.restore(bundle.before);const result=await runtime.step(bundle.input);if(!result.receipt||canonical(result.receipt)!==canonical(bundle.receipt))throw Error("Replay mismatch: input, state, decision, action or receipt differs.");
 return {matched:true,receiptHash:result.receipt.hash,stackId:pkg.manifest.stackId};
}
export function scenarioInput(pkg:ComposePackage,obstacle:boolean,steering=19661):Inputs{
 return Object.fromEntries(pkg.graph.nodes.filter(n=>DEFINITIONS[n.type].family==="sensor").map(n=>[n.id,n.type==="WorldState"?signal("WorldState/v1",obstacle?52429:0,0,0,obstacle?39322:0):n.type==="EventCamera"?signal("EventVision/v1",obstacle?52429:0,0,0,obstacle?39322:0):n.type==="SteeringInput"?signal("SteeringCommand/v1",steering,1):signal("HeadingDelta/v1",0)]));
}
