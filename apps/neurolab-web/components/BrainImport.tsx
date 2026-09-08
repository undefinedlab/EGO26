"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { DATASETS } from "@/lib/datasets";
import { canonicalBytes, formatCount, regionHistogram, type BrainGraph } from "@/lib/brain";
import { ImportError, WARN_BYTES, importBrain, type ImportProgress } from "@/lib/brainImport";
import { available, deleteBrain, listBrains, saveBrain, verifyBrain, type BrainSummary } from "@/lib/brainStore";
import { formatBytes } from "@/lib/library";
import { LibraryIcon as Icon } from "./LibraryIcon";

const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "brain";

export function BrainImport() {
  const [datasetId, setDatasetId] = useState(DATASETS[0]?.slug ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [minWeight, setMinWeight] = useState(1);
  const [ntPredicted, setNtPredicted] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [graph, setGraph] = useState<BrainGraph | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<BrainSummary[]>([]);
  const [notice, setNotice] = useState("");
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const dataset = DATASETS.find((d) => d.slug === datasetId);

  const refresh = useCallback(() => {
    listBrains().then(setSaved);
  }, []);
  useEffect(refresh, [refresh]);

  const run = async (f: File) => {
    if (!dataset) return;
    setBusy(true);
    setError("");
    setGraph(null);
    setProgress(null);
    try {
      const g = await importBrain(
        f,
        { datasetId: "datasets/" + dataset.slug, datasetVersion: dataset.version, minWeight, ntPredicted },
        setProgress,
      );
      setGraph(g);
    } catch (e) {
      setError(e instanceof ImportError ? e.message : "Import failed: " + String(e));
    } finally {
      setBusy(false);
    }
  };

  const choose = (f: File | null) => {
    setFile(f);
    setGraph(null);
    setError("");
    if (f) void run(f);
  };

  const commit = async () => {
    if (!graph || !dataset) return;
    const id = slug(dataset.slug + "-" + graph.sourceFile.replace(/\.(csv|tsv|txt)(\.gz)?$/i, ""));
    try {
      await saveBrain(id, dataset.name, graph, canonicalBytes(graph));
      setNotice("Saved to this browser as " + id);
      refresh();
    } catch (e) {
      setError("Could not save locally: " + String(e));
    }
  };

  const check = async (id: string) => {
    const r = await verifyBrain(id);
    setNotice(r.ok ? "Digest re-computed and matches: " + id : "Verification failed for " + id + " — " + r.reason);
  };

  const regions = graph ? regionHistogram(graph.nodes, graph.edges) : [];
  const pct = progress && progress.totalBytes ? Math.min(100, (progress.bytes / progress.totalBytes) * 100) : 0;

  return (
    <div className="brain-import">
      <header className="lib-hero">
        <div>
          <div className="lib-eyebrow">
            <span className="lib-live-dot" /> Compute
          </div>
          <h1>
            Attach the data.<br className="lib-mobile-break" /> Get exact numbers.
          </h1>
          <p>
            Every brain and region is already described in the library — browse them without
            downloading anything. Attach the source connectome here when you need exact per-region
            counts or want to derive a circuit. The file is read in this browser and never uploaded.
          </p>
        </div>
        <Link className="lib-button" href="/explore?kind=Brain">
          <Icon name="block" /> Browse brains
        </Link>
      </header>

      <div className="brain-grid">
        <section className="brain-panel">
          <h2>1 · Which brain</h2>
          <p className="brain-help">
            Records what this graph belongs to. Download the connectivity export from the
            dataset&rsquo;s own site first — nothing is fetched for you.
          </p>
          <select
            className="brain-select"
            value={datasetId}
            onChange={(e) => setDatasetId(e.target.value)}
            aria-label="Source dataset"
          >
            {DATASETS.map((d) => (
              <option key={d.slug} value={d.slug}>
                {d.name} · {d.version}
              </option>
            ))}
          </select>
          {dataset && (
            <div className="brain-source">
              <span>{dataset.scope}</span>
              <a href={dataset.homepage} target="_blank" rel="noreferrer noopener">
                Open source data ↗
              </a>
            </div>
          )}
          {dataset && !dataset.derivable && (
            <p className="brain-warn">
              {dataset.name} is a tissue sample. You can import it, but no complete pathway runs
              through the volume, so it will not yield a circuit.
            </p>
          )}
        </section>

        <section className="brain-panel">
          <h2>2 · Connectivity file</h2>
          <p className="brain-help">
            An edge list (<code>pre, post, weight</code>) or an adjacency matrix. CSV, TSV, or
            gzipped. Column names are detected.
          </p>

          <div
            className={dragging ? "brain-drop dragging" : "brain-drop"}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              choose(e.dataTransfer.files?.[0] ?? null);
            }}
            onClick={() => inputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                inputRef.current?.click();
              }
            }}
          >
            <Icon name="upload" size={22} />
            <strong>{file ? file.name : "Drop a connectivity file"}</strong>
            <span>{file ? formatBytes(file.size) : "or click to choose"}</span>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.tsv,.txt,.gz"
            hidden
            onChange={(e) => choose(e.target.files?.[0] ?? null)}
          />

          {file && file.size > WARN_BYTES && (
            <p className="brain-warn">
              {formatBytes(file.size)} is large for a browser import. It will work, but expect it to
              take a while and use a lot of memory.
            </p>
          )}

          <div className="brain-options">
            <label>
              Minimum synapses
              <input
                type="number"
                min={0}
                max={100}
                value={minWeight}
                onChange={(e) => setMinWeight(Math.max(0, Number(e.target.value) || 0))}
              />
            </label>
            <label className="brain-check">
              <input type="checkbox" checked={ntPredicted} onChange={(e) => setNtPredicted(e.target.checked)} />
              Neurotransmitters are predicted, not measured
            </label>
          </div>
        </section>
      </div>

      {busy && (
        <div className="brain-progress" role="status" aria-live="polite">
          <div className="brain-bar">
            <span style={{ width: pct + "%" }} />
          </div>
          <div className="brain-progress-meta">
            <span>{progress?.phase === "hashing" ? "Hashing canonical form…" : "Reading…"}</span>
            {progress && (
              <span className="mono">
                {formatCount(progress.rows)} rows · {formatCount(progress.nodes)} nodes ·{" "}
                {formatCount(progress.edges)} edges
              </span>
            )}
          </div>
        </div>
      )}

      {error && (
        <p className="brain-error" role="alert">
          {error}
        </p>
      )}

      {graph && (
        <section className="brain-result">
          <div className="brain-result-head">
            <div>
              <h2>Canonical graph</h2>
              <p className="mono brain-digest">{graph.digest}</p>
            </div>
            <button className="lib-button primary" onClick={commit} disabled={!available()}>
              <Icon name="save" /> Save to this browser
            </button>
          </div>

          <div className="brain-stats">
            {[
              ["Neurons", formatCount(graph.stats.nodes)],
              ["Connections", formatCount(graph.stats.edges)],
              ["Total synapses", formatCount(graph.stats.totalWeight)],
              ["Cell types", formatCount(graph.stats.types)],
              ["Regions", formatCount(graph.stats.regions)],
              ["Inputs (no afferents)", formatCount(graph.stats.sources)],
              ["Outputs (no efferents)", formatCount(graph.stats.sinks)],
              ["Electrical", formatCount(graph.stats.electrical)],
            ].map(([k, v]) => (
              <div key={k} className="brain-stat">
                <span>{k}</span>
                <strong>{v}</strong>
              </div>
            ))}
          </div>

          <div className="brain-coverage">
            <div>
              <span>Region coverage</span>
              <div className="brain-meter">
                <i style={{ width: Math.round(graph.stats.regionCoverage * 100) + "%" }} />
              </div>
              <b>{Math.round(graph.stats.regionCoverage * 100)}%</b>
            </div>
            <div>
              <span>Neurotransmitter coverage</span>
              <div className="brain-meter">
                <i style={{ width: Math.round(graph.stats.ntCoverage * 100) + "%" }} />
              </div>
              <b>{Math.round(graph.stats.ntCoverage * 100)}%</b>
            </div>
          </div>

          {regions.length > 0 && (
            <div className="brain-regions">
              <h3>Regions available for selection</h3>
              <div className="brain-region-chips">
                {regions.map(([name, count]) => (
                  <span key={name} className="brain-chip">
                    {name} <b>{formatCount(count)}</b>
                  </span>
                ))}
              </div>
            </div>
          )}

          {graph.notes.length > 0 && (
            <ul className="brain-notes">
              {graph.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          )}
        </section>
      )}

      {notice && <p className="brain-notice">{notice}</p>}

      <section className="brain-saved">
        <h2>Brains in this browser <span>{saved.length}</span></h2>
        {!saved.length ? (
          <p className="brain-help">Nothing imported yet. A saved brain stays on this machine.</p>
        ) : (
          <ul>
            {saved.map((b) => (
              <li key={b.id}>
                <div>
                  <strong>{b.id}</strong>
                  <span className="mono brain-digest">{b.digest.slice(0, 26)}…</span>
                  <span>
                    {formatCount(b.stats.nodes)} neurons · {formatCount(b.stats.edges)} connections ·{" "}
                    {formatBytes(b.canonicalBytes)} canonical
                  </span>
                </div>
                <div className="brain-saved-actions">
                  <button className="lib-button" onClick={() => check(b.id)}>
                    Verify digest
                  </button>
                  <button
                    className="lib-button"
                    onClick={() => deleteBrain(b.id).then(refresh)}
                    aria-label={"Delete " + b.id}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
