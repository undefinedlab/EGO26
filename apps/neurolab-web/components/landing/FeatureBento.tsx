"use client";

/**
 * Overlapping feature bento — layout language from the reference cluster
 * (large core + metric + side note + accent), with staggered appear.
 */
import type { CSSProperties } from "react";
import { Tilt } from "@/components/landing/Tilt";

export function FeatureBento() {
  return (
    <div className="feature-bento" aria-label="Core features">
      <div className="feature-bento-stage">
        <div className="fb-slot fb-slot--core" style={{ "--d": 1 } as CSSProperties}>
          <Tilt className="fb-card fb-card--core" max={5}>
            <div className="fb-core-visual" aria-hidden>
              <span className="fb-core-orb fb-core-orb--a" />
              <span className="fb-core-orb fb-core-orb--b" />
              <span className="fb-core-grid" />
            </div>
            <div className="fb-core-copy">
              <h3>NeuroBlocks · NeuroStacks</h3>
              <p>Reusable neural functions with typed I/O — compose into versioned, exportable behaviors.</p>
              <div className="fb-core-meta">
                <span>typed I/O</span>
                <span>compose</span>
                <span>export</span>
              </div>
            </div>
          </Tilt>
        </div>

        <div className="fb-slot fb-slot--metric" style={{ "--d": 0 } as CSSProperties}>
          <Tilt className="fb-card fb-card--metric glass" max={6}>
            <span className="fb-label">Deterministic</span>
            <strong className="fb-value">100%</strong>
            <span className="fb-unit">replayable ticks</span>
          </Tilt>
        </div>

        <div className="fb-slot fb-slot--side" style={{ "--d": 2 } as CSSProperties}>
          <Tilt className="fb-card fb-card--side glass" max={6}>
            <span className="fb-label">Workbench</span>
            <h3>Compose live</h3>
            <p>Typed node editor with validation before compile.</p>
          </Tilt>
        </div>

        <div className="fb-slot fb-slot--sim" style={{ "--d": 3 } as CSSProperties}>
          <Tilt className="fb-card fb-card--sim glass" max={5}>
            <span className="fb-label">3D Simulator</span>
            <h3>Same binary</h3>
            <p>Test the modules you ship — not a mock.</p>
          </Tilt>
        </div>

        <div className="fb-slot fb-slot--accent" style={{ "--d": 4 } as CSSProperties}>
          <Tilt className="fb-card fb-card--accent" max={6}>
            <span className="fb-label">NeuroReceipts</span>
            <h3>Verified path</h3>
            <p>Input → action, recorded</p>
            <div className="fb-dots" aria-hidden>
              {Array.from({ length: 18 }, (_, i) => (
                <i key={i} data-lit={i < 14 ? "true" : "false"} />
              ))}
            </div>
          </Tilt>
        </div>
      </div>
    </div>
  );
}
