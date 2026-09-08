"use client";

import dynamic from "next/dynamic";

/** Canvas Life field — light enough to load after first paint. */
const NeuralField = dynamic(() => import("@/components/landing/NeuralField"), {
  ssr: false,
  loading: () => <div className="hero-canvas hero-canvas--fallback" aria-hidden />,
});

export function HeroCanvas() {
  return <NeuralField />;
}
