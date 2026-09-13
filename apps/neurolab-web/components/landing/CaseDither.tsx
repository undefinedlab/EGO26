"use client";

/**
 * Use-case media: soft photo base + fine Life lattice dither.
 * Subject stays readable; lattice animates as sparse twinkle (no scan line).
 */
import { useEffect, useRef } from "react";

const CELL = 4;
const GAP = 1;
const STRIDE = CELL + GAP;

const BAYER_8 = [
  [0, 32, 8, 40, 2, 34, 10, 42],
  [48, 16, 56, 24, 50, 18, 58, 26],
  [12, 44, 4, 36, 14, 46, 6, 38],
  [60, 28, 52, 20, 62, 30, 54, 22],
  [3, 35, 11, 43, 1, 33, 9, 41],
  [51, 19, 59, 27, 49, 17, 57, 25],
  [15, 47, 7, 39, 13, 45, 5, 37],
  [63, 31, 55, 23, 61, 29, 53, 21],
];

function readColors() {
  const styles = getComputedStyle(document.documentElement);
  const theme = document.documentElement.getAttribute("data-theme");
  const dark =
    theme === "dark" ||
    (theme !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  const accent = styles.getPropertyValue("--accent").trim() || (dark ? "#ff5c26" : "#ff4d12");
  const ink = dark ? "rgba(236, 238, 242, 0.88)" : "rgba(18, 22, 28, 0.78)";
  const mid = dark ? "rgba(236, 238, 242, 0.4)" : "rgba(18, 22, 28, 0.34)";
  const soft = dark ? "rgba(236, 238, 242, 0.14)" : "rgba(18, 22, 28, 0.12)";
  return { accent, ink, mid, soft, dark };
}

/** Case cards: keep figure ink/accent strong; only background dust stays faint. */
function readPixelColors() {
  const base = readColors();
  return {
    ...base,
    soft: base.dark ? "rgba(236, 238, 242, 0.04)" : "rgba(18, 22, 28, 0.035)",
  };
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

export function CaseDither({ src, alt }: { src: string; alt: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const wrapEl = wrap.current;
    const canvas = canvasRef.current;
    if (!wrapEl || !canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let img: HTMLImageElement | null = null;
    let levels: Uint8Array | null = null;
    let cols = 0;
    let rows = 0;
    let base: HTMLCanvasElement | null = null;
    let raf = 0;
    let running = true;
    let active = true;
    let colors = readColors();
    let phase = -1;
    let cssW = 0;
    let cssH = 0;

    const rebuild = () => {
      if (!img || !img.complete || img.naturalWidth < 2) return;
      const w = wrapEl.clientWidth;
      const h = wrapEl.clientHeight;
      if (w < 2 || h < 2) return;
      cssW = w;
      cssH = h;

      cols = Math.max(48, Math.floor((w + GAP) / STRIDE));
      rows = Math.max(30, Math.floor((h + GAP) / STRIDE));
      levels = new Uint8Array(cols * rows);

      const ir = img.naturalWidth / img.naturalHeight;
      const gr = cols / rows;
      let sx = 0;
      let sy = 0;
      let sw = img.naturalWidth;
      let sh = img.naturalHeight;
      if (ir > gr) {
        sw = img.naturalHeight * gr;
        sx = (img.naturalWidth - sw) / 2;
      } else {
        sh = img.naturalWidth / gr;
        sy = (img.naturalHeight - sh) / 2;
      }

      const off = document.createElement("canvas");
      off.width = cols;
      off.height = rows;
      const octx = off.getContext("2d", { willReadFrequently: true });
      if (!octx) return;
      octx.drawImage(img, sx, sy, sw, sh, 0, 0, cols, rows);
      const data = octx.getImageData(0, 0, cols, rows).data;

      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const i = (y * cols + x) * 4;
          const lum = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
          const v = colors.dark ? lum : 1 - lum;
          const threshold = (BAYER_8[y % 8][x % 8] + 0.5) / 64;
          let level = 0;
          if (v > threshold + 0.18) level = 3;
          else if (v > threshold + 0.05) level = 2;
          else if (v > threshold - 0.06) level = 1;
          if (level >= 3 && v > 0.72 && ((x * 17 + y * 31) % 53 === 0)) level = 4;
          levels[y * cols + x] = level;
        }
      }

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      base = document.createElement("canvas");
      base.width = Math.floor(w * dpr);
      base.height = Math.floor(h * dpr);
      const bctx = base.getContext("2d");
      if (!bctx) return;
      bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      bctx.clearRect(0, 0, w, h);
      bctx.globalAlpha = colors.dark ? 0.44 : 0.4;
      bctx.filter = "saturate(0.55) contrast(1.06)";
      bctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
      bctx.filter = "none";
      bctx.globalAlpha = 1;

      canvas.width = base.width;
      canvas.height = base.height;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    };

    const paint = (t: number) => {
      if (!levels || !base || cols < 1) return;
      const w = cssW;
      const h = cssH;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(base, 0, 0, w, h);

      const gridW = cols * STRIDE - GAP;
      const gridH = rows * STRIDE - GAP;
      const ox = (w - gridW) / 2;
      const oy = (h - gridH) / 2;
      const [ar, ag, ab] = hexToRgb(colors.accent.startsWith("#") ? colors.accent : "#ff4d12");
      const nextPhase = (t / 480) | 0;
      if (active) phase = nextPhase;

      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          let level = levels[y * cols + x];
          if (!level) continue;

          // Independent cell twinkles — no coherent diagonal / scan line.
          const hash = (x * 73856093) ^ (y * 19349663) ^ (phase * 83492791);
          if (active && (hash & 255) < 5 && level < 4) level = Math.min(4, level + 1);

          ctx.fillStyle =
            level === 4
              ? `rgba(${ar}, ${ag}, ${ab}, 0.7)`
              : level === 3
                ? colors.ink.replace(/[\d.]+\s*\)$/, "0.5)")
                : level === 2
                  ? colors.mid.replace(/[\d.]+\s*\)$/, "0.26)")
                  : colors.soft.replace(/[\d.]+\s*\)$/, "0.11)");
          ctx.fillRect(ox + x * STRIDE, oy + y * STRIDE, CELL, CELL);
        }
      }

      // Soft dissolve on all four borders into the page (not a center vignette).
      const fadeX = Math.max(48, w * 0.22);
      const fadeY = Math.max(40, h * 0.24);
      const wipe = (g: CanvasGradient) => {
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      };
      ctx.globalCompositeOperation = "destination-out";
      {
        const g = ctx.createLinearGradient(0, 0, fadeX, 0);
        g.addColorStop(0, "rgba(0,0,0,1)");
        g.addColorStop(0.35, "rgba(0,0,0,0.55)");
        g.addColorStop(0.7, "rgba(0,0,0,0.18)");
        g.addColorStop(1, "rgba(0,0,0,0)");
        wipe(g);
      }
      {
        const g = ctx.createLinearGradient(w, 0, w - fadeX, 0);
        g.addColorStop(0, "rgba(0,0,0,1)");
        g.addColorStop(0.35, "rgba(0,0,0,0.55)");
        g.addColorStop(0.7, "rgba(0,0,0,0.18)");
        g.addColorStop(1, "rgba(0,0,0,0)");
        wipe(g);
      }
      {
        const g = ctx.createLinearGradient(0, 0, 0, fadeY);
        g.addColorStop(0, "rgba(0,0,0,1)");
        g.addColorStop(0.35, "rgba(0,0,0,0.55)");
        g.addColorStop(0.7, "rgba(0,0,0,0.18)");
        g.addColorStop(1, "rgba(0,0,0,0)");
        wipe(g);
      }
      {
        const g = ctx.createLinearGradient(0, h, 0, h - fadeY);
        g.addColorStop(0, "rgba(0,0,0,1)");
        g.addColorStop(0.35, "rgba(0,0,0,0.55)");
        g.addColorStop(0.7, "rgba(0,0,0,0.18)");
        g.addColorStop(1, "rgba(0,0,0,0)");
        wipe(g);
      }
      ctx.globalCompositeOperation = "source-over";
    };

    const tick = (t: number) => {
      if (!running) return;
      raf = requestAnimationFrame(tick);
      if (!active) return;
      const next = (t / 480) | 0;
      if (next === phase) return;
      paint(t);
    };

    const resize = () => {
      rebuild();
      paint(performance.now());
    };

    img = new Image();
    img.decoding = "async";
    img.onload = () => {
      rebuild();
      paint(performance.now());
      raf = requestAnimationFrame(tick);
    };
    img.src = src;

    const ro = new ResizeObserver(resize);
    ro.observe(wrapEl);

    const io = new IntersectionObserver(
      ([e]) => {
        active = e.isIntersecting;
        if (active) paint(performance.now());
      },
      { threshold: 0.05 }
    );
    io.observe(wrapEl);

    const refreshTheme = () => {
      colors = readColors();
      rebuild();
      paint(performance.now());
    };
    const obs = new MutationObserver(refreshTheme);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const scheme = window.matchMedia("(prefers-color-scheme: dark)");
    scheme.addEventListener("change", refreshTheme);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      obs.disconnect();
      scheme.removeEventListener("change", refreshTheme);
    };
  }, [src]);

  return (
    <div className="case-dither" ref={wrap} role="img" aria-label={alt}>
      <canvas ref={canvasRef} />
    </div>
  );
}

