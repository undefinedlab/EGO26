"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, OrbitControls } from "@react-three/drei";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import * as THREE from "three";
import {
  NEURO_BLOCKS,
  casesForBlock,
  comingSoonForBlock,
  getBlock,
  getCase,
  type BlockId,
  type CaseId,
} from "@/lib/blocks";
import { useLabStore, type FrameSnapshot, type ReceiptEvent } from "@/lib/store";
import Link from "next/link";
import { chainFor, compositionFor, RELATION_LABELS } from "@/lib/composition";
import { captureEvidence, verifyBrowserEvidence } from "@/lib/verification";
import { fromQ16, loadBlock, q16, SynapseVmJs, type StepView } from "@/lib/synapseVm";

type SceneRefs = {
  distanceRef: MutableRefObject<number>;
  smoothDistRef: MutableRefObject<number>;
  brakeRef: MutableRefObject<number>;
  smoothBrakeRef: MutableRefObject<number>;
  lateralRef: MutableRefObject<number>;
  altitudeRef: MutableRefObject<number>;
  reverseRef: MutableRefObject<number>;
  pedestrianRef: MutableRefObject<number>;
  triggeredRef: MutableRefObject<boolean>;
  whyPulseRef: MutableRefObject<number>;
};

function IconPlay() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}
function IconPause() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M6 5h4v14H6zm8 0h4v14h-4z" />
    </svg>
  );
}
function IconReset() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
      <path d="M3 12a9 9 0 1 0 3-6.7" strokeLinecap="round" />
      <path d="M3 4v5h5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconSensor({ on }: { on: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
      <circle cx="12" cy="12" r="3" fill={on ? "currentColor" : "none"} />
      <path d="M5.5 5.5a9 9 0 0 1 0 13M18.5 5.5a9 9 0 0 0 0 13" strokeLinecap="round" opacity={on ? 1 : 0.35} />
      <path d="M8.5 8.5a5 5 0 0 1 0 7M15.5 8.5a5 5 0 0 0 0 7" strokeLinecap="round" opacity={on ? 1 : 0.35} />
    </svg>
  );
}

function Lights({ ground = true }: { ground?: boolean }) {
  return (
    <>
      <color attach="background" args={["#eceef1"]} />
      <fog attach="fog" args={["#eceef1", 20, 52]} />

      <hemisphereLight args={["#ffffff", "#b4b8c0", 0.5]} />
      <directionalLight
        position={[7, 13, 6]}
        intensity={2.2}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
      >
        <orthographicCamera attach="shadow-camera" args={[-16, 16, 16, -16, 0.5, 44]} />
      </directionalLight>

      {/* Built from lightformers rather than a preset HDRI so the scene needs
          no network fetch and renders identically offline. */}
      <Environment resolution={256}>
        <Lightformer form="rect" intensity={4} position={[0, 7, 5]} scale={[12, 7, 1]} target={[0, 0, 0]} />
        <Lightformer form="rect" intensity={1.6} position={[-7, 4, -5]} scale={[9, 5, 1]} target={[0, 0, 0]} />
        <Lightformer form="ring" intensity={1.4} position={[7, 5, -3]} scale={5} target={[0, 0, 0]} />
        <Lightformer form="rect" intensity={0.8} position={[0, -4, 0]} rotation-x={Math.PI / 2} scale={[14, 14, 1]} />
      </Environment>

      {ground && (
        <ContactShadows
          position={[0, 0.012, 0]}
          opacity={0.42}
          scale={44}
          blur={2.4}
          far={10}
          resolution={1024}
          color="#23252a"
        />
      )}
    </>
  );
}

function Building({
  position,
  size,
  shade = "#d4d5d9",
}: {
  position: [number, number, number];
  size: [number, number, number];
  shade?: string;
}) {
  const [w, h, d] = size;
  const floors = Math.max(2, Math.floor(h / 0.9));
  const cols = Math.max(2, Math.floor(w / 0.7));
  return (
    <group position={position}>
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={shade} roughness={0.85} />
      </mesh>
      {Array.from({ length: floors }).map((_, fi) =>
        Array.from({ length: cols }).map((_, ci) => {
          const x = -w / 2 + 0.35 + (ci + 0.5) * ((w - 0.7) / cols);
          const y = 0.55 + fi * (h / floors);
          return (
            <mesh key={`${fi}-${ci}`} position={[x, y, d / 2 + 0.01]}>
              <planeGeometry args={[0.28, 0.38]} />
              <meshStandardMaterial color="#1a1b1e" emissive="#2a2c32" emissiveIntensity={0.15} />
            </mesh>
          );
        }),
      )}
    </group>
  );
}

