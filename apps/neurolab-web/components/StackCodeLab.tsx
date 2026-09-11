"use client";

/**
 * Scenario lab — the importability demo.
 *
 * Left is the code you would write to use a compiled Stack in your own
 * program, and the console it actually produced. Right is the body that code
 * is driving, and which body it is.
 *
 * The loop is closed: the world produces sensor features, the Stack decides,
 * and the command it returns is what decelerates the machine. So the scene is
 * the module's own decisions playing out, not an animation running alongside.
 *
 * One situation, three bodies. Physics is shared across them deliberately — a
 * difference in outcome between a van, a drone and a gantry arm is a
 * difference in the body, never in the model.
 *
 * The editor buffer is what runs. Until you touch it, it tracks the body you
 * picked; once edited, your version is executed instead.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { buildStack, canonical, digest, importStack, type ComposePackage } from "@/lib/composeCompiler";
import { loadCompiledStack, type CompiledStack, type Inputs, type ReplayBundle } from "@/lib/composeRuntime";
import { BUILD_KEY, DRAFT_KEY, draftFingerprint, restoreBuild } from "@/lib/workflow";
import { checkedDraft } from "@/lib/composeDraft";
import { DEMO_FILE } from "@/lib/brakeDemo";
import { putReceipt } from "@/lib/shelf";
import { ACTORS, actorById, actorFit, closestOf, type Actor, type ActorState } from "@/lib/actors";
import { condition, saturate } from "@/lib/scenarios";
import { highlight, scenarioCode } from "@/lib/scenarioCode";
import { INJECTED, RunStopped, runUserCode } from "@/lib/scenarioRun";
import { IconCopy, IconRefresh } from "@/components/icons";
import "@/app/verify/codelab.css";

const loading = () => <div className="clab-world-loading">Loading scene…</div>;
const SCENES: Record<string, React.ComponentType<{ road: ActorState }>> = {
  car: dynamic(() => import("./BrakeWorld").then((m) => m.BrakeWorld), { ssr: false, loading }) as never,
  drone: dynamic(() => import("./DroneWorld").then((m) => m.DroneWorld), { ssr: false, loading }) as never,
  arm: dynamic(() => import("./ArmWorld").then((m) => m.ArmWorld), { ssr: false, loading }) as never,
};

type Loaded = { pkg: ComposePackage; hash: string; file: string; source: "compose" | "file" | "demo" };
type Line = { text: string; kind: "in" | "out" | "evt" | "tick" | "warn" | "receipt" };

/** Nodes that carry a danger threshold the reflex is gated on. */
const GATES = new Set(["SafetyGate", "Arbiter"]);
const thresholdOf = (pkg: ComposePackage) =>
  pkg.graph.nodes.find((n) => GATES.has(n.type))?.params?.threshold ?? 52429;

const MAX_LINES = 220;
const TICK_CEILING = 20_000;