export type CaseKind = "robotics" | "games" | "spatial" | "edge" | "agents";

const PIXEL = 5;
const PIXEL_GAP = 2;
const PIXEL_STRIDE = PIXEL + PIXEL_GAP;

type PixColors = ReturnType<typeof readColors> & { accentRgb: [number, number, number] };

function plot(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  cols: number,
  rows: number,
  x: number,
  y: number,
  color: string,
) {
  if (x < 0 || y < 0 || x >= cols || y >= rows) return;
  ctx.fillStyle = color;
  ctx.fillRect(ox + x * PIXEL_STRIDE, oy + y * PIXEL_STRIDE, PIXEL, PIXEL);
}

function stamp(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  cols: number,
  rows: number,
  sx: number,
  sy: number,
  pattern: readonly (readonly number[])[],
  on: string,
  accent: string,
) {
  for (let y = 0; y < pattern.length; y++) {
    for (let x = 0; x < pattern[y].length; x++) {
      const v = pattern[y][x];
      if (!v) continue;
      plot(ctx, ox, oy, cols, rows, sx + x, sy + y, v === 2 ? accent : on);
    }
  }
}

function dust(ctx: CanvasRenderingContext2D, ox: number, oy: number, cols: number, rows: number, colors: PixColors, density: number) {
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const th = (BAYER_8[y % 8][x % 8] + 0.5) / 64;
      if (th > 1 - density) plot(ctx, ox, oy, cols, rows, x, y, colors.soft);
    }
  }
}

