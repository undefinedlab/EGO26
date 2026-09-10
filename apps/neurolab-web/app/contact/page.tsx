import type { Metadata } from "next";
import { ContactForm } from "@/components/site/ContactForm";
import { SiteFrame } from "@/components/site/SiteFrame";

export const metadata: Metadata = { title: "Contact" };

export default function ContactPage() {
  return (
    <SiteFrame>
      <main id="main" className="site-main">
        <header className="site-head">
          <p className="kicker">
            Mock page <span className="site-badge">UI only</span>
          </p>
          <h1>Contact</h1>
          <p className="t-lead">
            Ask about the Workbench, a receipt, or a partnership. This form is a
            visual mock — it does not send email.
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
              Support desk
            </h2>
            <p className="muted">
              Placeholder office copy for the landing mock. Hours and channels
              below are illustrative, not a live queue.
            </p>
            <dl className="site-dl">
              <div>
                <dt>Studio</dt>
                <dd>SynapseVM NeuroLab · local-first workbench</dd>
              </div>
              <div>
                <dt>Hours</dt>
                <dd>Weekdays, 10:00–18:00 (mock timezone)</dd>
              </div>
              <div>
                <dt>Topics</dt>
                <dd>Compose graphs · Simulate loops · Verify receipts</dd>
              </div>
            </dl>
            <p className="field-hint">No inbox is attached to this page.</p>
          </aside>
        </div>
      </main>
    </SiteFrame>
  );
}
