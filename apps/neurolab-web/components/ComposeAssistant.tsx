"use client";

/**
 * Natural language in, a validated ComposeGraph out.
 *
 * The panel never builds a graph itself. It sends what the user typed to
 * /api/composer, which fills in a BuildSpec and hands it to the deterministic
 * planner; the planner runs `checkGraph` — the same compiler that guards
 * manual editing — before anything comes back. So the worst a model can do
 * here is describe the wrong machine, never wire an illegal one.
 *
 * The panel says which extractor answered. When no model is configured the
 * reply comes from vocabulary matching, and pretending otherwise would make
 * the assistant look cleverer than it is.
 */

import { useEffect, useRef, useState } from "react";
import type { ComposeGraph } from "@/lib/composeCompiler";
import { IconRefresh } from "@/components/icons";

type Choice = { label: string; value: string };
type Issue = { code: string; message: string };
type Step = { text: string; because: string; asked: boolean };

type Plan = {
  graph: ComposeGraph;
  steps: Step[];
  errors: Issue[];
  warnings: Issue[];
  blocked: Issue[];
  cautions: string[];
  refused: string[];
  executable: boolean;
  criticalPathMs: number;
};

type Turn = { role: "user" | "assistant"; text: string; choices?: Choice[]; plan?: Plan };

const OPENERS = [
  "I have a robot I want to improve with an SNN",
  "A delivery van that should brake when something looms",
  "A drone that keeps its autopilot but overrides on danger",
];