const ROBOT = [
  [1, 1, 1],
  [1, 2, 1],
  [1, 1, 1],
  [1, 0, 1],
] as const;

const INVADER = [
  [0, 1, 0, 1, 0],
  [1, 1, 1, 1, 1],
  [1, 0, 1, 0, 1],
] as const;

const WALKER = [
  [0, 1, 0],
  [1, 1, 1],
  [1, 0, 1],
] as const;

function paintRobotics(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  cols: number,
  rows: number,
  t: number,
  colors: PixColors,
) {
  dust(ctx, ox, oy, cols, rows, colors, 0.035);
  const p = (t % 2800) / 2800;
  const loomX = cols * 0.7;
  const loomY = rows * 0.46;
  const loomR = 1.2 + p * Math.min(cols, rows) * 0.38;
  const dodge = p > 0.52 && p < 0.88;
  const rMax = Math.ceil(loomR);
  for (let y = -rMax; y <= rMax; y++) {
    for (let x = -rMax; x <= rMax; x++) {
      const d = Math.hypot(x, y);
      if (d > loomR || d < loomR - 2.4) continue;
      const px = Math.round(loomX + x);
      const py = Math.round(loomY + y);
      plot(ctx, ox, oy, cols, rows, px, py, d > loomR - 1.1 ? colors.accent : colors.mid);
    }
  }
  const rx = Math.round(cols * 0.22) - (dodge ? 3 : 0);
  const ry = Math.round(rows * 0.5) + (dodge ? 2 : 0);
  stamp(ctx, ox, oy, cols, rows, rx, ry, ROBOT, dodge ? colors.accent : colors.ink, colors.accent);
}

