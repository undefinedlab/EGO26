"use client";
import {Canvas} from "@react-three/fiber";
import {OrbitControls,ContactShadows} from "@react-three/drei";
import {gapMetres,type RoadState} from "@/lib/brakeDemo";

export function BrakeWorld({road}:{road:RoadState}){
 const gap=gapMetres(road),braking=road.brakeQ16>0;
 return <div className="brake-world" aria-label={road.collision?"Road scene: collision":road.speedMmps===0?"Road scene: stopped":braking?"Road scene: braking":"Road scene: approaching obstacle"}>
 <Canvas shadows camera={{position:[11,8,16],fov:45}}><color attach="background" args={["#b8c7cc"]}/><fog attach="fog" args={["#b8c7cc",40,100]}/><ambientLight intensity={1.1}/><hemisphereLight args={["#e2f3ff","#435844",1.5]}/><directionalLight castShadow position={[12,22,10]} intensity={2.5} shadow-mapSize={[2048,2048]} shadow-camera-left={-30} shadow-camera-right={30} shadow-camera-top={30} shadow-camera-bottom={-30}/>
 <mesh receiveShadow rotation={[-Math.PI/2,0,0]} position={[0,-.1,-25]}><planeGeometry args={[120,160]}/><meshStandardMaterial color="#65766a"/></mesh>
 <mesh receiveShadow rotation={[-Math.PI/2,0,0]} position={[0,-.06,-25]}><planeGeometry args={[8,150]}/><meshStandardMaterial color="#3a454b" roughness={.9}/></mesh>
 {[-3.6,3.6].map(x=><mesh key={x} rotation={[-Math.PI/2,0,0]} position={[x,-.045,-25]}><planeGeometry args={[.1,150]}/><meshStandardMaterial color="#dce2dc"/></mesh>)}
 {Array.from({length:22},(_,i)=><mesh key={i} rotation={[-Math.PI/2,0,0]} position={[0,-.04,15-i*5+(road.positionUm/1_000_000)%5]}><planeGeometry args={[.08,2.3]}/><meshStandardMaterial color="#d4d7cb"/></mesh>)}
 {[-1,1].flatMap(side=>Array.from({length:8},(_,i)=><group key={side+"-"+i} position={[side*(10+(i%3)*3),0,10-i*13+(road.positionUm/1_000_000)%13]}><mesh castShadow position={[0,2.5,0]}><boxGeometry args={[5,5+(i%3)*2,7]}/><meshStandardMaterial color={i%2?"#849899":"#92a2a0"}/></mesh><mesh position={[side*2.51,2.5,0]}><boxGeometry args={[.03,1.5,4]}/><meshStandardMaterial color="#4c6870"/></mesh></group>))}
 <group position={[-1.8,0,4]}>
 <mesh castShadow position={[0,1.05,0]}><boxGeometry args={[1.9,1.7,3.8]}/><meshStandardMaterial color="#e8ece4" metalness={.15} roughness={.35}/></mesh>
 <mesh castShadow position={[0,1.6,-1.4]} rotation={[-.14,0,0]}><boxGeometry args={[1.68,.65,.08]}/><meshStandardMaterial color="#29434d" metalness={.4} roughness={.15}/></mesh>
 <mesh position={[0,.35,1.94]}><boxGeometry args={[1.94,.24,.14]}/><meshStandardMaterial color="#26373b"/></mesh>
 {[-1,1].flatMap(side=>[-1.15,1.15].map(z=><group key={side+":"+z} position={[side*.94,.38,z]} rotation={[0,0,Math.PI/2]}><mesh castShadow><cylinderGeometry args={[.38,.38,.28,24]}/><meshStandardMaterial color="#152025"/></mesh><mesh position={[0,side*.15,0]}><cylinderGeometry args={[.19,.19,.015,16]}/><meshStandardMaterial color="#a6b2b2" metalness={.6}/></mesh></group>))}
 {[-.72,.72].map(x=><mesh key={x} position={[x,.9,1.92]}><boxGeometry args={[.25,.4,.05]}/><meshStandardMaterial color={braking?"#ff463a":"#662e2b"} emissive={braking?"#ed3322":"#220505"} emissiveIntensity={braking?2:0}/></mesh>)}
 <mesh position={[.961,1.2,.25]}><boxGeometry args={[.02,.36,1.4]}/><meshStandardMaterial color="#3e7f67"/></mesh>
 </group>
 {road.obstacle&&<group position={[-1.8,0,1.7-gap]}><mesh castShadow position={[0,.65,0]}><boxGeometry args={[3.2,1.3,.55]}/><meshStandardMaterial color="#dba46e"/></mesh>{[-1.2,-.4,.4,1.2].map(x=><mesh key={x} position={[x,.65,.28]} rotation={[0,0,-.4]}><boxGeometry args={[.23,1.2,.02]}/><meshStandardMaterial color="#3b4143"/></mesh>)}</group>}
 <ContactShadows position={[0,-.025,0]} opacity={.35} scale={35} blur={2} far={8}/><OrbitControls target={[-1.5,.4,-3]} maxPolarAngle={Math.PI/2.1} minDistance={8} maxDistance={45}/>
 </Canvas><span className="brake-scene-note">Deterministic road demo · orbit to inspect</span></div>;
}