function Person({ groupRef }: { groupRef: MutableRefObject<THREE.Group | null> }) {
  return (
    <group ref={groupRef}>
      <mesh position={[0, 0.22, 0]} castShadow>
        <capsuleGeometry args={[0.14, 0.28, 6, 10]} />
        <meshStandardMaterial color="#1c1d21" roughness={0.55} />
      </mesh>
      <mesh position={[0, 0.58, 0]} castShadow>
        <sphereGeometry args={[0.13, 18, 18]} />
        <meshStandardMaterial color="#2a2b30" />
      </mesh>
      <mesh position={[-0.12, 0.42, 0]} rotation={[0, 0, 0.35]}>
        <capsuleGeometry args={[0.04, 0.22, 4, 6]} />
        <meshStandardMaterial color="#15161a" />
      </mesh>
      <mesh position={[0.12, 0.42, 0]} rotation={[0, 0, -0.35]}>
        <capsuleGeometry args={[0.04, 0.22, 4, 6]} />
        <meshStandardMaterial color="#15161a" />
      </mesh>
      <mesh position={[-0.06, 0.02, 0]}>
        <capsuleGeometry args={[0.045, 0.2, 4, 6]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      <mesh position={[0.06, 0.02, 0]}>
        <capsuleGeometry args={[0.045, 0.2, 4, 6]} />
        <meshStandardMaterial color="#111" />
      </mesh>
    </group>
  );
}

function StreetScene({ refs, mode }: { refs: SceneRefs; mode: "brake" | "center" | "lock" }) {
  const car = useRef<THREE.Group>(null);
  const ped = useRef<THREE.Group>(null);
  const world = useRef<THREE.Group>(null);
  const wheels = useRef<THREE.Group>(null);
  const brakeL = useRef<THREE.Mesh>(null);
  const brakeR = useRef<THREE.Mesh>(null);
  const headL = useRef<THREE.Mesh>(null);
  const headR = useRef<THREE.Mesh>(null);
  const marker = useRef<THREE.Mesh>(null);
  const wheelSpin = useRef(0);

  useFrame((_, dt) => {
    refs.smoothDistRef.current = THREE.MathUtils.damp(
      refs.smoothDistRef.current,
      refs.distanceRef.current,
      7.5,
      dt,
    );
    refs.smoothBrakeRef.current = THREE.MathUtils.damp(
      refs.smoothBrakeRef.current,
      refs.brakeRef.current,
      7,
      dt,
    );
    const gap = refs.smoothDistRef.current;
    const brake = refs.smoothBrakeRef.current;
    const pulse = refs.whyPulseRef.current;
    const driven = Math.max(0, 14 - gap);
    const moving = !refs.triggeredRef.current && brake < 0.85;

    if (world.current) {
      // stronger parallax so cruise reads as fast urban drive
      world.current.position.z = THREE.MathUtils.damp(world.current.position.z, driven * 1.35, 6.5, dt);
    }

    if (car.current) {
      const cruiseZ = Math.min(driven * 0.18, 1.6);
      const bounce = moving ? Math.sin(performance.now() / 90) * 0.012 : 0;
      const tx = refs.lateralRef.current * 0.22;
      const tz = cruiseZ - brake * 0.28;
      car.current.position.x = THREE.MathUtils.damp(car.current.position.x, tx, 6, dt);
      car.current.position.y = 0.34 + bounce;
      car.current.position.z = THREE.MathUtils.damp(car.current.position.z, tz, 6.5, dt);
      car.current.rotation.x = THREE.MathUtils.damp(car.current.rotation.x, -brake * 0.16, 6, dt);
      car.current.rotation.y = THREE.MathUtils.damp(car.current.rotation.y, refs.lateralRef.current * 0.05, 6, dt);
      car.current.rotation.z = THREE.MathUtils.damp(
        car.current.rotation.z,
        moving ? Math.sin(performance.now() / 140) * 0.01 : 0,
        5,
        dt,
      );
    }

    if (wheels.current && moving) {
      wheelSpin.current += dt * (18 + (1 - brake) * 22);
      wheels.current.children.forEach((w) => {
        w.rotation.x = wheelSpin.current;
      });
    }

    if (ped.current && mode === "brake") {
      if (refs.triggeredRef.current) {
        refs.pedestrianRef.current = 0;
      } else if (gap < 4.8) {
        refs.pedestrianRef.current = THREE.MathUtils.damp(refs.pedestrianRef.current, 0, 5.5, dt);
      } else {
        refs.pedestrianRef.current = THREE.MathUtils.damp(refs.pedestrianRef.current, -3.45, 4, dt);
      }
      const pz = cruiseAhead(gap);
      ped.current.position.x = THREE.MathUtils.damp(ped.current.position.x, refs.pedestrianRef.current, 8, dt);
      ped.current.position.y = 0;
      ped.current.position.z = THREE.MathUtils.damp(ped.current.position.z, pz, 7, dt);
      ped.current.rotation.y = THREE.MathUtils.damp(
        ped.current.rotation.y,
        refs.pedestrianRef.current > -1.2 ? Math.PI / 2 : 0,
        4,
        dt,
      );
      ped.current.visible = true;
    } else if (ped.current) {
      const x =
        mode === "lock"
          ? THREE.MathUtils.lerp(-2.8, 2.4, Math.min(1, (10 - gap) / 8))
          : refs.pedestrianRef.current;
      ped.current.position.x = THREE.MathUtils.damp(ped.current.position.x, x, 5, dt);
      ped.current.position.z = THREE.MathUtils.damp(ped.current.position.z, cruiseAhead(gap), 5, dt);
      ped.current.visible = mode !== "center";
    }

    if (marker.current) {
      marker.current.visible = mode === "lock";
      const mx = THREE.MathUtils.lerp(-2.5, 1.8, Math.min(1, (10 - gap) / 7));
      marker.current.position.x = THREE.MathUtils.damp(marker.current.position.x, mx, 5, dt);
      marker.current.position.y = 0.35;
      marker.current.position.z = THREE.MathUtils.damp(marker.current.position.z, cruiseAhead(gap * 0.9), 5, dt);
    }
    for (const m of [brakeL.current, brakeR.current]) {
      if (!m) continue;
      const mat = m.material as THREE.MeshStandardMaterial;
      const lit = Math.max(brake, pulse);
      mat.emissiveIntensity = THREE.MathUtils.damp(mat.emissiveIntensity, lit * 3.2, 10, dt);
      mat.opacity = THREE.MathUtils.damp(mat.opacity, 0.25 + lit * 0.75, 10, dt);
    }
    for (const m of [headL.current, headR.current]) {
      if (!m) continue;
      const mat = m.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = THREE.MathUtils.damp(mat.emissiveIntensity, moving ? 1.4 : 0.55, 6, dt);
    }
    if (mode === "center" && refs.triggeredRef.current) {
      refs.lateralRef.current = THREE.MathUtils.damp(refs.lateralRef.current, 0, 2.4, dt);
    }
    refs.whyPulseRef.current = Math.max(0, pulse - dt * 1.8);
  });

  return (
    <>
      <Lights />
      <group ref={world}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -10]} receiveShadow>
          <planeGeometry args={[7.4, 56]} />
          <meshStandardMaterial color="#2f3035" roughness={0.92} />
        </mesh>
        {/* shoulder / gutter */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-3.55, 0.015, -10]}>
          <planeGeometry args={[0.35, 56]} />
          <meshStandardMaterial color="#242528" />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[3.55, 0.015, -10]}>
          <planeGeometry args={[0.35, 56]} />
          <meshStandardMaterial color="#242528" />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-4.7, 0.02, -10]} receiveShadow>
          <planeGeometry args={[2.4, 56]} />
          <meshStandardMaterial color="#c5c6cb" roughness={0.9} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[4.7, 0.02, -10]} receiveShadow>
          <planeGeometry args={[2.4, 56]} />
          <meshStandardMaterial color="#c5c6cb" roughness={0.9} />
        </mesh>
        <mesh position={[-3.6, 0.09, -10]}>
          <boxGeometry args={[0.16, 0.18, 56]} />
          <meshStandardMaterial color="#a8a9ae" />
        </mesh>
        <mesh position={[3.6, 0.09, -10]}>
          <boxGeometry args={[0.16, 0.18, 56]} />
          <meshStandardMaterial color="#a8a9ae" />
        </mesh>
        {/* lane dashes */}
        {[-26, -22, -18, -14, -10, -6, -2, 2, 6].map((z) => (
          <mesh key={z} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.035, z]}>
            <planeGeometry args={[0.16, 1.55]} />
            <meshStandardMaterial color="#ececef" />
          </mesh>
        ))}
        {/* crosswalk ahead of collision zone */}
        {[-0.7, -0.35, 0, 0.35, 0.7].map((x, i) => (
          <mesh key={`cw-${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.04, -3.2]}>
            <planeGeometry args={[0.28, 2.4]} />
            <meshStandardMaterial color="#e8e9ec" />
          </mesh>
        ))}
        <Building position={[-7.4, 0, -2]} size={[3.4, 6.2, 4.2]} shade="#d2d3d8" />
        <Building position={[-7.6, 0, -8]} size={[3.0, 8.4, 3.8]} shade="#c9cacf" />
        <Building position={[-7.2, 0, -14]} size={[3.6, 4.8, 3.4]} shade="#d6d7dc" />
        <Building position={[-7.5, 0, -20]} size={[3.2, 7.0, 3.6]} shade="#cecfd4" />
        <Building position={[7.4, 0, -3]} size={[3.2, 7.2, 4]} shade="#d4d5da" />
        <Building position={[7.7, 0, -9]} size={[3.6, 9.2, 4.4]} shade="#c6c7cc" />
        <Building position={[7.2, 0, -15.5]} size={[2.8, 5.4, 3.2]} shade="#d0d1d6" />
        <Building position={[7.5, 0, -21]} size={[3.4, 6.6, 3.8]} shade="#cbcdd2" />
        {[-18, -10, -2, 4].map((z) => (
          <group key={z} position={[-3.95, 0, z]}>
            <mesh position={[0, 1.55, 0]}>
              <cylinderGeometry args={[0.045, 0.055, 3.1, 10]} />
              <meshStandardMaterial color="#1d1e22" metalness={0.4} roughness={0.45} />
            </mesh>
            <mesh position={[0.32, 3.0, 0]}>
              <boxGeometry args={[0.7, 0.1, 0.22]} />
              <meshStandardMaterial color="#15161a" emissive="#fff4d6" emissiveIntensity={0.55} />
            </mesh>
          </group>
        ))}
        {/* parked silhouettes for depth */}
        <mesh position={[-5.2, 0.35, -7]} castShadow>
          <boxGeometry args={[1.0, 0.55, 2.0]} />
          <meshStandardMaterial color="#3a3b40" />
        </mesh>
        <mesh position={[5.2, 0.35, -12]} castShadow>
          <boxGeometry args={[1.0, 0.55, 2.0]} />
          <meshStandardMaterial color="#33343a" />
        </mesh>
      </group>

      <group ref={car}>
        {/* body lower */}
        <mesh position={[0, 0.28, 0]} castShadow>
          <boxGeometry args={[1.22, 0.38, 2.35]} />
          <meshStandardMaterial color="#0e0f12" metalness={0.55} roughness={0.32} />
        </mesh>
        {/* cabin */}
        <mesh position={[0, 0.58, -0.08]} castShadow>
          <boxGeometry args={[1.05, 0.36, 1.25]} />
          <meshStandardMaterial color="#17181c" metalness={0.35} roughness={0.28} />
        </mesh>
        {/* glass */}
        <mesh position={[0, 0.62, -0.05]}>
          <boxGeometry args={[0.96, 0.26, 1.05]} />
          <meshStandardMaterial color="#7a8a9a" transparent opacity={0.42} metalness={0.9} roughness={0.08} />
        </mesh>
        {/* hood line */}
        <mesh position={[0, 0.42, -0.85]}>
          <boxGeometry args={[1.1, 0.06, 0.55]} />
          <meshStandardMaterial color="#121317" metalness={0.5} roughness={0.35} />
        </mesh>
        <mesh ref={brakeL} position={[-0.4, 0.32, 1.18]}>
          <boxGeometry args={[0.3, 0.1, 0.06]} />
          <meshStandardMaterial color="#300" emissive="#ff1f1f" transparent opacity={0.3} />
        </mesh>
        <mesh ref={brakeR} position={[0.4, 0.32, 1.18]}>
          <boxGeometry args={[0.3, 0.1, 0.06]} />
          <meshStandardMaterial color="#300" emissive="#ff1f1f" transparent opacity={0.3} />
        </mesh>
        <mesh ref={headL} position={[-0.38, 0.3, -1.16]}>
          <boxGeometry args={[0.26, 0.1, 0.05]} />
          <meshStandardMaterial color="#ddd" emissive="#fff6d0" emissiveIntensity={0.8} />
        </mesh>
        <mesh ref={headR} position={[0.38, 0.3, -1.16]}>
          <boxGeometry args={[0.26, 0.1, 0.05]} />
          <meshStandardMaterial color="#ddd" emissive="#fff6d0" emissiveIntensity={0.8} />
        </mesh>
        <group ref={wheels}>
          {[
            [-0.52, -0.78],
            [0.52, -0.78],
            [-0.52, 0.82],
            [0.52, 0.82],
          ].map(([x, z], i) => (
            <mesh key={i} position={[x, 0.15, z]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.18, 0.18, 0.16, 16]} />
              <meshStandardMaterial color="#111" roughness={0.7} />
            </mesh>
          ))}
        </group>
      </group>

      <Person groupRef={ped} />
      <mesh ref={marker}>
        <octahedronGeometry args={[0.28, 0]} />
        <meshStandardMaterial color="#0a0a0a" emissive="#111" emissiveIntensity={0.5} />
      </mesh>

      <OrbitControls enablePan={false} maxPolarAngle={Math.PI / 2.15} target={[0, 0.55, -1.8]} />
    </>
  );
}

function cruiseAhead(gap: number) {
  return -Math.min(Math.max(gap, 1.1), 16);
}

function AirScene({ refs, mode }: { refs: SceneRefs; mode: "evade" | "gust" | "spin" | "beacon" }) {
  const craft = useRef<THREE.Group>(null);
  const wall = useRef<THREE.Group>(null);
  const rotors = useRef<THREE.Group>(null);
  const beacon = useRef<THREE.Mesh>(null);
  const WALL_Z = -5.2;

  useFrame((_, dt) => {
    refs.smoothDistRef.current = THREE.MathUtils.damp(
      refs.smoothDistRef.current,
      refs.distanceRef.current,
      7,
      dt,
    );
    const gap = refs.smoothDistRef.current;

    // facade stays put — the drone flies into it
    if (wall.current) {
      wall.current.visible = mode === "evade";
      wall.current.position.z = WALL_Z;
    }

    if (craft.current) {
      const yaw = mode === "spin" && !refs.triggeredRef.current ? Math.sin(performance.now() / 180) * 0.9 : 0;
      const hover =
        mode === "gust" && !refs.triggeredRef.current ? Math.sin(performance.now() / 400) * 0.55 : 0;
      const tx = refs.lateralRef.current + hover;
      const ty = 1.15 + refs.altitudeRef.current;
      // gap shrinks → craft advances toward fixed wall
      const tz =
        mode === "evade"
          ? WALL_Z + Math.max(gap, 1.15)
          : 0.4 - Math.max(0, 8 - gap) * 0.15;
      craft.current.position.x = THREE.MathUtils.damp(craft.current.position.x, tx, 5.2, dt);
      craft.current.position.y = THREE.MathUtils.damp(craft.current.position.y, ty, 5.2, dt);
      craft.current.position.z = THREE.MathUtils.damp(craft.current.position.z, tz, 6.5, dt);
      craft.current.rotation.z = THREE.MathUtils.damp(craft.current.rotation.z, -refs.lateralRef.current * 0.32, 5, dt);
      craft.current.rotation.x = THREE.MathUtils.damp(
        craft.current.rotation.x,
        refs.altitudeRef.current * 0.08 + (mode === "evade" && !refs.triggeredRef.current ? -0.06 : 0),
        5,
        dt,
      );
      craft.current.rotation.y = THREE.MathUtils.damp(
        craft.current.rotation.y,
        yaw + refs.whyPulseRef.current * 0.4,
        4,
        dt,
      );
    }
    if (rotors.current) {
      rotors.current.children.forEach((c, i) => {
        c.rotation.y += dt * (22 + i) * (refs.triggeredRef.current ? 1.8 : 1.25);
      });
    }
    if (beacon.current) {
      beacon.current.visible = mode === "beacon";
      const t = performance.now() / 900;
      const bx = Math.sin(t) * 1.6 + refs.lateralRef.current * 0.2;
      const by = 1.4 + Math.cos(t * 0.7) * 0.3;
      const bz = -Math.min(gap, 10);
      beacon.current.position.x = THREE.MathUtils.damp(beacon.current.position.x, bx, 5, dt);
      beacon.current.position.y = THREE.MathUtils.damp(beacon.current.position.y, by, 5, dt);
      beacon.current.position.z = THREE.MathUtils.damp(beacon.current.position.z, bz, 5, dt);
    }
    refs.whyPulseRef.current = Math.max(0, refs.whyPulseRef.current - dt * 1.8);
  });

  return (
    <>
      <Lights />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial color="#dfe1e6" />
      </mesh>
      <gridHelper args={[50, 50, "#c5c7cc", "#d5d7dc"]} position={[0, 0.02, 0]} />
      <Building position={[-8, 0, -3]} size={[4, 6, 4]} />
      <Building position={[9, 0, -4]} size={[3.5, 9, 3.5]} shade="#cfd0d5" />
      <Building position={[-10, 0, -10]} size={[5, 4.5, 5]} shade="#d8d9de" />

      <group ref={wall} position={[0, 0, WALL_Z]}>
        <mesh position={[0, 2.6, 0]} castShadow>
          <boxGeometry args={[10, 5.6, 0.6]} />
          <meshStandardMaterial color="#1a1b1f" roughness={0.7} />
        </mesh>
        {[-2.6, 0, 2.6].map((x) => (
          <mesh key={x} position={[x, 2.4, 0.32]}>
            <boxGeometry args={[1.6, 2.0, 0.08]} />
            <meshStandardMaterial color="#2e3036" emissive="#3a3d45" emissiveIntensity={0.22} />
          </mesh>
        ))}
      </group>

      <group ref={craft}>
        <mesh castShadow>
          <boxGeometry args={[0.58, 0.14, 0.58]} />
          <meshStandardMaterial color="#101114" metalness={0.4} roughness={0.35} />
        </mesh>
        <group ref={rotors}>
          {[
            [-0.4, 0.08, -0.4],
            [0.4, 0.08, -0.4],
            [-0.4, 0.08, 0.4],
            [0.4, 0.08, 0.4],
          ].map((p, i) => (
            <mesh key={i} position={p as [number, number, number]}>
              <boxGeometry args={[0.44, 0.02, 0.07]} />
              <meshStandardMaterial color="#33353a" />
            </mesh>
          ))}
        </group>
      </group>

      <mesh ref={beacon}>
        <sphereGeometry args={[0.22, 16, 16]} />
        <meshStandardMaterial color="#0a0a0a" emissive="#222" emissiveIntensity={0.8} />
      </mesh>

      <OrbitControls enablePan={false} maxPolarAngle={Math.PI / 2.1} target={[0, 1.4, -2.2]} />
    </>
  );
}

function CorridorScene({ refs }: { refs: SceneRefs }) {
  const rover = useRef<THREE.Group>(null);
  const barrier = useRef<THREE.Mesh>(null);

  useFrame((_, dt) => {
    refs.smoothDistRef.current = THREE.MathUtils.damp(
      refs.smoothDistRef.current,
      refs.distanceRef.current,
      5,
      dt,
    );
    const gap = refs.smoothDistRef.current;
    if (barrier.current) {
      barrier.current.position.z = THREE.MathUtils.damp(
        barrier.current.position.z,
        -Math.min(gap, 14),
        4.5,
        dt,
      );
    }
    if (rover.current) {
      rover.current.position.x = THREE.MathUtils.damp(rover.current.position.x, refs.lateralRef.current, 4.5, dt);
      rover.current.position.z = THREE.MathUtils.damp(rover.current.position.z, refs.reverseRef.current, 4.5, dt);
      rover.current.rotation.y = THREE.MathUtils.damp(rover.current.rotation.y, refs.lateralRef.current * 0.25, 4.5, dt);
      rover.current.rotation.x = THREE.MathUtils.damp(rover.current.rotation.x, refs.brakeRef.current * 0.05, 5, dt);
    }
    refs.whyPulseRef.current = Math.max(0, refs.whyPulseRef.current - dt * 1.5);
  });

  return (
    <>
      <Lights />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -4]} receiveShadow>
        <planeGeometry args={[3.4, 26]} />
        <meshStandardMaterial color="#d2d3d7" />
      </mesh>
      <mesh position={[-1.9, 1.3, -4]}>
        <boxGeometry args={[0.28, 2.6, 24]} />
        <meshStandardMaterial color="#c4c5ca" />
      </mesh>
      <mesh position={[1.9, 1.3, -4]}>
        <boxGeometry args={[0.28, 2.6, 24]} />
        <meshStandardMaterial color="#c4c5ca" />
      </mesh>
      {[-8, -4, 0].map((z) => (
        <group key={z}>
          <mesh position={[-1.5, 0.95, z]}>
            <boxGeometry args={[0.4, 1.5, 1.7]} />
            <meshStandardMaterial color="#b5b6bb" />
          </mesh>
          <mesh position={[1.5, 0.95, z]}>
            <boxGeometry args={[0.4, 1.5, 1.7]} />
            <meshStandardMaterial color="#b5b6bb" />
          </mesh>
        </group>
      ))}
      <mesh ref={barrier} position={[0, 1.15, -10]} castShadow>
        <boxGeometry args={[3.1, 2.3, 0.28]} />
        <meshStandardMaterial color="#141518" />
      </mesh>
      <group ref={rover}>
        <mesh position={[0, 0.22, 0]} castShadow>
          <boxGeometry args={[0.92, 0.34, 1.18]} />
          <meshStandardMaterial color="#121316" />
        </mesh>
        <mesh position={[0, 0.48, -0.08]}>
          <boxGeometry args={[0.55, 0.24, 0.45]} />
          <meshStandardMaterial color="#1e1f24" />
        </mesh>
      </group>
      <OrbitControls enablePan={false} maxPolarAngle={Math.PI / 2.2} target={[0, 0.5, -2]} />
    </>
  );
}

/** Industrial circular saw — hand intrusion → blade e-stop. */
function MillScene({ refs, mode }: { refs: SceneRefs; mode: "saw" | "gantry" }) {
  const blade = useRef<THREE.Group>(null);
  const hand = useRef<THREE.Group>(null);
  const gantry = useRef<THREE.Group>(null);
  const spin = useRef(0);

  useFrame((_, dt) => {
    refs.smoothDistRef.current = THREE.MathUtils.damp(
      refs.smoothDistRef.current,
      refs.distanceRef.current,
      8,
      dt,
    );
    refs.smoothBrakeRef.current = THREE.MathUtils.damp(
      refs.smoothBrakeRef.current,
      refs.brakeRef.current,
      9,
      dt,
    );
    const gap = refs.smoothDistRef.current;
    const stop = refs.smoothBrakeRef.current;
    const spinning = !refs.triggeredRef.current && stop < 0.75;

    if (blade.current) {
      spin.current += dt * (spinning ? 28 : 1.2);
      blade.current.rotation.z = spin.current;
      blade.current.visible = mode === "saw";
    }

    if (hand.current) {
      hand.current.visible = mode === "saw";
      // gap shrinks → hand approaches spinning blade
      const hx = THREE.MathUtils.clamp(2.6 - (12 - gap) * 0.28, -0.15, 2.6);
      hand.current.position.x = THREE.MathUtils.damp(hand.current.position.x, hx, 7, dt);
      hand.current.position.y = 0.72;
      hand.current.position.z = 0.15;
      if (refs.triggeredRef.current) {
        hand.current.position.x = THREE.MathUtils.damp(hand.current.position.x, 0.85, 8, dt);
      }
    }

    if (gantry.current) {
      gantry.current.visible = mode === "gantry";
      const gx = refs.lateralRef.current * 1.4 + (refs.triggeredRef.current ? 0 : Math.sin(performance.now() / 700) * 0.15);
      gantry.current.position.x = THREE.MathUtils.damp(gantry.current.position.x, gx, 5, dt);
      gantry.current.position.y = 2.05;
      gantry.current.position.z = -Math.min(gap * 0.15, 1.2);
    }

    refs.whyPulseRef.current = Math.max(0, refs.whyPulseRef.current - dt * 1.6);
  });

  return (
    <>
      <Lights />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[28, 28]} />
        <meshStandardMaterial color="#d8d9de" />
      </mesh>
      <mesh position={[0, 0.45, 0]} receiveShadow castShadow>
        <boxGeometry args={[5.2, 0.9, 2.4]} />
        <meshStandardMaterial color="#b8b9be" metalness={0.35} roughness={0.45} />
      </mesh>
      {/* fence / machine body */}
      <mesh position={[-2.1, 1.1, 0]} castShadow>
        <boxGeometry args={[0.35, 1.8, 2.2]} />
        <meshStandardMaterial color="#2a2b30" />
      </mesh>
      <mesh position={[0, 1.35, -1.05]} castShadow>
        <boxGeometry args={[4.4, 0.7, 0.22]} />
        <meshStandardMaterial color="#1e1f24" />
      </mesh>

      {/* saw arbor + blade */}
      <group position={[-0.35, 0.95, 0.05]}>
        <mesh position={[0, 0, 0]} castShadow>
          <boxGeometry args={[0.55, 0.35, 0.55]} />
          <meshStandardMaterial color="#111" metalness={0.5} roughness={0.35} />
        </mesh>
        <group ref={blade} position={[0.42, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.72, 0.72, 0.05, 48]} />
            <meshStandardMaterial color="#3a3b40" metalness={0.85} roughness={0.2} />
          </mesh>
          {Array.from({ length: 12 }).map((_, i) => (
            <mesh key={i} rotation={[0, 0, (i / 12) * Math.PI * 2]} position={[0, 0, 0]}>
              <boxGeometry args={[0.08, 1.35, 0.02]} />
              <meshStandardMaterial color="#c8cacf" metalness={0.9} roughness={0.15} />
            </mesh>
          ))}
        </group>
      </group>

      {/* approaching hand / stock */}
      <group ref={hand}>
        <mesh position={[0, 0, 0]} castShadow>
          <boxGeometry args={[0.55, 0.16, 0.28]} />
          <meshStandardMaterial color="#2c2d32" />
        </mesh>
        <mesh position={[-0.38, 0.02, 0]} castShadow>
          <boxGeometry args={[0.22, 0.12, 0.22]} />
          <meshStandardMaterial color="#1a1b1f" />
        </mesh>
        {[0.12, 0, -0.12].map((z, i) => (
          <mesh key={i} position={[-0.55, 0.02, z]} castShadow>
            <capsuleGeometry args={[0.035, 0.22, 4, 6]} />
            <meshStandardMaterial color="#15161a" />
          </mesh>
        ))}
      </group>

      {/* overhead gantry carriage */}
      <group ref={gantry}>
        <mesh position={[0, 0.15, 0]}>
          <boxGeometry args={[6.5, 0.12, 0.18]} />
          <meshStandardMaterial color="#3a3b40" />
        </mesh>
        <mesh position={[0, -0.35, 0]} castShadow>
          <boxGeometry args={[0.9, 0.55, 0.7]} />
          <meshStandardMaterial color="#121316" />
        </mesh>
        <mesh position={[0, -0.75, 0]}>
          <boxGeometry args={[0.35, 0.35, 0.35]} />
          <meshStandardMaterial color="#0a0a0a" />
        </mesh>
      </group>

      <OrbitControls enablePan={false} maxPolarAngle={Math.PI / 2.15} target={[0, 0.85, 0]} />
    </>
  );
}

/** Robot arm / hand on a workbench. */
function BenchScene({ refs, mode }: { refs: SceneRefs; mode: "arm" | "grasp" }) {
  const base = useRef<THREE.Group>(null);
  const arm = useRef<THREE.Group>(null);
  const wrist = useRef<THREE.Group>(null);
  const part = useRef<THREE.Mesh>(null);

  useFrame((_, dt) => {
    refs.smoothDistRef.current = THREE.MathUtils.damp(
      refs.smoothDistRef.current,
      refs.distanceRef.current,
      7,
      dt,
    );
    const gap = refs.smoothDistRef.current;
    const reach = Math.min(1, Math.max(0, (11 - gap) / 9));

    if (arm.current) {
      const yawErr = mode === "arm" && !refs.triggeredRef.current ? refs.lateralRef.current : 0;
      const yawFix = refs.triggeredRef.current && mode === "arm" ? refs.lateralRef.current : yawErr;
      arm.current.rotation.y = THREE.MathUtils.damp(arm.current.rotation.y, yawFix * 0.55, 5, dt);
      arm.current.rotation.x = THREE.MathUtils.damp(
        arm.current.rotation.x,
        -0.35 - reach * 0.55 + (refs.triggeredRef.current && mode === "grasp" ? 0.25 : 0),
        5.5,
        dt,
      );
    }
    if (wrist.current) {
      wrist.current.rotation.z = THREE.MathUtils.damp(
        wrist.current.rotation.z,
        refs.triggeredRef.current && mode === "grasp" ? 0.35 : mode === "arm" ? refs.lateralRef.current * 0.4 : 0,
        6,
        dt,
      );
    }
    if (part.current) {
      part.current.visible = mode === "grasp";
      const t = performance.now() / 1100;
      const px = refs.triggeredRef.current ? 0.15 : Math.sin(t) * 1.1;
      const pz = -0.4 - reach * 0.9;
      part.current.position.x = THREE.MathUtils.damp(part.current.position.x, px + refs.lateralRef.current * 0.2, 5, dt);
      part.current.position.z = THREE.MathUtils.damp(part.current.position.z, pz, 5, dt);
      part.current.position.y = 0.55;
    }
    refs.whyPulseRef.current = Math.max(0, refs.whyPulseRef.current - dt * 1.5);
  });

  return (
    <>
      <Lights />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[24, 24]} />
        <meshStandardMaterial color="#dde0e5" />
      </mesh>
      <mesh position={[0, 0.38, 0]} receiveShadow castShadow>
        <boxGeometry args={[3.6, 0.76, 2.2]} />
        <meshStandardMaterial color="#c5c6cb" />
      </mesh>
      <mesh position={[0, 0.78, 0]} receiveShadow>
        <boxGeometry args={[3.4, 0.06, 2.0]} />
        <meshStandardMaterial color="#ececef" />
      </mesh>

      <group ref={base} position={[-0.9, 0.82, 0.35]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.28, 0.34, 0.22, 20]} />
          <meshStandardMaterial color="#1a1b1f" />
        </mesh>
        <group ref={arm} position={[0, 0.18, 0]}>
          <mesh position={[0, 0.45, 0]} castShadow>
            <boxGeometry args={[0.22, 0.95, 0.22]} />
            <meshStandardMaterial color="#121316" />
          </mesh>
          <mesh position={[0, 0.95, 0]} castShadow>
            <sphereGeometry args={[0.16, 16, 16]} />
            <meshStandardMaterial color="#2a2b30" metalness={0.4} />
          </mesh>
          <group position={[0, 0.95, 0]} rotation={[0.4, 0, 0]}>
            <mesh position={[0, 0.55, 0]} castShadow>
              <boxGeometry args={[0.18, 1.05, 0.18]} />
              <meshStandardMaterial color="#0e0f12" />
            </mesh>
            <group ref={wrist} position={[0, 1.1, 0]}>
              <mesh castShadow>
                <boxGeometry args={[0.32, 0.18, 0.24]} />
                <meshStandardMaterial color="#1e1f24" />
              </mesh>
              <mesh position={[-0.12, -0.18, 0]} castShadow>
                <boxGeometry args={[0.08, 0.28, 0.1]} />
                <meshStandardMaterial color="#111" />
              </mesh>
              <mesh position={[0.12, -0.18, 0]} castShadow>
                <boxGeometry args={[0.08, 0.28, 0.1]} />
                <meshStandardMaterial color="#111" />
              </mesh>
            </group>
          </group>
        </group>
      </group>

      <mesh ref={part} castShadow>
        <boxGeometry args={[0.28, 0.16, 0.28]} />
        <meshStandardMaterial color="#0a0a0a" emissive="#222" emissiveIntensity={0.35} />
      </mesh>

      <OrbitControls enablePan={false} maxPolarAngle={Math.PI / 2.2} target={[0, 1.0, 0]} />
    </>
  );
}

function SceneForCase({ caseId, refs }: { caseId: CaseId; refs: SceneRefs }) {
  const c = getCase(caseId);
  if (c.scene === "street") return <StreetScene refs={refs} mode="brake" />;
  if (c.scene === "mill") {
    return <MillScene refs={refs} mode={caseId === "flow-gantry" ? "gantry" : "saw"} />;
  }
  if (c.scene === "bench") {
    return <BenchScene refs={refs} mode={caseId === "track-part" ? "grasp" : "arm"} />;
  }
  if (c.scene === "corridor") return <CorridorScene refs={refs} />;
  const mode =
    caseId === "flow-gust" ? "gust" : caseId === "heading-spin" ? "spin" : caseId === "track-beacon" ? "beacon" : "evade";
  return <AirScene refs={refs} mode={mode} />;
}

function buildInput(blockId: BlockId, dist: number, noise: number, extras: { yaw?: number; bearing?: number }) {
  const jitter = () => (Math.random() * 2 - 1) * noise;
  const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

  if (blockId === "loomguard") {
    // fire late — only when hazard is truly close
    const proximity = dist < 2.6 ? Math.min(1, (2.6 - dist) / 1.6) : dist < 4.5 ? 0.1 : 0.03;
    const loom = dist < 2.15 ? Math.min(1, (2.15 - dist) / 1.25) : 0;
    return [
      q16(clamp01(proximity + jitter())),
      q16(clamp01(proximity * 0.35 + jitter())),
      q16(clamp01(proximity * 0.35 + jitter())),
      q16(clamp01(loom + jitter())),
    ];
  }
  if (blockId === "flowsense") {
    const proximity = Math.min(1, 1 / Math.max(dist, 0.25) / 3.2);
    const loom = dist < 6 ? Math.min(1, (6 - dist) / 6) : 0;
    return [q16(clamp01(Math.max(proximity, loom) * 1.05 + jitter()))];
  }
  if (blockId === "headingcell") {
    const yaw = extras.yaw ?? Math.min(1, (6 - dist) / 6);
    const proximity = Math.min(1, 1 / Math.max(dist, 0.25) / 3.2);
    return [
      q16(clamp01(yaw + jitter())),
      q16(clamp01(yaw * 0.7 + jitter())),
      q16(clamp01((extras.bearing ?? proximity) + jitter())),
    ];
  }
  const proximity = Math.min(1, 1 / Math.max(dist, 0.25) / 3.2);
  const loom = dist < 6 ? Math.min(1, (6 - dist) / 6) : 0;
  return [q16(clamp01(Math.max(proximity, loom) + jitter()))];
}

function FrameCard({
  label,
  frame,
  active,
}: {
  label: string;
  frame: FrameSnapshot;
  active?: boolean;
}) {
  const maxIn = Math.max(...frame.inputChannels.map((c) => c.value), 0.001);
  return (
    <div className={`why-frame-card ${active ? "active" : ""} ${frame.trigger ? "is-trigger" : ""}`}>
      <div className="why-frame-label">
        <span>{label}</span>
        <span className="mono">{frame.trigger ? "TRIGGER" : "CRUISE"}</span>
      </div>
      <div className="mono why-frame-meta">
        tick {frame.tick} · {frame.distance.toFixed(2)} m · {frame.firedCount} spikes
      </div>
      <div className="why-frame-action">{frame.actionType ?? "—"}</div>
      <div className="why-frame-channels">
        {frame.inputChannels.map((ch) => (
          <div key={ch.name}>
            <div className="why-ch-row">
              <span className="mono">{ch.name}</span>
              <span className="mono">{ch.value.toFixed(3)}</span>
            </div>
            <div className="why-bar-track">
              <div className="why-bar-fill" style={{ width: `${(ch.value / maxIn) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
      <div className="mono muted" style={{ fontSize: 11, marginTop: 8 }}>
        danger {fromQ16(frame.danger).toFixed(3)} · avoidX {fromQ16(frame.avoidX).toFixed(3)}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
        {frame.triggerNeuronIds.map((id) => (
          <span key={`t-${id}`} className="neuron-chip neuron-trigger">
            T{id}
          </span>
        ))}
        {frame.dangerNeuronIds.map((id) => (
          <span key={`d-${id}`} className="neuron-chip neuron-danger">
            D{id}
          </span>
        ))}
        {frame.traceNeuronIds
          .filter((id) => !frame.triggerNeuronIds.includes(id) && !frame.dangerNeuronIds.includes(id))
          .slice(0, 12)
          .map((id) => (
            <span key={id} className="neuron-chip">
              {id}
            </span>
          ))}
      </div>
    </div>
  );
}

function WhyOverlay({
  detail,
  onClose,
}: {
  detail: NonNullable<ReturnType<typeof useLabStore.getState>["whyDetail"]>;
  onClose: () => void;
}) {
  const r = detail.receipt;
  const onTrigger: FrameSnapshot = {
    tick: r.tick,
    distance: r.distance,
    danger: r.danger,
    avoidX: r.avoidX,
    avoidY: r.avoidY,
    firedCount: r.firedCount,
    trigger: true,
    traceNeuronIds: r.traceNeuronIds,
    triggerNeuronIds: r.triggerNeuronIds,
    dangerNeuronIds: r.dangerNeuronIds,
    inputChannels: r.inputChannels,
    actionType: r.actionType,
  };
  const before = r.before;
  const [phase, setPhase] = useState<"before" | "trigger">(before ? "before" : "trigger");
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    if (!playing || !before) return;
    const id = window.setInterval(() => {
      setPhase((p) => (p === "before" ? "trigger" : "before"));
    }, 1400);
    return () => window.clearInterval(id);
  }, [playing, before]);

  const shown = phase === "before" && before ? before : onTrigger;

  return (
    <div className="why-overlay">
      <div className="why-overlay-head">
        <div>
          <div className="why-kicker">INSPECT WHY · MODULE REPLAY</div>
          <div className="why-title">{r.actionType}</div>
          <div className="mono muted" style={{ fontSize: 12, marginTop: 4 }}>
            one tick before → on trigger · replay{" "}
            <strong style={{ color: detail.replayMatch === "MATCH" ? "var(--fg)" : "var(--muted)" }}>
              {detail.replayMatch}
            </strong>
          </div>
        </div>
        <button type="button" className="sim-action" onClick={onClose}>
          Close
        </button>
      </div>

      <p style={{ padding: "0 24px", fontSize: 12 }}>Exact neural state replay · unsigned local evidence. Scene behavior and physical actuation are not verified. {detail.replayError}</p>
      <a href="/verify?evidence=simulator" className="btn btn-ghost" style={{ margin: "0 24px 16px" }}>Inspect verification evidence →</a>
      <div className="why-replay-window">
        <div className="why-replay-toolbar">
          <button
            type="button"
            className="sim-action"
            data-primary={playing ? undefined : "1"}
            onClick={() => setPlaying((p) => !p)}
          >
            {playing ? <IconPause /> : <IconPlay />}
            {playing ? "Pause replay" : "Play replay"}
          </button>
          <div className="why-phase-tabs">
            <button
              type="button"
              className={phase === "before" ? "why-phase active" : "why-phase"}
              disabled={!before}
              onClick={() => {
                setPlaying(false);
                setPhase("before");
              }}
            >
              t − 1 · before
            </button>
            <button
              type="button"
              className={phase === "trigger" ? "why-phase active" : "why-phase"}
              onClick={() => {
                setPlaying(false);
                setPhase("trigger");
              }}
            >
              t · trigger
            </button>
          </div>
        </div>

        <div className="why-replay-stage">
          <div className={`why-replay-pulse ${phase}`}>
            <div className="why-replay-pulse-label mono">
              {phase === "before" ? "INSTANCE BEFORE" : "ON TRIGGER"}
            </div>
            <div className="why-replay-pulse-title">{shown.actionType ?? "sensing…"}</div>
            <div className="mono" style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
              tick {shown.tick} · range {shown.distance.toFixed(2)} m · spikes {shown.firedCount}
            </div>
            <div className="why-replay-bars">
              {shown.inputChannels.map((ch) => {
                const maxIn = Math.max(...shown.inputChannels.map((c) => c.value), 0.001);
                return (
                  <div key={ch.name} className="why-replay-bar-row">
                    <span className="mono">{ch.name}</span>
                    <div className="why-bar-track">
                      <div
                        className="why-bar-fill"
                        style={{
                          width: `${(ch.value / maxIn) * 100}%`,
                          transition: "width 500ms ease",
                        }}
                      />
                    </div>
                    <span className="mono">{ch.value.toFixed(3)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="why-frame-compare">
          {before ? (
            <FrameCard label="t − 1 · one instance before" frame={before} active={phase === "before"} />
          ) : (
            <div className="why-frame-card muted">No prior tick captured</div>
          )}
          <FrameCard label="t · on trigger" frame={onTrigger} active={phase === "trigger"} />
        </div>
      </div>
    </div>
  );
}

export function Simulator() {
  const vmRef = useRef<SynapseVmJs | null>(null);
  const prevTrigger = useRef(false);
  const distanceRef = useRef(10);
  const smoothDistRef = useRef(10);
  const brakeRef = useRef(0);
  const smoothBrakeRef = useRef(0);
  const lateralRef = useRef(0);
  const altitudeRef = useRef(0);
  const reverseRef = useRef(0);
  const pedestrianRef = useRef(-3.35);
  const triggeredRef = useRef(false);
  const whyPulseRef = useRef(0);
  const channelNamesRef = useRef<string[]>([]);
  const preFrameRef = useRef<FrameSnapshot | null>(null);

  const refs = useMemo<SceneRefs>(
    () => ({
      distanceRef,
      smoothDistRef,
      brakeRef,
      smoothBrakeRef,
      lateralRef,
      altitudeRef,
      reverseRef,
      pedestrianRef,
      triggeredRef,
      whyPulseRef,
    }),
    [],
  );

  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [uiTick, setUiTick] = useState(0);
  const [uiDist, setUiDist] = useState(10);
  const [last, setLast] = useState<StepView | null>(null);
  const [triggerHold, setTriggerHold] = useState(false);
  const [holdAction, setHoldAction] = useState<string | null>(null);

  const { running, blockId, caseId, blockEnabled, speedScale, noise, set, pushReceipt, whyOpen, whyDetail } =
    useLabStore();
  const block = getBlock(blockId);
  const simCase = getCase(caseId);
  const blockCases = casesForBlock(blockId);
  const soonCases = comingSoonForBlock(blockId);

  const snapTriggerPose = (id: CaseId) => {
    triggeredRef.current = true;
    const c = getCase(id);
    if (id === "car-brake") {
      brakeRef.current = 1;
      // freeze close — ped already in mid-lane
      distanceRef.current = Math.min(Math.max(distanceRef.current, 1.05), 1.35);
      pedestrianRef.current = 0;
      return;
    }
    if (id === "saw-estop") {
      brakeRef.current = 1;
      distanceRef.current = Math.min(Math.max(distanceRef.current, 1.1), 1.45);
      return;
    }
    if (c.actionOnTrigger.includes("BRAKE") || c.actionOnTrigger.includes("STOP") || c.actionOnTrigger.includes("CENTER")) {
      brakeRef.current = 1;
      distanceRef.current = Math.max(distanceRef.current, 1.2);
      if (id === "flow-gantry") lateralRef.current = 0;
    }
    if (c.actionOnTrigger.includes("BANK") || c.actionOnTrigger.includes("DRIFT") || c.actionOnTrigger.includes("YAW")) {
      lateralRef.current = id === "flow-gust" ? 0.15 : 1.85;
      altitudeRef.current = 0.6;
      distanceRef.current = Math.min(Math.max(distanceRef.current, 1.25), 1.85);
    }
    if (c.actionOnTrigger.includes("STEER") || c.actionOnTrigger.includes("PURSUE") || c.actionOnTrigger.includes("LOCK")) {
      lateralRef.current = id === "heading-arm" ? 0.85 : 0.55;
      reverseRef.current = id === "heading-arm" ? 0.2 : 0;
      distanceRef.current = Math.max(distanceRef.current, 1.5);
    }
  };

  const openWhy = useCallback(async () => {
    const receipts = useLabStore.getState().receipts;
    if (!receipts.length) return;
    const receipt = receipts[receipts.length - 1];
    set({ whyOpen: true, running: false, whyDetail: null });
    try { sessionStorage.removeItem("synapsevm.verify.evidence"); } catch { /* storage unavailable */ }
    whyPulseRef.current = 1;

    try {
      if (!receipt.modelBytes || !receipt.stateBeforeBytes || !receipt.stateAfterBytes) throw new Error("Exact replay state was not captured. Generate a new event.");
      const evidence = await captureEvidence(receipt.modelBytes, receipt.tick, receipt.input, receipt.stateBeforeBytes, receipt.output, receipt.stateAfterBytes);
      const report = await verifyBrowserEvidence(evidence);
      if (useLabStore.getState().receipts.at(-1) !== receipt) return;
      try { sessionStorage.setItem("synapsevm.verify.evidence", JSON.stringify(evidence)); } catch { /* replay result remains valid without storage */ }
      set({ whyDetail: { receipt, replayMatch: report.outcome === "MATCH" ? "MATCH" : "MISMATCH", replayFired: receipt.output.traceNeuronIds, replayTrigger: receipt.output.trigger } });
    } catch (error) {
      set({ whyDetail: { receipt, replayMatch: "ERROR", replayError: String(error), replayFired: [], replayTrigger: false } });
    }
  }, [set]);

  const resetMotion = (id: CaseId = caseId) => {
    const c = getCase(id);
    distanceRef.current =
      id === "car-brake"
        ? 12
        : id === "saw-estop"
          ? 11
          : c.scene === "air"
            ? 9
            : c.scene === "bench" || c.scene === "mill"
              ? 10.5
              : c.scene === "corridor"
                ? 9
                : 11;
    smoothDistRef.current = distanceRef.current;
    brakeRef.current = 0;
    smoothBrakeRef.current = 0;
    lateralRef.current = id === "heading-arm" ? -0.9 : id === "flow-gantry" ? 0.7 : 0;
    altitudeRef.current = 0;
    reverseRef.current = 0;
    pedestrianRef.current = -3.35;
    triggeredRef.current = false;
    prevTrigger.current = false;
    whyPulseRef.current = 0;
    preFrameRef.current = null;
    vmRef.current?.reset();
    setTriggerHold(false);
    setHoldAction(null);
  };

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setLoadError(null);
    loadBlock(blockId)
      .then((vm) => {
        if (cancelled) return;
        vmRef.current = vm;
        channelNamesRef.current = vm.block.inputChannels.map((c) => c.name);
        setReady(true);
        set({ running: false });
      })
      .catch((e) => {
        if (!cancelled) setLoadError(`Failed to load ${blockId}: ${String(e)}`);
      });
    return () => {
      cancelled = true;
    };
  }, [blockId, set]);

  useEffect(() => {
    if (!running || !ready || triggerHold || whyOpen) return;
    let alive = true;
    let acc = 0;
    let lastTs = performance.now();

    const loop = (ts: number) => {
      if (!alive) return;
      const dt = ts - lastTs;
      lastTs = ts;
      acc += dt;
      if (acc >= 50) {
        acc = 0;
        const vm = vmRef.current;
        if (!vm) {
          requestAnimationFrame(loop);
          return;
        }
        const st = useLabStore.getState();
        const id = st.caseId;
        let dist = distanceRef.current;
        const c = getCase(id);
        // Baseline approach step per scene, authored for a readable pace.
        const baseCruise =
          id === "car-brake" || id === "saw-estop"
            ? 0.26
            : c.scene === "air"
              ? 0.08
              : c.scene === "mill" || c.scene === "bench"
                ? 0.09
                : c.scene === "corridor"
                  ? 0.05
                  : Math.max(st.speed, 0.07);
        const cruise = baseCruise * st.speedScale;
        dist = Math.max(0.08, dist - cruise);

        const extras =
          id === "heading-spin"
            ? { yaw: Math.min(1, 0.4 + (6 - dist) / 5) }
            : id === "heading-arm"
              ? { yaw: Math.min(1, Math.abs(lateralRef.current) + (7 - dist) / 8), bearing: 0.3 }
              : {};

        const input = st.blockEnabled
          ? buildInput(st.blockId, dist, st.noise, extras)
          : new Array(Math.max(1, channelNamesRef.current.length || 4)).fill(0);

        const t = st.tick + 1;
        const exactStateBefore = Array.from(vm.snapshot());
        let result: StepView;
        try {
          result = st.blockEnabled
            ? vm.step(input, t)
            : {
                danger: 0,
                avoidX: 0,
                avoidY: 0,
                trigger: false,
                firedCount: 0,
                traceNeuronIds: [],
                triggerNeuronIds: [],
                dangerNeuronIds: [],
                voltages: [],
              };
        } catch (e) {
          setLoadError(`Step failed: ${String(e)}`);
          set({ running: false });
          return;
        }

        distanceRef.current = dist;
        const names = channelNamesRef.current.length
          ? channelNamesRef.current
          : input.map((_, i) => `in${i}`);
        const channels = names.map((name, i) => ({
          name,
          q16: input[i] ?? 0,
          value: fromQ16(input[i] ?? 0),
        }));

        if (result.trigger && !prevTrigger.current) {
          const actionType = getCase(id).actionOnTrigger.replace(/\s*\+\s*/g, "_").replace(/\s+/g, "_");
          snapTriggerPose(id);
          const receipt: ReceiptEvent = {
            tick: t,
            actionType,
            danger: result.danger,
            avoidX: result.avoidX,
            avoidY: result.avoidY,
            traceNeuronIds: result.traceNeuronIds,
            triggerNeuronIds: result.triggerNeuronIds,
            dangerNeuronIds: result.dangerNeuronIds,
            input,
            inputChannels: channels,
            firedCount: result.firedCount,
            distance: distanceRef.current,
            caseId: id,
            blockId: st.blockId,
            before: preFrameRef.current,
            modelBytes: JSON.stringify(vm.block),
            stateBeforeBytes: exactStateBefore,
            stateAfterBytes: Array.from(vm.snapshot()),
            output: structuredClone(result),
          };
          pushReceipt(receipt);
          prevTrigger.current = true;
          setHoldAction(actionType);
          setTriggerHold(true);
          set({ running: false, tick: t, distance: distanceRef.current, last: result });
          setUiTick(t);
          setUiDist(distanceRef.current);
          setLast(result);
          return;
        }

        // keep prior non-trigger frame for WHY? before→trigger compare
        preFrameRef.current = {
          tick: t,
          distance: dist,
          danger: result.danger,
          avoidX: result.avoidX,
          avoidY: result.avoidY,
          firedCount: result.firedCount,
          trigger: result.trigger,
          traceNeuronIds: result.traceNeuronIds,
          triggerNeuronIds: result.triggerNeuronIds,
          dangerNeuronIds: result.dangerNeuronIds,
          inputChannels: channels,
          actionType: null,
        };

        set({ tick: t, distance: dist, last: result });
        setUiTick(t);
        setUiDist(dist);
        setLast(result);
      }
      requestAnimationFrame(loop);
    };

    const raf = requestAnimationFrame(loop);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, [running, ready, triggerHold, whyOpen, pushReceipt, set]);

  const selectBlock = (id: BlockId) => {
    const first = casesForBlock(id)[0];
    set({
      blockId: id,
      caseId: first.id,
      tick: 0,
      receipts: [],
      whyOpen: false,
      whyDetail: null,
      last: null,
      speed: first.defaultSpeed,
      running: false,
    });
    resetMotion(first.id);
    setUiTick(0);
    setUiDist(distanceRef.current);
    setLast(null);
  };

  const selectCase = (id: CaseId) => {
    const c = getCase(id);
    set({
      caseId: id,
      tick: 0,
      receipts: [],
      whyOpen: false,
      whyDetail: null,
      last: null,
      speed: c.defaultSpeed,
      running: false,
    });
    resetMotion(id);
    setUiTick(0);
    setUiDist(distanceRef.current);
    setLast(null);
  };

  const resetScene = () => {
    resetMotion(caseId);
    set({
      tick: 0,
      distance: distanceRef.current,
      receipts: [],
      whyOpen: false,
      whyDetail: null,
      last: null,
      running: false,
    });
    setUiTick(0);
    setUiDist(distanceRef.current);
    setLast(null);
  };

  return (
    <div className="simlab">
      <div className="simlab-controls">
        <section aria-labelledby="block-picker-label">
          <div className="simlab-section-label">
            <span className="why-kicker" id="block-picker-label">NeuroBlock</span>
            <span className="mono muted">{NEURO_BLOCKS.length} available</span>
          </div>
          <div className="simlab-block-cards">
        {NEURO_BLOCKS.map((b) => {
          const on = b.id === blockId;
          return (
            <button
              key={b.id}
              type="button"
              className={on ? "block-pick-card active" : "block-pick-card"}
              aria-pressed={on}
              onClick={() => selectBlock(b.id)}
            >
              <div className="block-pick-top">
                <span className="block-pick-name">{b.name}</span>
                <span className="block-pick-ver">v{b.version}</span>
              </div>
              <div className="block-pick-tagline">{b.tagline}</div>
              <p className="block-pick-desc">{b.description}</p>
              <div className="mono muted" style={{ fontSize: 11, marginTop: 8 }}>
                {b.neuronCount.toLocaleString()}n · {b.synapseCount.toLocaleString()} syn · {b.priority.replace("_", " ")}
              </div>
            </button>
          );
        })}
          </div>
        </section>

        <section className="simlab-usecases" aria-labelledby="usecase-label">
        <div className="simlab-usecases-head">
          <div className="simlab-section-label">
            <span className="why-kicker" id="usecase-label">Use cases</span>
            <span className="mono muted">{blockCases.length} runnable</span>
          </div>
          <p className="muted simlab-usecases-blurb">
            Example applications for {block.name} — what this NeuroBlock can do in the field.
          </p>
        </div>
        <div className="simlab-cases">
          {blockCases.map((c) => {
            const on = c.id === caseId;
            return (
              <button
                key={c.id}
                type="button"
                className={on ? "usecase-card active" : "usecase-card"}
                aria-pressed={on}
                onClick={() => selectCase(c.id)}
              >
                <div className="usecase-card-top">
                  <span className="usecase-emb">{c.tag}</span>
                  {on && <span className="usecase-live">Active</span>}
                </div>
                <div className="usecase-title">{c.title}</div>
                <p className="usecase-sum">{c.summary}</p>
                <div className="usecase-meta">
                  <div>
                    <span className="usecase-meta-label">Hazard</span>
                    <span>{c.hazard}</span>
                  </div>
                  <div>
                    <span className="usecase-meta-label">Success</span>
                    <span>{c.success}</span>
                  </div>
                  <div>
                    <span className="usecase-meta-label">Trigger</span>
                    <span className="mono">{c.actionOnTrigger}</span>
                  </div>
                </div>
              </button>
            );
          })}
          {soonCases.map((c) => (
            <div key={c.id} className="usecase-card soon" aria-disabled="true">
              <div className="usecase-card-top">
                <span className="usecase-emb">{c.tag}</span>
                <span className="usecase-soon">Coming soon</span>
              </div>
              <div className="usecase-title">{c.title}</div>
              <p className="usecase-sum">{c.summary}</p>
              <div className="usecase-meta">
                <div>
                  <span className="usecase-meta-label">Hazard</span>
                  <span>{c.hazard}</span>
                </div>
                <div>
                  <span className="usecase-meta-label">Success</span>
                  <span>{c.success}</span>
                </div>
                <div>
                  <span className="usecase-meta-label">Trigger</span>
                  <span className="mono">{c.actionOnTrigger}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
        </section>

        <section className="simlab-settings" aria-labelledby="run-settings-label">
          <div className="simlab-section-label">
            <span className="why-kicker" id="run-settings-label">Run settings</span>
            <button
              type="button"
              className="simlab-reset-settings"
              onClick={() => set({ speedScale: 1, noise: 0 })}
              disabled={speedScale === 1 && noise === 0}
            >
              Reset
            </button>
          </div>

          <label className="simlab-setting">
            <span>
              Approach speed
              <b>{speedScale.toFixed(2)}×</b>
            </span>
            <input
              type="range"
              min={0.25}
              max={2}
              step={0.05}
              value={speedScale}
              onChange={(e) => set({ speedScale: Number(e.target.value) })}
            />
            <small>How fast the hazard closes. Scales the scene&rsquo;s authored pace.</small>
          </label>

          <label className="simlab-setting">
            <span>
              Sensor noise
              <b>±{noise.toFixed(3)}</b>
            </span>
            <input
              type="range"
              min={0}
              max={0.25}
              step={0.005}
              value={noise}
              onChange={(e) => set({ noise: Number(e.target.value) })}
            />
            <small>Uniform jitter added to every input channel before encoding.</small>
          </label>

          <dl className="simlab-fixed">
            <div>
              <dt>Runtime</dt>
              <dd className="mono">Q16.16 fixed point</dd>
            </div>
            <div>
              <dt>Input channels</dt>
              <dd className="mono">{block.inputs.length}</dd>
            </div>
            <div>
              <dt>On trigger</dt>
              <dd className="mono">{simCase.actionOnTrigger}</dd>
            </div>
          </dl>
        </section>
      </div>

      <div className={`simlab-canvas-wrap ${triggerHold ? "triggered" : ""}`}>
          <div className="simlab-action-bar">
            <button
              type="button"
              className="sim-action icon-btn"
              data-primary={running && !triggerHold ? undefined : "1"}
              disabled={!ready || triggerHold}
              title={triggerHold ? "Frozen — reset to run again" : running ? "Pause" : "Play"}
              onClick={() => {
                if (triggerHold) return;
                set({ running: !running });
              }}
            >
              {running && !triggerHold ? <IconPause /> : <IconPlay />}
              <span>{running && !triggerHold ? "Pause" : "Play"}</span>
            </button>
            <button type="button" className="sim-action icon-btn" title="Reset" onClick={resetScene}>
              <IconReset />
              <span>Reset</span>
            </button>
            <button
              type="button"
              className="sim-action icon-btn"
              aria-pressed={blockEnabled}
              title={blockEnabled ? "Sensors on" : "Sensors off"}
              onClick={() => set({ blockEnabled: !blockEnabled })}
            >
              <IconSensor on={blockEnabled} />
              <span>{blockEnabled ? "Sensor on" : "Sensor off"}</span>
            </button>
          </div>

          {(() => {
            const comp = compositionFor("synapsevm/" + blockId);
            if (!comp) return null;
            return (
              <div className="simlab-provenance">
                <span className="simlab-provenance-label">Running</span>
                <ol className="simlab-chain">
                  {chainFor(comp).map((l) => (
                    <li key={l.id} className={l.verified ? "is-verified" : "is-attributed"}>
                      <Link href={"/explore/" + l.id} title={RELATION_LABELS[l.relation] + " · " + l.detail}>
                        {l.name}
                      </Link>
                    </li>
                  ))}
                  <li className="is-self">
                    <Link href={"/explore/synapsevm/" + blockId}>{block.name}</Link>
                  </li>
                </ol>
              </div>
            );
          })()}

          <div className="simlab-viewport">
            <Canvas
              key={`${blockId}-${caseId}`}
              shadows="soft"
              dpr={[1, 2]}
              gl={{ antialias: true, toneMappingExposure: 1.05 }}
              camera={{
                position:
                  simCase.scene === "air"
                    ? [6.2, 4.0, 7.2]
                    : simCase.scene === "mill" || simCase.scene === "bench"
                      ? [4.4, 2.8, 4.8]
                      : [5.2, 3.0, 6.8],
                fov: 44,
              }}
            >
              <SceneForCase caseId={caseId} refs={refs} />
            </Canvas>

            <aside className="simlab-live-rail" aria-label="Live telemetry">
              <div className="why-kicker">Live</div>
              <div className="simlab-live-rail-rows">
                <div className="sim-rail-stat mono">
                  <span>Tick</span>
                  <strong>{uiTick}</strong>
                </div>
                <div className="sim-rail-stat mono">
                  <span>Range</span>
                  <strong>{uiDist.toFixed(2)} m</strong>
                </div>
                <div className="sim-rail-stat mono">
                  <span>Spikes</span>
                  <strong>{last?.firedCount ?? 0}</strong>
                </div>
                <div className="sim-rail-stat mono">
                  <span>Danger</span>
                  <strong>{last ? fromQ16(last.danger).toFixed(3) : "—"}</strong>
                </div>
                <div className="sim-rail-stat">
                  <span>Hazard</span>
                  <strong>{simCase.hazard}</strong>
                </div>
                <div className="sim-rail-stat">
                  <span>On trigger</span>
                  <strong>{simCase.actionOnTrigger}</strong>
                </div>
              </div>
              {loadError && <div className="sim-rail-error">{loadError}</div>}
            </aside>

            {!ready && !loadError && <div className="simlab-loading">Loading {block.name}…</div>}

            {triggerHold && holdAction && !whyOpen && (
              <div className="trigger-banner">
                <div>
                  <div className="why-kicker">TRIGGER · SCENE FROZEN</div>
                  <div className="trigger-action">{holdAction}</div>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={openWhy}
                >
                  Inspect WHY?
                </button>
              </div>
            )}

            {whyOpen && whyDetail && <WhyOverlay detail={whyDetail} onClose={() => set({ whyOpen: false })} />}
          </div>
        </div>
    </div>
  );
}
