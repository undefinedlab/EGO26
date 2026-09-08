"use client";

/**
 * Hero field — Conway's Game of Life as a readable "neural" grid.
 * Pointer paints live cells; the automaton keeps reacting to what you leave behind.
 */
import { useEffect, useRef } from "react";

const STEP_MS = 140;
const CELL = 14;
const GAP = 3;
const STRIDE = CELL + GAP;
const BRUSH = 1; // radius in cells for paint
const HOVER_R = 1;

type Palette = {
  base: string;
  signal: string;
};

function readPalette(): Palette {
  const styles = getComputedStyle(document.documentElement);
  const theme = document.documentElement.getAttribute("data-theme");
  const dark =
    theme === "dark" ||
    (theme !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  const accent = styles.getPropertyValue("--accent").trim() || (dark ? "#ff5c26" : "#ff4d12");

  return {
    base: dark ? "rgba(182, 186, 192, 1)" : "rgba(63, 66, 70, 1)",
    signal: accent,
  };
}

function seedGrid(cols: number, rows: number): Uint8Array {
  const g = new Uint8Array(cols * rows);
  let s = 0xc0ffee >>> 0;
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

  const glider = [
    [0, 1, 0],
    [0, 0, 1],
    [1, 1, 1],
  ] as const;
  const blinker = [[1, 1, 1]] as const;
  const toad = [
    [0, 1, 1, 1],
    [1, 1, 1, 0],
  ] as const;
  const beacon = [
    [1, 1, 0, 0],
    [1, 1, 0, 0],
    [0, 0, 1, 1],
    [0, 0, 1, 1],
  ] as const;
  const pulsarArm = [
    [0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1],
    [0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1, 0, 0],
  ] as const;

  for (let i = 0; i < g.length; i++) {
    if (rnd() < 0.11) g[i] = 1;
  }

  stamp(Math.floor(cols * 0.18), Math.floor(rows * 0.22), glider);
  stamp(Math.floor(cols * 0.62), Math.floor(rows * 0.18), glider);
  stamp(Math.floor(cols * 0.4), Math.floor(rows * 0.55), blinker);
  stamp(Math.floor(cols * 0.72), Math.floor(rows * 0.48), toad);
  stamp(Math.floor(cols * 0.22), Math.floor(rows * 0.58), beacon);
  stamp(Math.floor(cols * 0.48), Math.floor(rows * 0.28), pulsarArm);

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

function withAlpha(color: string, alpha: number): string {
  if (color.startsWith("rgba")) {
    return color.replace(/[\d.]+\s*\)$/, `${alpha})`);
  }
  if (color.startsWith("rgb(")) {
    return color.replace("rgb(", "rgba(").replace(")", `, ${alpha})`);
  }
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

const GLIDER_NE = [
  [0, 1, 0],
  [0, 0, 1],
  [1, 1, 1],
] as const;

export default function NeuralField() {
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
    let curr: Uint8Array = new Uint8Array(0);
    let next: Uint8Array = new Uint8Array(0);
    let age = new Float32Array(0);
    let hover = new Float32Array(0);
    let palette = readPalette();
    let still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let active = true;
    let raf = 0;
    let lastStep = 0;
    let running = true;
    let drawing = false;
    let hoverCell = { x: -1, y: -1 };

    const layout = () => {
      const w = wrapEl.clientWidth;
      const h = wrapEl.clientHeight;
      const gridW = cols * STRIDE - GAP;
      const gridH = rows * STRIDE - GAP;
      ox = (w - gridW) / 2;
      oy = (h - gridH) / 2;
    };

    const cellAt = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      const px = clientX - rect.left;
      const py = clientY - rect.top;
      const x = Math.floor((px - ox) / STRIDE);
      const y = Math.floor((py - oy) / STRIDE);
      if (x < 0 || y < 0 || x >= cols || y >= rows) return null;
      // Ignore clicks in the gutter between cells.
      const lx = (px - ox) % STRIDE;
      const ly = (py - oy) % STRIDE;
      if (lx > CELL || ly > CELL) return { x, y }; // still count near edge as cell
      return { x, y };
    };

    const paintBrush = (cx: number, cy: number, radius: number, birth: boolean) => {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (dx * dx + dy * dy > radius * radius + 0.5) continue;
          const x = cx + dx;
          const y = cy + dy;
          if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
          const i = y * cols + x;
          curr[i] = 1;
          if (birth) age[i] = 1;
          else age[i] = Math.max(age[i], 0.85);
        }
      }
    };

    const stampPattern = (
      cx: number,
      cy: number,
      pattern: readonly (readonly number[])[],
    ) => {
      const ph = pattern.length;
      const pw = pattern[0]?.length ?? 0;
      const ox0 = cx - Math.floor(pw / 2);
      const oy0 = cy - Math.floor(ph / 2);
      for (let y = 0; y < ph; y++) {
        for (let x = 0; x < pw; x++) {
          if (!pattern[y][x]) continue;
          const gx = ox0 + x;
          const gy = oy0 + y;
          if (gx < 0 || gy < 0 || gx >= cols || gy >= rows) continue;
          const i = gy * cols + gx;
          curr[i] = 1;
          age[i] = 1;
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

      const nextCols = Math.max(12, Math.floor((w + GAP) / STRIDE));
      const nextRows = Math.max(10, Math.floor((h + GAP) / STRIDE));
      if (nextCols !== cols || nextRows !== rows) {
        cols = nextCols;
        rows = nextRows;
        curr = seedGrid(cols, rows);
        next = new Uint8Array(cols * rows);
        age = new Float32Array(cols * rows);
        hover = new Float32Array(cols * rows);
        for (let i = 0; i < curr.length; i++) if (curr[i]) age[i] = 1;
      }
      layout();
    };

    const paint = () => {
      const w = wrapEl.clientWidth;
      const h = wrapEl.clientHeight;
      ctx.clearRect(0, 0, w, h);
      layout();
      const r = Math.max(2.5, CELL * 0.38);

      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const i = y * cols + x;
          const hv = hover[i];
          const a = Math.max(age[i], hv);
          if (a < 0.02) continue;

          const cx = ox + x * STRIDE + CELL / 2;
          const cy = oy + y * STRIDE + CELL / 2;
          const alive = curr[i] === 1;
          const birth = alive && age[i] > 0.85;
          const hot = hv > 0.4;

          ctx.beginPath();
          ctx.arc(cx, cy, r * (alive || hot ? 1 : 0.65), 0, Math.PI * 2);
          ctx.fillStyle = hot && !alive
            ? withAlpha(palette.signal, 0.18 + hv * 0.35)
            : birth
              ? withAlpha(palette.signal, 0.4 + a * 0.5)
              : alive
                ? withAlpha(palette.base, 0.28 + a * 0.5)
                : withAlpha(palette.base, a * 0.16);
          ctx.fill();

          if (birth || hot) {
            ctx.beginPath();
            ctx.arc(cx, cy, r * (hot ? 1.8 : 1.55), 0, Math.PI * 2);
            ctx.fillStyle = withAlpha(palette.signal, hot ? 0.1 + hv * 0.12 : 0.12);
            ctx.fill();
          }
        }
      }
    };

    const tick = (t: number) => {
      if (!running) return;
      raf = requestAnimationFrame(tick);
      if (!active) return;

      // Hover glow fades every frame.
      for (let i = 0; i < hover.length; i++) hover[i] *= 0.86;

      if (hoverCell.x >= 0) {
        for (let dy = -HOVER_R; dy <= HOVER_R; dy++) {
          for (let dx = -HOVER_R; dx <= HOVER_R; dx++) {
            const x = hoverCell.x + dx;
            const y = hoverCell.y + dy;
            if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
            const d = Math.hypot(dx, dy);
            if (d > HOVER_R + 0.2) continue;
            hover[y * cols + x] = Math.max(hover[y * cols + x], 1 - d * 0.35);
          }
        }
      }

      if (!still && t - lastStep >= STEP_MS) {
        lastStep = t;
        stepLife(curr, next, cols, rows);
        const tmp = curr;
        curr = next;
        next = tmp;

        for (let i = 0; i < curr.length; i++) {
          if (curr[i]) age[i] = Math.min(1, age[i] * 0.55 + 0.55);
          else age[i] *= 0.72;
        }

        let live = 0;
        for (let i = 0; i < curr.length; i++) live += curr[i];
        if (live < cols * rows * 0.03) {
          for (let k = 0; k < 8; k++) {
            const i = (Math.random() * curr.length) | 0;
            curr[i] = 1;
            age[i] = 1;
          }
        }
      }

      paint();
    };

    const onPointerMove = (e: PointerEvent) => {
      const cell = cellAt(e.clientX, e.clientY);
      if (!cell) {
        hoverCell = { x: -1, y: -1 };
        return;
      }
      hoverCell = cell;
      if (drawing) paintBrush(cell.x, cell.y, BRUSH, true);
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const cell = cellAt(e.clientX, e.clientY);
      if (!cell) return;
      drawing = true;
      canvas.setPointerCapture(e.pointerId);
      // Click drops a glider; drag keeps painting a brush.
      stampPattern(cell.x, cell.y, GLIDER_NE);
      paintBrush(cell.x, cell.y, BRUSH, true);
      hoverCell = cell;
    };

    const onPointerUp = (e: PointerEvent) => {
      drawing = false;
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
    };

    const onPointerLeave = () => {
      hoverCell = { x: -1, y: -1 };
      drawing = false;
    };

    resize();
    paint();
    raf = requestAnimationFrame(tick);

    const ro = new ResizeObserver(resize);
    ro.observe(wrapEl);

    const io = new IntersectionObserver(([e]) => {
      active = e.isIntersecting;
    }, { threshold: 0.01 });
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

    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("pointerleave", onPointerLeave);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      mq.removeEventListener("change", onMotion);
      obs.disconnect();
      scheme.removeEventListener("change", onScheme);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("pointerleave", onPointerLeave);
    };
  }, []);

  return (
    <div className="hero-canvas" ref={wrap}>
      <canvas
        ref={canvasRef}
        className="hero-life"
        aria-label="Interactive Game of Life — click or drag to seed cells"
      />
    </div>
  );
}
