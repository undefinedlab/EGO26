import {DEFINITIONS,type ComposePackage} from "./composeCompiler";
import type {Inputs} from "./composeRuntime";

export const DEMO_FILE="EmergencyBrake-0.1.0.synapse";
export type RoadState={tick:number;positionUm:number;speedMmps:number;brakeQ16:number;obstacle:boolean;collision:boolean};
export const startRoad=():RoadState=>({tick:0,positionUm:0,speedMmps:8000,brakeQ16:0,obstacle:true,collision:false});
export const gapMetres=(s:RoadState)=>Math.max(0,24-s.positionUm/1_000_000);
/** Repeatable 1 ms bench world: integer distance/speed, bounded sensor features. */
export function roadInputs(pkg:ComposePackage,s:RoadState):Inputs {
 const proximity=s.obstacle?Math.max(0,Math.min(65536,Math.round((1-gapMetres(s)/24)*65536))):0;
 const looming=Math.round(proximity*s.speedMmps/8000);
 return Object.fromEntries(pkg.graph.nodes.filter(n=>DEFINITIONS[n.type].family==="sensor").map(n=>[n.id,n.type==="WorldState"?{kind:"WorldState/v1",values:[proximity,0,0,looming]}:n.type==="EventCamera"?{kind:"EventVision/v1",values:[proximity,0,0,looming]}:n.type==="SteeringInput"?{kind:"SteeringCommand/v1",values:[0,1]}:{kind:"HeadingDelta/v1",values:[0]}]));
}
export function advanceRoad(s:RoadState,actions:Inputs):RoadState {
 const commands=Object.values(actions).filter(v=>v.kind==="BrakeCommand/v1"||v.kind==="ControlVector/v1");
 // Actuator ports use LATEST delivery. A scheduler tick without a fresh action
 // holds the preceding command; it does not manufacture a zero-brake command.
 const brake=commands.length?Math.max(0,...commands.map(v=>v.kind==="BrakeCommand/v1"?v.values[0]:v.values[2]?65536:0)):s.brakeQ16;
 const speed=Math.max(0,s.speedMmps-Math.round(6*Math.min(65536,brake)/65536));
 const position=s.positionUm+speed,collision=s.obstacle&&position>=24_000_000;
 return {tick:s.tick+1,positionUm:collision?24_000_000:position,speedMmps:collision?0:speed,brakeQ16:brake,obstacle:s.obstacle,collision:s.collision||collision};
}
