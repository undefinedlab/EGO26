"use client";

/**
 * Stepped Add menu — Siphon BuildNav pattern:
 * categories → leaf nodes, with search across the full DEFINITIONS set.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { DEFINITIONS } from "@/lib/composeCompiler";

const FAMILIES = [
  { id: "sensor", label: "Sensors" },
  { id: "adapter", label: "Adapters" },
  { id: "neuroblock", label: "NeuroBlocks" },
  { id: "control", label: "Control" },
  { id: "state", label: "State" },
  { id: "actuator", label: "Actuators" },
] as const;

type FamilyId = (typeof FAMILIES)[number]["id"];

type MenuState =
  | { step: "closed" }
  | { step: "categories" }
  | { step: "category"; family: FamilyId };

const ALL_BLOCKS = Object.entries(DEFINITIONS);

export function ComposeAddMenu({
  onAdd,
  templates,
  onTemplate,
  embedded = false,
}: {
  onAdd: (type: string) => void;
  templates?: { value: string; label: string }[];
  onTemplate?: (value: string) => void;
  /** Render only the Add control (for embedding in ComposeCompileBar). */
  embedded?: boolean;
}) {
  const [menu, setMenu] = useState<MenuState>({ step: "closed" });
  const [query, setQuery] = useState("");
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (menu.step === "closed") return;
    const onPtr = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setMenu({ step: "closed" });
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu({ step: "closed" });
    };
    window.addEventListener("pointerdown", onPtr);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPtr);
      window.removeEventListener("keydown", onKey);
    };
  }, [menu.step]);

  useEffect(() => {
    if (menu.step === "closed") setQuery("");
  }, [menu.step]);

  const open = menu.step !== "closed";
  const q = query.trim().toLowerCase();

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const [, d] of ALL_BLOCKS) map[d.family] = (map[d.family] ?? 0) + 1;
    return map;
  }, []);

  const items = useMemo(() => {
    if (menu.step === "closed") return [];
    if (q) {
      return ALL_BLOCKS.filter(
        ([name, d]) =>
          name.toLowerCase().includes(q) ||
          d.description.toLowerCase().includes(q) ||
          d.family.toLowerCase().includes(q),
      );
    }
    if (menu.step === "category") {
      return ALL_BLOCKS.filter(([, d]) => d.family === menu.family);
    }
    return [];
  }, [menu, q]);

  function pick(type: string) {
    onAdd(type);
    setMenu({ step: "closed" });
  }

  const addControl = (
        <div className="cmp-add-anchor">
          <button
            type="button"
            className={`cmp-add-trigger${open ? " is-open" : ""}`}
            aria-expanded={open}
            aria-haspopup="menu"
            onClick={() =>
              setMenu((m) => (m.step === "closed" ? { step: "categories" } : { step: "closed" }))
            }
          >
            <span aria-hidden>+</span>
            Add
            <em className="cmp-add-count">{ALL_BLOCKS.length}</em>
          </button>

          {open ? (
            <div className="cmp-add-menu" role="menu" aria-label="Add building block">
              <div className="cmp-add-menu-head">
                {menu.step === "category" && !q ? (
                  <button
                    type="button"
                    className="cmp-add-back"
                    onClick={() => setMenu({ step: "categories" })}
                  >
                    ← Back
                  </button>
                ) : null}
                <span>
                  {q
                    ? `Search · ${items.length}`
                    : menu.step === "categories"
                      ? `Add element · ${ALL_BLOCKS.length}`
                      : FAMILIES.find((f) => f.id === (menu as { family: FamilyId }).family)?.label}
                </span>
              </div>

              <label className="cmp-add-search">
                <span className="sr-only">Search blocks</span>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search all blocks…"
                  autoFocus
                />
              </label>

              {!q && menu.step === "categories"
                ? FAMILIES.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      role="menuitem"
                      className={`cmp-add-item family-${f.id}`}
                      onClick={() => setMenu({ step: "category", family: f.id })}
                    >
                      <i className="cmp-add-dot" aria-hidden />
                      <span>{f.label}</span>
                      <em className="cmp-add-count">{counts[f.id] ?? 0}</em>
                      <b>→</b>
                    </button>
                  ))
                : null}

              {(q || menu.step === "category") &&
                (items.length ? (
                  items.map(([type, d]) => (
                    <button
                      key={type}
                      type="button"
                      role="menuitem"
                      className={`cmp-add-item family-${d.family}`}
                      title={d.description}
                      onClick={() => pick(type)}
                    >
                      <i className="cmp-add-dot" aria-hidden />
                      <span className="cmp-add-item-label">
                        <strong>{type}</strong>
                        <small>
                          {d.family}
                          {d.unsupported ? " · source" : ""} — {d.description}
                        </small>
                      </span>
                    </button>
                  ))
                ) : (
                  <p className="cmp-add-empty">No blocks match.</p>
                ))}
            </div>
          ) : null}
        </div>
  );

  if (embedded) {
    return (
      <div className="cmp-add-embedded" ref={root}>
        {addControl}
      </div>
    );
  }

  return (
    <div className="cmp-float-bar" ref={root}>
      <div className="cmp-float-bar-inner">
        {templates && onTemplate ? (
          <label className="cmp-float-template">
            <span className="sr-only">Template</span>
            <select
              aria-label="Start from template"
              defaultValue="shield"
              onChange={(e) => onTemplate(e.target.value)}
            >
              {templates.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {templates && onTemplate ? <span className="cmp-float-sep" aria-hidden /> : null}

        {addControl}
      </div>
    </div>
  );
}
