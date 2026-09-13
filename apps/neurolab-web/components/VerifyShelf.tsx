"use client";

/**
 * The shelf — a library of what you have made.
 *
 * Verify used to start from an empty file picker, which assumed you still had
 * the artifact lying around. Everything compiled here is now kept, so the page
 * opens on your own work and the file picker is for bringing something in
 * rather than the only way through.
 *
 * Two things you can do to anything on the shelf: look inside it, and check it.
 * Looking inside is the magnifier — identity digests, the locked modules, the
 * schedule and the graph. Checking runs the same verifier the forensic tool
 * below uses, so a card and a hand-uploaded file get identical treatment.
 *
 * A receipt can only be replayed against the Stack it came from. When that
 * Stack is not on the shelf the card says so instead of reporting a pass it
 * cannot justify.
 */

import { useCallback, useEffect, useState } from "react";
import { canonical, digest, importStack, type ComposePackage } from "@/lib/composeCompiler";
import type { ReplayBundle } from "@/lib/composeRuntime";
import {
  assessCreResult,
  createCreValidationRequest,
  type CreResultAssessment,
} from "@/lib/creValidation";
import { verifyArtifact, verifyStackEvidence, withAnchorClaim, withCreClaim, type LedgerAnchor, type VerificationReport } from "@/lib/verification";
import { anchorReceiptToLedger, checkInclusion } from "@/lib/anchorClient";
import { DRAFT_KEY, BUILD_KEY, draftFingerprint } from "@/lib/workflow";
import { SIMULATE_HREF } from "@/lib/nav";
import {
  anchorValidation,
  lookupValidation,
  readGraphIndex,
  registerStackLocal,
  type GraphNeuroStack,
  type GraphValidation,
} from "@/lib/graphPartner";
import {
  listShelf,
  putReceipt,
  putCreResult,
  putLedgerAnchor,
  putStack,
  readCreResult,
  readLedgerAnchor,
  readReceipt,
  readStack,
  removeItem,
  type ShelfItem,
} from "@/lib/shelf";

type Filter = "all" | "stack" | "receipt";
type VerificationStage = "idle" | "local" | "cre" | "submitted" | "assessment" | "anchor" | "complete" | "failed";
type VerificationFailureStage = "local" | "cre" | "assessment" | "anchor";
type LedgerStatus = { configured: boolean; network?: string; topicId?: string | null };

const short = (h?: string) => (h && h.length > 24 ? `${h.slice(0, 14)}…${h.slice(-6)}` : (h ?? ""));
const when = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
};

function stackRegistrationAsAnchor(row: GraphNeuroStack | null | undefined): GraphValidation | null {
  if (!row) return null;
  return {
    id: row.id,
    requestHash: row.stackRoot,
    receiptRoot: row.stackRoot,
    blockRoot: row.stackRoot,
    validator: row.publisher || "local",
    score: 100,
    tag: "neurostack",
    evidenceURI: row.manifestURI,
    timestamp: row.createdAt,
    txHash: row.id,
    source: row.source,
  };
}

