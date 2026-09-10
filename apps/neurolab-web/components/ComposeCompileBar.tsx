"use client";

/**
 * Compose action bar — import · open · save · compile (modal) · add
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { IconCheck, IconFolder, IconImport, IconPlay, IconSave } from "@/components/icons";

export type CompilePreset = {
  name: string;
  draft: unknown;
};

export type CompileBuildInfo = {
  hash: string;
  executable: boolean;
  shortHash: string;
};

const PRESETS = [
  { value: "shield", label: "Collision Shield" },
  { value: "brake", label: "Emergency Brake" },
  { value: "arbiter", label: "Safety Override" },
  { value: "biopilot", label: "BioPilot" },
  { value: "empty", label: "Empty canvas" },
] as const;

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
  onDownload,
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
  onCompile: () => void | Promise<void>;
  busy: boolean;
  canCompile: boolean;
  saveOk?: boolean;
  trailing?: ReactNode;
  status?: ReactNode;
  build?: CompileBuildInfo | null;
  onDownload?: () => void;
  onSimulate?: () => void;
}) {
  const [folderOpen, setFolderOpen] = useState(false);
  const [folderView, setFolderView] = useState<"root" | "presets">("root");
  const [showSave, setShowSave] = useState(false);
  const [showCompile, setShowCompile] = useState(false);
  const [sceneName, setSceneName] = useState("");
  const root = useRef<HTMLDivElement>(null);

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
    const trim = sceneName.trim().replace(/\.io$/i, "");
    if (!trim) return;
    onSavePreset(trim);
    onFileName(`${trim}.io`);
    setShowSave(false);
    setSceneName("");
  }, [sceneName, onSavePreset, onFileName]);

  const runCompile = useCallback(async () => {
    await onCompile();
  }, [onCompile]);

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
                      <span>Presets</span>
                    </div>
                    {PRESETS.map((p) => (
                      <button
                        key={p.value}
                        type="button"
                        role="menuitem"
                        className="cmp-add-item"
                        onClick={() => {
                          onPresetTemplate(p.value);
                          onFileName(`${p.value}.io`);
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
                      <span>Library</span>
                    </div>
                    <button
                      type="button"
                      role="menuitem"
                      className="cmp-add-item"
                      onClick={() => setFolderView("presets")}
                    >
                      <IconFolder size={14} />
                      <span>Presets</span>
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
              aria-label="Preset file name"
            />
          </div>

          <button
            type="button"
            className={`cmp-compile-icon-btn${saveOk ? " is-saved" : ""}`}
            disabled={saveOk}
            title={saveOk ? "Saved" : "Save preset"}
            aria-label={saveOk ? "Saved" : "Save preset"}
            onClick={() => {
              const base = fileName.replace(/\.io$/i, "").trim();
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
            onClick={() => setShowCompile(true)}
          >
            <IconPlay size={12} />
            <span>{busy ? "Compiling…" : "Compile"}</span>
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
            <p className="cmp-compile-dialog-hint">Saved as {sceneName.trim() ? `${sceneName.trim().replace(/\.io$/i, "")}.io` : "name.io"}</p>
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
        <div className="cmp-compile-dialog-overlay" onClick={() => setShowCompile(false)}>
          <div
            className="cmp-compile-dialog cmp-compile-dialog--build"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="cmp-compile-title"
          >
            <header>
              <h3 id="cmp-compile-title">Compile</h3>
              <button type="button" aria-label="Close" onClick={() => setShowCompile(false)}>×</button>
            </header>
            <p className="cmp-compile-dialog-hint">
              Build a package from the current graph. Trust claims stay outside the control loop.
            </p>
            <button
              type="button"
              className="cmp-compile-dialog-primary"
              disabled={!canCompile || busy}
              onClick={() => void runCompile()}
            >
              <IconPlay size={12} />
              {busy ? "Compiling…" : "Compile Stack"}
            </button>
            {!canCompile && !busy ? (
              <p className="cmp-compile-dialog-warn">Fix graph issues before compiling.</p>
            ) : null}
            {build ? (
              <div className="cmp-compile-dialog-build">
                <span className={build.executable ? "good" : "cmp-warning"}>
                  {build.executable ? "Built · executable" : "Built · source only"}
                </span>
                <code title={build.hash}>{build.shortHash}</code>
                <div className="cmp-compile-dialog-actions">
                  <button type="button" onClick={onDownload}>Download .synapse</button>
                  <button
                    type="button"
                    className="run"
                    disabled={!build.executable}
                    onClick={() => {
                      setShowCompile(false);
                      onSimulate?.();
                    }}
                  >
                    Simulate →
                  </button>
                </div>
              </div>
            ) : (
              <p className="cmp-compile-dialog-hint">No package built yet.</p>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
