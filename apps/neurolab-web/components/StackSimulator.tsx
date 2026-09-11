"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import {useEffect,useRef,useState} from "react";
import {canonical,digest,importStack,type ComposePackage} from "@/lib/composeCompiler";
import {loadCompiledStack,replayStack,type CompiledStack,type Inputs,type ReplayBundle} from "@/lib/composeRuntime";
import {BUILD_KEY,DRAFT_KEY,draftFingerprint,restoreBuild} from "@/lib/workflow";
import {checkedDraft} from "@/lib/composeDraft";
import {advanceRoad,DEMO_FILE,gapMetres,roadInputs,startRoad,type RoadState} from "@/lib/brakeDemo";
import {putReceipt} from "@/lib/shelf";
const World=dynamic(()=>import("./BrakeWorld").then(m=>m.BrakeWorld),{ssr:false});
const SESSION="synapsevm.simulator.package.v1";
function download(name:string,raw:string){const url=URL.createObjectURL(new Blob([raw],{type:"application/json"}));const a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export function StackSimulator(){
 const [loaded,setLoaded]=useState<{pkg:ComposePackage;hash:string;name:string;source:"file"|"compose"}|null>(null),[busy,setBusy]=useState(false),[running,setRunning]=useState(false),[error,setError]=useState(""),[road,setRoad]=useState(startRoad),[actions,setActions]=useState<Inputs>({}),[logs,setLogs]=useState<string[]>([]),[replay,setReplay]=useState<ReplayBundle|null>(null),[match,setMatch]=useState(""),[receiptSaved,setReceiptSaved]=useState(false);
 const vm=useRef<CompiledStack|null>(null),world=useRef<RoadState>(startRoad()),epoch=useRef(0),stepping=useRef(false),source=useRef<"file"|"compose">("file"),shelvedReceipt=useRef("");
 const log=(line:string)=>setLogs(old=>[...old,line].slice(-120));
 function reset(){epoch.current++;vm.current=null;world.current=startRoad();setRoad(world.current);setRunning(false);setActions({});setReplay(null);setMatch("");setReceiptSaved(false);shelvedReceipt.current="";setLogs([]);}
 async function load(raw:string,name:string,origin:"file"|"compose"="file"){
  reset();const ticket=epoch.current;setBusy(true);setLoaded(null);setError("");
  try{const pkg=await importStack(raw),hash=await digest(canonical(pkg));if(ticket!==epoch.current)return;if(!pkg.manifest.executable)throw Error("This package is source-only. Resolve its neural interfaces in Compose before running.");if(!pkg.graph.nodes.some(n=>n.type==="CarBrake"))throw Error("This road environment requires a CarBrake actuator. Use the Emergency Brake preset in Compose.");
   source.current=origin;setLoaded({pkg,hash,name,source:origin});log("[import] "+name);log("[identity] "+hash);log("[schedule] "+pkg.graph.nodes.length+" nodes · 1 ms clock");log("[ready] exact locked model bytes loaded");
   if(origin==="file")try{sessionStorage.setItem(SESSION,JSON.stringify({raw:canonical(pkg),name}));}catch{log("[storage] session full; retain the downloaded file");}
  }catch(e){if(ticket===epoch.current)setError(String(e));}finally{if(ticket===epoch.current)setBusy(false);}
 }
 async function importFile(file?:File){if(!file)return;if(file.size>20_000_000){setError("Package exceeds 20 MB.");return;}await load(await file.text(),file.name);}
 useEffect(()=>{let stopped=false;void(async()=>{try{const explicit=new URLSearchParams(window.location.search).get("source")==="compose",session=sessionStorage.getItem(SESSION);if(session&&!explicit){const cached=JSON.parse(session);if(!stopped)await load(cached.raw,cached.name);return;}const raw=localStorage.getItem(BUILD_KEY),draft=localStorage.getItem(DRAFT_KEY);if(!raw||!draft)return;const build=await restoreBuild(raw,draftFingerprint(checkedDraft(JSON.parse(draft))));if(!stopped)await load(canonical(build.pkg),build.pkg.manifest.name+"-"+build.pkg.manifest.version+".synapse","compose");}catch(e){if(!stopped)setError(String(e));}})();return()=>{stopped=true;epoch.current++;};},[]);
 useEffect(()=>{const changed=(event:StorageEvent)=>{if(source.current==="compose"&&(event.key===null||event.key===DRAFT_KEY||event.key===BUILD_KEY)){reset();setLoaded(null);setError("Compose changed in another tab. Compile again and open that package here, or import a saved .synapse file.");}};window.addEventListener("storage",changed);return()=>window.removeEventListener("storage",changed);},[]);
 async function step(count=50){
  if(!loaded||busy||stepping.current||world.current.collision||world.current.speedMmps===0)return;stepping.current=true;const ticket=epoch.current;
  try{if(!vm.current){const instance=await loadCompiledStack(loaded.pkg);if(ticket!==epoch.current)return;vm.current=instance;log("[run] 28.8 km/h · barrier at 24 m");}let last:Inputs={};
   for(let i=0;i<count;i++){const before=world.current,result=await vm.current.step(roadInputs(loaded.pkg,before));if(ticket!==epoch.current)return;world.current=advanceRoad(before,result.actions);last=result.actions;
    if(result.tick===0)for(const event of result.events)log("[0 ms] "+event.node+" → "+event.type);
    if(before.brakeQ16!==world.current.brakeQ16)log("["+world.current.tick+" ms] CarBrake → "+Math.round(world.current.brakeQ16/655.36)+"% · gap "+gapMetres(world.current).toFixed(2)+" m");
    if(result.replay){setReplay(result.replay);setMatch("");if(!shelvedReceipt.current){shelvedReceipt.current=result.replay.receipt.hash;const captured=result.replay,stackName=loaded.pkg.manifest.name;void putReceipt(captured,"captured",stackName).then(()=>{if(ticket===epoch.current){setReceiptSaved(true);log("[shelf] decision receipt saved to Verify");}}).catch(e=>{if(ticket===epoch.current){shelvedReceipt.current="";log("[shelf] receipt was not saved · "+String(e));}});}}
    if(world.current.speedMmps===0){setRunning(false);log(world.current.collision?"[collision] vehicle reached barrier":"[stopped] clearance "+gapMetres(world.current).toFixed(2)+" m");break;}
   }setRoad({...world.current});setActions(last);
  }catch(e){if(ticket===epoch.current){setError(String(e));setRunning(false);}}finally{stepping.current=false;}
 }
 useEffect(()=>{if(!running)return;const timer=setInterval(()=>void step(50),50);return()=>clearInterval(timer);},[running,loaded,busy]);
 const stopped=road.speedMmps===0;
 return <div className="stack-sim" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();void importFile(e.dataTransfer.files[0]);}}>
 <div className="stack-sim-world"><World road={road}/></div>
 <aside className="stack-terminal" aria-label="Simulation terminal">
  <header><span className="terminal-dots">● ● ●</span><span>EXECUTION TERMINAL</span><small>LOCAL</small></header>
  <div className="terminal-body"><p className="terminal-kicker">EMERGENCY BRAKE / ROAD DEMO</p><h1>{loaded?.pkg.manifest.name??"Import a compiled Stack"}</h1><p className="terminal-copy">Load the .synapse file from Compose. Its neural output drives the van’s brakes.</p>
  <label className="terminal-import">↑ Import .synapse<input type="file" accept=".synapse,application/json" aria-label="Import compiled .synapse file" disabled={busy} onChange={e=>{void importFile(e.target.files?.[0]);e.target.value="";}}/></label>
  {!loaded&&<button disabled={busy} onClick={async()=>{try{const r=await fetch("/demo/"+DEMO_FILE);if(!r.ok)throw Error("Demo file unavailable");await load(await r.text(),DEMO_FILE);}catch(e){setError(String(e));}}}>Load included compiled demo</button>}
  <Link href="/compose">← Open Compose</Link>
  {busy&&<p role="status">Checking package and model locks…</p>}{error&&<p role="alert" className="terminal-error">{error}</p>}
  {loaded&&<><div className="terminal-file"><strong>{loaded.name}</strong><span>{loaded.source==="compose"?"Current Compose build":"Imported file"} · v{loaded.pkg.manifest.version}</span><code title={loaded.hash}>{loaded.hash}</code><button onClick={()=>download(loaded.name,canonical(loaded.pkg))}>Download loaded .synapse</button></div>
  <div className="terminal-controls"><button className="terminal-run" disabled={busy||stopped} onClick={()=>setRunning(v=>!v)}>{running?"Pause":"Run scenario"}</button><button disabled={running||busy||stopped} onClick={()=>void step(50)}>Step 50 ms</button><button disabled={busy} onClick={reset}>Reset</button></div>
  <label className="terminal-toggle"><input type="checkbox" checked={road.obstacle} disabled={running||road.tick>0} onChange={e=>{world.current={...world.current,obstacle:e.target.checked};setRoad({...world.current});}}/> Barrier in lane</label>
  <div className="terminal-log" role="log" aria-label="Execution log">{logs.map((line,i)=><div key={i}>{line}</div>)}</div>
  <details><summary>Actual actuator output</summary><pre>{JSON.stringify(actions,null,2)}</pre></details>
  {replay&&<div className="terminal-evidence"><strong>Decision receipt captured{receiptSaved?" · saved to Verify":""}</strong><button onClick={async()=>{setRunning(false);const ticket=epoch.current;try{await replayStack(loaded.pkg,replay);if(ticket===epoch.current)setMatch("MATCH · exact decision reproduced");}catch(e){if(ticket===epoch.current)setMatch(String(e));}}}>Replay decision</button><button onClick={()=>download(loaded.pkg.manifest.name+".replay.json",canonical(replay))}>Download replay</button><button onClick={()=>{sessionStorage.setItem("synapsevm.verify.stack",JSON.stringify({package:loaded.pkg,evidence:replay}));window.location.assign("/verify?evidence=compose");}}>Verify evidence →</button><p role="status">{match}</p></div>}
  </>}
  <p className="terminal-footnote">1 ms deterministic road model · 6 m/s² maximum braking. Demonstration environment; simplified sensing and motion.</p></div>
 </aside>
 <section className="stack-hud" aria-label="Road telemetry"><div><span>SPEED</span><strong>{(road.speedMmps*.0036).toFixed(1)}<small> km/h</small></strong></div><div><span>CLEARANCE</span><strong>{road.obstacle?gapMetres(road).toFixed(2):"—"}<small> m</small></strong></div><div><span>BRAKE</span><strong>{Math.round(road.brakeQ16/655.36)}<small>%</small></strong></div><div><span>TIME</span><strong>{(road.tick/1000).toFixed(2)}<small> s</small></strong></div></section>
 <div className={"stack-outcome "+(road.collision?"collision":stopped?"stopped":"")} role="status">{road.collision?"Collision":stopped?"Stopped before obstacle":road.brakeQ16>0?"Neural trigger · braking":running?"Approaching barrier":loaded?"Package ready · press Run scenario":"Drop a .synapse file to begin"}</div>
 </div>;
}