function paintGames(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  cols: number,
  rows: number,
  t: number,
  colors: PixColors,
  sprites: { x: number; y: number; dx: number }[],
) {
  dust(ctx, ox, oy, cols, rows, colors, 0.025);
  const ground = rows - 3;
  for (let x = 0; x < cols; x += 2) plot(ctx, ox, oy, cols, rows, x, ground, colors.soft);
  const flinch = Math.floor(t / 1400) % 2 === 1;
  sprites.forEach((s, i) => {
    const shape = i % 2 === 0 ? INVADER : WALKER;
    const y = Math.round(s.y) + (flinch ? -1 : 0);
    stamp(
      ctx,
      ox,
      oy,
      cols,
      rows,
      Math.round(s.x),
      y,
      shape,
      i === 0 ? colors.accent : colors.ink,
      colors.accent,
    );
  });
}

const CAM = [
  [1, 1, 1],
  [1, 2, 1],
  [0, 1, 0],
] as const;

/** Camera + sweeping FOV rays only. */
function paintSpatial(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  cols: number,
  rows: number,
  t: number,
  colors: PixColors,
) {
  dust(ctx, ox, oy, cols, rows, colors, 0.01);

  const camX = Math.max(2, Math.round(cols * 0.18));
  const camY = Math.max(2, Math.round(rows * 0.2));
  stamp(ctx, ox, oy, cols, rows, camX, camY, CAM, colors.ink, colors.accent);

  const sweep = 0.35 + ((Math.sin(t / 900) + 1) / 2) * 1.05;
  const half = 0.34;
  const reach = Math.min(cols, rows) * 0.92;
  const originX = camX + 1;
  const originY = camY + 1;

  for (let a = -half; a <= half; a += 0.06) {
    const ang = sweep + a;
    const dx = Math.cos(ang);
    const dy = Math.sin(ang);
    const edge = Math.abs(a) > half * 0.72;
    for (let s = 2; s < reach; s += 1) {
      const x = Math.round(originX + dx * s);
      const y = Math.round(originY + dy * s);
      if (x < 0 || x >= cols || y < 0 || y >= rows) break;
      if (edge || s % 2 === 0) {
        const fade = s / reach;
        plot(
          ctx,
          ox,
          oy,
          cols,
          rows,
          x,
          y,
          edge ? colors.accent : fade > 0.72 ? colors.soft : colors.mid,
        );
      }
    }
  }
}

const DEVICE = [
  [1, 1, 1, 1, 1, 1, 1],
  [1, 0, 0, 0, 0, 0, 1],
  [1, 0, 1, 2, 1, 0, 1],
  [1, 0, 1, 1, 1, 0, 1],
  [1, 0, 0, 0, 0, 0, 1],
  [1, 1, 1, 1, 1, 1, 1],
  [0, 0, 1, 1, 1, 0, 0],
] as const;

