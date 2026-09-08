"use client";

import { Shell } from "@/components/Shell";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Receipt = {
  schema: string;
  receiptId: string;
  blockRoot: string;
  stackRoot: string;
  deviceId: string;
  sequence: number;
  localTimestampUs: number;
  tick: number;
  inputRoot: string;
  encodedInputRoot: string;
  stateBeforeRoot: string;
  traceRoot: string;
  stateAfterRoot: string;
  actionType: string;
  actionDataHash: string;
  previousReceiptHash: string;
  runtimeHash: string;
  signatureScheme: string;
  signature: string;
};

type ReplayResult = {
  valid?: boolean;
  match?: boolean;
  actionType?: string;
  error?: string;
  message?: string;
  [k: string]: unknown;
};

type Stage = {
  id: string;
  title: string;
  status: "idle" | "running" | "pass" | "fail" | "skip";
  detail: string;
};

function short(h: string, n = 14) {
  if (!h) return "—";
  return h.length <= n + 1 ? h : `${h.slice(0, n)}…`;
}

const FIELD_GROUPS: { title: string; keys: (keyof Receipt)[] }[] = [
  {
    title: "Identity",
    keys: ["receiptId", "deviceId", "sequence", "tick", "localTimestampUs", "schema"],
  },
  {
    title: "Commitments",
    keys: [
      "blockRoot",
      "stackRoot",
      "inputRoot",
      "encodedInputRoot",
      "stateBeforeRoot",
      "traceRoot",
      "stateAfterRoot",
      "runtimeHash",
      "previousReceiptHash",
    ],
  },
  {
    title: "Action",
    keys: ["actionType", "actionDataHash", "signatureScheme", "signature"],
  },
];

