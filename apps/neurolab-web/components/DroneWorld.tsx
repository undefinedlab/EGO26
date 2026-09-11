"use client";

/**
 * Drone approaching a wall.
 *
 * Same 24 m approach as the road scene, flown instead of driven. The rotors
 * spin while there is speed and the underside glows when the reflex is
 * commanding a stop, so the decision is visible without reading the HUD.
 */

import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, OrbitControls } from "@react-three/drei";
import { useRef } from "react";
import type { Group } from "three";
import { gapMetres, type ActorState } from "@/lib/actors";

function Rotor({ x, z, spinning }: { x: number; z: number; spinning: boolean }) {
  const blades = useRef<Group>(null);
  useFrame((_, dt) => {
    if (blades.current && spinning) blades.current.rotation.y += dt * 42;
  });
  return (
    <group position={[x, 0.34, z]}>
      <mesh castShadow>
        <cylinderGeometry args={[0.07, 0.07, 0.24, 12]} />
        <meshStandardMaterial color="#27343b" />
      </mesh>
      <group ref={blades} position={[0, 0.16, 0]}>
        {[0, Math.PI / 2].map((r) => (
          <mesh key={r} rotation={[0, r, 0]}>
            <boxGeometry args={[1.5, 0.02, 0.12]} />
            <meshStandardMaterial color="#4d6570" transparent opacity={spinning ? 0.4 : 0.9} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

export function DroneWorld({ road }: { road: ActorState }) {
  const gap = gapMetres(road);
  const braking = road.brakeQ16 > 0;
  const moving = road.speedMmps > 0;
  const hover = 2.6;

  return (
    <div
      className="brake-world"
      aria-label={
        road.collision
          ? "Drone scene: struck the wall"
          : !moving
            ? "Drone scene: holding position"
            : braking
              ? "Drone scene: braking"
              : "Drone scene: approaching the wall"
      }
    >
      <Canvas shadows camera={{ position: [9, 6, 15], fov: 45 }}>
        <color attach="background" args={["#aebfc8"]} />
        <fog attach="fog" args={["#aebfc8", 40, 105]} />
        <ambientLight intensity={1.15} />
        <hemisphereLight args={["#dff0ff", "#47563f", 1.4]} />
        <directionalLight
          castShadow
          position={[10, 20, 9]}
          intensity={2.4}
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-30}
          shadow-camera-right={30}
          shadow-camera-top={30}
          shadow-camera-bottom={-30}
        />

        <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, -25]}>
          <planeGeometry args={[120, 170]} />
          <meshStandardMaterial color="#63775f" />
        </mesh>
        {/* Ground markers give the approach a sense of travel. */}
        {Array.from({ length: 20 }, (_, i) => (
          <mesh
            key={i}
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, -0.05, 14 - i * 6 + ((road.positionUm / 1_000_000) % 6)]}
          >
            <planeGeometry args={[3.4, 0.12]} />
            <meshStandardMaterial color="#8fa189" />
          </mesh>
        ))}

        <group position={[0, hover + Math.sin(road.tick / 260) * 0.12, 4]}>
          <mesh castShadow>
            <boxGeometry args={[1.15, 0.3, 1.5]} />
            <meshStandardMaterial color="#e9ece6" metalness={0.2} roughness={0.35} />
          </mesh>
          <mesh position={[0, 0.02, -0.82]}>
            <boxGeometry args={[0.5, 0.22, 0.22]} />
            <meshStandardMaterial color="#26383f" metalness={0.4} roughness={0.2} />
          </mesh>
          {[
            [-0.85, -0.95],
            [0.85, -0.95],
            [-0.85, 0.95],
            [0.85, 0.95],
          ].map(([x, z]) => (
            <Rotor key={`${x}:${z}`} x={x} z={z} spinning={moving} />
          ))}
          {/* Underside turns red while the reflex is holding it off. */}
          <mesh position={[0, -0.19, 0]}>
            <boxGeometry args={[0.7, 0.05, 0.7]} />
            <meshStandardMaterial
              color={braking ? "#ff4a3c" : "#3f5560"}
              emissive={braking ? "#ee3524" : "#0b1418"}
              emissiveIntensity={braking ? 2.2 : 0}
            />
          </mesh>
        </group>

        {road.obstacle ? (
          <group position={[0, 0, 5.7 - gap]}>
            <mesh castShadow position={[0, 2.4, 0]}>
              <boxGeometry args={[9, 4.8, 0.5]} />
              <meshStandardMaterial color="#c9a074" roughness={0.85} />
            </mesh>
            {[-3, -1, 1, 3].map((x) => (
              <mesh key={x} position={[x, 2.4, 0.27]}>
                <boxGeometry args={[0.3, 4.4, 0.04]} />
                <meshStandardMaterial color="#3c4345" />
              </mesh>
            ))}
          </group>
        ) : null}

        <ContactShadows position={[0, -0.02, 0]} opacity={0.34} scale={36} blur={2.2} far={9} />
        <OrbitControls target={[0, 1.6, -2]} maxPolarAngle={Math.PI / 2.1} minDistance={7} maxDistance={45} />
      </Canvas>
      <span className="brake-scene-note">Deterministic flight demo · orbit to inspect</span>
    </div>
  );
}