const CLOUD = [
  [0, 1, 1, 1, 0],
  [1, 1, 1, 1, 1],
  [0, 1, 1, 1, 0],
] as const;

/** Offline edge: cloud link fails → local chip keeps ticking. */
function paintEdge(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  cols: number,
  rows: number,
  t: number,
  colors: PixColors,
) {
  dust(ctx, ox, oy, cols, rows, colors, 0.012);

  const phase = (t % 4200) / 4200;
  const offline = phase > 0.35;

  // Stack vertically: cloud on top, device below, wire straight down
  const midX = Math.round(cols * 0.42);
  const cloudX = midX - 2;
  const cloudY = Math.max(1, Math.round(rows * 0.1));
  stamp(ctx, ox, oy, cols, rows, cloudX, cloudY, CLOUD, offline ? colors.mid : colors.ink, colors.accent);

  const devX = midX - 3;
  const devY = Math.round(rows * 0.52);
  stamp(ctx, ox, oy, cols, rows, devX, devY, DEVICE, colors.ink, colors.accent);

  const xWire = midX;
  const y0 = cloudY + 3;
  const y1 = devY;
  const steps = Math.max(4, y1 - y0);
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const y = y0 + i;
    if (offline && u > 0.35 && u < 0.65) continue;
    plot(ctx, ox, oy, cols, rows, xWire, y, offline ? colors.soft : i % 2 === 0 ? colors.mid : colors.ink);
  }

  if (!offline) {
    const u = (phase / 0.35) % 1;
    const py = Math.round(y0 + (y1 - y0) * u);
    plot(ctx, ox, oy, cols, rows, xWire, py, colors.accent);
    plot(ctx, ox, oy, cols, rows, xWire - 1, py, colors.accent);
    plot(ctx, ox, oy, cols, rows, xWire + 1, py, colors.accent);
  } else {
    const my = Math.round(y0 + (y1 - y0) * 0.5);
    plot(ctx, ox, oy, cols, rows, xWire, my, colors.accent);
    plot(ctx, ox, oy, cols, rows, xWire - 1, my - 1, colors.accent);
    plot(ctx, ox, oy, cols, rows, xWire + 1, my - 1, colors.accent);
    plot(ctx, ox, oy, cols, rows, xWire - 1, my + 1, colors.accent);
    plot(ctx, ox, oy, cols, rows, xWire + 1, my + 1, colors.accent);
  }

  const tick = Math.floor(t / 280) % 4;
  for (let i = 0; i < 4; i++) {
    const on = offline ? i <= tick : i === 0;
    plot(ctx, ox, oy, cols, rows, devX + 8 + i, devY + 2, on ? colors.accent : colors.soft);
    plot(ctx, ox, oy, cols, rows, devX + 8 + i, devY + 3, on ? colors.accent : colors.soft);
  }
  if (offline && tick % 2 === 0) {
    plot(ctx, ox, oy, cols, rows, devX + 3, devY + 2, colors.accent);
  }
}

const AGENT = [
  [0, 1, 0],
  [1, 2, 1],
  [1, 0, 1],
] as const;

const HAZARD = [
  [0, 2, 0],
  [2, 2, 2],
  [0, 2, 0],
] as const;