export function ComposeAssistant({
  onApply,
  variant = "panel",
}: {
  onApply: (graph: ComposeGraph) => void;
  variant?: "panel" | "dock";
}) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [spec, setSpec] = useState<unknown>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [source, setSource] = useState<"model" | "local" | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [expanded, setExpanded] = useState(false);
  const log = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const c = new AbortController();
    fetch("/api/composer", { signal: c.signal })
      .then((r) => r.json())
      .then((r) => setConfigured(Boolean(r.configured)))
      .catch(() => {});
    return () => c.abort();
  }, []);

  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight, behavior: "smooth" });
  }, [turns]);

  async function send(message: string) {
    const trimmed = message.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError("");
    setText("");
    setExpanded(true);
    setTurns((t) => [...t, { role: "user", text: trimmed }]);
    try {
      const res = await fetch("/api/composer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ spec, message: trimmed }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "The assistant could not answer.");
      const data = (await res.json()) as { source: "model" | "local"; spec: unknown; turn: Turn };
      setSpec(data.spec);
      setSource(data.source);
      setTurns((t) => [...t, data.turn]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function restart() {
    setTurns([]);
    setSpec(null);
    setError("");
    setText("");
    setExpanded(false);
  }

  const latestPlan = [...turns].reverse().find((t) => t.plan)?.plan;
  const dock = variant === "dock";
  const showThread = !dock || expanded || turns.length > 0;
  const canSend = Boolean(text.trim()) && !busy;

  if (dock) {
    return (
      <section
        className={`cmp-ai cmp-ai--dock${expanded || turns.length ? " is-open" : ""}`}
        aria-label="Describe what you want to build"
      >
        {showThread && turns.length > 0 ? (
          <div className="cmp-ai-thread" ref={log} role="log" aria-live="polite">
            <div className="cmp-ai-thread-spacer" aria-hidden />
            {turns.map((t, i) => (
              <div key={i} className={`cmp-ai-msg cmp-ai-msg--${t.role === "user" ? "user" : "assistant"}`}>
                <span className="cmp-ai-msg-label">{t.role === "user" ? "You" : "Composer"}</span>
                <p className="cmp-ai-msg-text">{t.text}</p>
                {t.choices && i === turns.length - 1 ? (
                  <div className="cmp-ai-choices">
                    {t.choices.map((c) => (
                      <button key={c.value} type="button" onClick={() => void send(c.label)} disabled={busy}>
                        {c.label}
                      </button>
                    ))}
                  </div>
                ) : null}
                {t.plan ? <PlanCard plan={t.plan} onApply={onApply} isLatest={t.plan === latestPlan} /> : null}
              </div>
            ))}
            {busy ? (
              <div className="cmp-ai-msg cmp-ai-msg--assistant cmp-ai-msg--typing">
                <span className="cmp-ai-msg-label">Composer</span>
                <p className="cmp-ai-msg-text">Thinking…</p>
              </div>
            ) : null}
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="cmp-ai-error">
            {error}
          </p>
        ) : null}

        <div className="cmp-ai-prompt-dock">
          {!turns.length ? (
            <div className="cmp-ai-marquee" role="region" aria-label="Suggested prompts">
              <div className="cmp-ai-marquee-track">
                {[0, 1].map((copy) => (
                  <div key={copy} className="cmp-ai-marquee-strip" aria-hidden={copy === 1}>
                    {OPENERS.map((o) => (
                      <button
                        key={`${copy}-${o}`}
                        type="button"
                        className="cmp-ai-marquee-chip"
                        disabled={busy}
                        onClick={() => void send(o)}
                      >
                        {o.length > 42 ? `${o.slice(0, 40)}…` : o}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="cmp-ai-input-row">
            <form
              className="cmp-ai-composer"
              onSubmit={(e) => {
                e.preventDefault();
                void send(text);
              }}
            >
              <div className="cmp-ai-field">
                <label className="sr-only" htmlFor="cmp-ai-input">
                  Describe what you want to build
                </label>
                <input
                  id="cmp-ai-input"
                  className="cmp-ai-input"
                  value={text}
                  placeholder={turns.length ? "Add a detail…" : "Describe a neural reflex to compose…"}
                  onChange={(e) => setText(e.target.value)}
                  onFocus={() => setExpanded(true)}
                  disabled={busy}
                />
              </div>
              {turns.length > 0 ? (
                <button
                  type="button"
                  className="cmp-ai-reset"
                  onClick={restart}
                  disabled={busy}
                  title="Reset chat"
                  aria-label="Reset chat"
                >
                  <IconRefresh size={15} />
                </button>
              ) : null}
              <button
                type="submit"
                className="cmp-ai-submit"
                disabled={!canSend}
                title={busy ? "Sending…" : "Send"}
                aria-label={busy ? "Sending…" : "Send"}
              >
                {busy ? "…" : "↑"}
              </button>
            </form>
          </div>
          <p className="cmp-ai-disclaimer">
            {configured
              ? "AI can make mistakes. Review the synthesised graph before compile."
              : "Local extractor — plain words work best. Review before compile."}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="cmp-ai" aria-label="Describe what you want to build">
      <header className="cmp-ai-head">
        <h3>Describe it instead</h3>
        <p>
          Say what the machine is and what it should do. The wiring is synthesised deterministically and checked by the
          compiler before it reaches the canvas.
        </p>
        {configured !== null && (
          <p className={configured ? "cmp-ai-badge" : "cmp-ai-badge weak"}>
            {configured
              ? "A language model is configured for reading your description."
              : "No model configured — replies come from vocabulary matching, so plain words work best."}
          </p>
        )}
      </header>

      {!turns.length && (
        <ul className="cmp-ai-openers">
          {OPENERS.map((o) => (
            <li key={o}>
              <button type="button" onClick={() => void send(o)} disabled={busy}>
                {o}
              </button>
            </li>
          ))}
        </ul>
      )}

      {turns.length > 0 && (
        <div className="cmp-ai-log" ref={log} role="log" aria-live="polite">
          {turns.map((t, i) => (
            <div key={i} className={t.role === "user" ? "cmp-ai-turn user" : "cmp-ai-turn bot"}>
              <p>{t.text}</p>

              {t.choices && i === turns.length - 1 && (
                <div className="cmp-ai-choices">
                  {t.choices.map((c) => (
                    <button key={c.value} type="button" onClick={() => void send(c.label)} disabled={busy}>
                      {c.label}
                    </button>
                  ))}
                </div>
              )}

              {t.plan && <PlanCard plan={t.plan} onApply={onApply} isLatest={t.plan === latestPlan} />}
            </div>
          ))}
        </div>
      )}

      {error && (
        <p role="alert" className="cmp-ai-error">
          {error}
        </p>
      )}

      <div className="cmp-ai-form-wrap">
        <form
          className="cmp-ai-form"
          onSubmit={(e) => {
            e.preventDefault();
            void send(text);
          }}
        >
          <label className="sr-only" htmlFor="cmp-ai-input-panel">
            Describe what you want to build
          </label>
          <input
            id="cmp-ai-input-panel"
            value={text}
            placeholder={turns.length ? "Add a detail…" : "I have a rover that should stop before hitting things…"}
            onChange={(e) => setText(e.target.value)}
            disabled={busy}
          />
          <button type="submit" disabled={busy || !text.trim()}>
            {busy ? "Thinking…" : "Send"}
          </button>
          {turns.length > 0 && (
            <button type="button" className="cmp-ai-restart" onClick={restart} disabled={busy}>
              Start over
            </button>
          )}
        </form>
      </div>

      {source ? (
        <p className="cmp-ai-source">Answered by the {source === "model" ? "configured model" : "local extractor"}.</p>
      ) : null}
    </section>
  );
}

function PlanCard({ plan, onApply, isLatest }: { plan: Plan; onApply: (g: ComposeGraph) => void; isLatest: boolean }) {
  const [open, setOpen] = useState(false);
  const chain = plan.graph.nodes.map((n) => n.id);

  return (
    <div className={plan.errors.length ? "cmp-ai-plan bad" : "cmp-ai-plan"}>
      <ol className="cmp-ai-chain">
        {chain.map((id) => (
          <li key={id}>{id}</li>
        ))}
      </ol>

      <p className="cmp-ai-meta">
        {plan.graph.nodes.length} nodes · {plan.graph.edges.length} connections · {plan.criticalPathMs} ms path ·{" "}
        <span className={plan.executable ? "good" : "cmp-warning"}>{plan.executable ? "executable" : "not executable"}</span>
      </p>

      {plan.errors.length > 0 && (
        <ul className="cmp-ai-issues bad">
          {plan.errors.map((e, i) => (
            <li key={i}>{e.message}</li>
          ))}
        </ul>
      )}

      {plan.cautions.map((c, i) => (
        <p key={i} className="cmp-ai-caution">
          {c}
        </p>
      ))}

      <button type="button" className="cmp-ai-toggle" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {open ? "Hide reasoning" : "Why these blocks?"}
      </button>

      {open && (
        <ul className="cmp-ai-steps">
          {plan.steps.map((s, i) => (
            <li key={i}>
              <b>{s.text}</b>
              <span className={s.asked ? "cmp-ai-tag asked" : "cmp-ai-tag forced"}>
                {s.asked ? "you asked" : "required"}
              </span>
              <em>{s.because}</em>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        className="cmp-ai-apply"
        disabled={plan.errors.length > 0 || !isLatest}
        onClick={() => onApply(plan.graph)}
      >
        {plan.errors.length ? "Cannot place — it does not compile" : "Place on canvas"}
      </button>
    </div>
  );
}
