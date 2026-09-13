import type { Metadata } from "next";
import Link from "next/link";
import { DocsNav } from "@/components/site/DocsNav";
import { SiteFrame } from "@/components/site/SiteFrame";
import { DOC_PAGES } from "@/lib/docsContent";

export const metadata: Metadata = {
  title: "Docs",
  description: "SynapseVM NeuroLab documentation — platform architecture, Compose, Simulate, runtime, receipts, and verification.",
};

export default function DocsIndexPage() {
  return (
    <SiteFrame>
      <main id="main" className="site-main">
        <header className="site-head">
          <p className="kicker">Documentation</p>
          <h1>NeuroLab docs</h1>
          <p className="t-lead">
            How SynapseVM works end-to-end: blocks, stacks, compose, simulate,
            runtime ticks, receipts, and verification — with process diagrams.
          </p>
        </header>

        <div className="docs-layout">
          <DocsNav />
          <div className="docs-index-grid">
            {DOC_PAGES.map((page) => (
              <Link key={page.slug} href={`/docs/${page.slug}`} className="docs-card">
                <span className="kicker">{page.nav}</span>
                <strong>{page.title}</strong>
                <p>{page.summary}</p>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </SiteFrame>
  );
}
