"use client";

/**
 * Compose action bar — import · open · save · compile (modal) · add
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { IconCheck, IconDownload, IconFolder, IconImport, IconPlay, IconSave, IconSimulate } from "@/components/icons";

export type CompilePreset = {
  name: string;
  draft: unknown;
};

export type CompileLog = { label: string; status: "running" | "pass" | "fail"; detail?: string };
export type CompileBuildInfo = { fileName: string; hash: string; stackId: string; executable: boolean; nodes: number; connections: number; lockedModules: number; runtime: string };

const PRESETS = [{ value: "brake", label: "Emergency Brake · end-to-end demo" }] as const;

export function ComposeCompileBar({
  fileName,
  onFileName,
  savedPresets,
  onSavePreset,
  onLoadPreset,
  onDeletePreset,
  onPresetTemplate,
  onImport,
  onCompile,
  busy,
  canCompile,
  saveOk,
  trailing,
  status,
  build,
  logs,
  onDownload,
  onSaveToLibrary,
  onSimulate,
}: {
  fileName: string;
  onFileName: (name: string) => void;
  savedPresets: CompilePreset[];
  onSavePreset: (name: string) => void;
  onLoadPreset: (name: string) => void;
  onDeletePreset: (name: string) => void;
  onPresetTemplate: (value: string) => void;
  onImport: (file?: File) => void;
  onCompile: () => void | boolean | Promise<void | boolean>;
  busy: boolean;
  canCompile: boolean;
  saveOk?: boolean;
  trailing?: ReactNode;
  status?: ReactNode;
  build?: CompileBuildInfo | null;
  logs: CompileLog[];
  onDownload?: () => void;
  onSaveToLibrary?: () => void | boolean | Promise<void | boolean>;
  onSimulate?: () => void;
}) {
  const [folderOpen, setFolderOpen] = useState(false);
  const [folderView, setFolderView] = useState<"root" | "presets">("root");
  const [showSave, setShowSave] = useState(false);
  const [showCompile, setShowCompile] = useState(false);
  const [sceneName, setSceneName] = useState("");
  const [librarySaved, setLibrarySaved] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  const openCompileModal = useCallback(() => {
    setLibrarySaved(false);
    setShowCompile(true);
  }, []);

  const closeCompileModal = useCallback(() => {
    setShowCompile(false);
  }, []);

  useEffect(() => {
    if (!folderOpen) return;
    const onPtr = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) {
        setFolderOpen(false);
        setFolderView("root");
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (folderView === "presets") setFolderView("root");
        else {
          setFolderOpen(false);
          setFolderView("root");
        }
      }
    };
    window.addEventListener("pointerdown", onPtr, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPtr, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [folderOpen, folderView]);

  const submitSave = useCallback(() => {
    const trim = sceneName.trim().replace(/\.(?:io|synapse)$/i, "");
    if (!trim) return;
    onSavePreset(trim);
    setShowSave(false);
    setSceneName("");
  }, [sceneName, onSavePreset]);

  const runCompile = useCallback(async () => {
    setLibrarySaved(false);
    await onCompile();
  }, [onCompile]);

  const proofReady =
    !busy &&
    !!build &&
    logs.length > 0 &&
    logs.every((entry) => entry.status === "pass");

  const saveToVerifyLibrary = useCallback(async () => {
    if (!onSaveToLibrary || !proofReady) return;
    const ok = await onSaveToLibrary();
    if (ok === false) return;
    setLibrarySaved(true);
  }, [onSaveToLibrary, proofReady]);

  return (
    <>
      <div className="cmp-float-bar cmp-compile-bar" ref={root}>
        <div className="cmp-compile-stack">
        <div className="cmp-float-bar-inner">
          <label className="cmp-compile-icon-btn cmp-compile-import" title="Import Stack or draft">
            <IconImport size={15} />
            <input
              type="file"
              accept=".synapse,.json,.io"
              aria-label="Import Stack or draft"
              onChange={(e) => {
                void onImport(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>

          <div className="cmp-compile-file">
            <button
              type="button"
              className={`cmp-compile-icon-btn${folderOpen ? " is-open" : ""}`}
              title="Presets and saved files"
              aria-label="Presets and saved files"
              aria-expanded={folderOpen}
              aria-haspopup="menu"
              onClick={() => {
                setFolderOpen((open) => {
                  if (open) setFolderView("root");
                  return !open;
                });
              }}
            >
              <IconFolder size={15} />
            </button>
            {folderOpen ? (
              <div className="cmp-add-menu cmp-compile-saved-menu" role="menu" aria-label="Presets and saved files">
                {folderView === "presets" ? (
                  <>
                    <div className="cmp-add-menu-head">
                      <button type="button" className="cmp-add-back" onClick={() => setFolderView("root")}>
                        ← Back
                      </button>
                      <span>Included preset</span>
                    </div>
                    {PRESETS.map((p) => (
                      <button
                        key={p.value}
                        type="button"
                        role="menuitem"
                        className="cmp-add-item"
                        onClick={() => {
                          onPresetTemplate(p.value);
                          setFolderOpen(false);
                          setFolderView("root");
                        }}
                      >
                        <span>{p.label}</span>
                      </button>
                    ))}
                  </>
                ) : (
                  <>
                    <div className="cmp-add-menu-head">
                      <span>Workspaces</span>
                    </div>
                    <button
                      type="button"
                      role="menuitem"
                      className="cmp-add-item"
                      onClick={() => setFolderView("presets")}
                    >
                      <IconFolder size={14} />
                      <span>Included preset</span>
                      <em className="cmp-add-count">{PRESETS.length}</em>
                      <b>→</b>
                    </button>
                    <div className="cmp-add-menu-head">
                      <span>Saved · {savedPresets.length}</span>
                    </div>
                    {savedPresets.length === 0 ? (
                      <p className="cmp-add-empty">No saved presets</p>
                    ) : (
                      savedPresets.map((s) => (
                        <div key={s.name} className="cmp-compile-saved-row">
                          <button
                            type="button"
                            role="menuitem"
                            className="cmp-add-item"
                            onClick={() => {
                              onLoadPreset(s.name);
                              onFileName(`${s.name}.io`);
                              setFolderOpen(false);
                              setFolderView("root");
                            }}
                          >
                            <span>{s.name}.io</span>
                          </button>
                          <button
                            type="button"
                            className="cmp-compile-delete"
                            title={`Delete ${s.name}`}
                            aria-label={`Delete ${s.name}`}
                            onClick={() => onDeletePreset(s.name)}
                          >
                            ×
                          </button>
                        </div>
                      ))
                    )}
                  </>
                )}
              </div>
            ) : null}
            <input
              type="text"
              className="cmp-compile-filename"
              value={fileName}
              onChange={(e) => onFileName(e.target.value)}
              spellCheck={false}
              aria-label="Compiled artifact file name"
            />
          </div>

          <button
            type="button"
            className={`cmp-compile-icon-btn${saveOk ? " is-saved" : ""}`}
            disabled={saveOk}
            title={saveOk ? "Saved" : "Save preset"}
            aria-label={saveOk ? "Saved" : "Save preset"}
            onClick={() => {
              const base = fileName.replace(/\.(?:io|synapse)$/i, "").trim();
              setSceneName(base && base !== "untitled" ? base : "");
              setShowSave(true);
            }}
          >
            {saveOk ? <IconCheck size={15} /> : <IconSave size={15} />}
          </button>

          <span className="cmp-float-sep" aria-hidden />

          <button
            type="button"
            className={`cmp-compile-run-btn${busy ? " is-busy" : ""}${build ? " has-build" : ""}`}
            title="Compile"
            aria-label="Compile"
            aria-haspopup="dialog"
            aria-expanded={showCompile}
            onClick={openCompileModal}
          >
            <IconPlay size={12} />
            <span>Compile</span>
          </button>

          {trailing}
        </div>
        {status ? <div className="cmp-compile-status-wrap">{status}</div> : null}
        </div>
      </div>

      {showSave ? (
        <div
          className="cmp-compile-dialog-overlay"
          onClick={() => {
            setShowSave(false);
            setSceneName("");
          }}
        >
          <div className="cmp-compile-dialog" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="cmp-save-title">
            <header>
              <h3 id="cmp-save-title">Save preset</h3>
              <button type="button" aria-label="Close" onClick={() => { setShowSave(false); setSceneName(""); }}>×</button>
            </header>
            <input
              type="text"
              placeholder="Enter preset name"
              value={sceneName}
              autoFocus
              onChange={(e) => setSceneName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitSave();
              }}
            />
            <p className="cmp-compile-dialog-hint">Saved as {sceneName.trim() ? `${sceneName.trim().replace(/\.(?:io|synapse)$/i, "")}.io` : "name.io"}</p>
            <footer>
              <button type="button" onClick={() => { setShowSave(false); setSceneName(""); }}>Cancel</button>
              <button type="button" className="cmp-compile-dialog-save" disabled={!sceneName.trim()} onClick={submitSave}>
                Save
              </button>
            </footer>
          </div>
        </div>
      ) : null}

      {showCompile ? (
        <div className="cmp-compile-dialog-overlay" onClick={closeCompileModal}>
          <div
            className="cmp-compile-dialog cmp-compile-dialog--build"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="cmp-compile-title"
          >
            <header>
              <div><span className="cmp-eyebrow">COMPILE OUTPUT</span><h3 id="cmp-compile-title">{busy ? "Building package…" : build?.fileName ?? "Compile Stack"}</h3></div>
              <button type="button" aria-label="Close" onClick={closeCompileModal}>×</button>
            </header>
            <p className="cmp-compile-dialog-hint">Create a versioned package from the current graph, then check that the exported bytes can be imported and executed locally.</p>
            <button
              type="button"
              className="cmp-compile-dialog-primary"
              disabled={!canCompile || busy}
              onClick={() => void runCompile()}
            >
              <IconPlay size={14} />
              {busy ? "Compiling…" : build ? "Recompile Stack" : "Compile Stack"}
            </button>
            {!canCompile && !busy ? (
              <p className="cmp-compile-dialog-warn">Fix graph issues before compiling.</p>
            ) : null}
            {(logs.length || busy) ? (
              <div className="cmp-compile-dialog-build">
                <div className="cmp-compile-log" role="log" aria-live="polite">
                  {logs.map((entry, index) => (
                    <div key={entry.label + index} className={`is-${entry.status}`}>
                      <i aria-hidden>{entry.status === "pass" ? "✓" : entry.status === "fail" ? "×" : "·"}</i>
                      <span>
                        <strong>{entry.label}</strong>
                        {entry.detail ? <small>{entry.detail}</small> : null}
                      </span>
                    </div>
                  ))}
                </div>
                {proofReady && build ? (
                  <>
                    <div className="cmp-compile-proof">
                      <div><small>Runtime</small><strong>{build.executable ? "Executable" : "Source only"}</strong></div>
                      <div><small>Graph</small><strong>{build.nodes} nodes · {build.connections} wires</strong></div>
                      <div><small>Locked models</small><strong>{build.lockedModules}</strong></div>
                      <div><small>Package SHA-256</small><code title={build.hash}>{build.hash.slice(0, 14)}…</code></div>
                    </div>
                    <p className="cmp-compile-contract">
                      This .synapse contains the typed graph, runtime plan, parameters, module locks and exact neural model bytes. It was re-imported and smoke-run against <code>{build.runtime}</code> before these actions were enabled.
                    </p>
                    <p className="cmp-compile-dialog-hint">These checks do not provide a publisher signature, an independent build, Chainlink CRE validation, or an onchain anchor.</p>
                  </>
                ) : null}
                <div className="cmp-compile-dialog-actions">
                  <button
                    type="button"
                    className={`cmp-compile-dialog-action${librarySaved ? " is-saved" : ""}`}
                    disabled={!proofReady}
                    onClick={() => void saveToVerifyLibrary()}
                  >
                    {librarySaved ? <IconCheck size={16} /> : <IconSave size={16} />}
                    <span>{librarySaved ? "Saved" : "Save"}</span>
                  </button>
                  <button type="button" className="cmp-compile-dialog-action" disabled={!proofReady} onClick={onDownload}>
                    <IconDownload size={16} />
                    <span>Download</span>
                  </button>
                  <button
                    type="button"
                    className="cmp-compile-dialog-action run"
                    disabled={!proofReady || !build?.executable}
                    onClick={() => {
                      closeCompileModal();
                      onSimulate?.();
                    }}
                  >
                    <IconSimulate size={16} />
                    <span>Open</span>
                  </button>
                </div>
                {proofReady && !librarySaved ? (
                  <p className="cmp-compile-dialog-hint">Save keeps this package on the Verify shelf in this browser — no publish page.</p>
                ) : null}
                {!proofReady && !busy ? (
                  <p className="cmp-compile-dialog-hint">Save, Download and Open unlock after every check passes.</p>
                ) : null}
              </div>
            ) : !busy ? (
              <p className="cmp-compile-dialog-hint">Compile Stack to run checks. Actions unlock after every local check passes.</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
