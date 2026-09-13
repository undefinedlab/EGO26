"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useLandingDeckOptional } from "@/components/landing/LandingDeck";

export type VerifyLayer = {
  title: string;
  body: string;
  detail: string;
};

function wrapDelta(i: number, index: number, len: number) {
  let d = i - index;
  if (d > len / 2) d -= len;
  if (d < -len / 2) d += len;
  return d;
}

function ArrowMark({ active }: { active: boolean }) {
  return (
    <svg className="verify-rail-mark" viewBox="0 0 14 14" aria-hidden>
      {active ? (
        <path d="M2.2 7h7.6M7.2 3.4 10.8 7l-3.6 3.6" />
      ) : (
        <circle cx="7" cy="7" r="1.65" />
      )}
    </svg>
  );
}

export function VerifySlider({ layers }: { layers: readonly VerifyLayer[] }) {
  const deck = useLandingDeckOptional();
  const [index, setIndex] = useState(0);
  const touchX = useRef<number | null>(null);
  const onVerify = deck?.slides[deck.index]?.id === "verify";
  const active = layers[index] ?? layers[0];
  const progress = layers.length > 1 ? index / (layers.length - 1) : 0;

  const go = useCallback(
    (next: number) => {
      setIndex(((next % layers.length) + layers.length) % layers.length);
    },
    [layers.length],
  );

  useEffect(() => {
    if (!onVerify) return;
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
  }, [go, index, onVerify]);

  const cards = useMemo(
    () =>
      layers.map((layer, i) => {
        const d = wrapDelta(i, index, layers.length);
        return { layer, i, d, visible: Math.abs(d) <= 1 };
      }),
    [layers, index],
  );

  return (
    <div
      className="verify-slider"
      data-deck-nest="true"
      aria-roledescription="carousel"
      aria-label="Verification layers"
    >
      <div
        className="verify-slider-stage"
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
        <div className="verify-slider-glow" aria-hidden />
        <div className="verify-slider-deck">
          {cards.map(({ layer, i, d, visible }) => (
            <article
              key={layer.title}
              className="verify-slide-card"
              data-active={d === 0 ? "true" : "false"}
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
              <header className="verify-slide-top">
                <span className="verify-slide-idx">{String(i + 1).padStart(2, "0")}</span>
                <span className="verify-slide-layer">Layer</span>
              </header>
              <h3>{layer.title}</h3>
              <p className="verify-slide-body">{layer.body}</p>
              <p className="verify-slide-detail">{layer.detail}</p>
            </article>
          ))}
        </div>
      </div>

      <nav className="verify-rail" aria-label="Verification progress">
        <button
          type="button"
          className="verify-rail-step"
          aria-label="Previous layer"
          onClick={() => go(index - 1)}
        >
          <svg viewBox="0 0 16 16" aria-hidden>
            <path d="M9.8 3.6 5.4 8l4.4 4.4" />
          </svg>
        </button>

        <div
          className="verify-rail-track"
          role="tablist"
          style={{ "--progress": String(progress) } as CSSProperties}
        >
          <span className="verify-rail-line" aria-hidden />
          <span className="verify-rail-fill" aria-hidden />
          {layers.map((layer, i) => (
            <button
              key={layer.title}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={layer.title}
              className="verify-rail-dot"
              data-active={i === index ? "true" : "false"}
              data-done={i < index ? "true" : "false"}
              style={{ "--i": String(i / Math.max(1, layers.length - 1)) } as CSSProperties}
              onClick={() => setIndex(i)}
            >
              <ArrowMark active={i === index} />
            </button>
          ))}
        </div>

        <button
          type="button"
          className="verify-rail-step"
          aria-label="Next layer"
          onClick={() => go(index + 1)}
        >
          <svg viewBox="0 0 16 16" aria-hidden>
            <path d="M6.2 3.6 10.6 8 6.2 12.4" />
          </svg>
        </button>
      </nav>

      <p className="verify-slider-live sr-only" aria-live="polite">
        {active.title}
      </p>
    </div>
  );
}
