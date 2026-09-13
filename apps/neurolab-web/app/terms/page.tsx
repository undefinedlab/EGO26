import type { Metadata } from "next";
import Link from "next/link";
import { SiteFrame } from "@/components/site/SiteFrame";

export const metadata: Metadata = {
  title: "Terms of use",
  description: "Terms governing use of SynapseVM NeuroLab and related verification tooling.",
};

const SECTIONS = [
  {
    id: "acceptance",
    title: "1. Agreement",
    body: [
      "These Terms of Use (“Terms”) govern access to and use of SynapseVM NeuroLab, including Discover, Compose, Simulate, Verify, associated documentation, APIs exposed by this deployment, and any NeuroBlock, NeuroStack, or NeuroReceipt materials made available through them (collectively, the “Service”).",
      "By accessing or using the Service, you agree to these Terms. If you use the Service on behalf of an organization, you represent that you have authority to bind that organization, and “you” includes that organization.",
    ],
  },
  {
    id: "service",
    title: "2. The Service",
    body: [
      "NeuroLab is a workbench for composing, simulating, and verifying deterministic neural controllers. It is research and engineering software. Unless we expressly agree otherwise in a separate written contract, the Service is provided for evaluation, development, education, and non-safety-critical experimentation.",
      "Features may include local drafting in your browser, packaging of .synapse artifacts, simulation loops, receipt replay, and optional partner integrations (for example The Graph, Hedera Consensus Service, or Chainlink CRE). Partner features depend on configuration and third-party availability; their absence does not breach these Terms.",
    ],
  },
  {
    id: "eligibility",
    title: "3. Eligibility and accounts",
    body: [
      "You must be able to form a binding contract in your jurisdiction. You are responsible for activity under your local drafts, exports, and any credentials you configure (including operator keys for partner services).",
      "Unless a hosted account system is expressly offered, drafts and shelves may remain in browser storage or on the machine running this deployment. Clearing storage or losing the host may permanently discard that data. You are responsible for exporting anything you need to keep.",
    ],
  },
  {
    id: "acceptable-use",
    title: "4. Acceptable use",
    body: [
      "You may use the Service to explore published NeuroBlocks, compose stacks, run simulations, and verify receipts for lawful purposes consistent with these Terms.",
      "You may not: (a) use the Service to operate or supervise machinery, vehicles, weapons, medical devices, or other systems where failure could cause death, personal injury, or significant property or environmental damage, unless you have independent safety certification and a separate written agreement with us covering that use; (b) attempt to disrupt, overload, or reverse engineer the Service except as allowed by mandatory law; (c) misrepresent verification results, partner attestations, or safety claims; (d) upload malware or unlawful content; or (e) use partner networks in violation of their terms or applicable sanctions laws.",
    ],
  },
  {
    id: "ip",
    title: "5. Intellectual property",
    body: [
      "SynapseVM, NeuroLab, NeuroBlock, NeuroStack, NeuroReceipt, and related names, logos, and product design are owned by their respective rights holders. These Terms do not transfer ownership of that IP to you.",
      "Connectome-derived or dataset-derived modules may carry provenance and license obligations from upstream sources. Using the Workbench does not grant you those upstream datasets. You must respect third-party licenses attached to any block, stack, or sample you export.",
      "Subject to these Terms, you retain rights in graphs, notes, and packages you create. By submitting content through Contact or similar channels, you grant us a non-exclusive license to use that content to operate and improve the Service and to respond to you.",
    ],
  },
  {
    id: "verification",
    title: "6. Verification, receipts, and partners",
    body: [
      "A NeuroReceipt and a successful local replay are evidence about a disclosed computational path: typically that a given stack, input commitments, and pre-state produced stated outputs under a stated runtime. They are not warranties of physical actuation, publisher identity, hardware attestation, biological truth, or fitness for a particular purpose.",
      "Optional partner checks (registry inclusion, subgraph indexing, Hedera anchors, CRE reports, enclave or confidential workflows) each answer a narrower question. A missing or failed partner step remains an open claim; the Service must not be construed as fabricating a pass.",
      "You are solely responsible for how you present verification results to third parties.",
    ],
  },
  {
    id: "third-parties",
    title: "7. Third-party services",
    body: [
      "The Service may link to or call third-party networks and tools. Their availability, fees, privacy practices, and terms are outside our control. You are responsible for keys, gas, topic fees, subgraph quotas, and compliance with those providers.",
    ],
  },
  {
    id: "confidentiality",
    title: "8. Confidentiality and security",
    body: [
      "Do not submit production secrets, private keys you cannot rotate, or personal data you are not authorized to share. If you believe you have found a vulnerability, contact us via the Contact form using the Security topic and allow a reasonable time for remediation before public disclosure, except where legally required otherwise.",
    ],
  },
  {
    id: "disclaimers",
    title: "9. Disclaimers",
    body: [
      "THE SERVICE IS PROVIDED “AS IS” AND “AS AVAILABLE.” TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE DISCLAIM ALL WARRANTIES, WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR FREE OF HARMFUL COMPONENTS, OR THAT RECEIPTS OR PARTNER ATTESTATIONS WILL MEET YOUR COMPLIANCE NEEDS.",
    ],
  },
  {
    id: "liability",
    title: "10. Limitation of liability",
    body: [
      "TO THE MAXIMUM EXTENT PERMITTED BY LAW, NEITHER SYNAPSEVM NOR ITS CONTRIBUTORS, AFFILIATES, OR SUPPLIERS WILL BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, DATA, GOODWILL, OR BUSINESS INTERRUPTION, ARISING FROM OR RELATED TO THE SERVICE OR THESE TERMS, WHETHER BASED ON WARRANTY, CONTRACT, TORT (INCLUDING NEGLIGENCE), OR ANY OTHER LEGAL THEORY, EVEN IF ADVISED OF THE POSSIBILITY.",
      "OUR AGGREGATE LIABILITY FOR ALL CLAIMS RELATING TO THE SERVICE SHALL NOT EXCEED THE GREATER OF (A) THE AMOUNTS YOU PAID US FOR THE SERVICE IN THE TWELVE MONTHS BEFORE THE CLAIM, OR (B) ONE HUNDRED U.S. DOLLARS (US $100), EXCEPT WHERE LIABILITY CANNOT BE LIMITED UNDER APPLICABLE LAW.",
    ],
  },
  {
    id: "indemnity",
    title: "11. Indemnity",
    body: [
      "You will defend and indemnify SynapseVM and its contributors against claims, damages, and expenses (including reasonable legal fees) arising from your use of the Service, your packages or receipts, your misrepresentation of verification results, or your violation of these Terms or third-party rights—except to the extent caused by our willful misconduct.",
    ],
  },
  {
    id: "changes",
    title: "12. Changes and termination",
    body: [
      "We may modify the Service or these Terms. Material changes will be reflected by updating the “Last updated” date on this page. Continued use after changes become effective constitutes acceptance. We may suspend or terminate access for violation of these Terms or to protect the Service and its users.",
      "Sections that by nature should survive (including IP, disclaimers, liability limits, and indemnity) survive termination.",
    ],
  },
  {
    id: "law",
    title: "13. Governing law",
    body: [
      "Unless a separate written agreement says otherwise, these Terms are governed by the laws applicable in the jurisdiction where the SynapseVM entity operating this deployment is established, without regard to conflict-of-law rules. Courts in that jurisdiction shall have exclusive venue, except that we may seek injunctive relief in any competent court. If any provision is unenforceable, the remainder stays in effect.",
    ],
  },
  {
    id: "contact",
    title: "14. Contact",
    body: [
      "Questions about these Terms: use the Contact page. Formal legal notices should be sent to the address or email we publish for legal correspondence when available; until then, Contact submissions marked for legal/security topics are the designated channel for this deployment.",
    ],
  },
] as const;

