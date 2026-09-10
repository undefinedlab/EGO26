/**
 * NeuroLab surfaces — shared by the app header, landing page, and footer.
 */
export const NAV = [
  { href: "/explore", label: "Discover", blurb: "NeuroBlocks, provenance, roots" },
  { href: "/compose", label: "Compose", blurb: "Wire versioned pieces into a graph" },
  { href: "/compile", label: "Compile", blurb: "Check, lock and package the graph" },
  { href: "/simulate", label: "Simulate", blurb: "Run the compiled Stack and inspect decisions" },
  { href: "/verify", label: "Verify", blurb: "Replay a NeuroReceipt" },
] as const;
