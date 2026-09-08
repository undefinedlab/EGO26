"use client";

/**
 * Quiet Game-of-Life field behind the reflex statement — sparse square pixels.
 */
import { useEffect, useRef } from "react";

const STEP_MS = 160;
const CELL = 9;
const GAP = 3;
const STRIDE = CELL + GAP;

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

function seedGrid(cols: number, rows: number): Uint8Array {
  const g = new Uint8Array(cols * rows);
  let s = 0x51fe >>> 0;
  const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);

  const set = (x: number, y: number) => {
    if (x >= 0 && x < cols && y >= 0 && y < rows) g[y * cols + x] = 1;
  };
  const stamp = (ox: number, oy: number, pattern: readonly (readonly number[])[]) => {
    for (let y = 0; y < pattern.length; y++) {
      for (let x = 0; x < pattern[y].length; x++) {
        if (pattern[y][x]) set(ox + x, oy + y);
      }
    }
  };

  for (let i = 0; i < g.length; i++) {
    if (rnd() < 0.09) g[i] = 1;
  }

  stamp(Math.floor(cols * 0.12), Math.floor(rows * 0.35), [
    [0, 1, 0],
    [0, 0, 1],
    [1, 1, 1],
  ]);
  stamp(Math.floor(cols * 0.55), Math.floor(rows * 0.2), [
    [1, 1, 1],
  ]);
  stamp(Math.floor(cols * 0.7), Math.floor(rows * 0.55), [
    [1, 1, 0, 0],
    [1, 1, 0, 0],
    [0, 0, 1, 1],
    [0, 0, 1, 1],
  ]);
  stamp(Math.floor(cols * 0.35), Math.floor(rows * 0.6), [
    [0, 1, 1, 1],
    [1, 1, 1, 0],
  ]);

  return g;
}

function stepLife(curr: Uint8Array, next: Uint8Array, cols: number, rows: number) {
  for (let y = 0; y < rows; y++) {
    const yu = (y - 1 + rows) % rows;
    const yd = (y + 1) % rows;
    for (let x = 0; x < cols; x++) {
      const xl = (x - 1 + cols) % cols;
      const xr = (x + 1) % cols;
      const n =
        curr[yu * cols + xl] +
        curr[yu * cols + x] +
        curr[yu * cols + xr] +
        curr[y * cols + xl] +
        curr[y * cols + xr] +
        curr[yd * cols + xl] +
        curr[yd * cols + x] +
        curr[yd * cols + xr];
      const alive = curr[y * cols + x];
      next[y * cols + x] = alive ? (n === 2 || n === 3 ? 1 : 0) : n === 3 ? 1 : 0;
    }
  }
}

export default function ImpulseLife() {
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
    let curr: Uint8Array = new Uint8Array(0);
    let next: Uint8Array = new Uint8Array(0);
    let age = new Float32Array(0);
    let palette = readPalette();
    let still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let active = true;
    let running = true;
    let raf = 0;
    let lastStep = 0;

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

      const nextCols = Math.max(24, Math.floor((w + GAP) / STRIDE));
      const nextRows = Math.max(10, Math.floor((h + GAP) / STRIDE));
      if (nextCols !== cols || nextRows !== rows) {
        cols = nextCols;
        rows = nextRows;
        curr = seedGrid(cols, rows);
        next = new Uint8Array(cols * rows);
        age = new Float32Array(cols * rows);
        for (let i = 0; i < curr.length; i++) if (curr[i]) age[i] = 1;
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
      const r = Math.max(1.5, CELL * 0.42);

      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const i = y * cols + x;
          const a = age[i];
          if (a < 0.04) continue;
          const cx = ox + x * STRIDE;
          const cy = oy + y * STRIDE;
          const alive = curr[i] === 1;
          const birth = alive && a > 0.85;

          ctx.beginPath();
          // Square pixels — Game of Life lattice, not round neurons.
          const s = CELL * (alive ? 1 : 0.72);
          const inset = (CELL - s) / 2;
          ctx.roundRect(cx + inset, cy + inset, s, s, r * 0.55);
          ctx.fillStyle = birth
            ? withAlpha(palette.signal, 0.35 + a * 0.45)
            : alive
              ? withAlpha(palette.base, 0.16 + a * 0.38)
              : withAlpha(palette.base, a * 0.12);
          ctx.fill();
        }
      }
    };

    const tick = (t: number) => {
      if (!running) return;
      raf = requestAnimationFrame(tick);
      if (!active) return;

      if (!still && t - lastStep >= STEP_MS) {
        lastStep = t;
        stepLife(curr, next, cols, rows);
        const tmp = curr;
        curr = next;
        next = tmp;

        let live = 0;
        for (let i = 0; i < curr.length; i++) {
          if (curr[i]) {
            age[i] = Math.min(1, age[i] * 0.55 + 0.55);
            live++;
          } else {
            age[i] *= 0.74;
          }
        }

        if (live < cols * rows * 0.025) {
          for (let k = 0; k < 10; k++) {
            const i = (Math.random() * curr.length) | 0;
            curr[i] = 1;
            age[i] = 1;
          }
        }
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
    }, { threshold: 0.05 });
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
    };
  }, []);

  return (
    <div className="impulse-canvas" ref={wrap} aria-hidden>
      <canvas ref={canvasRef} />
    </div>
  );
}
