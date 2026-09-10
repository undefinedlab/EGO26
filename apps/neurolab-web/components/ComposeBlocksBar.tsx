"use client";

/**
 * Blocks bar — Siphon-style floating glass rail over the canvas.
 *
 * Replaces the old light sidebar, which duplicated the top Add menu and was
 * the last surface still wearing the page theme inside a dark chrome.
 *
 * Two things it does that a plain list did not: it carries each block's typed
 * ports, so you can see what will connect before you drop it, and it marks the
 * blocks whose declared interface the bundled model does not implement. Those
 * compile and then refuse to run, so hiding that until compile time would be
 * the wrong kind of tidy.
 */

import { useMemo, useState } from "react";
import { DEFINITIONS } from "@/lib/composeCompiler";

export type DropPoint = { x: number; y: number };

const FAMILIES: { id: string; label: string }[] = [
  { id: "sensor", label: "Sensors" },
  { id: "adapter", label: "Adapters" },
  { id: "neuroblock", label: "Neuroblocks" },
  { id: "control", label: "Control" },
  { id: "state", label: "State" },
  { id: "actuator", label: "Actuators" },
];

export const NODE_DRAG_TYPE = "application/x-synapsevm-node";

export function ComposeBlocksBar({ onAdd }: { onAdd: (type: string, at?: DropPoint) => void }) {
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const [closed, setClosed] = useState<Record<string, boolean>>({});

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    return FAMILIES.map((f) => ({
      ...f,
      items: Object.entries(DEFINITIONS)
        .filter(([name, d]) => d.family === f.id)
        .filter(([name, d]) => !q || (name + " " + d.description).toLowerCase().includes(q))
        .map(([type, d]) => ({ type, def: d })),
    })).filter((g) => g.items.length > 0);
  }, [search]);

  const total = groups.reduce((n, g) => n + g.items.length, 0);

  if (collapsed) {
    return (
      <div className="cmp-blocks cmp-blocks--collapsed">
        <button
          type="button"
          className="cmp-blocks-reopen"
          onClick={() => setCollapsed(false)}
          aria-expanded={false}
          title="Show blocks"
        >
          <span className="cmp-blocks-reopen-glyph" aria-hidden="true">
            ▤
          </span>
          <span className="cmp-blocks-reopen-text">Blocks</span>
        </button>
      </div>
    );
  }

  return (
    <aside className="cmp-blocks" aria-label="Building blocks">
      <header className="cmp-blocks-head">
        <div className="cmp-blocks-title">
          <span className="cmp-blocks-eyebrow">Blocks</span>
          <span className="cmp-blocks-count">{total}</span>
        </div>
        <button
          type="button"
          className="cmp-blocks-collapse"
          onClick={() => setCollapsed(true)}
          aria-expanded
          title="Hide blocks"
          aria-label="Hide blocks"
        >
          ×
        </button>
      </header>

      <div className="cmp-blocks-search">
        <label className="sr-only" htmlFor="cmp-blocks-search">
          Search blocks
        </label>
        <input
          id="cmp-blocks-search"
          value={search}
          placeholder="Find a block…"
          onChange={(e) => setSearch(e.target.value)}
        />
        {search ? (
          <button type="button" onClick={() => setSearch("")} aria-label="Clear search">
            ×
          </button>
        ) : null}
      </div>

      <div className="cmp-blocks-scroll">
        {groups.map((g) => {
          const open = !closed[g.id];
          return (
            <section key={g.id} className={`cmp-blocks-group family-${g.id}`}>
              <button
                type="button"
                className="cmp-blocks-group-head"
                aria-expanded={open}
                onClick={() => setClosed((c) => ({ ...c, [g.id]: open }))}
              >
                <i className="cmp-blocks-dot" aria-hidden="true" />
                <span>{g.label}</span>
                <b>{g.items.length}</b>
                <span className="cmp-blocks-chev" aria-hidden="true">
                  {open ? "−" : "+"}
                </span>
              </button>

              {open ? (
                <ul className="cmp-blocks-list">
                  {g.items.map(({ type, def }) => {
                    const ins = Object.values(def.inputs) as string[];
                    const outs = Object.values(def.outputs) as string[];
                    return (
                      <li key={type}>
                        <button
                          type="button"
                          className={`cmp-blocks-item${def.unsupported ? " is-blocked" : ""}`}
                          title={def.description}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData(NODE_DRAG_TYPE, type);
                            e.dataTransfer.setData("text/plain", type);
                            e.dataTransfer.effectAllowed = "copy";
                          }}
                          onClick={() => onAdd(type)}
                        >
                          <span className="cmp-blocks-item-top">
                            <strong>{type}</strong>
                            {def.module ? <em className="cmp-blocks-tag neural">neural</em> : null}
                            {def.stateful && !def.module ? <em className="cmp-blocks-tag">stateful</em> : null}
                            {def.unsupported ? (
                              <em className="cmp-blocks-tag blocked" title={def.unsupported}>
                                won&rsquo;t run
                              </em>
                            ) : null}
                          </span>
                          <span className="cmp-blocks-ports">
                            <span className="cmp-blocks-io">
                              <i aria-hidden="true">in</i>
                              {ins.length ? ins.join(" · ") : "—"}
                            </span>
                            <span className="cmp-blocks-io">
                              <i aria-hidden="true">out</i>
                              {outs.length ? outs.join(" · ") : "—"}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </section>
          );
        })}

        {!groups.length ? <p className="cmp-blocks-empty">No block matches “{search}”.</p> : null}
      </div>

      <p className="cmp-blocks-hint">Drag onto the canvas, or click to drop one in the middle.</p>
    </aside>
  );
}
