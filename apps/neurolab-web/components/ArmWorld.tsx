"use client";

/**
 * Robotic arm slewing around its own axis.
 *
 * The approach is angular rather than linear: the arm swings from 0 toward a
 * person standing at 160°, so "something is in the way" becomes a rotary
 * safety case — which is the one that actually matters on a cell floor.
 *
 * The figure is a person, so the scene does not dress it up. No motion of its
 * own, no reaction: it is the thing being protected, and the only question is
 * whether the arm stops in time.
 */

import { Canvas } from "@react-three/fiber";
import { ContactShadows, OrbitControls } from "@react-three/drei";
import { SWEEP_DEG, gapDegrees, sweptDegrees, type ActorState } from "@/lib/actors";

const RADIUS = 5.4;
const rad = (deg: number) => (deg * Math.PI) / 180;

/** Stylised person — enough to read as one, not enough to pretend it is a model. */
function Figure({ angleDeg }: { angleDeg: number }) {
  const a = rad(angleDeg);
  return (
    <group position={[Math.cos(a) * RADIUS, 0, -Math.sin(a) * RADIUS]} rotation={[0, a + Math.PI / 2, 0]}>
      <mesh castShadow position={[0, 1.62, 0]}>
        <sphereGeometry args={[0.21, 20, 16]} />
        <meshStandardMaterial color="#e2b892" roughness={0.75} />
      </mesh>
      <mesh castShadow position={[0, 1.12, 0]}>
        <capsuleGeometry args={[0.23, 0.56, 6, 14]} />
        <meshStandardMaterial color="#e8a23f" roughness={0.7} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} castShadow position={[s * 0.3, 1.14, 0]} rotation={[0, 0, s * 0.16]}>
          <capsuleGeometry args={[0.075, 0.5, 5, 10]} />
          <meshStandardMaterial color="#e8a23f" roughness={0.7} />
        </mesh>
      ))}
      {[-1, 1].map((s) => (
        <mesh key={s} castShadow position={[s * 0.13, 0.4, 0]}>
          <capsuleGeometry args={[0.095, 0.56, 5, 10]} />
          <meshStandardMaterial color="#3f4a5c" roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

export function ArmWorld({ road }: { road: ActorState }) {
  const swept = sweptDegrees(road);
  const arc = gapDegrees(road);
  const braking = road.brakeQ16 > 0;
  const a = rad(swept);

  return (
    <div
      className="brake-world"
      aria-label={
        road.collision
          ? "Arm scene: reached the person"
          : road.retracting
            ? "Arm scene: returning"
            : braking
              ? "Arm scene: stopping"
              : "Arm scene: slewing toward the person"
      }
    >
      <Canvas shadows camera={{ position: [0, 8.5, 12.5], fov: 42 }}>
        <color attach="background" args={["#b6c0c4"]} />
        <fog attach="fog" args={["#b6c0c4", 34, 80]} />
        <ambientLight intensity={1.1} />
        <hemisphereLight args={["#e6f2ff", "#3f4a4e", 1.5]} />
        <directionalLight
          castShadow
          position={[7, 18, 9]}
          intensity={2.3}
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-18}
          shadow-camera-right={18}
          shadow-camera-top={18}
          shadow-camera-bottom={-18}
        />

        <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]}>
          <planeGeometry args={[60, 60]} />
          <meshStandardMaterial color="#6d7679" />
        </mesh>
        <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.06, 0]}>
          <circleGeometry args={[7.4, 48]} />
          <meshStandardMaterial color="#4b5860" roughness={0.9} />
        </mesh>

        {/* The swept arc, marked on the floor. */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0]}>
          <ringGeometry args={[RADIUS - 0.12, RADIUS + 0.12, 64, 1, 0, rad(SWEEP_DEG)]} />
          <meshStandardMaterial color="#8b969b" />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, 0]}>
          <ringGeometry args={[RADIUS - 0.12, RADIUS + 0.12, 64, 1, 0, Math.max(0.001, rad(swept))]} />
          <meshStandardMaterial color={braking ? "#e0705a" : "#e8c46f"} />
        </mesh>

        {/* Pedestal and slewing column. */}
        <mesh castShadow receiveShadow position={[0, 0.2, 0]}>
          <cylinderGeometry args={[1.15, 1.35, 0.4, 28]} />
          <meshStandardMaterial color="#7d888d" metalness={0.4} roughness={0.55} />
        </mesh>

        <group rotation={[0, a, 0]}>
          <mesh castShadow position={[0, 1.05, 0]}>
            <cylinderGeometry args={[0.62, 0.78, 1.3, 24]} />
            <meshStandardMaterial color="#e8ece4" metalness={0.2} roughness={0.4} />
          </mesh>
          {/* Upper arm reaching out along +X, which rotation carries around. */}
          <mesh castShadow position={[1.5, 1.72, 0]} rotation={[0, 0, -0.34]}>
            <boxGeometry args={[3.2, 0.42, 0.5]} />
            <meshStandardMaterial color="#e8ece4" metalness={0.2} roughness={0.38} />
          </mesh>
          <mesh castShadow position={[3.05, 1.2, 0]}>
            <sphereGeometry args={[0.3, 18, 14]} />
            <meshStandardMaterial color="#55666d" metalness={0.4} roughness={0.4} />
          </mesh>
          <mesh castShadow position={[4.25, 1.0, 0]} rotation={[0, 0, 0.22]}>
            <boxGeometry args={[2.3, 0.3, 0.36]} />
            <meshStandardMaterial color="#3e7f67" metalness={0.25} roughness={0.4} />
          </mesh>
          {/* Gripper at the far end — the part that would reach the person. */}
          {[-0.16, 0.16].map((z) => (
            <mesh key={z} castShadow position={[5.35, 0.86, z]}>
              <boxGeometry args={[0.5, 0.12, 0.1]} />
              <meshStandardMaterial color="#2c3b41" />
            </mesh>
          ))}
          <mesh position={[0, 1.82, 0]}>
            <cylinderGeometry args={[0.2, 0.2, 0.12, 16]} />
            <meshStandardMaterial
              color={braking ? "#ff4a3c" : road.retracting ? "#6fd0a0" : "#4c5f67"}
              emissive={braking ? "#ee3524" : road.retracting ? "#3f9f74" : "#0b1418"}
              emissiveIntensity={braking || road.retracting ? 2.2 : 0}
            />
          </mesh>
        </group>

        {road.obstacle ? <Figure angleDeg={SWEEP_DEG} /> : null}

        {/* Safety rail behind the person. */}
        <mesh position={[Math.cos(rad(SWEEP_DEG)) * 7, 0.5, -Math.sin(rad(SWEEP_DEG)) * 7]} rotation={[0, rad(SWEEP_DEG) + Math.PI / 2, 0]}>
          <boxGeometry args={[3.4, 1, 0.08]} />
          <meshStandardMaterial color="#c8a86f" roughness={0.85} />
        </mesh>

        <ContactShadows position={[0, -0.02, 0]} opacity={0.36} scale={24} blur={2} far={8} />
        <OrbitControls target={[0, 1.2, 0]} maxPolarAngle={Math.PI / 2.1} minDistance={7} maxDistance={34} />
      </Canvas>
      <span className="brake-scene-note">
        {road.retracting
          ? `Returning · came within ${Math.max(0, SWEEP_DEG - (road.reachedUm / 1_000_000 / 24) * SWEEP_DEG).toFixed(1)}°`
          : `Slewing · ${arc.toFixed(1)}° to the figure`}
      </span>
    </div>
  );
}
