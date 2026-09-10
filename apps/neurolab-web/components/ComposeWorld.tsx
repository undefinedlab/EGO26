"use client";
import {Canvas} from "@react-three/fiber";
import {OrbitControls} from "@react-three/drei";
import type {Inputs} from "@/lib/composeRuntime";
export function ComposeWorld({actions,obstacle,tick}:{actions:Inputs;obstacle:boolean;tick:number}){
 const value=Object.values(actions)[0],stopped=value?.kind==="BrakeCommand/v1"?value.values[0]>0:!!value?.values[2],steer=value?.kind==="ControlVector/v1"?value.values[0]/65536:0;
 return <div className="cmp-world" aria-label={"3D command preview: "+(stopped?"safety stop":"nominal")}>
 <Canvas orthographic camera={{position:[7,6,9],zoom:45}}><color attach="background" args={["#101820"]}/><ambientLight intensity={1.8}/><directionalLight position={[4,8,3]} intensity={2}/>
 <mesh rotation={[-Math.PI/2,0,0]} position={[0,-.12,0]}><planeGeometry args={[18,12]}/><meshStandardMaterial color="#1d2a30"/></mesh>
 <gridHelper args={[18,18,"#40544d","#283d37"]}/>
 <mesh position={[0,.2,0]} rotation={[0,-steer*.6,0]}><boxGeometry args={[1,.4,1.7]}/><meshStandardMaterial color={stopped?"#ef9b75":"#9ad3b0"}/></mesh>
 {[[-.55,-.55],[-.55,.55],[.55,-.55],[.55,.55]].map(([x,z],i)=><mesh key={i} position={[x,.1,z]} rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[.2,.2,.15,12]}/><meshStandardMaterial color="#111"/></mesh>)}
 {obstacle&&<mesh position={[0,.6,-3]}><boxGeometry args={[3,1.2,.35]}/><meshStandardMaterial color="#e7a484"/></mesh>}
 {!stopped&&value&&<mesh position={[steer,.08,-1.6]} rotation={[-Math.PI/2,0,-steer]}><coneGeometry args={[.18,.6,3]}/><meshStandardMaterial color="#b3e8c4"/></mesh>}
 <OrbitControls enablePan={false} minZoom={20} maxZoom={80}/></Canvas>
 <span>{tick} ms · {stopped?"Safety stop":value?"Nominal command":"Awaiting execution"} · command visualization</span></div>;
}
