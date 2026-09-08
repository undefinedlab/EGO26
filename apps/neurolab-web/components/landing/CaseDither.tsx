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
