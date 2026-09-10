"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MOTIFS, type MotifDef } from "@/lib/motifAtlas";
import {
  DEFAULT_PARAMS,
  initState,
  inputNodes,
  outputNodes,
  pushRaster,
  step,
  type Drive,
  type MotifParams,
  type MotifState,
  type RasterRow,
} from "@/lib/motifSim";
import { MotifDiagram } from "./MotifDiagram";

const RASTER_WIDTH = 64;

/**
 * Runs a motif directly. Nothing is imported and nothing is compiled — the
 * graph ships complete, so the only thing between the library and a running
 * simulation is pressing play.
 */
export function MotifLab() {
  const [slug, setSlug] = useState(MOTIFS[0].slug);
  const motif = useMemo(() => MOTIFS.find((m) => m.slug === slug) ?? MOTIFS[0], [slug]);

  const [running, setRunning] = useState(true);
  const [rate, setRate] = useState(6);
  const [params, setParams] = useState<MotifParams>(DEFAULT_PARAMS);
  const [drive, setDrive] = useState<Drive>({});
  const [state, setState] = useState<MotifState>(() => initState(motif));
  const [raster, setRaster] = useState<RasterRow[]>([]);

  const inputs = useMemo(() => inputNodes(motif), [motif]);
  const outputs = useMemo(() => outputNodes(motif), [motif]);

  // Every input is driven by default, so a motif does something immediately.
  const reset = useCallback(() => {
    setState(initState(motif));
    setRaster([]);
    setDrive(Object.fromEntries(inputNodes(motif).map((n) => [n.id, true])));
  }, [motif]);

  useEffect(reset, [reset]);

  const driveRef = useRef(drive);
  driveRef.current = drive;
  const paramsRef = useRef(params);
  paramsRef.current = params;

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setState((prev) => {
        const next = step(motif, prev, driveRef.current, paramsRef.current);
        setRaster((rows) => pushRaster(rows, motif, next, RASTER_WIDTH));
        return next;
      });
    }, Math.round(1000 / rate));
    return () => window.clearInterval(id);
  }, [running, rate, motif]);

  const single = () => {
    setState((prev) => {
      const next = step(motif, prev, driveRef.current, paramsRef.current);
      setRaster((rows) => pushRaster(rows, motif, next, RASTER_WIDTH));
      return next;
    });
  };

  const firingNow = motif.nodes.filter((n) => state.fired[n.id]).length;
  const outputFired = outputs.some((n) => state.fired[n.id]);

  return (
    <div className="motif-lab">
      <aside className="motif-picker" aria-label="Motifs">
        <div className="simlab-section-label">
          <span className="why-kicker">Motif</span>
          <span className="mono muted">{MOTIFS.length} complete</span>
        </div>
        <div className="motif-picker-list">
          {MOTIFS.map((m) => (
            <button
              key={m.slug}
              type="button"
              className={m.slug === slug ? "motif-pick active" : "motif-pick"}
              aria-pressed={m.slug === slug}
              onClick={() => setSlug(m.slug)}
            >
              <span className="motif-pick-name">{m.name}</span>
              <span className="motif-pick-analogue">{m.analogue.split(" / ")[0]}</span>
              <span className="mono motif-pick-size">
                {m.nodes.length}n · {m.edges.length}e
              </span>
            </button>
          ))}
        </div>
      </aside>

      <div className="motif-stage-wrap">
        <div className="simlab-action-bar">
          <button
            type="button"
            className="sim-action icon-btn"
            data-primary={running ? undefined : "1"}
            onClick={() => setRunning((v) => !v)}
          >
            {running ? "Pause" : "Play"}
          </button>
          <button type="button" className="sim-action icon-btn" onClick={single} disabled={running}>
            Step
          </button>
          <button type="button" className="sim-action icon-btn" onClick={reset}>
            Reset
          </button>
          <span className="motif-tickcount mono">tick {state.tick}</span>
          <span className={outputFired ? "motif-out fired" : "motif-out"}>
            <span className="dot" aria-hidden />
            {outputFired ? "OUTPUT SPIKE" : "output quiet"}
          </span>
        </div>

        <div className="motif-provenance">
          <span className="simlab-provenance-label">Running</span>
          <ol className="simlab-chain">
            <li className="is-self">
              <Link href={"/explore/motifs/" + motif.slug}>{motif.name}</Link>
            </li>
            {motif.appearsIn.slice(0, 2).map((a) => (
              <li key={a.circuit} className="is-attributed">
                <Link href={"/explore/circuits/" + a.circuit} title={a.note}>
                  {a.circuit.replace(/-/g, " ")}
                </Link>
              </li>
            ))}
          </ol>
        </div>

        <div className="motif-stage">
          <MotifDiagram motif={motif} state={state} />
        </div>

        <div className="motif-readout">
          <p className="motif-computes">{motif.computes}</p>
          <div className="motif-raster" aria-label="Spike raster">
            {raster.map((row) => (
              <div key={row.id} className={"motif-raster-row kind-" + row.kind}>
                <span className="motif-raster-label mono">{row.label || row.id}</span>
                <div className="motif-raster-track">
                  {row.spikes.map((sp, i) => (
                    <i key={i} className={sp ? "on" : ""} />
                  ))}
                </div>
              </div>
            ))}
            {!raster.length && <p className="muted t-xs">Press play to record spikes.</p>}
          </div>
        </div>
      </div>

      <aside className="motif-controls" aria-label="Stimulus and parameters">
        <div className="simlab-section-label">
          <span className="why-kicker">Stimulus</span>
          <span className="mono muted">{firingNow} firing</span>
        </div>

        <div className="motif-drives">
          {inputs.length === 0 && <p className="muted t-xs">This motif has no external input.</p>}
          {inputs.map((n) => (
            <label key={n.id} className="motif-drive">
              <input
                type="checkbox"
                checked={Boolean(drive[n.id])}
                onChange={(e) => setDrive((d) => ({ ...d, [n.id]: e.target.checked }))}
              />
              Drive {n.label || n.id}
            </label>
          ))}
        </div>

        <label className="simlab-setting">
          <span>
            Tick rate<b>{rate}/s</b>
          </span>
          <input type="range" min={1} max={20} step={1} value={rate} onChange={(e) => setRate(Number(e.target.value))} />
        </label>

        <label className="simlab-setting">
          <span>
            Drive probability<b>{params.driveRate.toFixed(2)}</b>
          </span>
          <input
            type="range"
            min={0.1}
            max={1}
            step={0.05}
            value={params.driveRate}
            onChange={(e) => setParams((p) => ({ ...p, driveRate: Number(e.target.value) }))}
          />
          <small>How often a driven input actually fires.</small>
        </label>

        <div className="simlab-section-label" style={{ marginTop: "var(--sp-2)" }}>
          <span className="why-kicker">Neuron model</span>
          <button
            type="button"
            className="simlab-reset-settings"
            onClick={() => setParams(DEFAULT_PARAMS)}
            disabled={JSON.stringify(params) === JSON.stringify(DEFAULT_PARAMS)}
          >
            Reset
          </button>
        </div>

        <label className="simlab-setting">
          <span>
            Excitation<b>{params.excite.toFixed(2)}</b>
          </span>
          <input
            type="range"
            min={0.1}
            max={1.2}
            step={0.02}
            value={params.excite}
            onChange={(e) => setParams((p) => ({ ...p, excite: Number(e.target.value) }))}
          />
        </label>

        <label className="simlab-setting">
          <span>
            Inhibition<b>{params.inhibit.toFixed(2)}</b>
          </span>
          <input
            type="range"
            min={0}
            max={2}
            step={0.05}
            value={params.inhibit}
            onChange={(e) => setParams((p) => ({ ...p, inhibit: Number(e.target.value) }))}
          />
          <small>Drop this to zero and a gating motif stops gating.</small>
        </label>

        <label className="simlab-setting">
          <span>
            Leak<b>{params.leak.toFixed(2)}</b>
          </span>
          <input
            type="range"
            min={0.4}
            max={0.98}
            step={0.01}
            value={params.leak}
            onChange={(e) => setParams((p) => ({ ...p, leak: Number(e.target.value) }))}
          />
        </label>

        <label className="simlab-setting">
          <span>
            Adaptation<b>{params.adaptation.toFixed(2)}</b>
          </span>
          <input
            type="range"
            min={0}
            max={1.2}
            step={0.05}
            value={params.adaptation}
            onChange={(e) => setParams((p) => ({ ...p, adaptation: Number(e.target.value) }))}
          />
          <small>Fatigue after firing. Without it the oscillator picks a winner and stays there.</small>
        </label>

        <p className="motif-caveat">
          A legible LIF model, not the Q16.16 runtime. Deriving a Block from a motif still goes
          through the compiler.
        </p>
      </aside>
    </div>
  );
}

export function motifBySlug(slug: string): MotifDef | undefined {
  return MOTIFS.find((m) => m.slug === slug);
}
