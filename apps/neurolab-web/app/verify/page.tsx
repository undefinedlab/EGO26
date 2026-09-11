"use client";

import { Shell } from "@/components/Shell";
import { VerifyShelf } from "@/components/VerifyShelf";
import { useEffect, useState } from "react";
import { putReceipt, putStack } from "@/lib/shelf";
import type { ReplayBundle } from "@/lib/composeRuntime";
import type { ComposePackage } from "@/lib/composeCompiler";
import "./verify.css";

export default function VerifyPage() {
  const [handoffNotice, setHandoffNotice] = useState("");
  const [handoffError, setHandoffError] = useState("");

  useEffect(() => {
    const source = new URLSearchParams(window.location.search).get("evidence");
    if (!source) return;

    void (async () => {
      try {
        if (source === "compose") {
          const raw = sessionStorage.getItem("synapsevm.verify.stack");
          if (!raw) throw Error("No Compose evidence. Capture a Stack receipt first.");
          const handoff = JSON.parse(raw) as { package: ComposePackage; evidence: ReplayBundle };
          await putStack(handoff.package, "imported");
          if (handoff.evidence?.format === "synapsevm.stack-replay.v1") {
            await putReceipt(handoff.evidence, "captured", handoff.package.graph.name);
          }
          setHandoffNotice("Compose package and receipt saved to your shelf. Use Verify on a card.");
        } else if (source === "simulator") {
          const raw = sessionStorage.getItem("synapsevm.verify.evidence");
          if (!raw) throw Error("No captured simulator evidence.");
          const evidence = JSON.parse(raw) as ReplayBundle;
          if (evidence?.format === "synapsevm.stack-replay.v1") {
            await putReceipt(evidence, "captured");
            setHandoffNotice("Simulator receipt saved to your shelf. Use Verify on the card.");
          } else {
            throw Error("Unsupported simulator evidence format for the shelf.");
          }
        }
        window.history.replaceState(null, "", "/verify");
      } catch (e) {
        setHandoffError(String(e));
      }
    })();
  }, []);

  return (
    <Shell wide>
      <div className="vf">
        <header className="vf-header">
          <div>
            <span className="vf-kicker">EVIDENCE WORKSPACE</span>
            <h1>Know what was checked.</h1>
            <p>
              This browser keeps the Stacks you compiled and the receipts you captured. Open a card to inspect it, run
              Simulate, or Verify — import more anytime from the library grid.
            </p>
          </div>
        </header>

        {(handoffError || handoffNotice) && (
          <p role={handoffError ? "alert" : "status"} className={handoffError ? "vsh-error" : "vsh-notice"}>
            {handoffError || handoffNotice}
            <button
              type="button"
              onClick={() => {
                setHandoffError("");
                setHandoffNotice("");
              }}
              aria-label="Dismiss"
            >
              ×
            </button>
          </p>
        )}

        <VerifyShelf />
      </div>
    </Shell>
  );
}
