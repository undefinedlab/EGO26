"use client";

/**
 * Why-now field: Conway Life rains from the top, treats the four cards as
 * solid bodies, and reflects (recasts) off the slide walls.
 */
import { useEffect, useRef } from "react";

const STEP_MS = 120;
const CELL = 8;
const GAP = 2;
const STRIDE = CELL + GAP;
const MAX_NUDGE = 16;
const SPRING = 70;
const DAMP = 11;

type Palette = { base: string; signal: string };

function readPalette(): Palette {
  const styles = getComputedStyle(document.documentElement);
  const theme = document.documentElement.getAttribute("data-theme");
  const dark =
    theme === "dark" ||
    (theme !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  const accent = styles.getPropertyValue("--accent").trim() || (dark ? "#ff5c26" : "#ff4d12");
  return {
    base: dark ? "rgba(182, 186, 192, 1)" : "rgba(70, 74, 80, 1)",
    signal: accent,
  };
}

function withAlpha(color: string, alpha: number): string {
  if (color.startsWith("rgba")) return color.replace(/[\d.]+\s*\)$/, `${alpha})`);
  if (color.startsWith("rgb(")) return color.replace("rgb(", "rgba(").replace(")", `, ${alpha})`);
  const hex = color.replace("#", "");
  if (hex.length === 3 || hex.length === 6) {
    const full =
      hex.length === 3
        ? hex
            .split("")
            .map((ch) => ch + ch)
            .join("")
        : hex;
    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return color;
}

function reflect(v: number, max: number): number {
  if (max <= 1) return 0;
  const period = max * 2;
  let t = v % period;
  if (t < 0) t += period;
  return t < max ? t : period - 1 - t;
}

const GLIDER = [
  [0, 1, 0],
  [0, 0, 1],
  [1, 1, 1],
] as const;

type Body = {
  slot: HTMLElement;
  phys: HTMLElement;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  gx0: number;
  gy0: number;
  gx1: number;
  gy1: number;
};

export default function WhyNowLife() {
  const wrap = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const wrapEl = wrap.current;
    const canvas = canvasRef.current;
    if (!wrapEl || !canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let cols = 0;
    let rows = 0;
    let curr = new Uint8Array(0);
    let next = new Uint8Array(0);
    let blocked = new Uint8Array(0);
    let age = new Float32Array(0);
    let bodies: Body[] = [];
    let palette = readPalette();
    let still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let active = true;
    let running = true;
    let raf = 0;
    let lastStep = 0;
    let lastT = 0;
    let rain = 0;

    const rnd = () => Math.random();

    const stamp = (ox: number, oy: number, pattern: readonly (readonly number[])[]) => {
      for (let y = 0; y < pattern.length; y++) {
        for (let x = 0; x < pattern[y].length; x++) {
          if (!pattern[y][x]) continue;
          const gx = ox + x;
          const gy = oy + y;
          if (gx < 0 || gy < 0 || gx >= cols || gy >= rows) continue;
          const i = gy * cols + gx;
          if (blocked[i]) continue;
          curr[i] = 1;
          age[i] = 1;
        }
      }
    };

    const seedFromTop = () => {
      curr.fill(0);
      age.fill(0);
      const band = Math.max(5, Math.floor(rows * 0.2));
      for (let y = 0; y < band; y++) {
        const p = 0.28 * (1 - y / band);
        for (let x = 0; x < cols; x++) {
          if (blocked[y * cols + x]) continue;
          if (rnd() < p) {
            curr[y * cols + x] = 1;
            age[y * cols + x] = 1;
          }
        }
      }
      stamp(Math.floor(cols * 0.18), 1, GLIDER);
      stamp(Math.floor(cols * 0.48), 2, GLIDER);
      stamp(Math.floor(cols * 0.78), 1, GLIDER);
    };

    const syncBodies = () => {
      const slots = [...wrapEl.querySelectorAll<HTMLElement>(".why-card-slot")];
      if (bodies.length !== slots.length) {
        bodies = slots.map((slot) => {
          const phys = slot.querySelector<HTMLElement>(".why-card-phys") ?? slot;
          return { slot, phys, x: 0, y: 0, vx: 0, vy: 0, rot: 0, vr: 0, gx0: 0, gy0: 0, gx1: 0, gy1: 0 };
        });
      } else {
        bodies.forEach((b, i) => {
          b.slot = slots[i];
          b.phys = slots[i].querySelector<HTMLElement>(".why-card-phys") ?? slots[i];
        });
      }

      blocked.fill(0);
      const wr = wrapEl.getBoundingClientRect();
      for (const b of bodies) {
        const r = b.slot.getBoundingClientRect();
        const pad = 3;
        b.gx0 = Math.max(0, Math.floor((r.left - wr.left - pad) / STRIDE));
        b.gy0 = Math.max(0, Math.floor((r.top - wr.top - pad) / STRIDE));
        b.gx1 = Math.min(cols, Math.ceil((r.right - wr.left + pad) / STRIDE));
        b.gy1 = Math.min(rows, Math.ceil((r.bottom - wr.top + pad) / STRIDE));
        for (let y = b.gy0; y < b.gy1; y++) {
          for (let x = b.gx0; x < b.gx1; x++) {
            blocked[y * cols + x] = 1;
            curr[y * cols + x] = 0;
          }
        }
      }
    };

    const sample = (x: number, y: number) => {
      const rx = reflect(x, cols);
      const ry = reflect(y, rows);
      const i = ry * cols + rx;
      return blocked[i] ? 0 : curr[i];
    };

    const stepLife = () => {
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const i = y * cols + x;
          if (blocked[i]) {
            next[i] = 0;
            continue;
          }
          const n =
            sample(x - 1, y - 1) +
            sample(x, y - 1) +
            sample(x + 1, y - 1) +
            sample(x - 1, y) +
            sample(x + 1, y) +
            sample(x - 1, y + 1) +
            sample(x, y + 1) +
            sample(x + 1, y + 1);
          const alive = curr[i];
          next[i] = alive ? (n === 2 || n === 3 ? 1 : 0) : n === 3 ? 1 : 0;
        }
      }
      const tmp = curr;
      curr = next;
      next = tmp;

      for (let i = 0; i < curr.length; i++) {
        if (blocked[i]) {
          curr[i] = 0;
          age[i] *= 0.6;
          continue;
        }
        if (curr[i]) age[i] = Math.min(1, age[i] * 0.5 + 0.58);
        else age[i] *= 0.72;
      }
    };

    const rainTop = () => {
      const band = 3;
      for (let y = 0; y < band; y++) {
        for (let x = 0; x < cols; x++) {
          if (blocked[y * cols + x]) continue;
          if (rnd() < 0.12) {
            curr[y * cols + x] = 1;
            age[y * cols + x] = 1;
          }
        }
      }
      if (rnd() < 0.55) {
        stamp(Math.floor(rnd() * Math.max(1, cols - 4)), 0, GLIDER);
      }
    };

    const recastWalls = () => {
      if (cols < 6 || rows < 6) return;
      for (let x = 1; x < cols - 1; x++) {
        if (curr[x] && !blocked[2 * cols + x]) {
          curr[2 * cols + x] = 1;
          age[2 * cols + x] = 1;
        }
        const bi = (rows - 1) * cols + x;
        if (curr[bi] && !blocked[(rows - 3) * cols + x]) {
          curr[(rows - 3) * cols + x] = 1;
          age[(rows - 3) * cols + x] = 1;
        }
      }
      for (let y = 1; y < rows - 1; y++) {
        if (curr[y * cols] && !blocked[y * cols + 2]) {
          curr[y * cols + 2] = 1;
          age[y * cols + 2] = 1;
        }
        if (curr[y * cols + cols - 1] && !blocked[y * cols + cols - 3]) {
          curr[y * cols + cols - 3] = 1;
          age[y * cols + cols - 3] = 1;
        }
      }
    };

    const halo = (b: Body, side: "l" | "r" | "t" | "b") => {
      let n = 0;
      if (side === "l") {
        const x = b.gx0 - 1;
        if (x >= 0) for (let y = b.gy0; y < b.gy1; y++) n += curr[y * cols + x];
      } else if (side === "r") {
        const x = b.gx1;
        if (x < cols) for (let y = b.gy0; y < b.gy1; y++) n += curr[y * cols + x];
      } else if (side === "t") {
        const y = b.gy0 - 1;
        if (y >= 0) for (let x = b.gx0; x < b.gx1; x++) n += curr[y * cols + x];
      } else {
        const y = b.gy1;
        if (y < rows) for (let x = b.gx0; x < b.gx1; x++) n += curr[y * cols + x];
      }
      return n;
    };

    const stepPhysics = (dt: number) => {
      for (const b of bodies) {
        const left = halo(b, "l");
        const right = halo(b, "r");
        const top = halo(b, "t");
        const bot = halo(b, "b");
        const impulseX = (left - right) * 2.4;
        const impulseY = (top - bot) * 2.4;
        const torque = (top + right - bot - left) * 0.12;

        b.vx += impulseX;
        b.vy += impulseY;
        b.vr += torque;
        b.vx += (-SPRING * b.x - DAMP * b.vx) * dt;
        b.vy += (-SPRING * b.y - DAMP * b.vy) * dt;
        b.vr += (-SPRING * b.rot - DAMP * b.vr) * dt;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.rot += b.vr * dt;
        b.x = Math.max(-MAX_NUDGE, Math.min(MAX_NUDGE, b.x));
        b.y = Math.max(-MAX_NUDGE, Math.min(MAX_NUDGE, b.y));
        b.rot = Math.max(-3.2, Math.min(3.2, b.rot));
        b.phys.style.setProperty("--tx", `${b.x.toFixed(2)}px`);
        b.phys.style.setProperty("--ty", `${b.y.toFixed(2)}px`);
        b.phys.style.setProperty("--tr", `${b.rot.toFixed(2)}deg`);
      }
    };

    const paint = () => {
      const w = wrapEl.clientWidth;
      const h = wrapEl.clientHeight;
      ctx.clearRect(0, 0, w, h);
      const gridW = cols * STRIDE - GAP;
      const gridH = rows * STRIDE - GAP;
      const ox = (w - gridW) / 2;
      const oy = (h - gridH) / 2;
      const rad = Math.max(1.1, CELL * 0.28);

      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const i = y * cols + x;
          if (blocked[i]) continue;
          const a = age[i];
          if (a < 0.05) continue;
          const cx = ox + x * STRIDE;
          const cy = oy + y * STRIDE;
          const alive = curr[i] === 1;
          const s = CELL * (alive ? 1 : 0.7);
          const inset = (CELL - s) / 2;
          ctx.beginPath();
          ctx.roundRect(cx + inset, cy + inset, s, s, rad);
          ctx.fillStyle = alive && a > 0.82
            ? withAlpha(palette.signal, 0.28 + a * 0.42)
            : alive
              ? withAlpha(palette.base, 0.12 + a * 0.32)
              : withAlpha(palette.base, a * 0.1);
          ctx.fill();
        }
      }
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = wrapEl.clientWidth;
      const h = wrapEl.clientHeight;
      if (w < 2 || h < 2) return;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const nextCols = Math.max(28, Math.floor((w + GAP) / STRIDE));
      const nextRows = Math.max(16, Math.floor((h + GAP) / STRIDE));
      if (nextCols !== cols || nextRows !== rows) {
        cols = nextCols;
        rows = nextRows;
        curr = new Uint8Array(cols * rows);
        next = new Uint8Array(cols * rows);
        blocked = new Uint8Array(cols * rows);
        age = new Float32Array(cols * rows);
        syncBodies();
        seedFromTop();
      } else {
        syncBodies();
      }
    };

    const tick = (t: number) => {
      if (!running) return;
      raf = requestAnimationFrame(tick);
      if (!active) return;
      const dt = Math.min(0.033, lastT ? (t - lastT) / 1000 : 0.016);
      lastT = t;

      if (!still) {
        if (t - lastStep >= STEP_MS) {
          lastStep = t;
          syncBodies();
          stepLife();
          rain++;
          if (rain % 3 === 0) rainTop();
          if (rain % 2 === 0) recastWalls();
          let live = 0;
          for (let i = 0; i < curr.length; i++) if (curr[i]) live++;
          if (live < cols * 4) rainTop();
        }
        stepPhysics(dt);
      }

      paint();
    };

    resize();
    paint();
    raf = requestAnimationFrame(tick);

    const ro = new ResizeObserver(resize);
    ro.observe(wrapEl);
    const io = new IntersectionObserver(([e]) => {
      active = e.isIntersecting;
    }, { threshold: 0.08 });
    io.observe(wrapEl);

    const onVis = () => {
      active = !document.hidden;
    };
    document.addEventListener("visibilitychange", onVis);

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMotion = () => {
      still = mq.matches;
    };
    mq.addEventListener("change", onMotion);

    const obs = new MutationObserver(() => {
      palette = readPalette();
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const scheme = window.matchMedia("(prefers-color-scheme: dark)");
    const onScheme = () => {
      palette = readPalette();
    };
    scheme.addEventListener("change", onScheme);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      mq.removeEventListener("change", onMotion);
      obs.disconnect();
      scheme.removeEventListener("change", onScheme);
      for (const b of bodies) {
        b.phys.style.removeProperty("--tx");
        b.phys.style.removeProperty("--ty");
        b.phys.style.removeProperty("--tr");
      }
    };
  }, []);

  return (
    <div className="why-life" ref={wrap} aria-hidden>
      <canvas ref={canvasRef} />
    </div>
  );
}
