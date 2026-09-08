"use client";

/**
 * Typing terminal demo for the developers section —
 * one continuous session instead of static command categories.
 */
import { useEffect, useRef, useState } from "react";

type Line =
  | { kind: "cmd"; text: string }
  | { kind: "out"; text: string }
  | { kind: "blank" };

const SCRIPT: Line[] = [
  { kind: "cmd", text: "synapse pull synapsevm/loomguard@1.0" },
  { kind: "out", text: "resolved loomguard@1.0 · 142 KB · sha256:8f3a…" },
  { kind: "blank" },
  { kind: "cmd", text: "synapse compile biopilot.graph.json" },
  { kind: "out", text: "compiled NeuroStack · 3 modules · deterministic" },
  { kind: "blank" },
  { kind: "cmd", text: "synapse export biopilot.synapse --target wasm" },
  { kind: "out", text: "wrote biopilot.synapse · target=wasm" },
  { kind: "blank" },
  { kind: "cmd", text: 'python -c \'from synapsevm import Stack; Stack.load("biopilot.synapse").step(x)\'' },
  { kind: "out", text: "step ok · latency 0.8 ms · receipt written" },
  { kind: "blank" },
  { kind: "cmd", text: "synapse replay event.receipt --stack biopilot.synapse" },
  { kind: "out", text: "replay match · bit-identical · verified" },
];

const TYPE_MS = 22;
const PAUSE_AFTER_CMD = 380;
const PAUSE_AFTER_OUT = 520;
const HOLD_END = 2600;

export function DevTerminal() {
  const [lines, setLines] = useState<{ kind: "cmd" | "out"; text: string; done: boolean }[]>([]);
  const [typing, setTyping] = useState("");
  const [promptOn, setPromptOn] = useState(true);
  const [active, setActive] = useState(true);
  const wrap = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setActive(e.isIntersecting), { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let timer = 0;

    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        timer = window.setTimeout(resolve, ms);
      });

    const run = async () => {
      while (!cancelled) {
        setLines([]);
        setTyping("");
        setPromptOn(true);

        for (const step of SCRIPT) {
          if (cancelled) return;

          if (step.kind === "blank") {
            await wait(180);
            continue;
          }

          if (step.kind === "cmd") {
            setPromptOn(true);
            setTyping("");
            for (let i = 1; i <= step.text.length; i++) {
              if (cancelled) return;
              setTyping(step.text.slice(0, i));
              await wait(TYPE_MS + (Math.random() * 18) | 0);
            }
            setLines((prev) => [...prev, { kind: "cmd", text: step.text, done: true }]);
            setTyping("");
            await wait(PAUSE_AFTER_CMD);
            continue;
          }

          // output appears as a unit (feels like a process reply)
          setPromptOn(false);
          setLines((prev) => [...prev, { kind: "out", text: "", done: false }]);
          for (let i = 1; i <= step.text.length; i++) {
            if (cancelled) return;
            const slice = step.text.slice(0, i);
            setLines((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last?.kind === "out") next[next.length - 1] = { kind: "out", text: slice, done: false };
              return next;
            });
            await wait(10);
          }
          setLines((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last?.kind === "out") next[next.length - 1] = { ...last, done: true };
            return next;
          });
          setPromptOn(true);
          await wait(PAUSE_AFTER_OUT);
        }

        setTyping("");
        setPromptOn(true);
        await wait(HOLD_END);
      }
    };

    void run();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [active]);

  useEffect(() => {
    const el = body.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [lines, typing]);

  return (
    <div className="dev-term reveal" ref={wrap} aria-label="Synapse CLI session">
      <div className="dev-term-head">
        <div className="dev-term-dots" aria-hidden>
          <span />
          <span />
          <span />
        </div>
        <span className="dev-term-title">synapse — zsh</span>
        <span className="dev-term-meta">local · deterministic</span>
      </div>
      <div className="dev-term-body" ref={body}>
        {lines.map((l, i) =>
          l.kind === "cmd" ? (
            <div key={`c-${i}`} className="dev-term-line">
              <span className="tok-prompt">$ </span>
              <span>{l.text}</span>
            </div>
          ) : (
            <div key={`o-${i}`} className="dev-term-line dev-term-out">
              {l.text}
            </div>
          )
        )}
        {promptOn && (
          <div className="dev-term-line">
            <span className="tok-prompt">$ </span>
            <span>{typing}</span>
            <span className="dev-term-caret" aria-hidden />
          </div>
        )}
      </div>
    </div>
  );
}
