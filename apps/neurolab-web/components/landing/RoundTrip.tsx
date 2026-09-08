"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

/* ------------------------------------------------------------------ *
 * The argument, drawn: a small local reflex loop firing many times per
 * second next to a general-purpose model that costs a long round trip.
 * Both pulses run on the same clock, so the difference is the message.
 * ------------------------------------------------------------------ */

const LOCAL = new THREE.Vector3(-2.15, -0.75, 0.35);
const REMOTE = new THREE.Vector3(2.05, 0.95, -1.1);

const ARC_SAMPLES = 190;
const CLOUD = 1250;
const NODE = 240;
const LOOP_SAMPLES = 90;

type Geo = {
  arcPos: Float32Array;
  arcT: Float32Array;
  loopPos: Float32Array;
  loopT: Float32Array;
  cloudPos: Float32Array;
  cloudSeed: Float32Array;
  nodePos: Float32Array;
  nodeSeed: Float32Array;
};

function build(): Geo {
  let s = 0xc0ffee >>> 0;
  const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  const sym = () => rnd() * 2 - 1;

  // Out along a high bow, back along a low one — a visible round trip.
  const out = new THREE.CatmullRomCurve3([
    LOCAL.clone(),
    new THREE.Vector3(-1.0, 1.5, 0.6),
    new THREE.Vector3(0.7, 1.9, -0.2),
    REMOTE.clone(),
  ]);
  const back = new THREE.CatmullRomCurve3([
    REMOTE.clone(),
    new THREE.Vector3(0.9, -0.6, -0.9),
    new THREE.Vector3(-0.8, -1.7, 0.1),
    LOCAL.clone(),
  ]);

  const half = Math.floor(ARC_SAMPLES / 2);
  const arcPts = [...out.getPoints(half), ...back.getPoints(ARC_SAMPLES - half - 1).slice(1)];
  const arcSegs = arcPts.length - 1;

  const arcPos = new Float32Array(arcSegs * 2 * 3);
  const arcT = new Float32Array(arcSegs * 2);
  let ai = 0;
  for (let i = 0; i < arcSegs; i++) {
    for (const k of [i, i + 1]) {
      const p = arcPts[k];
      arcPos[ai * 3] = p.x;
      arcPos[ai * 3 + 1] = p.y;
      arcPos[ai * 3 + 2] = p.z;
      arcT[ai] = k / arcSegs;
      ai++;
    }
  }

  // The reflex loop: a tight ring sitting on the local node.
  const loopPts: THREE.Vector3[] = [];
  for (let i = 0; i <= LOOP_SAMPLES; i++) {
    const a = (i / LOOP_SAMPLES) * Math.PI * 2;
    loopPts.push(
      new THREE.Vector3(
        LOCAL.x + Math.cos(a) * 0.64,
        LOCAL.y + Math.sin(a) * 0.42,
        LOCAL.z + Math.sin(a) * 0.3,
      ),
    );
  }
  const loopSegs = loopPts.length - 1;
  const loopPos = new Float32Array(loopSegs * 2 * 3);
  const loopT = new Float32Array(loopSegs * 2);
  let li = 0;
  for (let i = 0; i < loopSegs; i++) {
    for (const k of [i, i + 1]) {
      const p = loopPts[k];
      loopPos[li * 3] = p.x;
      loopPos[li * 3 + 1] = p.y;
      loopPos[li * 3 + 2] = p.z;
      loopT[li] = k / loopSegs;
      li++;
    }
  }

  // The oversized model: big, diffuse, slow.
  const cloudPos = new Float32Array(CLOUD * 3);
  const cloudSeed = new Float32Array(CLOUD);
  for (let i = 0; i < CLOUD; i++) {
    const dir = new THREE.Vector3(sym(), sym(), sym()).normalize();
    const r = 1.45 * Math.cbrt(rnd());
    cloudPos[i * 3] = REMOTE.x + dir.x * r;
    cloudPos[i * 3 + 1] = REMOTE.y + dir.y * r * 0.86;
    cloudPos[i * 3 + 2] = REMOTE.z + dir.z * r;
    cloudSeed[i] = rnd();
  }

  // The reflex: small, dense, near.
  const nodePos = new Float32Array(NODE * 3);
  const nodeSeed = new Float32Array(NODE);
  for (let i = 0; i < NODE; i++) {
    const dir = new THREE.Vector3(sym(), sym(), sym()).normalize();
    const r = 0.26 * Math.cbrt(rnd());
    nodePos[i * 3] = LOCAL.x + dir.x * r;
    nodePos[i * 3 + 1] = LOCAL.y + dir.y * r;
    nodePos[i * 3 + 2] = LOCAL.z + dir.z * r;
    nodeSeed[i] = rnd();
  }

  return { arcPos, arcT, loopPos, loopT, cloudPos, cloudSeed, nodePos, nodeSeed };
}