export function StackCodeLab() {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [actor, setActor] = useState<Actor>(ACTORS[0]);
  const [speed, setSpeed] = useState<number>(ACTORS[0].speed.value);
  const [lines, setLines] = useState<Line[]>([]);
  const [actions, setActions] = useState<Inputs>({});
  const [road, setRoad] = useState<ActorState>(() => ACTORS[0].start(ACTORS[0].speed.value));
  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [replay, setReplay] = useState<ReplayBundle | null>(null);
  const [copied, setCopied] = useState(false);
  const [source, setSource] = useState("");
  const [edited, setEdited] = useState(false);
  const [rate, setRate] = useState(0);
  /** The danger threshold is a parameter of the Stack, not of this page.
   *  Changing it rebuilds the package, which gives a different stackId. */
  const [threshold, setThreshold] = useState(0);
  const [retuning, setRetuning] = useState(false);
  /** Pre-gain on the vision channels, in percent. This is integration code,
   *  not a change to the block — its digest is untouched. */
  const [gain, setGain] = useState(100);

  const vm = useRef<CompiledStack | null>(null);
  const worldRef = useRef<ActorState>(ACTORS[0].start(ACTORS[0].speed.value));
  const epoch = useRef(0);
  const stepping = useRef(false);
  const shelved = useRef("");
  const consoleRef = useRef<HTMLDivElement>(null);
  const cost = useRef({ ticks: 0, ms: 0 });
  /** The interval can fire again after a run ends; say the outcome once. */
  const announced = useRef(false);
  /** The package as it was loaded, so retuning always starts from source. */
  const baseline = useRef<ComposePackage | null>(null);
  const tuneTimer = useRef<number | null>(null);

  const log = useCallback((text: string, kind: Line["kind"] = "out") => {
    setLines((old) => [...old, { text, kind }].slice(-MAX_LINES));
  }, []);

  useEffect(() => {
    consoleRef.current?.scrollTo({ top: consoleRef.current.scrollHeight });
  }, [lines]);

  const reset = useCallback(
    (a: Actor = actor, v: number = speed) => {
      epoch.current++;
      vm.current = null;
      shelved.current = "";
      announced.current = false;
      worldRef.current = a.start(v);
      cost.current = { ticks: 0, ms: 0 };
      setRate(0);
      setRoad(worldRef.current);
      setRunning(false);
      setActions({});
      setReplay(null);
      setLines([]);
    },
    [actor, speed],
  );

  const load = useCallback(
    async (raw: string, file: string, origin: Loaded["source"]) => {
      epoch.current++;
      const ticket = epoch.current;
      setBusy(true);
      setError("");
      setLines([]);
      try {
        const pkg = await importStack(raw);
        const hash = await digest(canonical(pkg));
        if (ticket !== epoch.current) return;
        if (!pkg.manifest.executable) {
          throw Error("This package is source-only — its neural interfaces are not implemented, so it cannot run.");
        }
        vm.current = null;
        worldRef.current = actor.start(speed);
        setRoad(worldRef.current);
        baseline.current = pkg;
        setThreshold(thresholdOf(pkg));
        setLoaded({ pkg, hash, file, source: origin });
        log(`$ loaded ${file}`, "in");
        log(`  stackId  ${pkg.manifest.stackId}`);
        log(`  ready — ${pkg.graph.nodes.length} nodes on a 1 ms clock`);
        const fit = actorFit(pkg, actor);
        if (fit.note) log(`  ${fit.note}`, "warn");
      } catch (e) {
        if (ticket === epoch.current) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (ticket === epoch.current) setBusy(false);
      }
    },
    [actor, log, speed],
  );

  /* Current Compose build, else the bundled demo. Mount only. */
  useEffect(() => {
    let stopped = false;
    void (async () => {
      const build = localStorage.getItem(BUILD_KEY);
      const draft = localStorage.getItem(DRAFT_KEY);
      if (build && draft) {
        try {
          const restored = await restoreBuild(build, draftFingerprint(checkedDraft(JSON.parse(draft))));
          if (stopped) return;
          await load(
            canonical(restored.pkg),
            `${restored.pkg.manifest.name}-${restored.pkg.manifest.version}.synapse`,
            "compose",
          );
          return;
        } catch {
          /* Fall through to the demo rather than showing an empty editor. */
        }
      }
      try {
        const res = await fetch(`/demo/${DEMO_FILE}`);
        if (!res.ok || stopped) return;
        await load(await res.text(), DEMO_FILE, "demo");
      } catch {
        /* An empty lab is a fine starting state; the import button is right there. */
      }
    })();
    return () => {
      stopped = true;
      epoch.current++;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const generated = loaded ? scenarioCode(loaded.pkg, actor, speed, loaded.file, gain) : "";
  useEffect(() => {
    if (!edited) setSource(generated);
  }, [generated, edited]);

  /** Buffered printing: user code may log every tick. */
  const printBuffer = useRef<Line[]>([]);
  const flushTimer = useRef<number | null>(null);
  const flushSoon = useCallback(() => {
    if (flushTimer.current !== null) return;
    flushTimer.current = window.setTimeout(() => {
      flushTimer.current = null;
      const batch = printBuffer.current;
      printBuffer.current = [];
      if (batch.length) setLines((old) => [...old, ...batch].slice(-MAX_LINES));
    }, 60);
  }, []);

  async function runCustom() {
    if (!loaded || busy) return;
    const ticket = epoch.current;
    setError("");
    setLines([]);
    setRunning(true);
    printBuffer.current = [];
    try {
      await runUserCode(source, loaded.pkg, actor, {
        print: (text) => {
          printBuffer.current.push({ text: `  ${text}`, kind: "out" });
          flushSoon();
        },
        show: (r) => {
          if (epoch.current !== ticket) return;
          worldRef.current = r;
          setRoad(r);
        },
        onReceipt: (r) => {
          if (epoch.current !== ticket) return;
          setReplay(r);
          if (!shelved.current) {
            shelved.current = r.receipt.hash;
            void putReceipt(r, "captured", loaded.pkg.manifest.name).catch(() => {
              shelved.current = "";
            });
          }
        },
        budgetMs: 30_000,
        cancelled: () => epoch.current !== ticket,
      });
      if (epoch.current === ticket) {
        printBuffer.current.push({ text: "  run finished", kind: "warn" });
        flushSoon();
      }
    } catch (e) {
      if (epoch.current !== ticket) return;
      const message = e instanceof Error ? e.message : String(e);
      if (e instanceof RunStopped) {
        printBuffer.current.push({ text: `  ${message}`, kind: "warn" });
        flushSoon();
      } else {
        setError(message);
      }
    } finally {
      if (epoch.current === ticket) setRunning(false);
    }
  }

  /** Rebuild the loaded package with a different danger threshold.
   *  This is a real recompile: the bytes change, so the stackId changes. */
  const retune = useCallback(
    async (value: number) => {
      const src = baseline.current;
      if (!src) return;
      setRetuning(true);
      try {
        const graph = {
          ...src.graph,
          nodes: src.graph.nodes.map((n) =>
            GATES.has(n.type) ? { ...n, params: { ...(n.params ?? {}), threshold: value } } : n,
          ),
        };
        const rebuilt = await buildStack(graph, async (key) => {
          const raw = src.modules[key];
          if (!raw) throw Error(`Module ${key} is not in this package.`);
          return raw;
        });
        const hash = await digest(canonical(rebuilt));
        setLoaded((old) => (old ? { ...old, pkg: rebuilt, hash } : old));
        reset();
        log(`$ recompiled with threshold ${value}`, "in");
        log(`  stackId  ${rebuilt.manifest.stackId}`, "warn");
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setRetuning(false);
      }
    },
    [log, reset],
  );

  function pickActor(id: string) {
    const next = actorById(id);
    setActor(next);
    setSpeed(next.speed.value);
    reset(next, next.speed.value);
  }

  const step = useCallback(
    async (count: number) => {
      if (!loaded || stepping.current || busy) return;
      stepping.current = true;
      const ticket = epoch.current;
      try {
        if (!vm.current) {
          const instance = await loadCompiledStack(loaded.pkg);
          if (ticket !== epoch.current) return;
          vm.current = instance;
          log(`$ node run.mjs   # ${actor.name}`, "in");
        }
        const began = performance.now();
        const pending: Line[] = [];
        const push = (text: string, kind: Line["kind"] = "out") => pending.push({ text, kind });
        let last: Inputs = {};
        let stepped = 0;

        for (let i = 0; i < count; i++) {
          const before = worldRef.current;
          if (before.speedMmps === 0 || before.collision || before.tick >= TICK_CEILING) {
            setRunning(false);
            if (announced.current) break;
            announced.current = true;
            push(
              before.collision
                ? "  collision — reached the obstruction"
                : before.retracting
                  ? `  returned · came within ${closestOf(actor, before).toFixed(2)} ${actor.gap.unit}`
                  : `  stopped with ${closestOf(actor, before).toFixed(2)} ${actor.gap.unit} to spare`,
              before.collision ? "warn" : "receipt",
            );
            break;
          }

          const result = await vm.current.step(saturate(condition(actor.sense(loaded.pkg, before), gain / 100)));
          if (ticket !== epoch.current) return;
          worldRef.current = actor.advance(before, result.actions);
          last = result.actions;
          stepped++;

          for (const e of result.events) {
            if (/OVERRIDE|TRIGGER|ACTUATOR|EMERGENCY/.test(e.type)) {
              push(`  [${String(result.tick).padStart(5)} ms] ${e.node} → ${e.type}`, "evt");
            }
          }
          if (before.brakeQ16 !== worldRef.current.brakeQ16) {
            push(
              `  [${String(worldRef.current.tick).padStart(5)} ms] brake ${Math.round(
                worldRef.current.brakeQ16 / 655.36,
              )}% · ${actor.gap.of(worldRef.current).toFixed(2)} ${actor.gap.unit} left`,
              "tick",
            );
          }
          if (!before.retracting && worldRef.current.retracting) push("  stopped — returning", "warn");
          if (result.replay) {
            setReplay(result.replay);
            push(`  receipt ${result.replay.receipt.hash}`, "receipt");
            if (!shelved.current) {
              shelved.current = result.replay.receipt.hash;
              void putReceipt(result.replay, "captured", loaded.pkg.manifest.name).catch(() => {
                shelved.current = "";
              });
            }
          }
        }

        if (stepped) {
          cost.current.ticks += stepped;
          cost.current.ms += performance.now() - began;
          setRate(cost.current.ms / cost.current.ticks);
          setActions(last);
        }
        if (pending.length) setLines((old) => [...old, ...pending].slice(-MAX_LINES));
        setRoad({ ...worldRef.current });
      } catch (e) {
        if (ticket === epoch.current) {
          setError(e instanceof Error ? e.message : String(e));
          setRunning(false);
        }
      } finally {
        stepping.current = false;
      }
    },
    [actor, busy, gain, loaded, log],
  );

  useEffect(() => {
    if (!running || edited) return;
    const timer = setInterval(() => void step(220), 30);
    return () => clearInterval(timer);
  }, [running, step, edited]);

  async function importFile(file?: File) {
    if (!file) return;
    if (file.size > 20_000_000) {
      setError("Package exceeds 20 MB.");
      return;
    }
    await load(await file.text(), file.name, "file");
  }

  const codeLines = source ? source.split("\n") : [];
  const blockNames = loaded ? Object.keys(loaded.pkg.lockfile) : [];
  const tunable = loaded ? loaded.pkg.graph.nodes.some((n) => GATES.has(n.type)) : false;
  const fit = loaded ? actorFit(loaded.pkg, actor) : null;
  const finished = road.speedMmps === 0 || road.collision;
  const Scene = SCENES[actor.id];

  return (
    <div className="clab">
      <header className="clab-head">
        <div>
          <p className="clab-eyebrow">Importable by design</p>
          <h1>Use a Stack from your own code</h1>
          <p className="clab-blurb">
            A compiled <code>.synapse</code> carries its own model bytes, schedule and digests. Import it, feed it the
            world, and the command it returns drives the body on the right. One obstruction, three machines — the same
            locked model in each.
          </p>
        </div>
        <div className="clab-head-actions">
          <label className="clab-import">
            <input
              type="file"
              accept=".synapse,application/json"
              disabled={busy}
              onChange={(e) => {
                void importFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <span>Import .synapse</span>
          </label>
          <Link href="/compose" className="clab-link">
            Open Compose →
          </Link>
        </div>
      </header>

      {error ? (
        <p role="alert" className="clab-error">
          {error}
          <button type="button" onClick={() => setError("")} aria-label="Dismiss">
            ×
          </button>
        </p>
      ) : null}

      <div className="clab-grid">
        {/* ── left: the code, and what it printed ── */}
        <section className="clab-left" aria-label="Code and console">
          <div className="clab-pane clab-code">
            <header className="clab-pane-head">
              <span className="clab-dots" aria-hidden="true">
                ● ● ●
              </span>
              <span className="clab-file">run.mjs</span>
              {edited ? <span className="clab-edited">edited</span> : null}
              <div className="clab-tools">
                <button
                  type="button"
                  className="clab-icon"
                  disabled={!source}
                  title={copied ? "Copied" : "Copy to clipboard"}
                  aria-label={copied ? "Copied" : "Copy to clipboard"}
                  onClick={() => {
                    void navigator.clipboard?.writeText(source).then(() => {
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1600);
                    });
                  }}
                >
                  {copied ? <span className="clab-icon-ok">✓</span> : <IconCopy size={14} />}
                </button>
                <button
                  type="button"
                  className="clab-icon"
                  disabled={!edited}
                  title="Revert to the generated code"
                  aria-label="Revert to the generated code"
                  onClick={() => {
                    setEdited(false);
                    setSource(generated);
                    reset();
                  }}
                >
                  <IconRefresh size={14} />
                </button>
              </div>
            </header>

            <div className="clab-code-body">
              {codeLines.length ? (
                <div className="clab-editor">
                  <div className="clab-gutter" aria-hidden="true">
                    {codeLines.map((_, i) => (
                      <span key={i}>{i + 1}</span>
                    ))}
                  </div>
                  <div className="clab-editor-inner">
                    <pre aria-hidden="true">
                      <code>
                        {codeLines.map((line, i) => (
                          <span className="clab-src" key={i}>
                            {highlight(line, blockNames).map((t, j) => (
                              <span key={j} className={`tk-${t.kind}`}>
                                {t.text}
                              </span>
                            ))}
                            {"\n"}
                          </span>
                        ))}
                      </code>
                    </pre>
                    <textarea
                      className="clab-input"
                      value={source}
                      spellCheck={false}
                      autoCapitalize="off"
                      autoCorrect="off"
                      aria-label="Editable run.mjs — this is the code that runs"
                      onChange={(e) => {
                        setSource(e.target.value);
                        setEdited(true);
                      }}
                      onKeyDown={(e) => {
                        if (e.key !== "Tab") return;
                        e.preventDefault();
                        const el = e.currentTarget;
                        const { selectionStart: a, selectionEnd: b } = el;
                        const next = `${source.slice(0, a)}  ${source.slice(b)}`;
                        setSource(next);
                        setEdited(true);
                        requestAnimationFrame(() => el.setSelectionRange(a + 2, a + 2));
                      }}
                    />
                  </div>
                </div>
              ) : (
                <p className="clab-muted">Import a compiled .synapse, or compile one in Compose, to see the code.</p>
              )}
            </div>

            <p className="clab-note">
              Editable — this buffer is what runs. Import paths are this repo&rsquo;s <code>lib/</code>; there is no
              published package yet, and the portable artifact is the <code>.synapse</code> file. The{" "}
              <code>import</code> lines are what a real file needs; here {INJECTED.join(", ")} are already in scope, and
              advancing the world paints the scene. Runs are capped at 30 s.
            </p>
          </div>

          <div className="clab-pane clab-console">
            <header className="clab-pane-head">
              <span className="clab-file">console</span>
              <span className="clab-tickcount">
                {(road.tick / 1000).toFixed(2)} s simulated
                {rate ? ` · ${rate.toFixed(2)} ms/tick to run the model` : ""}
              </span>
              <button type="button" className="clab-copy" onClick={() => setLines([])} disabled={!lines.length}>
                Clear
              </button>
            </header>
            <div className="clab-console-body" ref={consoleRef} role="log" aria-label="Console output">
              {lines.length ? (
                lines.map((l, i) => (
                  <div key={i} className={`clab-log is-${l.kind}`}>
                    {l.text}
                  </div>
                ))
              ) : (
                <p className="clab-muted">Nothing yet. Run it.</p>
              )}
            </div>
          </div>
        </section>

        {/* ── right: the body it drives ── */}
        <aside className="clab-right" aria-label="Simulation">
          <div className="clab-pane clab-worldpane">
            <header className="clab-pane-head">
              <span className="clab-file">environment</span>
              <span className="clab-tickcount">{loaded ? loaded.pkg.manifest.name : "no package"}</span>
            </header>

            {/* Compact body switch. */}
            <div className="clab-actors" role="tablist" aria-label="Body">
              {ACTORS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  role="tab"
                  aria-selected={a.id === actor.id}
                  className={a.id === actor.id ? "clab-actor is-on" : "clab-actor"}
                  onClick={() => pickActor(a.id)}
                >
                  <strong>{a.name}</strong>
                  <small>{a.actuator}</small>
                </button>
              ))}
            </div>

            <div className="clab-world">
              <Scene road={road} />
            </div>

            <dl className="clab-hud">
              <div>
                <dt>Speed</dt>
                <dd>
                  {actor.fromMmps(road.speedMmps)}
                  <small>{actor.speed.unit.trim()}</small>
                </dd>
              </div>
              <div>
                <dt>{actor.gap.label}</dt>
                <dd>
                  {road.obstacle ? actor.gap.of(road).toFixed(actor.gap.unit === "°" ? 1 : 2) : "—"}
                  <small>{actor.gap.unit}</small>
                </dd>
              </div>
              <div>
                <dt>Brake</dt>
                <dd className={road.brakeQ16 > 0 ? "is-live" : ""}>
                  {Math.round(road.brakeQ16 / 655.36)}
                  <small>%</small>
                </dd>
              </div>
              <div>
                <dt>Time</dt>
                <dd>
                  {(road.tick / 1000).toFixed(2)}
                  <small>s</small>
                </dd>
              </div>
            </dl>

            <div className="clab-setup">
              <p className="clab-actor-line">
                <b>{actor.blurb}</b>
                {actor.expect}
              </p>

              <label className="clab-knob">
                <span className="clab-knob-top">
                  {actor.speed.label}
                  <b>
                    {speed}
                    {actor.speed.unit}
                  </b>
                </span>
                <input
                  type="range"
                  min={actor.speed.min}
                  max={actor.speed.max}
                  step={actor.speed.step}
                  value={speed}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setSpeed(v);
                    reset(actor, v);
                  }}
                />
              </label>

              <label className="clab-knob">
                <span className="clab-knob-top">
                  Reaction margin
                  <b>{gain}% of true signal</b>
                </span>
                <input
                  type="range"
                  min={40}
                  max={200}
                  step={5}
                  value={gain}
                  disabled={running}
                  onChange={(e) => {
                    setGain(Number(e.target.value));
                    reset();
                  }}
                />
                <small>
                  Pre-gain on the vision channels. The reflex fires on the block&rsquo;s own neural trigger, which is
                  locked in the model bytes — so the way to make it commit sooner is to show it a stronger signal.
                  This is your integration code; the block&rsquo;s digest is unchanged.
                </small>
              </label>

              {tunable ? (
                <label className="clab-knob">
                  <span className="clab-knob-top">
                    Danger threshold
                    <b>
                      {(threshold / 65536).toFixed(2)}
                      {retuning ? " · rebuilding" : ""}
                    </b>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={131072}
                    step={1024}
                    value={threshold}
                    disabled={retuning || running}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setThreshold(v);
                      if (tuneTimer.current !== null) window.clearTimeout(tuneTimer.current);
                      tuneTimer.current = window.setTimeout(() => void retune(v), 320);
                    }}
                  />
                  <small>
                    A second, non-neural guard on the raw danger scalar. On this Stack the neural trigger fires
                    first, so moving this changes nothing you can see — it only bites on a block that does not
                    trigger. It lives in the Stack, so moving it recompiles the package and the stackId with it.
                  </small>
                </label>
              ) : null}

              {fit?.note ? <p className="clab-blind">{fit.note}</p> : null}

              <div className="clab-controls">
                <button
                  type="button"
                  className="clab-run"
                  disabled={!loaded || busy || (!edited && finished)}
                  onClick={() => {
                    if (!edited) return setRunning((v) => !v);
                    if (running) return reset();
                    void runCustom();
                  }}
                >
                  {running
                    ? edited
                      ? "Stop"
                      : "Pause"
                    : edited
                      ? "Run your code"
                      : finished
                        ? road.collision
                          ? "Collision"
                          : "Stopped"
                        : "Run"}
                </button>
                <button
                  type="button"
                  disabled={!loaded || busy || running || finished || edited}
                  onClick={() => void step(60)}
                >
                  Step
                </button>
                <button type="button" onClick={() => reset()} disabled={!loaded || busy}>
                  Reset
                </button>
              </div>

              <details className="clab-actions">
                <summary>Actuator output</summary>
                <pre>{Object.keys(actions).length ? JSON.stringify(actions, null, 2) : "nothing committed yet"}</pre>
              </details>

              {replay ? (
                <div className="clab-receipt">
                  <strong>Decision receipt captured</strong>
                  <Link href="/verify" className="clab-link">
                    Check it on the shelf →
                  </Link>
                </div>
              ) : null}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
