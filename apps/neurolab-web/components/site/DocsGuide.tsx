"use client";

import { useState } from "react";

const SECTIONS = [
  {
    id: "overview",
    label: "Overview",
    kicker: "NeuroLab",
    title: "Compose, simulate, verify",
    body: [
      "SynapseVM NeuroLab is a local workbench for neural controllers. You wire NeuroBlocks into a Stack, run the same graph live, then replay the critical path with a receipt.",
      "These pages are a mock of the docs surface — enough structure to read the loop, not a full documentation platform.",
    ],
    soon: "Search, versioned API references, and export-target cookbooks are not written yet.",
  },
  {
    id: "compose",
    label: "Compose",
    kicker: "Workbench",
    title: "Wire a typed graph",
    body: [
      "Compose is where sensors, NeuroBlocks, and actuators become one portable Stack. Interfaces stay explicit: if a channel does not match, the graph does not lock.",
      "A typical pass: pick versioned blocks from Discover, place them on the canvas, check the graph, then lock modules so the package is deterministic.",
    ],
    soon: "Block authoring, custom interface schemas, and a shared template gallery are coming soon.",
  },
  {
    id: "simulate",
    label: "Simulate",
    kicker: "Live loop",
    title: "Run the exact Stack",
    body: [
      "Simulate sits under Verify. It runs the locked Stack in one loop so signal flow matches what you packaged — not a separate notebook copy.",
      "Use it to watch channels, step a case, and confirm the controller behaves before you ask for a receipt.",
    ],
    soon: "Multi-agent scenes, hardware-in-the-loop fixtures, and recorded scenario packs are coming soon.",
  },
  {
    id: "verify",
    label: "Verify",
    kicker: "Receipts",
    title: "Replay what happened",
    body: [
      "Verify replays a NeuroReceipt against the Stack that produced it. The claim is narrow: this action, this graph, this locked set of modules.",
      "Independent of the author — anyone with the package and the receipt should be able to replay the critical path.",
    ],
    soon: "Public receipt explorers, third-party attesters, and CI replay recipes are coming soon.",
  },
] as const;

export function DocsGuide() {
  const [active, setActive] = useState<(typeof SECTIONS)[number]["id"]>("overview");
  const section = SECTIONS.find((s) => s.id === active) ?? SECTIONS[0];

  return (
    <div className="docs-layout">
      <nav className="docs-nav" aria-label="Docs sections">
        <p className="kicker">Guide</p>
        <ul>
          {SECTIONS.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className="docs-nav-btn"
                data-active={item.id === active ? "true" : "false"}
                aria-current={item.id === active ? "true" : undefined}
                onClick={() => setActive(item.id)}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <article className="site-panel docs-article">
        <p className="kicker">{section.kicker}</p>
        <h2>{section.title}</h2>
        {section.body.map((para) => (
          <p key={para}>{para}</p>
        ))}
        <aside className="docs-soon">
          <p className="kicker">Coming soon</p>
          <p>{section.soon}</p>
        </aside>
      </article>
    </div>
  );
}
