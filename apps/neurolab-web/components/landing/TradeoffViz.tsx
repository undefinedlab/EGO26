/**
 * Micro-visualisations for the five tradeoffs. 64 x 32 grid, currentColor,
 * with the offending part in the signal accent so each card carries its
 * argument at a glance rather than relying on the label alone.
 */
import type { ReactNode } from "react";

function Viz({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 64 32"
      className="tradeoff-viz"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

/** Compute: a footprint that keeps doubling. */
export const VizCompute = () => (
  <Viz>
    <rect x="2" y="24" width="8" height="6" rx="1.5" />
    <rect x="13" y="19" width="8" height="11" rx="1.5" />
    <rect x="24" y="12" width="8" height="18" rx="1.5" />
    <rect x="35" y="4" width="8" height="26" rx="1.5" className="viz-accent" />
    <rect x="46" y="-4" width="8" height="34" rx="1.5" className="viz-accent" />
  </Viz>
);

/** Latency: one decision spends the whole budget getting there and back. */
export const VizLatency = () => (
  <Viz>
    <path d="M4 26v-6M60 26v-6" />
    <path d="M4 23h56" strokeDasharray="2 3" />
    <path d="M4 11c10-9 22 9 32 0" className="viz-accent" />
    <circle cx="4" cy="11" r="2" fill="currentColor" stroke="none" />
    <circle cx="36" cy="11" r="2.5" fill="currentColor" stroke="none" className="viz-accent" />
    <path d="M42 11h18" strokeDasharray="2 3" />
  </Viz>
);

/** Infrastructure: layers you have to run before the model runs. */
export const VizInfra = () => (
  <Viz>
    <path d="M32 3 55 11 32 19 9 11Z" className="viz-accent" />
    <path d="M9 17.5 32 25.5 55 17.5" />
    <path d="M9 24 32 32 55 24" />
  </Viz>
);

/** Determinism: the same input, more than one answer. */
export const VizDeterminism = () => (
  <Viz>
    <path d="M3 16h14" />
    <circle cx="20" cy="16" r="3" />
    <path d="M23 16c8 0 10-9 18-9M23 16h18M23 16c8 0 10 9 18 9" className="viz-accent" />
    <circle cx="44" cy="7" r="1.8" fill="currentColor" stroke="none" className="viz-accent" />
    <circle cx="44" cy="16" r="1.8" fill="currentColor" stroke="none" className="viz-accent" />
    <circle cx="44" cy="25" r="1.8" fill="currentColor" stroke="none" className="viz-accent" />
    <path d="M50 16h11" strokeDasharray="2 3" />
  </Viz>
);

/** Auditability: a sealed box, and no way to get the run back out. */
export const VizAudit = () => (
  <Viz>
    <rect x="16" y="7" width="26" height="18" rx="3" />
    <path d="M19 21 37 9M24 24 42 12M16 15 26 7" opacity="0.5" />
    <path d="M2 16h12" strokeDasharray="2 3" />
    <path d="M44 16h7" strokeDasharray="2 3" />
    <path d="M53 12.5 60 19.5M60 12.5 53 19.5" className="viz-accent" strokeWidth="2" />
  </Viz>
);

/* ------------------------------------------------------------------ gaps */

/** Packaged: a sealed module, ready to ship. */
export const VizPackaged = () => (
  <Viz>
    <rect x="14" y="10" width="36" height="16" rx="2.5" />
    <path d="M14 16h36" />
    <path d="M32 10v16" className="viz-accent" />
    <path d="M28 7h8l2 3H26Z" className="viz-accent" />
  </Viz>
);

/** Composed: discrete blocks wired into one behavior. */
export const VizComposed = () => (
  <Viz>
    <rect x="2" y="11" width="14" height="10" rx="2" />
    <rect x="25" y="11" width="14" height="10" rx="2" />
    <rect x="48" y="11" width="14" height="10" rx="2" className="viz-accent" />
    <path d="M16 16h9M39 16h9" className="viz-accent" />
  </Viz>
);

/** Versioned: successive tagged releases of the same module. */
export const VizVersioned = () => (
  <Viz>
    <rect x="6" y="18" width="16" height="8" rx="1.5" opacity="0.45" />
    <rect x="18" y="12" width="16" height="8" rx="1.5" opacity="0.7" />
    <rect x="30" y="6" width="16" height="8" rx="1.5" className="viz-accent" />
    <path d="M50 10h8M54 6v8" className="viz-accent" />
  </Viz>
);

/** Exported: leave the platform, land in a runtime. */
export const VizExported = () => (
  <Viz>
    <rect x="4" y="8" width="22" height="16" rx="2.5" />
    <path d="M12 16h28" className="viz-accent" />
    <path d="M34 10 46 16 34 22" className="viz-accent" />
    <rect x="48" y="12" width="12" height="8" rx="1.5" strokeDasharray="2 2" />
  </Viz>
);

/** Benchmarked: measured, not assumed. */
export const VizBenchmarked = () => (
  <Viz>
    <path d="M6 26V8M6 26h52" />
    <rect x="12" y="18" width="8" height="8" rx="1" />
    <rect x="26" y="13" width="8" height="13" rx="1" />
    <rect x="40" y="6" width="8" height="20" rx="1" className="viz-accent" />
    <circle cx="44" cy="6" r="2" fill="currentColor" stroke="none" className="viz-accent" />
  </Viz>
);

/** Independently verified: a second environment confirms the same result. */
export const VizVerified = () => (
  <Viz>
    <rect x="4" y="8" width="22" height="16" rx="2.5" />
    <path d="M10 16h10M10 20h6" opacity="0.6" />
    <path d="M28 16h8" strokeDasharray="2 2" />
    <circle cx="48" cy="16" r="10" className="viz-accent" />
    <path d="M43 16.5 46.5 20 54 11.5" className="viz-accent" strokeWidth="2" />
  </Viz>
);
