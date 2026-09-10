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
import { verifyArtifact, verifyStackEvidence, type VerificationReport } from "@/lib/verification";
import { DRAFT_KEY, BUILD_KEY, draftFingerprint } from "@/lib/workflow";
import { SIMULATE_HREF } from "@/lib/nav";
import {
  listShelf,
  putReceipt,
  putStack,
  readReceipt,
  readStack,
  removeItem,
  type ShelfItem,
} from "@/lib/shelf";

type Filter = "all" | "stack" | "receipt";

const short = (h?: string) => (h && h.length > 24 ? `${h.slice(0, 14)}…${h.slice(-6)}` : (h ?? ""));
const when = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
};

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
  }

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
        setNotice(`Receipt for tick ${bundle.receipt.tick} added to the shelf.`);
      } else {
        const pkg = await importStack(raw);
        await putStack(pkg, "imported");
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
      setOpen(item);
      setPayload(data);
      setReport(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId("");
    }
  }

  async function verify(item: ShelfItem) {
    setError("");
    setBusyId(item.id);
    try {
      if (item.kind === "stack") {
        const pkg = await readStack(item.id);
        if (!pkg) throw Error("The stored bytes for this Stack are missing.");
        setOpen(item);
        setPayload(pkg);
        setReport(await verifyArtifact(canonical(pkg)));
      } else {
        const bundle = await readReceipt(item.id);
        if (!bundle) throw Error("The stored bytes for this receipt are missing.");
        const host = items.find((i) => i.kind === "stack" && i.stackId === bundle.stackId);
        const pkg = host ? await readStack(host.id) : undefined;
        setOpen(item);
        setPayload(bundle);
        if (!pkg) {
          throw Error(
            "A receipt can only be replayed against the Stack that produced it, and that Stack is not on the shelf. Import it first.",
          );
        }
        setReport(await verifyStackEvidence(canonical(pkg), bundle));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
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
      <header className="vsh-head">
        <div>
          <p className="vsh-eyebrow">Your shelf</p>
          <h2>Everything you have made</h2>
          <p className="vsh-blurb">
            Stacks you compiled here and anything you imported, kept in this browser. Look inside one, replay it, or
            check its receipts.
          </p>
        </div>
        <label className="vsh-import">
          <input
            type="file"
            accept="application/json,.synapse,.json"
            onChange={(e) => {
              void importFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <span>Import a file</span>
        </label>
      </header>

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
              ["stack", `Stacks ${stacks}`],
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
      </div>

      {!ready ? (
        <p className="vsh-empty">Reading the shelf…</p>
      ) : !shown.length ? (
        <div className="vsh-empty-box">
          <p className="vsh-empty">
            {items.length
              ? "Nothing of that kind yet."
              : "Nothing here yet. Compile a Stack in Compose and it lands on this shelf, or import a .synapse package or receipt above."}
          </p>
        </div>
      ) : (
        <ul className="vsh-grid">
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
                      {item.nodeCount} nodes · {item.edgeCount} connections · {item.criticalPathMs} ms of {item.deadlineMs} ms
                      {" · "}
                      <span className={item.executable ? "vsh-ok" : "vsh-warn"}>
                        {item.executable ? "executable" : "will not run"}
                      </span>
                    </p>
                    <ul className="vsh-chips">
                      {(item.nodes ?? []).slice(0, 6).map((n) => (
                        <li key={n}>{n}</li>
                      ))}
                      {(item.nodes?.length ?? 0) > 6 ? <li className="vsh-more">+{(item.nodes?.length ?? 0) - 6}</li> : null}
                    </ul>
                  </>
                ) : (
                  <p className="vsh-meta">
                    tick {item.tick} · sequence {item.sequence} · {item.eventCount} events
                  </p>
                )}

                <code className="vsh-hash" title={item.kind === "stack" ? item.stackId : item.receiptHash}>
                  {item.kind === "stack" ? "stack" : "receipt"} {short(item.kind === "stack" ? item.stackId : item.receiptHash)}
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
                  <button type="button" onClick={() => void verify(item)} disabled={busyId === item.id}>
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
        </ul>
      )}

      {open && payload ? (
        <Detail item={open} payload={payload} report={report} onClose={closeDetail} onVerify={() => void verify(open)} />
      ) : null}
    </section>
  );
}

function Detail({
  item,
  payload,
  report,
  onClose,
  onVerify,
}: {
  item: ShelfItem;
  payload: ComposePackage | ReplayBundle;
  report: VerificationReport | null;
  onClose: () => void;
  onVerify: () => void;
}) {
  const isStack = item.kind === "stack";
  const pkg = isStack ? (payload as ComposePackage) : null;
  const bundle = isStack ? null : (payload as ReplayBundle);

  return (
    <div className="vsh-detail-backdrop" role="dialog" aria-modal="true" aria-label={`Inside ${item.name}`}>
      <button type="button" className="vsh-detail-dismiss" onClick={onClose} aria-label="Close" />
      <aside className="vsh-detail">
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
            </>
          ) : (
            <>
              <h4>Actions committed</h4>
              <pre>{JSON.stringify(bundle!.receipt.actions, null, 2)}</pre>
              <h4>Events</h4>
              <pre>{JSON.stringify(bundle!.receipt.events, null, 2)}</pre>
            </>
          )}

          <h4>Check it</h4>
          {report ? (
            <div className={`vsh-report is-${report.outcome.toLowerCase()}`}>
              <p className="vsh-outcome">
                {report.outcome} · {report.scope}
              </p>
              <ul className="vsh-claims">
                {report.claims.map((c) => (
                  <li key={c.id} className={`is-${c.status}`}>
                    <span className="vsh-claim-layer">{c.layer}</span>
                    <b>{c.label}</b>
                    <em>{c.status}</em>
                    <small>{c.detail}</small>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="vsh-muted">
              Not checked yet in this session.{" "}
              <button type="button" className="vsh-inline-btn" onClick={onVerify}>
                Run the verifier
              </button>
            </p>
          )}
        </div>

        <footer className="vsh-detail-foot">
          <button
            type="button"
            onClick={() =>
              download(isStack ? `${item.name}-${item.version}.synapse` : `receipt-${item.tick}.json`, payload)
            }
          >
            Download the bytes
          </button>
        </footer>
      </aside>
    </div>
  );
}
