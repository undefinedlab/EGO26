"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { CasePixel, type CaseKind } from "@/components/landing/CaseDither";
import { useLandingDeckOptional } from "@/components/landing/LandingDeck";

export type UseCase = {
  title: string;
  body: string;
  points: readonly string[];
  status?: string;
};

const CASE_KIND: Record<string, CaseKind> = {
  Robotics: "robotics",
  "Games & simulation": "games",
  "3D & spatial": "spatial",
  "Edge software": "edge",
  "Autonomous agents": "agents",
};

const CASE_STATUS: Record<CaseKind, string> = {
  robotics: "REFLEX · LIVE",
  games: "NPC LOOP · 16MS",
  spatial: "CAM · ROOM LOCK",
  edge: "EDGE · OFFLINE",
  agents: "PLAN + REFLEX",
};

function caseKind(title: string, index: number): CaseKind {
  return CASE_KIND[title] ?? (["robotics", "games", "spatial", "edge", "agents"] as const)[index % 5];
}

function wrapDelta(i: number, index: number, len: number) {
  let d = i - index;
  if (d > len / 2) d -= len;
  if (d < -len / 2) d += len;
  return d;
}

function formatStatus(kind: CaseKind, base: string, tick: number, live: boolean) {
  if (!live) return base;
  if (kind === "robotics") {
    return tick % 6 === 0 ? `LOOM · ${11 + (tick % 4)}MS` : base;
  }
  if (kind === "games") {
    return `NPC LOOP · ${15 + (tick % 4)}MS`;
  }
  if (kind === "spatial") {
    return tick % 5 === 0 ? `DEPTH · ${78 + (tick % 11)}CM` : base;
  }
  if (kind === "edge") {
    return tick % 7 === 0 ? "EDGE · TICK" : base;
  }
  return tick % 5 === 0 ? "VETO · ARMED" : base;
}

function CaseStatus({
  kind,
  label,
  playing,
}: {
  kind: CaseKind;
  label: string;
  playing: boolean;
}) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 920);
    return () => window.clearInterval(id);
  }, [playing]);

  return (
    <footer className="case-slide-status">
      <i
        className="case-slide-status-led"
        data-live={playing && kind !== "edge" ? "true" : "false"}
        data-kind={kind}
        aria-hidden
      />
      <span>{formatStatus(kind, label, tick, playing)}</span>
    </footer>
  );
}

export function UseCaseSlider({ cases }: { cases: readonly UseCase[] }) {
  const deck = useLandingDeckOptional();
  const [index, setIndex] = useState(0);
  const touchX = useRef<number | null>(null);
  const onUseCases = deck?.slides[deck.index]?.id === "usecases";
  const active = cases[index] ?? cases[0];

  const go = useCallback(
    (next: number) => {
      setIndex(((next % cases.length) + cases.length) % cases.length);
    },
    [cases.length],
  );

  useEffect(() => {
    if (!onUseCases) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        go(index + 1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        go(index - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, index, onUseCases]);

  const cards = useMemo(
    () =>
      cases.map((c, i) => {
        const d = wrapDelta(i, index, cases.length);
        return { c, i, d, visible: Math.abs(d) <= 1 };
      }),
    [cases, index],
  );

  return (
    <div
      className="case-slider"
      data-deck-nest="true"
      aria-roledescription="carousel"
      aria-label="Use case categories"
    >
      <div
        className="case-slider-stage"
        onTouchStart={(e) => {
          touchX.current = e.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(e) => {
          if (touchX.current == null) return;
          const x = e.changedTouches[0]?.clientX;
          if (x == null) return;
          const dx = touchX.current - x;
          touchX.current = null;
          if (Math.abs(dx) < 40) return;
          go(index + (dx > 0 ? 1 : -1));
        }}
      >
        <div className="case-slider-glow" aria-hidden />
        <div className="case-slider-deck">
          {cards.map(({ c, i, d, visible }) => {
            const kind = caseKind(c.title, i);
            const status = c.status ?? CASE_STATUS[kind];
            return (
              <article
                key={c.title}
                className="case-slide-card"
                data-active={d === 0 ? "true" : "false"}
                data-kind={kind}
                data-side={d < 0 ? "left" : d > 0 ? "right" : "center"}
                aria-hidden={!visible || d !== 0}
                style={
                  {
                    "--d": d,
                    "--abs": Math.abs(d),
                    opacity: visible ? (d === 0 ? 1 : 0.72) : 0,
                    pointerEvents: visible ? "auto" : "none",
                    zIndex: 10 - Math.abs(d),
                    cursor: d === 0 ? "default" : "pointer",
                  } as CSSProperties
                }
                onClick={() => {
                  if (d !== 0) go(i);
                }}
              >
                <div className="case-slide-media">
                  <CasePixel kind={kind} alt={`${c.title} pixel field`} playing={visible && d === 0} />
                </div>
                <CaseStatus kind={kind} label={status} playing={visible && d === 0} />
              </article>
            );
          })}
        </div>
      </div>

      <div className="case-slider-dots" role="tablist" aria-label="Use cases">
        {cases.map((c, i) => (
          <button
            key={c.title}
            type="button"
            role="tab"
            aria-selected={i === index}
            aria-label={c.title}
            className="case-slider-dot"
            data-active={i === index ? "true" : "false"}
            onClick={() => setIndex(i)}
          />
        ))}
      </div>

      <div className="case-slider-caption" aria-live="polite">
        <h3>{active.title}</h3>
        <p>{active.body}</p>
      </div>
    </div>
  );
}