/** Planner dashed path vs reflex veto when a hazard appears. */
function paintAgents(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  cols: number,
  rows: number,
  t: number,
  colors: PixColors,
  _path: { x: number; y: number }[],
) {
  dust(ctx, ox, oy, cols, rows, colors, 0.012);

  const startX = 2;
  const startY = Math.round(rows * 0.72);
  const goalX = cols - 4;
  const goalY = Math.round(rows * 0.22);
  const hazX = Math.round(cols * 0.52);
  const hazY = Math.round(rows * 0.38);

  // Goal
  stamp(
    ctx,
    ox,
    oy,
    cols,
    rows,
    goalX,
    goalY,
    [
      [1, 1],
      [1, 1],
    ],
    colors.ink,
    colors.accent,
  );

  // Planned route (dashed) — goes straight through where hazard will be
  const planSteps = 16;
  for (let i = 0; i <= planSteps; i++) {
    const u = i / planSteps;
    const x = Math.round(startX + (goalX - startX) * u);
    const y = Math.round(startY + (goalY - startY) * u);
    if (i % 2 === 0) plot(ctx, ox, oy, cols, rows, x, y, colors.mid);
  }

  const cycle = (t % 5600) / 5600;
  // Hazard appears mid-run
  const hazardLive = cycle > 0.28 && cycle < 0.88;
  if (hazardLive) {
    stamp(ctx, ox, oy, cols, rows, hazX, hazY, HAZARD, colors.accent, colors.accent);
  }

  // Agent progress along path; reflex divert when near hazard
  let u = Math.min(1, cycle / 0.92);
  let ax = startX + (goalX - startX) * u;
  let ay = startY + (goalY - startY) * u;

  const nearHaz = hazardLive && u > 0.32 && u < 0.72;
  if (nearHaz) {
    // reflex: drop below hazard instead of following plan into it
    const local = (u - 0.32) / 0.4;
    const divert = Math.sin(Math.min(1, Math.max(0, local)) * Math.PI);
    ay = ay + divert * Math.max(3, rows * 0.22);
    // veto flash on the planned cell inside hazard
    if (local > 0.2 && local < 0.55) {
      plot(ctx, ox, oy, cols, rows, hazX + 1, hazY - 2, colors.accent);
      plot(ctx, ox, oy, cols, rows, hazX, hazY - 1, colors.accent);
      plot(ctx, ox, oy, cols, rows, hazX + 2, hazY - 1, colors.accent);
      // STOP bar
      for (let k = -2; k <= 2; k++) plot(ctx, ox, oy, cols, rows, hazX + 1 + k, hazY + 4, colors.accent);
    }
  }

  const ix = Math.round(ax);
  const iy = Math.round(Math.min(rows - 4, ay));
  stamp(ctx, ox, oy, cols, rows, ix, iy, AGENT, nearHaz ? colors.accent : colors.ink, colors.accent);

  // solid reflex trail behind agent (vs dashed plan)
  for (let back = 1; back <= 3; back++) {
    const bu = Math.max(0, u - back * 0.04);
    let bx = startX + (goalX - startX) * bu;
    let by = startY + (goalY - startY) * bu;
    if (hazardLive && bu > 0.32 && bu < 0.72) {
      const local = (bu - 0.32) / 0.4;
      by = by + Math.sin(Math.min(1, Math.max(0, local)) * Math.PI) * Math.max(3, rows * 0.22);
    }
    plot(ctx, ox, oy, cols, rows, Math.round(bx), Math.round(Math.min(rows - 4, by)), colors.ink);
  }
}

function buildAgentPath(cols: number, rows: number) {
  const path: { x: number; y: number }[] = [];
  let x = 2;
  let y = Math.round(rows * 0.7);
  const gx = cols - 4;
  const gy = Math.round(rows * 0.28);
  while (x < gx || y > gy) {
    path.push({ x, y });
    if (x < gx && ((x + y) % 3 !== 0 || y <= gy)) x += 1;
    else if (y > gy) y -= 1;
    else x += 1;
    if (path.length > 80) break;
  }
  path.push({ x: gx, y: gy });
  return path;
}

/**
 * Per-case pixel field — same dither lattice as the photo dither,
 * but drawn procedurally so robotics ≠ games ≠ edge.
 */
