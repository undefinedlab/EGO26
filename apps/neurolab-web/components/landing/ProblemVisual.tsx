"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const RoundTrip = dynamic(() => import("@/components/landing/RoundTrip"), {
  ssr: false,
  loading: () => <div className="scene-canvas scene-canvas--fallback" aria-hidden />,
});

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

/**
 * The round-trip diagram. Labels live in the DOM rather than the scene so
 * they stay crisp, selectable, and readable to assistive tech.
 */
export function ProblemVisual() {
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => setOk(hasWebGL()), []);

  return (
    <figure className="scene glass">
      {ok ? <RoundTrip /> : <div className="scene-canvas scene-canvas--fallback" aria-hidden />}

      <span className="scene-tag scene-tag--remote">
        <span className="scene-dot" aria-hidden />
        general-purpose model
      </span>
      <span className="scene-tag scene-tag--local">
        <span className="scene-dot scene-dot--accent" aria-hidden />
        local reflex
      </span>

      <figcaption className="scene-caption">
        <span>One round trip per decision</span>
        <span aria-hidden>vs</span>
        <span className="accent">many local ticks</span>
      </figcaption>
    </figure>
  );
}
