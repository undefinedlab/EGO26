/**
 * NeuroLab surfaces — shared by the app header, landing page, and footer.
 * Simulate lives under Verify (`SIMULATE_HREF`), not as a top-level nav item.
 */
export const NAV = [
  { href: "/explore", label: "Discover", blurb: "NeuroBlocks, provenance, roots" },
  { href: "/compose", label: "Compose", blurb: "Wire, check, lock and package a graph" },
  { href: "/verify", label: "Verify", blurb: "Replay a NeuroReceipt · simulate the Stack" },
] as const;

/** Landing / site chrome — Contact, Terms, Docs. No URL item. */
export const SITE_LINKS = [
  { href: "/contact", label: "Contact" },
  { href: "/terms", label: "Terms" },
  { href: "/docs", label: "Docs" },
] as const;

export const SIMULATE_HREF = "/verify/simulate";