export default function VerifyPage() {
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [stages, setStages] = useState<Stage[]>([
    { id: "local", title: "Local SynapseVM replay", status: "idle", detail: "Waiting" },
    { id: "cre", title: "Chainlink CRE validation", status: "idle", detail: "Post-action trust plane" },
    { id: "chain", title: "Onchain commitment", status: "idle", detail: "NeuroRegistry / batch root" },
  ]);
  const [raw, setRaw] = useState("");

  useEffect(() => {
    fetch("/samples/receipt-current.json")
      .then((r) => r.json())
      .then((j) => setReceipt(j as Receipt))
      .catch((e) => setLoadError(String(e)));
  }, []);

  const setStage = (id: string, patch: Partial<Stage>) => {
    setStages((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const runLocal = async () => {
    if (!receipt) return;
    setBusy(true);
    setStage("local", { status: "running", detail: "POST /v1/replay …" });
    try {
      const res = await fetch("http://127.0.0.1:8788/v1/replay", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          bundleDir: "receipt-bundles/75f63a0edd5a1b6c",
          receipt,
        }),
      });
      const json = (await res.json()) as ReplayResult;
      setRaw(JSON.stringify(json, null, 2));
      const ok = res.ok && json.valid === true;
      setStage("local", {
        status: ok ? "pass" : "fail",
        detail: ok
          ? `Replay MATCH · action ${json.actionType ?? receipt.actionType}`
          : json.error || json.message || "Replay failed — is validator-api running?",
      });
      return ok;
    } catch (e) {
      const msg = String(e);
      setRaw(
        JSON.stringify(
          {
            valid: false,
            message: "Start validator-api on :8788, then re-run local replay.",
            error: msg,
            note: "Validation is never in the reflex loop — offline replay only.",
          },
          null,
          2,
        ),
      );
      setStage("local", {
        status: "fail",
        detail: "Validator unavailable · replay not verified",
      });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const runAll = async () => {
    await runLocal();
    setStage("cre", { status: "skip", detail: "Not configured · no external validation has been performed" });
    setStage("chain", { status: "skip", detail: "Not configured · no transaction or inclusion proof available" });
  };

  const checklist = useMemo(() => {
    if (!receipt) return [];
    return [
      { label: "Sensor / input root", ok: !!receipt.inputRoot, value: short(receipt.inputRoot) },
      { label: "State before", ok: !!receipt.stateBeforeRoot, value: short(receipt.stateBeforeRoot) },
      { label: "Block root", ok: !!receipt.blockRoot, value: short(receipt.blockRoot) },
      { label: "Trace root", ok: !!receipt.traceRoot, value: short(receipt.traceRoot) },
      { label: "Action", ok: !!receipt.actionType, value: receipt.actionType },
      { label: "Signature", ok: !!receipt.signature, value: receipt.signatureScheme },
    ];
  }, [receipt]);

  return (
    <Shell wide>
      <div className="page-head">
        <div className="page-head-copy">
          <p className="lp-kicker">Trust plane</p>
          <h1>Verify</h1>
          <p>
            Inspect a NeuroReceipt, replay it locally, and see exactly which checks have and have
            not been performed. None of this sits in the reflex loop.
          </p>
        </div>
        <div className="page-head-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={runAll}
            disabled={busy || !receipt}
            data-loading={busy ? "true" : undefined}
          >
            Check available verification
          </button>
          <button type="button" className="btn btn-ghost" onClick={runLocal} disabled={busy || !receipt}>
            Local replay only
          </button>
        </div>
      </div>

      {loadError && (
        <div className="notice notice-err" style={{ marginBottom: "var(--sp-6)" }} role="alert">
          <span>Failed to load the sample receipt: {loadError}</span>
        </div>
      )}

      <div className="verify-pipeline" aria-live="polite">
        {stages.map((s, i) => (
          <div key={s.id} className={`verify-stage status-${s.status}`}>
            <div className="verify-stage-idx mono">{String(i + 1).padStart(2, "0")}</div>
            <div>
              <div className="verify-stage-title">{s.title}</div>
              <div className="verify-stage-detail">{s.detail}</div>
            </div>
            <div className={`verify-badge ${s.status}`}>{s.status}</div>
          </div>
        ))}
      </div>

      <div className="verify-grid">
        <section className="glass-panel verify-card" aria-labelledby="receipt-fields">
          <div className="lp-kicker" id="receipt-fields">
            NeuroReceipt fields
          </div>
          {!receipt ? (
            <div className="stack-2" style={{ marginTop: "var(--sp-4)" }} aria-busy="true">
              <div className="skeleton" style={{ height: 14, width: "40%" }} />
              <div className="skeleton" style={{ height: 14, width: "90%" }} />
              <div className="skeleton" style={{ height: 14, width: "75%" }} />
              <div className="skeleton" style={{ height: 14, width: "85%" }} />
            </div>
          ) : (
            FIELD_GROUPS.map((g) => (
              <div key={g.title} className="verify-field-group">
                <div className="verify-field-head">{g.title}</div>
                {g.keys.map((k) => (
                  <div key={k} className="verify-field-row">
                    <span className="mono muted">{k}</span>
                    <span className="mono verify-field-val">{String(receipt[k])}</span>
                  </div>
                ))}
              </div>
            ))
          )}
        </section>

        <div className="verify-right">
          <section className="glass-panel verify-card">
            <div className="lp-kicker">Recorded fields · presence only</div>
            <p className="muted t-xs" style={{ marginTop: "var(--sp-2)" }}>
              Field presence does not verify signatures or replay. Software evidence does not prove
              sensor authenticity or physical actuation.
            </p>
            <div className="why-check-list">
              {checklist.map((c) => (
                <div key={c.label} className="why-check-row">
                  <span className={c.ok ? "check-ok" : "check-bad"} aria-hidden>
                    {c.ok ? "•" : "—"}
                  </span>
                  <span>
                    {c.label}
                    <span className="sr-only">{c.ok ? " — present" : " — missing"}</span>
                  </span>
                  <span className="mono muted">{c.value}</span>
                </div>
              ))}
            </div>
            {receipt && (
              <div className="verify-action-banner">
                <div className="lp-kicker">Recorded action</div>
                <div className="verify-action-type">{receipt.actionType}</div>
                <div className="mono" style={{ marginTop: "var(--sp-1)", opacity: 0.75 }}>
                  tick {receipt.tick} · device {receipt.deviceId}
                </div>
              </div>
            )}
          </section>

          <section className="glass-panel verify-card">
            <div className="lp-kicker">Replay response</div>
            <pre className="verify-raw mono">{raw || "Run a check to see the replay JSON."}</pre>
            <div className="cluster" style={{ marginTop: "var(--sp-4)" }}>
              <Link href="/simulate" className="btn btn-ghost btn-sm">
                Generate one in Sim Lab
              </Link>
            </div>
          </section>
        </div>
      </div>
    </Shell>
  );
}
