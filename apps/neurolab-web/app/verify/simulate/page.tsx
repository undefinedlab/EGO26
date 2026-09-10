"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Shell } from "@/components/Shell";
import { Simulator } from "@/components/Simulator";
import { ComposeStudio } from "@/components/ComposeStudio";
import { MotifLab } from "@/components/MotifLab";
import { ThemeToggle } from "@/components/ThemeToggle";
import { casesForBlock, type BlockId } from "@/lib/blocks";
import { SIMULATE_HREF } from "@/lib/nav";
import { useLabStore } from "@/lib/store";
import "../../compose/compose.css";
import "../verify.css";

type Subject = "block" | "motif";

const SUBJECTS: { id: Subject; label: string; blurb: string }[] = [
  { id: "block", label: "Block in a body", blurb: "A compiled module driving a machine in a scene" },
  { id: "motif", label: "Motif", blurb: "A complete graph, run directly — nothing to import" },
];

function SimulateBackBar() {
  return (
    <div className="vf-sim-bar">
      <Link href="/verify" className="vf-sim-back">
        ← Back
      </Link>
      <div>
        <span className="vf-kicker">VERIFY · SUBFEATURE</span>
        <strong>Simulate</strong>
      </div>
      <div className="vf-sim-bar-actions">
        <ThemeToggle className="theme-toggle--bare" />
      </div>
    </div>
  );
}

function SimLabInner() {
  const params = useSearchParams();
  const demo = params.has("block") || params.has("motif") || params.get("mode") === "demo";
  const set = useLabStore((s) => s.set);
  const [subject, setSubject] = useState<Subject>("block");

  useEffect(() => {
    if (params.get("motif")) setSubject("motif");
  }, [params]);

  useEffect(() => {
    const b = params.get("block") as BlockId | null;
    if (!b) return;
    const cases = casesForBlock(b);
    if (!cases.length) return;
    set({
      blockId: b,
      caseId: cases[0].id,
      speed: cases[0].defaultSpeed,
      receipts: [],
      whyOpen: false,
      whyDetail: null,
      tick: 0,
    });
  }, [params, set]);

  if (!demo) {
    return (
      <>
        <SimulateBackBar />
        <ComposeStudio mode="simulate" />
      </>
    );
  }

  return (
    <>
      <SimulateBackBar />
      <div className="simlab-page-head">
        <div className="page-head-copy">
          <p className="lp-kicker">NeuroLab</p>
          <h1>Block & motif demos</h1>
          <p className="simlab-page-blurb">
            Run a module in a machine, or run a motif on its own. Either way the scene freezes on
            trigger so you can inspect what caused the action.
          </p>
        </div>
        <div className="page-head-actions">
          <Link href={SIMULATE_HREF} className="btn btn-ghost btn-sm">
            Simulate compiled Stack
          </Link>
          <Link href="/explore?kind=Motif" className="btn btn-ghost btn-sm">
            Motif library
          </Link>
        </div>
      </div>

      <div className="simlab-subjects" role="tablist" aria-label="What to simulate">
        {SUBJECTS.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={subject === s.id}
            className={subject === s.id ? "simlab-subject active" : "simlab-subject"}
            onClick={() => setSubject(s.id)}
          >
            <span className="simlab-subject-label">{s.label}</span>
            <span className="simlab-subject-blurb">{s.blurb}</span>
          </button>
        ))}
      </div>

      {subject === "block" ? <Simulator /> : <MotifLab />}
    </>
  );
}

export default function VerifySimulatePage() {
  return (
    <Shell wide bare>
      <Suspense fallback={<div className="muted">Loading Sim Lab…</div>}>
        <SimLabInner />
      </Suspense>
    </Shell>
  );
}