function Magnifier() {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true" focusable="false">
      <circle cx="7" cy="7" r="4.6" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10.4 10.4 14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function download(name: string, value: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function VerifyShelf() {
  const [items, setItems] = useState<ShelfItem[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState("");

  const [open, setOpen] = useState<ShelfItem | null>(null);
  const [payload, setPayload] = useState<ComposePackage | ReplayBundle | null>(null);
  const [report, setReport] = useState<VerificationReport | null>(null);
  const [creResult, setCreResult] = useState<CreResultAssessment | null>(null);
  const [anchor, setAnchor] = useState<GraphValidation | null>(null);
  /** Indexed NeuroStack row when a package (not a receipt) was registered. */
  const [stackReg, setStackReg] = useState<GraphNeuroStack | null>(null);
  /** A real ledger commitment, when Hedera is configured. Outranks the local index. */
  const [ledger, setLedger] = useState<LedgerAnchor | null>(null);
  const [ledgerStatus, setLedgerStatus] = useState<LedgerStatus | null>(null);
  const [panel, setPanel] = useState<"inspect" | "verify" | null>(null);
  const [verificationStage, setVerificationStage] = useState<VerificationStage>("idle");
  const [verificationLog, setVerificationLog] = useState<string[]>([]);
  const [verificationError, setVerificationError] = useState("");
  const [verificationFailureAt, setVerificationFailureAt] = useState<VerificationFailureStage | null>(null);

  const refresh = useCallback(async () => {
    try {
      setItems(await listShelf());
    } catch (e) {
      setError(`The shelf could not be read: ${String(e)}`);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/anchor", { cache: "no-store" });
        const body = (await res.json()) as LedgerStatus & { missing?: string[] };
        if (!cancelled) setLedgerStatus({ configured: Boolean(body.configured), network: body.network, topicId: body.topicId });
      } catch {
        if (!cancelled) setLedgerStatus({ configured: false });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDetail();
    };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open]);

  function closeDetail() {
    setOpen(null);
    setPayload(null);
    setReport(null);
    setCreResult(null);
    setAnchor(null);
    setStackReg(null);
    setLedger(null);
    setPanel(null);
    setVerificationStage("idle");
    setVerificationLog([]);
    setVerificationError("");
    setVerificationFailureAt(null);
  }

  useEffect(() => {
    const hash = creResult?.validation.requestHash;
    if (!hash) {
      setAnchor(null);
      return;
    }
    let cancelled = false;
    void lookupValidation(hash).then((row) => {
      if (!cancelled) setAnchor(row);
    });
    return () => {
      cancelled = true;
    };
  }, [creResult?.validation.requestHash]);

  async function importFile(file?: File) {
    if (!file) return;
    setError("");
    setNotice("");
    try {
      if (file.size > 20_000_000) throw Error("File exceeds 20 MB.");
      const raw = await file.text();
      const value = JSON.parse(raw) as { format?: string };

      if (value.format === "synapsevm.stack-replay.v1") {
        const bundle = value as unknown as ReplayBundle;
        if (!bundle.receipt?.hash) throw Error("That replay bundle has no receipt hash.");
        await putReceipt(bundle, "imported");
        setFilter("receipt");
        setNotice(`Receipt for tick ${bundle.receipt.tick} added to the shelf.`);
      } else {
        const pkg = await importStack(raw);
        await putStack(pkg, "imported");
        try {
          await registerStackLocal({
            stackRoot: pkg.manifest.stackId,
            name: pkg.manifest.name,
            version: pkg.manifest.version,
            manifestURI: `shelf://${pkg.manifest.stackId}`,
          });
        } catch {
          /* discovery index is best-effort */
        }
        setFilter("stack");
        setNotice(`${pkg.manifest.name}@${pkg.manifest.version} added to the shelf.`);
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function inspect(item: ShelfItem) {
    setError("");
    setBusyId(item.id);
    try {
      const data = item.kind === "stack" ? await readStack(item.id) : await readReceipt(item.id);
      if (!data) throw Error("The stored bytes for this item are missing. Remove it and add it again.");
      setReport(null);
      setCreResult(item.kind === "receipt" ? ((await readCreResult(item.id)) ?? null) : null);
      setLedger((await readLedgerAnchor(item.id)) ?? null);
      if (item.kind === "stack" && item.stackId) {
        try {
          const snap = await readGraphIndex();
          const key = item.stackId.replace(/^sha256:/i, "").replace(/^0x/i, "").toLowerCase();
          setStackReg(snap.stacks.find((s) => s.stackRoot.replace(/^0x/i, "").toLowerCase() === key) ?? null);
        } catch {
          setStackReg(null);
        }
      } else {
        setStackReg(null);
      }
      setOpen(item);
      setPayload(data);
      setPanel("inspect");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId("");
    }
  }

  async function verify(item: ShelfItem) {
    setError("");
    setBusyId(item.id);
    setReport(null);
    setCreResult(null);
    setAnchor(null);
    setStackReg(null);
    setLedger(null);
    setPayload(null);
    setVerificationStage("idle");
    setVerificationLog([]);
    setVerificationError("");
    setVerificationFailureAt(null);
    setOpen(item);
    setPanel("verify");
    try {
      if (item.kind === "stack") {
        const pkg = await readStack(item.id);
        if (!pkg) throw Error("The stored bytes for this Stack are missing.");
        setPayload(pkg);
      } else {
        const bundle = await readReceipt(item.id);
        if (!bundle) throw Error("The stored bytes for this receipt are missing.");
        setPayload(bundle);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      closeDetail();
    } finally {
      setBusyId("");
    }
  }

  async function startVerification() {
    if (!open || !payload) return;
    const item = open;
    setError("");
    setNotice("");
    setVerificationError("");
    setVerificationFailureAt(null);
    setVerificationLog(["Evidence bytes loaded from the local shelf."]);
    setReport(null);
    setCreResult(null);
    setBusyId(item.id);
    let activeStage: VerificationFailureStage = "local";
    try {
      setVerificationStage("local");
      if (item.kind === "stack") {
        const pkg = payload as ComposePackage;
        const localReport = await verifyArtifact(canonical(pkg));
        setReport(localReport);
        setVerificationLog((entries) => [...entries, "Canonical Stack identity and locked artifact bytes checked."]);
        if (localReport.outcome === "MISMATCH") {
          setVerificationStage("failed");
          setVerificationError("The Stack failed its local integrity check.");
          return;
        }

        setVerificationStage("anchor");
        activeStage = "anchor";
        const notes: string[] = [];
        try {
          const row = await registerStackLocal({
            stackRoot: pkg.manifest.stackId,
            name: pkg.manifest.name,
            version: pkg.manifest.version,
            manifestURI: `shelf://${pkg.manifest.stackId}`,
          });
          setStackReg(row);
          notes.push(
            row.source === "subgraph"
              ? `Sepolia NeuroStack ${short(row.stackRoot)} was indexed by The Graph.`
              : row.source === "chain"
                ? `Sepolia confirmed NeuroStack ${short(row.stackRoot)}; The Graph indexing is pending.`
                : `NeuroStack ${short(row.stackRoot)} was stored in the local Graph index.`,
          );
        } catch (e) {
          notes.push(`Graph partner skipped: ${e instanceof Error ? e.message : String(e)}`);
        }

        try {
          const committed = await anchorReceiptToLedger(
            pkg.manifest.stackId,
            0,
            pkg.manifest.name,
            pkg.manifest.stackId,
          );
          if (committed) {
            const saved = { ...committed, leaves: committed.leaves, savedAt: new Date().toISOString() };
            await putLedgerAnchor(item.id, saved);
            setLedger(saved);
            notes.push(`Hedera topic ${committed.topicId} seq ${committed.sequenceNumber}.`);
          } else {
            notes.push(
              ledgerStatus?.configured
                ? "Hedera submit returned without an anchor — check server logs."
                : "Hedera not configured — Stack identity was not submitted to HCS.",
            );
          }
        } catch (e) {
          notes.push(`Hedera skipped: ${e instanceof Error ? e.message : String(e)}`);
        }

        setVerificationLog((entries) => [...entries, ...notes]);
        setVerificationStage("complete");
        return;
      }

      const bundle = payload as ReplayBundle;
      const host = items.find((candidate) => candidate.kind === "stack" && candidate.stackId === bundle.stackId);
      if (!host) {
        throw Error("Import the exact NeuroStack for this receipt before starting verification.");
      }
      const pkg = await readStack(host.id);
      if (!pkg) throw Error("The stored bytes for the matching NeuroStack are missing.");

      const localReport = await verifyStackEvidence(canonical(pkg), bundle);
      setReport(localReport);
      setVerificationLog((entries) => [...entries, "Local Stack replay reproduced the recorded control decision."]);
      if (localReport.outcome !== "MATCH") {
        setVerificationStage("failed");
        setVerificationError("Local replay did not match, so the external CRE stage was stopped.");
        return;
      }

      setVerificationStage("cre");
      activeStage = "cre";
      const creRequest = await createCreValidationRequest(pkg, bundle);
      setVerificationLog((entries) => [...entries, "Commitment-only CRE request created after the replay matched."]);
      const response = await fetch("/api/verify/cre", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(creRequest),
        cache: "no-store",
      });
      const responseBody = (await response.json()) as {
        result?: unknown;
        mode?: string;
        durationMs?: number;
        accepted?: boolean;
        workflowExecutionId?: string;
        status?: string;
        error?: string;
        message?: string;
      };
      if (responseBody.accepted && responseBody.workflowExecutionId) {
        setVerificationLog((entries) => [
          ...entries,
          `Chainlink CRE accepted production execution ${responseBody.workflowExecutionId}. The DON result is asynchronous and has not been claimed as verified.`,
        ]);
        setVerificationStage("submitted");
        return;
      }
      if (!response.ok || !responseBody.result) {
        throw Error(responseBody.message ?? responseBody.error ?? `CRE verification failed (${response.status}).`);
      }
      setVerificationLog((entries) => [
        ...entries,
        `Chainlink CRE returned a signed report${responseBody.durationMs ? ` in ${(responseBody.durationMs / 1000).toFixed(1)} s` : ""}.`,
      ]);

      setVerificationStage("assessment");
      activeStage = "assessment";
      const assessment = await assessCreResult(creRequest, responseBody.result);
      await putCreResult(item.id, assessment);
      setCreResult(assessment);
      setVerificationLog((entries) => [
        ...entries,
        assessment.status === "REPORT_VERIFIED"
          ? "The report payload and DON signature quorum authenticated."
          : "The report payload is exact; production DON authentication remains unavailable for simulation keys.",
      ]);

      if (assessment.outcome === "COMMITMENTS_MATCH") {
        setVerificationStage("anchor");
        activeStage = "anchor";
        const { notes } = await commitAnchors(item, assessment, bundle);
        setVerificationLog((entries) => [...entries, ...notes]);
      }

      setVerificationStage("complete");
    } catch (e) {
      setVerificationStage("failed");
      setVerificationFailureAt(activeStage);
      setVerificationError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId("");
    }
  }

  async function simulate(item: ShelfItem) {
    setError("");
    setBusyId(item.id);
    try {
      const pkg = await readStack(item.id);
      if (!pkg) throw Error("The stored bytes for this Stack are missing.");
      if (!pkg.manifest.executable) {
        throw Error("This Stack compiled but cannot execute, so there is nothing to simulate.");
      }
      const draft = { graph: pkg.graph, positions: {}, modules: pkg.modules };
      const record = { pkg, fingerprint: draftFingerprint(draft), hash: await digest(canonical(pkg)) };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      localStorage.setItem(BUILD_KEY, JSON.stringify(record));
      window.location.assign(SIMULATE_HREF);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusyId("");
    }
  }

  async function prepareCre(item: ShelfItem, current?: ReplayBundle) {
    if (item.kind !== "receipt") return;
    setError("");
    setNotice("");
    setBusyId(item.id);
    try {
      const bundle = current ?? (await readReceipt(item.id));
      if (!bundle) throw Error("The stored bytes for this receipt are missing.");
      const host = items.find((candidate) => candidate.kind === "stack" && candidate.stackId === bundle.stackId);
      if (!host) throw Error("Import the exact NeuroStack for this receipt before preparing a CRE request.");
      const pkg = await readStack(host.id);
      if (!pkg) throw Error("Import the exact NeuroStack for this receipt before preparing a CRE request.");
      const request = await createCreValidationRequest(pkg, bundle);
      const base = host.name.replace(/[^A-Za-z0-9_-]+/g, "-");
      download(`${base}-tick-${bundle.receipt.tick}.cre-request.json`, request);
      setNotice("CRE request prepared after an exact local replay. It contains commitments only; Chainlink CRE has not run.");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId("");
    }
  }

  async function importCreResult(item: ShelfItem, current: ReplayBundle, file?: File) {
    if (!file || item.kind !== "receipt") return;
    setError("");
    setNotice("");
    setBusyId(item.id);
    try {
      if (file.size > 2_000_000) throw Error("CRE result exceeds 2 MB.");
      const host = items.find((candidate) => candidate.kind === "stack" && candidate.stackId === current.stackId);
      if (!host) throw Error("Import the exact NeuroStack for this receipt before importing a CRE result.");
      const pkg = await readStack(host.id);
      if (!pkg) throw Error("The stored bytes for this Stack are missing.");
      const request = await createCreValidationRequest(pkg, current);
      const assessment = await assessCreResult(request, JSON.parse(await file.text()) as unknown);
      await putCreResult(item.id, assessment);
      setCreResult(assessment);
      let anchored: GraphValidation | null = null;
      let hederaOk = false;
      if (assessment.outcome === "COMMITMENTS_MATCH") {
        const { graph, ledger: committed, notes } = await commitAnchors(item, assessment, current);
        anchored = graph;
        hederaOk = Boolean(committed);
        if (notes.length) setNotice(notes.join(" "));
      }
      setNotice(
        [
          assessment.status === "REPORT_VERIFIED"
            ? "CRE report authenticated against the pinned DON signer set and bound to this exact request."
            : assessment.status === "REPORT_UNVERIFIED"
              ? `CRE report bound to this exact request, but not authenticated: ${assessment.donVerification?.reason ?? "DON signature verification is incomplete."}`
              : "CRE result imported and bound to this exact request. It has no authenticated report envelope.",
          anchored
            ? anchored.source === "subgraph"
              ? "Sepolia validation indexed by The Graph."
              : anchored.source === "chain"
                ? "Sepolia validation confirmed; The Graph indexing is pending."
                : "Validation stored in the local Graph index."
            : null,
          hederaOk ? "Hedera HCS anchor submitted." : null,
        ]
          .filter(Boolean)
          .join(" "),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId("");
    }
  }

  /** Publish matching evidence to Sepolia/The Graph and Hedera HCS. */
  async function commitAnchors(
    item: ShelfItem,
    assessment: CreResultAssessment,
    current: ReplayBundle,
  ): Promise<{ graph: GraphValidation | null; ledger: LedgerAnchor | null; notes: string[] }> {
    const notes: string[] = [];
    let graph: GraphValidation | null = null;
    let nextLedger: LedgerAnchor | null = null;

    try {
      graph = await anchorValidation({
        requestHash: assessment.validation.requestHash,
        receiptRoot: assessment.receiptHash,
        blockRoot: assessment.validation.packageHash,
        score: 100,
        tag: "cre",
        evidenceURI: `data:application/json,${encodeURIComponent(
          JSON.stringify({
            format: "synapsevm.graph-evidence.v1",
            resultHash: assessment.validation.resultHash,
            status: assessment.status,
            stackId: assessment.validation.stackId,
            tick: current.receipt.tick,
          }),
        )}`,
      });
      setAnchor(graph);
      notes.push(
        graph.source === "subgraph"
          ? `Sepolia validation ${graph.requestHash.slice(0, 18)}… was indexed by The Graph.`
          : graph.source === "chain"
            ? `Sepolia validation ${graph.requestHash.slice(0, 18)}… confirmed; The Graph indexing is pending.`
            : `Validation ${graph.requestHash.slice(0, 18)}… was stored only in the local Graph index.`,
      );
    } catch (e) {
      notes.push(`Graph partner skipped: ${e instanceof Error ? e.message : String(e)}`);
    }

    try {
      const committed = await anchorReceiptToLedger(
        assessment.receiptHash,
        current.receipt.sequence,
        item.stackName ?? "browser",
        assessment.validation.stackId,
      );
      if (committed) {
        const saved = { ...committed, leaves: committed.leaves, savedAt: new Date().toISOString() };
        await putLedgerAnchor(item.id, saved);
        setLedger(saved);
        nextLedger = saved;
        notes.push(`Hedera topic ${committed.topicId} seq ${committed.sequenceNumber}.`);
      } else {
        notes.push(
          ledgerStatus?.configured
            ? "Hedera submit returned without an anchor — check server logs."
            : "Hedera not configured — batch root was not submitted to HCS.",
        );
      }
    } catch (e) {
      notes.push(`Hedera skipped: ${e instanceof Error ? e.message : String(e)}`);
    }

    return { graph, ledger: nextLedger, notes };
  }

  async function publishAnchor(item: ShelfItem, current: ReplayBundle) {
    if (item.kind !== "receipt" || !creResult) return;
    setError("");
    setNotice("");
    setBusyId(item.id);
    try {
      if (creResult.outcome !== "COMMITMENTS_MATCH") {
        throw Error("Only matching CRE results can be anchored.");
      }
      const { notes } = await commitAnchors(item, creResult, current);
      setNotice(notes.join(" "));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId("");
    }
  }

  async function drop(item: ShelfItem) {
    setError("");
    try {
      await removeItem(item.id);
      if (open?.id === item.id) closeDetail();
      await refresh();
      setNotice(`Removed ${item.name}.`);
    } catch (e) {
      setError(String(e));
    }
  }

  const shown = items.filter((i) => filter === "all" || i.kind === filter);
  const stacks = items.filter((i) => i.kind === "stack").length;
  const receipts = items.length - stacks;

  return (
    <section className="vsh" aria-label="Your shelf">
      {(error || notice) && (
        <p role={error ? "alert" : "status"} className={error ? "vsh-error" : "vsh-notice"}>
          {error || notice}
          <button type="button" onClick={() => (error ? setError("") : setNotice(""))} aria-label="Dismiss">
            ×
          </button>
        </p>
      )}

      <div className="vsh-controls">
        <div className="vsh-filters" role="tablist" aria-label="Filter the shelf">
          {(
            [
              ["all", `All ${items.length}`],
              ["stack", `NeuroStacks ${stacks}`],
              ["receipt", `Receipts ${receipts}`],
            ] as [Filter, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              role="tab"
              type="button"
              aria-selected={filter === id}
              className={filter === id ? "is-on" : ""}
              onClick={() => setFilter(id)}
            >
              {label}
            </button>
          ))}
        </div>
        {ledgerStatus ? (
          <p className={`vsh-ledger-status${ledgerStatus.configured ? " is-ready" : ""}`} role="status">
            {ledgerStatus.configured
              ? `Hedera ${ledgerStatus.network ?? "testnet"} · topic ${ledgerStatus.topicId}`
              : "Hedera ledger not configured"}
          </p>
        ) : null}
      </div>

      {!ready ? (
        <p className="vsh-empty">Reading the shelf…</p>
      ) : (
        <ul className="vsh-grid">
          <li>
            <label className="vsh-card vsh-card--import">
              <input
                type="file"
                accept="application/json,.synapse,.json"
                aria-label="Import a NeuroStack or Receipt"
                onChange={(e) => {
                  void importFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
              <span className="vsh-plus-inline" aria-hidden="true">
                +
              </span>
              <strong className="vsh-import-label">
                {filter === "stack" ? "Import NeuroStack" : filter === "receipt" ? "Import Receipt" : "Import new"}
              </strong>
            </label>
          </li>
          {shown.map((item) => (
            <li key={item.id}>
              <article className={`vsh-card${item.kind === "receipt" ? " is-receipt" : ""}`}>
                <header className="vsh-card-head">
                  <span className="vsh-kind">{item.kind === "stack" ? "NeuroStack" : "Receipt"}</span>
                  <span className={`vsh-source is-${item.source}`}>{item.source}</span>
                </header>

                <h3 className="vsh-name">
                  {item.kind === "stack" ? (
                    <>
                      {item.name} <small>@ {item.version}</small>
                    </>
                  ) : (
                    item.name
                  )}
                </h3>

                {item.kind === "stack" ? (
                  <>
                    <p className="vsh-meta">
                      {item.nodeCount} nodes · {item.edgeCount} connections · {item.criticalPathMs} ms of{" "}
                      {item.deadlineMs} ms
                      {" · "}
                      <span className={item.executable ? "vsh-ok" : "vsh-warn"}>
                        {item.executable ? "executable" : "will not run"}
                      </span>
                    </p>
                    <ul className="vsh-chips">
                      {(item.nodes ?? []).slice(0, 6).map((n) => (
                        <li key={n}>{n}</li>
                      ))}
                      {(item.nodes?.length ?? 0) > 6 ? (
                        <li className="vsh-more">+{(item.nodes?.length ?? 0) - 6}</li>
                      ) : null}
                    </ul>
                  </>
                ) : (
                  <p className="vsh-meta">
                    tick {item.tick} · sequence {item.sequence} · {item.eventCount} events
                  </p>
                )}

                <code className="vsh-hash" title={item.kind === "stack" ? item.stackId : item.receiptHash}>
                  {item.kind === "stack" ? "stack" : "receipt"}{" "}
                  {short(item.kind === "stack" ? item.stackId : item.receiptHash)}
                </code>
                <p className="vsh-when">{when(item.addedAt)}</p>

                <div className="vsh-actions">
                  <button
                    type="button"
                    className="vsh-glass"
                    onClick={() => void inspect(item)}
                    disabled={busyId === item.id}
                    title="Look inside"
                    aria-label={`Look inside ${item.name}`}
                  >
                    <Magnifier />
                    <span>Inspect</span>
                  </button>
                  {item.kind === "stack" ? (
                    <button
                      type="button"
                      className="vsh-run"
                      onClick={() => void simulate(item)}
                      disabled={busyId === item.id || !item.executable}
                      title={item.executable ? "Load into Simulate" : "This Stack cannot execute"}
                    >
                      Simulate
                    </button>
                  ) : null}
                  <button type="button" className="vsh-verify" onClick={() => void verify(item)} disabled={busyId === item.id}>
                    Verify
                  </button>
                  <button
                    type="button"
                    className="vsh-drop"
                    onClick={() => void drop(item)}
                    aria-label={`Remove ${item.name}`}
                    title="Remove from the shelf"
                  >
                    ×
                  </button>
                </div>
              </article>
            </li>
          ))}
          {!shown.length ? (
            <li className="vsh-empty-box">
              <p className="vsh-empty">
                {items.length
                  ? "No saved items match this filter yet."
                  : "Your saved verification library starts here. Compile a Stack or import one from the Import card."}
              </p>
            </li>
          ) : null}
        </ul>
      )}

      {panel === "inspect" && open && payload ? (
        <InspectModal
          item={open}
          payload={payload}
          creResult={creResult}
          anchor={anchor}
          stackReg={stackReg}
          ledger={ledger}
          busy={busyId === open.id}
          onPrepareCre={(bundle) => prepareCre(open, bundle)}
          onImportCre={(bundle, file) => importCreResult(open, bundle, file)}
          onAnchor={(bundle) => publishAnchor(open, bundle)}
          onClose={closeDetail}
        />
      ) : null}
      {panel === "verify" && open ? (
        <VerifyModal
          item={open}
          report={report}
          creResult={creResult}
          anchor={anchor}
          stackReg={stackReg}
          ledger={ledger}
          busy={busyId === open.id}
          stage={verificationStage}
          log={verificationLog}
          error={verificationError}
          failureAt={verificationFailureAt}
          onStart={startVerification}
          onClose={closeDetail}
        />
      ) : null}
    </section>
  );
}

function claimMark(status: VerificationReport["claims"][number]["status"]) {
  if (status === "match") return "✓";
  if (status === "fail") return "×";
  if (status === "computed") return "·";
  return "–";
}

function claimLabel(status: VerificationReport["claims"][number]["status"]) {
  if (status === "match") return "MATCH";
  if (status === "fail") return "MISMATCH";
  if (status === "computed") return "COMPUTED";
  if (status === "unsupported") return "UNAVAILABLE";
  return "NOT CHECKED";
}

function VerifyModal({
  item,
  report,
  creResult,
  anchor,
  stackReg,
  ledger,
  busy,
  stage,
  log,
  error,
  failureAt,
  onStart,
  onClose,
}: {
  item: ShelfItem;
  report: VerificationReport | null;
  creResult: CreResultAssessment | null;
  anchor: GraphValidation | null;
  stackReg?: GraphNeuroStack | null;
  ledger?: LedgerAnchor | null;
  busy: boolean;
  stage: VerificationStage;
  log: string[];
  error: string;
  failureAt: VerificationFailureStage | null;
  onStart: () => Promise<void>;
  onClose: () => void;
}) {
  const receipt = item.kind === "receipt";
  const steps = receipt
    ? [
        { id: "evidence", label: "Load evidence" },
        { id: "local", label: "Replay locally" },
        { id: "cre", label: "Run Chainlink CRE" },
        { id: "assessment", label: "Assess report trust" },
        { id: "anchor", label: "Anchor Graph + Hedera" },
      ]
    : [
        { id: "evidence", label: "Load Stack" },
        { id: "local", label: "Check artifact integrity" },
        { id: "anchor", label: "Register Graph + Hedera" },
      ];
  const order = ["idle", "local", "cre", "assessment", "anchor", "complete"] as const;
  const stageIndex = stage === "submitted" ? 2 : order.indexOf(stage === "failed" ? "idle" : stage);
  const stepState = (id: string, index: number) => {
    if (id === "evidence") return "done";
    if (stage === "submitted") {
      if (["local", "cre"].includes(id)) return "done";
      if (id === "assessment") return "active";
      return "idle";
    }
    if (stage === "failed") {
      const failureIndex = steps.findIndex((step) => step.id === failureAt);
      return index < failureIndex ? "done" : index === failureIndex ? "fail" : "idle";
    }
    if (!receipt) {
      const target = id === "local" ? 1 : id === "anchor" ? 4 : -1;
      if (stage === "complete" || stageIndex > target) return "done";
      if (stageIndex === target || (id === "anchor" && stage === "anchor")) return "active";
      return "idle";
    }
    const target = id === "local" ? 1 : id === "cre" ? 2 : id === "assessment" ? 3 : id === "anchor" ? 4 : -1;
    if (id === "anchor" && stage === "complete" && creResult?.outcome !== "COMMITMENTS_MATCH") return "idle";
    if (stage === "complete" || stageIndex > target) return "done";
    if (stageIndex === target) return "active";
    return "idle";
  };
  const assessedClaims = report
    ? withAnchorClaim(
        withCreClaim(report.claims, item.kind === "receipt" ? creResult : null),
        anchor ?? stackRegistrationAsAnchor(stackReg),
        ledger,
      )
    : [];
  const hasFailedClaim = assessedClaims.some((claim) => claim.status === "fail");
  const hasUnresolvedClaim = assessedClaims.some((claim) =>
    ["computed", "missing", "unsupported"].includes(claim.status),
  );
  return (
    <div className="vsh-detail-backdrop" role="dialog" aria-modal="true" aria-label={`Verify ${item.name}`}>
      <button type="button" className="vsh-detail-dismiss" onClick={onClose} aria-label="Close" />
      <div className="vsh-detail vsh-detail--verify" onClick={(e) => e.stopPropagation()}>
        <header className="vsh-detail-head">
          <div>
            <p className="vsh-eyebrow">Verification</p>
            <h3>{item.name}{item.version ? <small> @ {item.version}</small> : null}</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="vsh-detail-x">
            ×
          </button>
        </header>

        <div className="vsh-detail-body">
          <section className="vsh-run-panel" aria-label="Verification process">
            <div className="vsh-run-intro">
              <span>{receipt ? "LOCAL + CRE" : "ARTIFACT + LEDGER"}</span>
              <strong>{stage === "idle" ? "Ready to verify" : busy ? "Verification running" : stage === "submitted" ? "CRE execution accepted · awaiting DON result" : stage === "complete" ? (hasUnresolvedClaim ? "Verification complete · review trust gaps" : "Verification complete") : "Verification stopped"}</strong>
              <p>
                {receipt
                  ? "This run replays the receipt, sends commitments through CRE, assesses the report, then anchors a matching batch root to The Graph and Hedera HCS."
                  : "This run recomputes the canonical Stack identity, registers it with the Graph partner, and commits the stack root to Hedera HCS. CRE belongs to receipts from this Stack, not the package itself."}
              </p>
            </div>
            <ol className="vsh-run-steps">
              {steps.map((step, index) => {
                const state = stepState(step.id, index);
                return (
                  <li key={step.id} className={`is-${state}`}>
                    <i aria-hidden="true">{state === "done" ? "✓" : state === "fail" ? "×" : index + 1}</i>
                    <span>{step.label}</span>
                    <small>{state === "active" ? (stage === "submitted" ? "Awaiting DON" : "Running") : state === "done" ? "Done" : state === "fail" ? "Stopped" : "Waiting"}</small>
                  </li>
                );
              })}
            </ol>
            {log.length ? (
              <ul className="vsh-run-log" aria-label="Verification log">
                {log.map((entry, index) => <li key={`${index}-${entry}`}>{entry}</li>)}
              </ul>
            ) : null}
            {error ? <p className="vsh-run-error" role="alert">{error}</p> : null}
          </section>

          {report ? (
            <>
              <div className={`vsh-verify-summary is-${hasFailedClaim ? "mismatch" : hasUnresolvedClaim ? "incomplete" : "match"}`}>
                <strong>
                  {hasFailedClaim
                    ? "Evidence does not match."
                    : hasUnresolvedClaim
                      ? "Verification completed with unresolved trust claims."
                      : "All trust claims match."}
                </strong>
                <p>{report.scope}</p>
                <small>
                  {report.mode} · {report.verifierId}
                </small>
              </div>

              {item.kind === "receipt" ? (
                <TrustGraph localReport={report} creResult={creResult} anchor={anchor} ledger={ledger} />
              ) : (
                <StackTrustGraph localReport={report} stackReg={stackReg ?? null} ledger={ledger} />
              )}

              <ul className="vsh-verify-points">
                {assessedClaims.map((c) => (
                  <li key={c.id} className={`is-${c.status}`}>
                    <i aria-hidden="true">{claimMark(c.status)}</i>
                    <div>
                      <span className="vsh-claim-layer">{c.layer}</span>
                      <b>{c.label}</b>
                      <small>{c.detail}</small>
                    </div>
                    <em>{claimLabel(c.status)}</em>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
        <footer className="vsh-detail-foot vsh-verify-foot">
          <span>{receipt ? "Authenticated local CRE simulation; production DON deployment access is pending" : "Local artifact check, then Sepolia/The Graph + Hedera"}</span>
          <button type="button" className="vsh-start-verification" onClick={() => void onStart()} disabled={busy}>
            {busy ? "Verification running…" : stage === "idle" ? "Start verification" : "Run verification again"}
          </button>
        </footer>
      </div>
    </div>
  );
}

function InspectModal({
  item,
  payload,
  creResult,
  anchor,
  stackReg,
  ledger,
  busy,
  onPrepareCre,
  onImportCre,
  onAnchor,
  onClose,
}: {
  item: ShelfItem;
  payload: ComposePackage | ReplayBundle;
  creResult: CreResultAssessment | null;
  anchor: GraphValidation | null;
  stackReg?: GraphNeuroStack | null;
  ledger?: LedgerAnchor | null;
  busy: boolean;
  onPrepareCre: (bundle: ReplayBundle) => Promise<void>;
  onImportCre: (bundle: ReplayBundle, file?: File) => Promise<void>;
  onAnchor: (bundle: ReplayBundle) => Promise<void>;
  onClose: () => void;
}) {
  const isStack = item.kind === "stack";
  const pkg = isStack ? (payload as ComposePackage) : null;
  const bundle = isStack ? null : (payload as ReplayBundle);

  return (
    <div className="vsh-detail-backdrop" role="dialog" aria-modal="true" aria-label={`Inside ${item.name}`}>
      <button type="button" className="vsh-detail-dismiss" onClick={onClose} aria-label="Close" />
      <div className="vsh-detail" onClick={(e) => e.stopPropagation()}>
        <header className="vsh-detail-head">
          <div>
            <p className="vsh-eyebrow">{isStack ? "Inside this Stack" : "Inside this receipt"}</p>
            <h3>{item.name}</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="vsh-detail-x">
            ×
          </button>
        </header>

        <div className="vsh-detail-body">
          <h4>Identity</h4>
          <dl className="vsh-dl">
            {isStack ? (
              <>
                <dt>Stack ID</dt>
                <dd>
                  <code>{pkg!.manifest.stackId}</code>
                </dd>
                <dt>Package hash</dt>
                <dd>
                  <code>{item.packageHash}</code>
                </dd>
                <dt>Runtime</dt>
                <dd>{pkg!.manifest.runtime}</dd>
                <dt>Policy</dt>
                <dd>{pkg!.graph.policy}</dd>
                <dt>Signature</dt>
                <dd className="vsh-warn">none — local unsigned replay</dd>
              </>
            ) : (
              <>
                <dt>Receipt hash</dt>
                <dd>
                  <code>{bundle!.receipt.hash}</code>
                </dd>
                <dt>Stack ID</dt>
                <dd>
                  <code>{bundle!.stackId}</code>
                </dd>
                <dt>Package hash</dt>
                <dd>
                  <code>{bundle!.receipt.packageHash}</code>
                </dd>
                <dt>Previous</dt>
                <dd>
                  <code>{bundle!.receipt.previousReceiptHash ?? "none — first in the chain"}</code>
                </dd>
              </>
            )}
          </dl>

          {isStack ? (
            <>
              <h4>Locked modules</h4>
              {Object.keys(pkg!.lockfile).length ? (
                <ul className="vsh-lock">
                  {Object.entries(pkg!.lockfile).map(([key, lock]) => (
                    <li key={key}>
                      <b>{key}</b>
                      <span>@{lock.version}</span>
                      <code>{short(lock.digest)}</code>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="vsh-muted">No neural modules — this Stack is entirely deterministic nodes.</p>
              )}

              <h4>Execution schedule</h4>
              <ol className="vsh-sched">
                {pkg!.runtimePlan.order.map((id) => (
                  <li key={id}>
                    <span>{id}</span>
                    <code>every {pkg!.runtimePlan.periods[id]} ms</code>
                  </li>
                ))}
              </ol>

              <h4>Graph</h4>
              <ul className="vsh-wires">
                {pkg!.graph.edges.map((e, i) => (
                  <li key={i}>
                    <code>{e.from}</code>
                    <i aria-hidden="true">→</i>
                    <code>{e.to}</code>
                  </li>
                ))}
              </ul>

              <StackTrustGraph localReport={null} stackReg={stackReg ?? null} ledger={ledger} />
              {ledger ? <HederaAnchorPanel ledger={ledger} receiptHash={pkg!.manifest.stackId} /> : null}
            </>
          ) : (
            <>
              <TrustGraph localReport={null} creResult={creResult} anchor={anchor} ledger={ledger} />
              <section className="vsh-cre-status" aria-label="Chainlink CRE status">
                <div>
                  <span>External verifier</span>
                  <strong className={
                    creResult?.outcome === "MISMATCH"
                      ? "is-fail"
                      : creResult?.status === "REPORT_VERIFIED"
                        ? "is-verified"
                        : creResult
                          ? "is-pending"
                          : ""
                  }>
                    {!creResult
                      ? "Chainlink CRE · not run"
                      : creResult.status === "REPORT_VERIFIED"
                        ? `CRE report · ${creResult.outcome === "COMMITMENTS_MATCH" ? "authenticated match" : "authenticated mismatch"}`
                        : creResult.status === "REPORT_UNVERIFIED"
                        ? `CRE report · ${creResult.outcome === "COMMITMENTS_MATCH" ? "match, signatures pending" : "mismatch"}`
                        : `CRE result · ${creResult.outcome === "COMMITMENTS_MATCH" ? "match, unauthenticated" : "mismatch"}`}
                  </strong>
                </div>
                <p>
                  {!creResult
                    ? "This local receipt can be exported as a commitment-only request. Exporting the request is not validation."
                    : creResult.status === "REPORT_VERIFIED"
                      ? `Result hash, exact request links, embedded payload, and DON quorum match. ${creResult.donVerification?.reason ?? "The report signatures verified."}`
                      : creResult.status === "REPORT_UNVERIFIED"
                      ? `Result hash, exact request links, and embedded report payload match. ${creResult.donVerification?.reason ?? "DON signatures are not verified."}`
                      : "Result hash and exact request links match. No CRE report bytes or DON signatures were supplied."}
                </p>
              </section>
              {anchor ? (
                <section className="vsh-cre-status" aria-label="Graph partner anchor">
                  <div>
                    <span>Graph partner</span>
                    <strong className="is-verified">
                      Anchored · score {anchor.score}
                    </strong>
                  </div>
                  <p>
                    Indexed validation {short(anchor.requestHash)}. Inclusion id{" "}
                    <code>{anchor.txHash}</code>
                    {anchor.source === "subgraph"
                      ? " (indexed by The Graph)."
                      : anchor.source === "chain"
                        ? " (confirmed on Sepolia; Graph indexing pending)."
                        : " (local Graph partner index only)."}
                  </p>
                </section>
              ) : null}
              {ledger ? (
                <HederaAnchorPanel ledger={ledger} receiptHash={bundle!.receipt.hash} />
              ) : null}
              <h4>Actions committed</h4>
              <pre>{JSON.stringify(bundle!.receipt.actions, null, 2)}</pre>
              <h4>Events</h4>
              <pre>{JSON.stringify(bundle!.receipt.events, null, 2)}</pre>
            </>
          )}
        </div>

        <footer className="vsh-detail-foot">
          {!isStack ? (
            <>
              <button type="button" className="vsh-cre-button" onClick={() => void onPrepareCre(bundle!)}>
                Download CRE request
              </button>
              <label className="vsh-cre-import">
                <input
                  type="file"
                  accept="application/json,.json"
                  aria-label="Import a CRE result"
                  onChange={(event) => {
                    void onImportCre(bundle!, event.target.files?.[0]);
                    event.target.value = "";
                  }}
                />
                Import CRE result
              </label>
              {creResult?.outcome === "COMMITMENTS_MATCH" && (!anchor || !ledger) ? (
                <button
                  type="button"
                  className="vsh-cre-button"
                  disabled={busy}
                  onClick={() => void onAnchor(bundle!)}
                >
                  {busy ? "Anchoring…" : ledger ? "Index in Graph partner" : "Anchor (Graph + Hedera)"}
                </button>
              ) : null}
            </>
          ) : null}
          <button
            type="button"
            onClick={() =>
              download(isStack ? `${item.name}-${item.version}.synapse` : `receipt-${item.tick}.json`, payload)
            }
          >
            Download the bytes
          </button>
        </footer>
      </div>
    </div>
  );
}

function HederaAnchorPanel({
  ledger,
  receiptHash,
}: {
  ledger: LedgerAnchor;
  receiptHash: string;
}) {
  const [inclusion, setInclusion] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const mirror = `https://${ledger.network === "mainnet" ? "mainnet-public" : ledger.network}.mirrornode.hedera.com/api/v1/topics/${ledger.topicId}/messages/${ledger.sequenceNumber}`;

  async function prove() {
    if (!ledger.leaves?.length) {
      setInclusion("Batch leaves were not stored with this anchor, so inclusion cannot be re-proved here.");
      return;
    }
    setBusy(true);
    setInclusion("");
    try {
      const result = await checkInclusion(
        receiptHash,
        ledger.leaves,
        ledger.topicId,
        ledger.sequenceNumber,
        ledger.network,
      );
      setInclusion(result.reason);
    } catch (e) {
      setInclusion(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="vsh-cre-status" aria-label="Hedera HCS anchor">
      <div>
        <span>Hedera HCS</span>
        <strong className="is-verified">
          Topic {ledger.topicId} · seq {ledger.sequenceNumber}
        </strong>
      </div>
      <p>
        Batch root <code>{short(ledger.receiptRoot)}</code>
        {ledger.consensusTimestamp ? ` · consensus ${ledger.consensusTimestamp}` : ""}.{" "}
        <a href={mirror} target="_blank" rel="noreferrer">
          Read on mirror
        </a>
        {" · "}
        <button type="button" className="vsh-inline-btn" disabled={busy} onClick={() => void prove()}>
          {busy ? "Checking…" : "Prove inclusion"}
        </button>
      </p>
      {inclusion ? <p>{inclusion}</p> : null}
    </section>
  );
}

function StackTrustGraph({
  localReport,
  stackReg,
  ledger,
}: {
  localReport: VerificationReport | null;
  stackReg: GraphNeuroStack | null;
  ledger?: LedgerAnchor | null;
}) {
  const localOk = localReport?.outcome === "MATCH";
  const localFail = localReport?.outcome === "MISMATCH";
  const onGraph = Boolean(stackReg);
  const onPublicGraph = stackReg?.source === "subgraph" || stackReg?.source === "chain";
  const onLedger = Boolean(ledger);
  const mirror = ledger
    ? `https://${ledger.network === "mainnet" ? "mainnet-public" : ledger.network}.mirrornode.hedera.com/api/v1/topics/${ledger.topicId}/messages/${ledger.sequenceNumber}`
    : null;
  return (
    <section className="vsh-trust-graph" aria-label="NeuroStack verification graph">
      <header>
        <div>
          <span>Package trust graph</span>
          <strong>Evidence path</strong>
        </div>
        <small>NeuroStack artifact</small>
      </header>
      <ol>
        <li className={localFail ? "is-fail" : localOk || !localReport ? "is-done" : "is-pending"}>
          <i>1</i><b>Package bytes</b><small>{localFail ? "mismatch" : localOk ? "intact" : "on shelf"}</small>
        </li>
        <li className={localFail ? "is-fail" : localOk || !localReport ? "is-done" : "is-pending"}>
          <i>2</i><b>Canonical identity</b><small>{localFail ? "failed" : localOk ? "recomputed" : "pending"}</small>
        </li>
        <li className={onPublicGraph ? "is-done" : onGraph || localOk ? "is-pending" : "is-idle"}>
          <i>3</i><b>Graph registry</b><small>{onGraph ? (stackReg!.source === "subgraph" ? "indexed" : stackReg!.source === "chain" ? "Sepolia confirmed" : "local index") : "not registered"}</small>
        </li>
        <li className={onLedger ? "is-done" : localOk ? "is-pending" : "is-idle"}>
          <i>4</i><b>Hedera HCS</b><small>{onLedger ? `seq ${ledger!.sequenceNumber}` : "not anchored"}</small>
        </li>
      </ol>
      <p>CRE validates receipts from this Stack after Simulate — not the package bytes themselves.</p>
      {onGraph ? (
        <p>
          Graph partner holds stackRoot {short(stackReg!.stackRoot)}
          {stackReg!.name ? ` · ${stackReg!.name}@${stackReg!.version}` : ""}.
        </p>
      ) : null}
      {onLedger ? (
        <p>
          Hedera topic {ledger!.topicId} · seq {ledger!.sequenceNumber} ·{" "}
          <a href={mirror!} target="_blank" rel="noreferrer">
            mirror
          </a>
        </p>
      ) : null}
    </section>
  );
}

function TrustGraph({
  localReport,
  creResult,
  anchor,
  ledger,
}: {
  localReport: VerificationReport | null;
  creResult: CreResultAssessment | null;
  anchor: GraphValidation | null;
  ledger?: LedgerAnchor | null;
}) {
  const replayMatched = localReport?.outcome === "MATCH" || Boolean(creResult);
  const replayFailed = localReport?.outcome === "MISMATCH";
  const creFailed = creResult?.outcome === "MISMATCH";
  const creVerified = creResult?.status === "REPORT_VERIFIED";
  const creDetail = !creResult
    ? "Not run"
    : creVerified
      ? creFailed
        ? "Authenticated mismatch"
        : "Authenticated"
      : creResult.status === "REPORT_UNVERIFIED"
      ? creFailed
        ? "Report mismatch"
        : "Report attached"
      : creFailed
        ? "Result mismatch"
        : "Result only";
  const onLedger = Boolean(ledger);
  const onGraph = Boolean(anchor);
  const onPublicGraph = anchor?.source === "subgraph" || anchor?.source === "chain";
  const publiclyAnchored = onLedger || onPublicGraph;
  const anchorDetail = !creResult
    ? "await CRE"
    : onLedger
      ? `Hedera · seq ${ledger!.sequenceNumber}`
      : onGraph
        ? anchor!.source === "subgraph"
          ? "indexed"
          : anchor!.source === "chain"
            ? "Sepolia confirmed"
            : "local index"
        : creResult.outcome === "COMMITMENTS_MATCH"
          ? "ready"
          : "not checked";
  const mirror = ledger
    ? `https://${ledger.network === "mainnet" ? "mainnet-public" : ledger.network}.mirrornode.hedera.com/api/v1/topics/${ledger.topicId}/messages/${ledger.sequenceNumber}`
    : null;
  return (
    <section className="vsh-trust-graph" aria-label="Post-action verification graph">
      <header>
        <div>
          <span>Post-action trust graph</span>
          <strong>Evidence path</strong>
        </div>
        <small>Runs after control output</small>
      </header>
      <ol>
        <li className="is-done"><i>1</i><b>Runtime action</b><small>captured</small></li>
        <li className="is-done"><i>2</i><b>NeuroReceipt</b><small>linked</small></li>
        <li className={replayFailed ? "is-fail" : replayMatched ? "is-done" : "is-pending"}>
          <i>3</i><b>Local replay</b><small>{replayFailed ? "mismatch" : replayMatched ? "match" : "not checked"}</small>
        </li>
        <li className={creFailed ? "is-fail" : creVerified ? "is-done" : creResult ? "is-pending" : "is-idle"}>
          <i>4</i><b>Chainlink CRE</b><small>{creDetail}</small>
        </li>
        <li className={publiclyAnchored ? "is-done" : creResult?.outcome === "COMMITMENTS_MATCH" ? "is-pending" : "is-idle"}>
          <i>5</i><b>Anchor</b><small>{anchorDetail}</small>
        </li>
      </ol>
      {creResult?.status === "REPORT_UNVERIFIED" && !creFailed ? (
        <p>{creResult.donVerification?.reason ?? "CRE created report bytes for this result. Registry signature verification is the remaining external trust step."}</p>
      ) : null}
      {onLedger ? (
        <p>
          Hedera topic {ledger!.topicId} · seq {ledger!.sequenceNumber} ·{" "}
          <a href={mirror!} target="_blank" rel="noreferrer">
            mirror
          </a>
        </p>
      ) : null}
      {onGraph && !onLedger ? (
        <p>
          Graph partner holds requestHash {short(anchor!.requestHash)} · inclusion {anchor!.txHash}
        </p>
      ) : null}
    </section>
  );
}