/* ---------------------------------------------------------- shaders */

const PULSE = /* glsl */ `
  uniform float uTime;
  uniform float uRate;
  uniform float uWidth;
  attribute float aT;
  varying float vPulse;
  void main() {
    float head = fract(uTime * uRate);
    float d = head - aT;
    float core = smoothstep(uWidth, 0.0, abs(d));
    float tail = 0.35 * smoothstep(uWidth * 5.0, uWidth * 0.5, d) * step(0.0, d);
    vPulse = core + tail;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const PULSE_FRAG = /* glsl */ `
  uniform vec3 uBase;
  uniform vec3 uSignal;
  uniform float uOpacity;
  varying float vPulse;
  void main() {
    vec3 col = mix(uBase, uSignal, clamp(vPulse, 0.0, 1.0));
    gl_FragColor = vec4(col, uOpacity * (0.5 + vPulse * 3.2));
  }
`;

const CLOUD_VERT = /* glsl */ `
  uniform float uTime;
  uniform float uDpr;
  uniform float uSize;
  attribute float aSeed;
  varying float vDepth;
  void main() {
    float w = aSeed * 6.2831;
    vec3 p = position + vec3(sin(uTime * 0.19 + w), cos(uTime * 0.16 + w), sin(uTime * 0.13 + w)) * 0.045;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vDepth = smoothstep(12.0, 5.0, -mv.z);
    gl_PointSize = uSize * uDpr * (0.6 + aSeed * 0.8) * (17.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

const CLOUD_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vDepth;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    gl_FragColor = vec4(uColor, smoothstep(0.5, 0.1, d) * uOpacity * mix(0.35, 1.0, vDepth));
  }
`;

/* ------------------------------------------------------------------ */

type Palette = { base: string; signal: string; line: number; cloud: number; node: number };

const LIGHT: Palette = { base: "#3f4246", signal: "#ff4d12", line: 0.26, cloud: 0.3, node: 0.6 };
const DARK: Palette = { base: "#b6bac0", signal: "#ff5c26", line: 0.24, cloud: 0.28, node: 0.58 };

function Scene({ palette, still }: { palette: Palette; still: boolean }) {
  const geo = useMemo(build, []);
  const group = useRef<THREE.Group>(null);
  const { gl } = useThree();
  const pointer = useRef({ x: 0, y: 0 });
  const target = useRef({ x: 0, y: 0 });

  const mk = (rate: number, width: number, opacity: number) => ({
    uTime: { value: 0 },
    uRate: { value: rate },
    uWidth: { value: width },
    uBase: { value: new THREE.Color(palette.base) },
    uSignal: { value: new THREE.Color(palette.signal) },
    uOpacity: { value: opacity },
  });

  // One slow lap on the round trip; the reflex loop fires many times over.
  const arcU = useMemo(() => mk(0.22, 0.022, palette.line), []); // eslint-disable-line react-hooks/exhaustive-deps
  const loopU = useMemo(() => mk(2.1, 0.08, palette.line * 2.2), []); // eslint-disable-line react-hooks/exhaustive-deps

  const cloudU = useMemo(
    () => ({
      uTime: { value: 0 },
      uDpr: { value: 1 },
      uSize: { value: 1.5 },
      uColor: { value: new THREE.Color(palette.base) },
      uOpacity: { value: palette.cloud },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const nodeU = useMemo(
    () => ({
      uTime: { value: 0 },
      uDpr: { value: 1 },
      uSize: { value: 1.6 },
      uColor: { value: new THREE.Color(palette.signal) },
      uOpacity: { value: palette.node },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    for (const u of [arcU, loopU]) {
      u.uBase.value.set(palette.base);
      u.uSignal.value.set(palette.signal);
    }
    arcU.uOpacity.value = palette.line;
    loopU.uOpacity.value = palette.line * 2.2;
    cloudU.uColor.value.set(palette.base);
    cloudU.uOpacity.value = palette.cloud;
    nodeU.uColor.value.set(palette.signal);
    nodeU.uOpacity.value = palette.node;
  }, [palette, arcU, loopU, cloudU, nodeU]);

  useEffect(() => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cloudU.uDpr.value = dpr;
    nodeU.uDpr.value = dpr;
  }, [cloudU, nodeU]);

  useEffect(() => {
    const el = gl.domElement;
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      target.current.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      target.current.y = ((e.clientY - r.top) / r.height) * 2 - 1;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [gl]);

  useFrame((_, delta) => {
    const g = group.current;
    if (!g) return;
    const d = Math.min(delta, 0.05);
    if (!still) {
      for (const u of [arcU, loopU, cloudU, nodeU]) u.uTime.value += d;
    }
    pointer.current.x += (target.current.x - pointer.current.x) * Math.min(1, d * 2.6);
    pointer.current.y += (target.current.y - pointer.current.y) * Math.min(1, d * 2.6);
    // A diagram, so it tilts rather than spins.
    g.rotation.y = pointer.current.x * 0.22;
    g.rotation.x = pointer.current.y * -0.14;
  });

  return (
    <group ref={group}>
      <lineSegments frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[geo.arcPos, 3]} />
          <bufferAttribute attach="attributes-aT" args={[geo.arcT, 1]} />
        </bufferGeometry>
        <shaderMaterial vertexShader={PULSE} fragmentShader={PULSE_FRAG} uniforms={arcU} transparent depthWrite={false} />
      </lineSegments>

      <lineSegments frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[geo.loopPos, 3]} />
          <bufferAttribute attach="attributes-aT" args={[geo.loopT, 1]} />
        </bufferGeometry>
        <shaderMaterial vertexShader={PULSE} fragmentShader={PULSE_FRAG} uniforms={loopU} transparent depthWrite={false} />
      </lineSegments>

      <points frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[geo.cloudPos, 3]} />
          <bufferAttribute attach="attributes-aSeed" args={[geo.cloudSeed, 1]} />
        </bufferGeometry>
        <shaderMaterial vertexShader={CLOUD_VERT} fragmentShader={CLOUD_FRAG} uniforms={cloudU} transparent depthWrite={false} />
      </points>

      <points frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[geo.nodePos, 3]} />
          <bufferAttribute attach="attributes-aSeed" args={[geo.nodeSeed, 1]} />
        </bufferGeometry>
        <shaderMaterial vertexShader={CLOUD_VERT} fragmentShader={CLOUD_FRAG} uniforms={nodeU} transparent depthWrite={false} />
      </points>
    </group>
  );
}

function useThemePalette(): Palette {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const read = () => {
      const attr = document.documentElement.getAttribute("data-theme");
      if (attr === "dark") return true;
      if (attr === "light") return false;
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    };
    setDark(read());
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onMq = () => setDark(read());
    mq.addEventListener("change", onMq);
    const obs = new MutationObserver(() => setDark(read()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => {
      mq.removeEventListener("change", onMq);
      obs.disconnect();
    };
  }, []);
  return dark ? DARK : LIGHT;
}

export default function RoundTrip() {
  const palette = useThemePalette();
  const wrap = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const [still, setStill] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setStill(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setActive(e.isIntersecting), { threshold: 0.01 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div className="scene-canvas" ref={wrap} aria-hidden>
      <Canvas
        frameloop={active ? "always" : "never"}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        camera={{ position: [0, 0, 6.6], fov: 42 }}
      >
        <Scene palette={palette} still={still} />
      </Canvas>
    </div>
  );
}