export function CasePixel({
  kind,
  alt,
  playing = true,
}: {
  kind: CaseKind;
  alt: string;
  playing?: boolean;
}) {
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
    let ox = 0;
    let oy = 0;
    let cssW = 0;
    let cssH = 0;
    let colors: PixColors = { ...readPixelColors(), accentRgb: [255, 77, 18] };
    let sprites = [
      { x: 3, y: 6, dx: 0.08 },
      { x: 12, y: 11, dx: -0.06 },
      { x: 20, y: 8, dx: 0.05 },
    ];
    let path: { x: number; y: number }[] = [];
    let raf = 0;
    let running = true;
    let visible = true;
    let still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let last = 0;

    const refreshColors = () => {
      const next = readPixelColors();
      const hex = next.accent.startsWith("#") ? next.accent : "#ff4d12";
      colors = { ...next, accentRgb: hexToRgb(hex) };
    };

    const layout = () => {
      const w = wrapEl.clientWidth;
      const h = wrapEl.clientHeight;
      if (w < 2 || h < 2) return;
      cssW = w;
      cssH = h;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.max(18, Math.floor((w + PIXEL_GAP) / PIXEL_STRIDE));
      rows = Math.max(14, Math.floor((h + PIXEL_GAP) / PIXEL_STRIDE));
      const gridW = cols * PIXEL_STRIDE - PIXEL_GAP;
      const gridH = rows * PIXEL_STRIDE - PIXEL_GAP;
      ox = (w - gridW) / 2;
      oy = (h - gridH) / 2;
      sprites = [
        { x: 2, y: Math.max(3, Math.round(rows * 0.28)), dx: 0.09 },
        { x: Math.max(6, Math.round(cols * 0.38)), y: Math.max(5, Math.round(rows * 0.48)), dx: -0.07 },
        { x: Math.max(8, Math.round(cols * 0.62)), y: Math.max(4, Math.round(rows * 0.34)), dx: 0.06 },
      ];
      path = buildAgentPath(cols, rows);
    };

    const paint = (t: number) => {
      if (cols < 2) return;
      ctx.clearRect(0, 0, cssW, cssH);
      if (kind === "robotics") paintRobotics(ctx, ox, oy, cols, rows, t, colors);
      else if (kind === "games") paintGames(ctx, ox, oy, cols, rows, t, colors, sprites);
      else if (kind === "spatial") paintSpatial(ctx, ox, oy, cols, rows, t, colors);
      else if (kind === "edge") paintEdge(ctx, ox, oy, cols, rows, t, colors);
      else paintAgents(ctx, ox, oy, cols, rows, t, colors, path);
    };

    const stepSprites = () => {
      for (const s of sprites) {
        s.x += s.dx;
        const maxX = cols - 6;
        if (s.x <= 1 || s.x >= maxX) s.dx *= -1;
      }
    };

    const tick = (now: number) => {
      if (!running) return;
      raf = requestAnimationFrame(tick);
      const live = visible && playing && !still;
      if (!live) return;
      if (now - last < 70) return;
      last = now;
      if (kind === "games") stepSprites();
      paint(now);
    };

    refreshColors();
    layout();
    paint(performance.now());
    raf = requestAnimationFrame(tick);

    const ro = new ResizeObserver(() => {
      layout();
      paint(performance.now());
    });
    ro.observe(wrapEl);

    const io = new IntersectionObserver(
      ([e]) => {
        visible = e.isIntersecting;
        if (visible) paint(performance.now());
      },
      { threshold: 0.08 },
    );
    io.observe(wrapEl);

    const onTheme = () => {
      refreshColors();
      paint(performance.now());
    };
    const obs = new MutationObserver(onTheme);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const scheme = window.matchMedia("(prefers-color-scheme: dark)");
    scheme.addEventListener("change", onTheme);
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMotion = () => {
      still = motion.matches;
      paint(performance.now());
    };
    motion.addEventListener("change", onMotion);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      obs.disconnect();
      scheme.removeEventListener("change", onTheme);
      motion.removeEventListener("change", onMotion);
    };
  }, [kind, playing]);

  return (
    <div className="case-dither case-pixel" ref={wrap} role="img" aria-label={alt}>
      <canvas ref={canvasRef} />
    </div>
  );
}
