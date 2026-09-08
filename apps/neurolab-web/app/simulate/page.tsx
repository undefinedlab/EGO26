"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Shell } from "@/components/Shell";
import { Simulator } from "@/components/Simulator";
import { casesForBlock, type BlockId } from "@/lib/blocks";
import { useLabStore } from "@/lib/store";

function SimLabInner() {
  const params = useSearchParams();
  const set = useLabStore((s) => s.set);

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

  return (
    <>
      <div className="simlab-page-head">
        <div className="page-head-copy">
          <p className="lp-kicker">NeuroLab</p>
          <h1>Sim Lab</h1>
          <p className="simlab-page-blurb">
            Pick a NeuroBlock, choose a use case, and watch it run in a body. The scene freezes on
            trigger so you can inspect the causal replay behind the action.
          </p>
        </div>
        <div className="page-head-actions">
          <Link href="/explore" className="btn btn-ghost btn-sm">
            Library
          </Link>
          <Link href="/verify" className="btn btn-ghost btn-sm">
            Verify a receipt
          </Link>
        </div>
      </div>
      <Simulator />
    </>
  );
}

export default function SimulatePage() {
  return (
    <Shell wide>
      <Suspense fallback={<div className="muted">Loading Sim Lab…</div>}>
        <SimLabInner />
      </Suspense>
    </Shell>
  );
}
