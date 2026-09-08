"use client";

import { useRef, type CSSProperties, type HTMLAttributes, type ReactNode } from "react";

/**
 * Pointer-reactive card: a few degrees of tilt plus a specular highlight
 * that tracks the cursor. Values are written as custom properties so the
 * stylesheet owns the look and `prefers-reduced-motion` can flatten it.
 */
export function Tilt({
  children,
  className = "",
  max = 7,
  style,
  ...rest
}: {
  children: ReactNode;
  className?: string;
  max?: number;
  style?: CSSProperties;
} & Omit<HTMLAttributes<HTMLDivElement>, "style" | "className" | "children">) {
  const ref = useRef<HTMLDivElement>(null);
  const frame = useRef(0);

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      el.style.setProperty("--ry", `${(px - 0.5) * 2 * max}deg`);
      el.style.setProperty("--rx", `${(py - 0.5) * -2 * max}deg`);
      el.style.setProperty("--mx", `${px * 100}%`);
      el.style.setProperty("--my", `${py * 100}%`);
    });
  };

  const reset = () => {
    const el = ref.current;
    if (!el) return;
    cancelAnimationFrame(frame.current);
    el.style.setProperty("--ry", "0deg");
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--mx", "50%");
    el.style.setProperty("--my", "50%");
  };

  return (
    <div
      ref={ref}
      className={`tilt ${className}`.trim()}
      style={style}
      onPointerMove={onMove}
      onPointerLeave={reset}
      {...rest}
    >
      {children}
    </div>
  );
}
