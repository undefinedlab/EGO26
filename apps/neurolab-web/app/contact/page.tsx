import type { Metadata } from "next";
import { ContactForm } from "@/components/site/ContactForm";
import { SiteFrame } from "@/components/site/SiteFrame";

export const metadata: Metadata = {
  title: "Contact",
  description: "Reach the SynapseVM NeuroLab team about the workbench, verification, or partnerships.",
};

export default function ContactPage() {
  return (
    <SiteFrame>
      <main id="main" className="site-main">
        <header className="site-head">
          <p className="kicker">Contact</p>
          <h1>Talk to the team</h1>
          <p className="t-lead">
            Questions about Compose, Verify, partner integrations, or research
            collaboration. We reply by email — usually within two business days.
          </p>
        </header>

        <div className="contact-grid">
          <section className="site-panel" aria-labelledby="contact-form-title">
            <h2 id="contact-form-title" className="site-panel-title">
              Write in
            </h2>
            <ContactForm />
          </section>

          <aside className="site-panel site-aside" aria-labelledby="contact-office-title">
            <h2 id="contact-office-title" className="site-panel-title">
              Where to start
            </h2>
            <p className="muted">
              Prefer self-serve first? Open Discover for NeuroBlocks, Compose for
              an empty canvas, or Docs for the verification model.
            </p>
            <dl className="site-dl">
              <div>
                <dt>Product</dt>
                <dd>SynapseVM NeuroLab — local-first neural control workbench</dd>
              </div>
              <div>
                <dt>Response</dt>
                <dd>Weekdays · aim ≤ 2 business days</dd>
              </div>
              <div>
                <dt>Topics we handle</dt>
                <dd>Workbench · receipts · Graph / Hedera / CRE · partnerships · security</dd>
              </div>
              <div>
                <dt>Security</dt>
                <dd>Use the Security topic for vulnerability reports. Do not include production secrets.</dd>
              </div>
            </dl>
            <p className="field-hint">
              Messages are accepted by this deployment&apos;s contact API. Optional
              webhook forwarding uses <span className="mono">CONTACT_WEBHOOK_URL</span>.
            </p>
          </aside>
        </div>
      </main>
    </SiteFrame>
  );
}