export default function TermsPage() {
  return (
    <SiteFrame>
      <main id="main" className="site-main">
        <header className="site-head">
          <p className="kicker">Legal</p>
          <h1>Terms of use</h1>
          <p className="t-lead">
            These Terms govern SynapseVM NeuroLab and related verification tooling.
            They are written for a real product deployment; have counsel review them
            before a commercial launch in your jurisdiction.
          </p>
          <p className="mono subtle">Last updated · 13 September 2026</p>
        </header>

        <nav className="terms-toc" aria-label="Terms sections">
          <ol>
            {SECTIONS.map((section) => (
              <li key={section.id}>
                <a href={`#${section.id}`}>{section.title.replace(/^\d+\.\s*/, "")}</a>
              </li>
            ))}
          </ol>
        </nav>

        <article className="terms-article">
          {SECTIONS.map((section) => (
            <section key={section.id} id={section.id}>
              <h2>{section.title}</h2>
              {section.body.map((para) => (
                <p key={para.slice(0, 48)}>{para}</p>
              ))}
            </section>
          ))}
          <p className="terms-foot">
            Related: <Link href="/docs/verify">Verify process</Link>
            {" · "}
            <Link href="/contact">Contact</Link>
          </p>
        </article>
      </main>
    </SiteFrame>
  );
}
