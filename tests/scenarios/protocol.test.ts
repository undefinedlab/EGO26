import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { SynapseVmJs, mul, q16 } from "../../apps/neurolab-web/lib/synapseVm.ts";
import { compileStack, canonical, digest, importPackage, validateGraph, deploymentBundle, type StackGraph } from "../../apps/neurolab-web/lib/stackCompiler.ts";
const load = async (slug:string) => readFileSync("blocks/"+slug+"/1.0.0/block.json","utf8");
const graph:StackGraph={name:"BioPilot",version:"1.0.0",deadlineMs:10,nodes:["EventCamera","IMU","LoomGuard","FlowSense","TargetTrack","HeadingCell","Arbiter","DroneControl"].map(id=>({id,type:id})),edges:[
 ["EventCamera.events","LoomGuard.event_vision"],["EventCamera.events","FlowSense.event_vision"],["EventCamera.events","TargetTrack.event_vision"],["IMU.heading","HeadingCell.heading_delta"],["FlowSense.optic_flow","HeadingCell.optic_flow"],["TargetTrack.target_bearing","HeadingCell.target_bearing"],["HeadingCell.steering_command","Arbiter.nominal"],["LoomGuard.avoidance_vector","Arbiter.override"],["Arbiter.command","DroneControl.control"]].map(([from,to])=>({from,to}))};
test("fixed point rounds and saturates exactly",()=>{assert.equal(mul(-1,32768),-1);assert.equal(mul(2147483647,2147483647),2147483647);assert.equal(q16(-0.5/65536),-1);});
test("Rust and browser agree on every output, full state byte, and spike trace",()=>{
 const native=spawnSync("cargo",["run","--offline","-q","-p","synapsevm-core","--example","conformance"],{encoding:"utf8",maxBuffer:20_000_000});
 assert.equal(native.status,0,native.stderr);
 const rows=JSON.parse(native.stdout);const vms=new Map<string,SynapseVmJs>();
 for(const row of rows){let vm=vms.get(row.slug);if(!vm){vm=new SynapseVmJs(JSON.parse(readFileSync("blocks/"+row.slug+"/1.0.0/block.json","utf8")));vms.set(row.slug,vm);}
 const r=vm.step(row.input,row.tick);assert.deepEqual([r.danger,r.avoidX,r.avoidY,Number(r.trigger)],row.output,row.slug+" tick "+row.tick);assert.equal(Buffer.from(vm.snapshot()).toString("hex"),row.snapshot);assert.deepEqual(r.traceNeuronIds,row.trace);}
 assert.equal(rows.length,132);
});
test("canonical identity ignores ordering and visual positions; locks exact module bytes",async()=>{
 const a=await compileStack(graph,load);const b=await compileStack({...graph,nodes:[...graph.nodes].reverse().map(n=>({...n,x:999})),edges:[...graph.edges].reverse()},load);
 assert.equal(a.manifest.stackId,b.manifest.stackId);assert.equal(canonical(a),canonical(b));
 assert.equal(a.lockfile.loomguard.digest,await digest(await load("loomguard")));
 const changed=await compileStack({...graph,deadlineMs:11},load);assert.notEqual(a.manifest.stackId,changed.manifest.stackId);
 assert.deepEqual(await importPackage(canonical(a)),a);
 const tampered=structuredClone(a);tampered.modules.loomguard+=" ";await assert.rejects(()=>importPackage(JSON.stringify(tampered)),/mismatch/);
});
test("compiler blocks missing input, incompatible wires, duplicate writers, implicit cycles and timing",()=>{
 assert.equal(validateGraph(graph).errors.length,0);
 assert.ok(validateGraph({...graph,edges:graph.edges.slice(1)}).errors.some(e=>e.code==="MISSING_INPUT"));
 assert.ok(validateGraph({...graph,edges:[...graph.edges,{from:"LoomGuard.avoidance_vector",to:"HeadingCell.optic_flow"}]}).errors.some(e=>e.code==="TYPE"));
 assert.ok(validateGraph({...graph,edges:[...graph.edges,graph.edges[0]]}).errors.some(e=>e.code==="WRITERS"));
 assert.ok(validateGraph({...graph,deadlineMs:1}).errors.some(e=>e.code==="DEADLINE"));
 assert.ok(validateGraph({...graph,nodes:graph.nodes.map(n=>n.type==="EventCamera"?{...n,params:{hz:30}}:n)}).errors.some(e=>e.code==="ENVELOPE"));
});
test("deployment rejects low-rate hardware and binds stack identity",async()=>{const p=await compileStack(graph,load);await assert.rejects(()=>deploymentBundle(p,30),/unsupported/);assert.equal((await deploymentBundle(p,200)).stackId,p.manifest.stackId);});
test("invalid input and snapshots leave state unchanged",async()=>{const vm=new SynapseVmJs(JSON.parse(await load("loomguard")));const initial=vm.snapshot();assert.throws(()=>vm.step([],0));assert.deepEqual(vm.snapshot(),initial);const bad=initial.slice();bad[16]=2;assert.throws(()=>vm.restore(bad));assert.deepEqual(vm.snapshot(),initial);});
