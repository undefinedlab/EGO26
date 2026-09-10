import type { Metadata } from "next";
import { SiteFrame } from "@/components/site/SiteFrame";

export const metadata: Metadata = { title: "Terms" };

const SECTIONS = [
  {
    id: "acceptance",
    title: "1. Acceptance",
    body: "These mock Terms describe how a visitor may use the SynapseVM NeuroLab preview. By opening the Workbench or these pages you agree this copy is illustrative, not a binding agreement with any company.",
  },
  {
    id: "use",
    title: "2. Use of the Workbench",
    body: "NeuroLab is offered as a local instrument for composing, simulating, and verifying neural controllers. You may explore published NeuroBlocks, wire a Stack, and replay a receipt on your own machine. You may not present this preview as a certified safety system, or use it to operate machinery where failure can harm people or property.",
  },
  {
    id: "accounts",
    title: "3. Local data",
    body: "The preview keeps drafts, saved modules, and profile shelves in the browser unless you export them. Clearing site storage discards that shelf. Nothing here implies a hosted account, backup, or shared tenancy.",
  },
  {
    id: "ip",
    title: "4. Intellectual property",
    body: "SynapseVM, NeuroLab, NeuroBlock, NeuroStack, and NeuroReceipt names and marks remain with their owners. Connectome-derived blocks carry the provenance of their source datasets; you do not receive those datasets by using the Workbench. Your own graphs and notes stay yours. You grant no license beyond what you explicitly export.",
  },
  {
    id: "receipts",
    title: "5. Verification and receipts",
    body: "A NeuroReceipt is a replayable claim about a locked graph, not a warranty that a controller is safe in the world. Replay can fail if modules, vectors, or the runtime differ. Treat a green replay as evidence about that package, not as certification.",
  },
  {
    id: "liability",
    title: "6. Liability",
    body: "The preview is provided as-is, without warranties of any kind. To the fullest extent allowed by law, SynapseVM and its contributors are not liable for lost work, incorrect control outputs, or damages arising from use or inability to use NeuroLab. You assume the risk of relying on a mock or experimental controller.",
  },
  {
    id: "changes",
    title: "7. Changes",
    body: "This placeholder may be replaced by counsel-reviewed terms before any public launch. Continued use of a later version means you accept the replacement text. The date below is for the mock only.",
  },
  {
    id: "contact",
    title: "8. Questions",
    body: "Use the Contact mock if you want to comment on this draft. No legal notice is accepted through that form until a real channel is published.",
  },
] as const;

export default function TermsPage() {
  return (
    <SiteFrame>
      <main id="main" className="site-main">
        <header className="site-head">
          <p className="kicker">
            Mock page <span className="site-badge">Placeholder legal</span>
          </p>
          <h1>Terms of use</h1>
          <p className="t-lead">
            Original stand-in copy for the landing. Not scraped from another
            product, and not a substitute for a reviewed agreement.
          </p>
          <p className="mono subtle">Last updated · 10 September 2026 · mock</p>
        </header>

        <article className="terms-article">
          {SECTIONS.map((section) => (
            <section key={section.id} id={section.id}>
              <h2>{section.title}</h2>
              <p>{section.body}</p>
            </section>
          ))}
        </article>
      </main>
    </SiteFrame>
  );
}
