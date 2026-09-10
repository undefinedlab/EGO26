import type { Metadata } from "next";
import { DocsGuide } from "@/components/site/DocsGuide";
import { SiteFrame } from "@/components/site/SiteFrame";

export const metadata: Metadata = { title: "Docs" };

export default function DocsPage() {
  return (
    <SiteFrame>
      <main id="main" className="site-main">
        <header className="site-head">
          <p className="kicker">
            Mock page <span className="site-badge">Guide sketch</span>
          </p>
          <h1>Docs</h1>
          <p className="t-lead">
            A short map of Compose, Simulate, and Verify. Depth is marked
            Coming soon — this is not a full docs platform.
          </p>
        </header>

        <DocsGuide />
      </main>
    </SiteFrame>
  );
}
