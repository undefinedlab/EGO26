import Link from "next/link";
import type { ReactNode } from "react";
import { LandingNav } from "@/components/LandingNav";
import { HeroCanvas } from "@/components/landing/HeroCanvas";
import ImpulseLife from "@/components/landing/ImpulseLife";
import { CaseDither } from "@/components/landing/CaseDither";
import { DevTerminal } from "@/components/landing/DevTerminal";
import { Tilt } from "@/components/landing/Tilt";
import {
  VizAudit,
  VizBenchmarked,
  VizComposed,
  VizCompute,
  VizDeterminism,
  VizExported,
  VizInfra,
  VizLatency,
  VizPackaged,
  VizVerified,
  VizVersioned,
} from "@/components/landing/TradeoffViz";
import { IconArrowRight } from "@/components/icons";
import { NAV } from "@/lib/nav";

/* ------------------------------------------------------------------ copy */

const HERO_TICKER = [
  "Compose neural behaviors",
  "Simulate them live",
  "Export them anywhere",
  "Verify exactly what they did",
] as const;

const TRADEOFFS = [
  { kind: "much", qty: "Too much", label: "compute", Viz: VizCompute },
  { kind: "much", qty: "Too much", label: "latency", Viz: VizLatency },
  { kind: "much", qty: "Too much", label: "infrastructure", Viz: VizInfra },
  { kind: "little", qty: "Too little", label: "determinism", Viz: VizDeterminism },
  { kind: "little", qty: "Too little", label: "auditability", Viz: VizAudit },
] as const;

const BLOCKS = [
  { name: "LoomGuard", role: "collision and looming reflex" },
  { name: "FlowSense", role: "visual motion estimation" },
  { name: "HeadingCell", role: "orientation and heading" },
  { name: "TargetTrack", role: "visual target tracking" },
];

const USE_CASES = [
  {
    title: "Robotics",
    body: "Fast local reflexes for collision avoidance, visual motion, navigation, target tracking, and stabilization.",
    image: "/usecases/robotics.png",
    alt: "Industrial robotic arm in a bright workshop",
    situations: [
      { title: "Collision dodge", blurb: "Brake or swerve before contact." },
      { title: "Loom response", blurb: "React to expanding threats in view." },
      { title: "Heading hold", blurb: "Keep orientation stable mid-motion." },
    ],
  },
  {
    title: "Games and simulation",
    body: "Lightweight neural reactions for NPCs and simulated agents, without a large model in every frame loop.",
    image: "/usecases/games.png",
    alt: "Stylized agents in a sparse simulated environment",
    situations: [
      { title: "NPC flinch", blurb: "Instant local reactions under fire." },
      { title: "Crowd motion", blurb: "Cheap flocking without a cloud call." },
      { title: "Local pursuit", blurb: "Chase and evade in the frame loop." },
    ],
  },
  {
    title: "3D and spatial software",
    body: "Camera collision avoidance, motion response, spatial tracking, and event-driven behaviors.",
    image: "/usecases/spatial.png",
    alt: "Spatial computing setup in a bright studio",
    situations: [
      { title: "Camera dodge", blurb: "Keep the view clear of geometry." },
      { title: "Motion snap", blurb: "Respond to sudden spatial events." },
      { title: "Room tracking", blurb: "Stabilize against local movement." },
    ],
  },
  {
    title: "Edge software",
    body: "Tiny deterministic SNN modules where latency, compute, privacy, or offline execution matter.",
    image: "/usecases/edge.png",
    alt: "Compact edge device on a clean industrial desk",
    situations: [
      { title: "Offline reflex", blurb: "Decide with no network in the loop." },
      { title: "Private inference", blurb: "Keep the tick on-device." },
      { title: "Low-power tick", blurb: "Run continuous reflexes cheaply." },
    ],
  },
  {
    title: "Autonomous agents",
    body: "Pair high-level reasoning with low-level neural reflexes — the planner decides where to go; SynapseVM handles move now.",
    image: "/usecases/agents.png",
    alt: "Planner display beside a small robot ready to move",
    situations: [
      { title: "Planner + reflex", blurb: "Reason high, react low." },
      { title: "Safety interrupt", blurb: "Override when the body must move." },
      { title: "Event veto", blurb: "Block unsafe actions locally." },
    ],
  },
] as const;

const VERIFICATION = [
  { title: "Artifact verification", body: "Confirm the exact package, modules, versions, runtime, and graph." },
  { title: "Runtime receipt", body: "Record the exact execution context for a critical event." },
  { title: "Deterministic replay", body: "Re-run the same Stack with the same committed input and state." },
  { title: "External validation", body: "Verify the execution in an independent or confidential environment." },
  { title: "Public anchor", body: "Commit compact receipt or validation roots for tamper-evident audit history." },
];

const MISSING = [
  {
    label: "packaged",
    blurb: "Shipped as a reusable module, not a notebook.",
    Viz: VizPackaged,
  },
  {
    label: "composed",
    blurb: "Wired into larger behaviors without glue code.",
    Viz: VizComposed,
  },
  {
    label: "versioned",
    blurb: "Pinned releases with clear provenance.",
    Viz: VizVersioned,
  },
  {
    label: "exported",
    blurb: "Run the same artifact anywhere you deploy.",
    Viz: VizExported,
  },
  {
    label: "benchmarked",
    blurb: "Measured cost, latency, and footprint.",
    Viz: VizBenchmarked,
  },
  {
    label: "independently verified",
    blurb: "Replay the exact run in another environment.",
    Viz: VizVerified,
  },
] as const;

/* ------------------------------------------------------------- fragments */

function Band({
  id,
  kicker,
  title,
  lead,
  tone,
  children,
}: {
  id?: string;
  kicker: string;
  title: string;
  lead?: string;
  tone?: "deep";
  children?: ReactNode;
}) {
  return (
    <section
      id={id}
      className={
        tone === "deep"
          ? children
            ? "band band--deep"
            : "band band--deep band--title"
          : children
            ? "band"
            : "band band--title"
      }
    >
      <div className="band-inner">
        <header className="band-head reveal">
          <span className="kicker">{kicker}</span>
          <h2>{title}</h2>
          {lead ? <p className="band-lead">{lead}</p> : null}
        </header>
        {children}
      </div>
    </section>
  );
}

function Flow({ nodes }: { nodes: string[] }) {
  return (
    <p className="flow">
      {nodes.map((n, i) => (
        <span key={n} style={{ display: "contents" }}>
          {i > 0 && (
            <span className="flow-sep" aria-hidden>
              →
            </span>
          )}
          <span>{n}</span>
        </span>
      ))}
    </p>
  );
}

function Chips({ items, accent }: { items: readonly string[]; accent?: boolean }) {
  return (
    <div className="chips">
      {items.map((i) => (
        <span key={i} className={accent ? "chip-mono chip-mono--accent" : "chip-mono"}>
          {i}
        </span>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ page */

export default function HomePage() {
  return (
    <>
      <LandingNav />

      <main id="main" className="lp">
        {/* ------------------------------------------------------------ hero */}
        <section className="hero">
          <div className="hero-stage">
            <HeroCanvas />
            <div className="hero-veil" aria-hidden />

            <div className="hero-inner">
              <h1 className="anim-rise">
                Build, ship, and <em>verify</em> neural reflexes.
              </h1>

              <p className="hero-sub anim-rise-delay">
                Portable SNN modules for software, robots, and autonomous systems.
              </p>

              <div className="hero-cta anim-rise-delay-2">
                <Link href="/compose" className="btn btn-primary btn-lg">
                  Open Workbench
                  <IconArrowRight />
                </Link>
                <Link href="/explore" className="btn btn-glass btn-lg">
                  Explore NeuroBlocks
                </Link>
              </div>
            </div>

            <div
              className="hero-marquee"
              role="region"
              aria-label="What SynapseVM does"
            >
              <div className="hero-marquee-track">
                {[0, 1].map((copy) => (
                  <div key={copy} className="hero-marquee-strip" aria-hidden={copy === 1}>
                    {HERO_TICKER.map((item) => (
                      <span key={`${copy}-${item}`} className="hero-marquee-item">
                        {item}
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* --------------------------------------------------------- problem */}
        <section id="problem" className="band">
          <div className="band-inner">
            <div className="problem-split reveal">
              <header className="band-head band-head--left">
                <span className="kicker">The problem</span>
                <h2>Autonomous systems are too dependent on oversized intelligence.</h2>
                <p className="band-lead">
                  Many agents rely on large general-purpose models for tasks that need neither
                  language nor deep reasoning. For real-time systems that is the wrong tradeoff.
                </p>
              </header>

              <div className="tradeoff-cloud" aria-label="Wrong tradeoffs">
                {TRADEOFFS.map(({ Viz, ...t }, i) => (
                  <div key={t.label} className="tradeoff-cloud-slot" data-i={i}>
                    <Tilt className="tradeoff glass tradeoff-cloud-card" max={6} data-kind={t.kind}>
                      <div className="tradeoff-frame">
                        <Viz />
                      </div>
                      <div className="tradeoff-meta">
                        <span className="tradeoff-qty">{t.qty}</span>
                        <span className="tradeoff-label">{t.label}</span>
                      </div>
                    </Tilt>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <figure className="impulse reveal">
            <ImpulseLife />
            <figcaption className="impulse-copy">
              <p className="statement">
                It often needs a tiny,
                <br />
                <em>specialized neural reflex.</em>
              </p>
              <p className="statement-note">
                A robot avoiding an obstacle, a game agent reacting to motion, or a software system
                detecting a critical event does not always need a giant model.
              </p>
            </figcaption>
          </figure>
        </section>

        {/* --------------------------------------------------------- why now */}
        <Band
          kicker="Why now"
          title="The pieces exist. The software layer does not."
          lead="Connectomes are becoming richer. Neuromorphic models are becoming more practical. Autonomous software is moving into the physical world."
        >
          <p className="gap-caption reveal">
            Neural modules still have no shared way to be
          </p>
          <div
            className="gap-marquee reveal"
            role="region"
            aria-label="Missing capabilities"
          >
            <div className="gap-marquee-track">
              {[0, 1].map((copy) => (
                <div key={copy} className="gap-marquee-strip" aria-hidden={copy === 1}>
                  {MISSING.map(({ Viz, label, blurb }) => (
                    <article key={`${copy}-${label}`} className="gap-card">
                      <div className="gap-card-viz" aria-hidden>
                        <Viz />
                      </div>
                      <h3 className="gap-card-title">{label}</h3>
                      <p className="gap-card-blurb">{blurb}</p>
                    </article>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </Band>

        {/* -------------------------------------------------------- solution */}
        <Band
          kicker="The solution"
          title="SynapseVM turns neural circuits into portable software."
          lead="Hugging Face for SNNs — with composable neural control and verifiable execution."
          tone="deep"
        >
          <div className="pitch-steps pitch-steps--inline reveal">
            <div className="pitch-step">
              <b>Discover</b>
              <span>neural modules</span>
            </div>
            <div className="pitch-step">
              <b>Build</b>
              <span>with them</span>
            </div>
            <div className="pitch-step">
              <b>Run</b>
              <span>them locally</span>
            </div>
            <div className="pitch-step">
              <b>Verify</b>
              <span>what they did</span>
            </div>
          </div>
        </Band>

        {/* ---------------------------------------------------- how it works */}
        <Band
          id="how"
          kicker="How it works"
          title="Explore, compose, simulate, compile, run, verify."
        >
          <div className="steps reveal">
            <Tilt className="step glass" max={5}>
              <span className="step-num" aria-hidden>
                1
              </span>
              <h3>Explore</h3>
              <p>Discover reusable neural functions, each with provenance, interfaces, benchmarks, and verification support.</p>
              <div className="step-detail">
                <div className="chips">
                  {BLOCKS.map((b) => (
                    <span key={b.name} className="chip-mono" title={b.role}>
                      {b.name}
                    </span>
                  ))}
                </div>
              </div>
            </Tilt>

            <Tilt className="step glass" max={5}>
              <span className="step-num" aria-hidden>
                2
              </span>
              <h3>Compose</h3>
              <p>Connect a complete behavior in the visual Workbench, without hiding the execution graph.</p>
              <div className="step-detail">
                <Flow nodes={["Sensors", "Adapters", "NeuroBlocks", "Control", "Actuators"]} />
              </div>
            </Tilt>

            <Tilt className="step glass" max={5}>
              <span className="step-num" aria-hidden>
                3
              </span>
              <h3>Simulate</h3>
              <p>Run the exact Stack in a live 3D environment. Watch signals move through the graph and trigger scenarios.</p>
              <div className="step-detail">
                <Chips items={["signal flow", "neural activity", "scenario triggers"]} />
              </div>
            </Tilt>

            <Tilt className="step glass" max={5}>
              <span className="step-num" aria-hidden>
                4
              </span>
              <h3>Compile</h3>
              <p>
                Compile the graph into a portable <span className="mono">.synapse</span> package.
              </p>
              <div className="step-detail">
                <Chips
                  items={[
                    "exact versions",
                    "graph wiring",
                    "runtime plan",
                    "typed interfaces",
                    "verification metadata",
                    "export bindings",
                  ]}
                />
              </div>
            </Tilt>

            <Tilt className="step glass" max={5}>
              <span className="step-num" aria-hidden>
                5
              </span>
              <h3>Run anywhere</h3>
              <p>No blockchain or cloud connection is required in the real-time execution loop.</p>
              <div className="step-detail">
                <Chips items={["WASM", "Rust", "Python", "ROS2"]} accent />
              </div>
            </Tilt>

            <Tilt className="step glass" max={5}>
              <span className="step-num" aria-hidden>
                6
              </span>
              <h3>Verify</h3>
              <p>Critical actions produce NeuroReceipts. Replay the execution independently and check that the result matches.</p>
              <div className="step-detail">
                <Flow nodes={["input", "state", "neural result", "decision", "action"]} />
              </div>
            </Tilt>
          </div>
        </Band>

        {/* -------------------------------------------------------- features */}
        <Band
          id="features"
          kicker="Core features"
          title="Neural modules with interfaces, not opaque model files."
          tone="deep"
        >
          <div className="bento reveal">
            <Tilt className="feature glass bento--wide" max={5}>
              <h3>NeuroBlocks</h3>
              <p>Small, reusable neural functions with typed inputs and outputs.</p>
              <div className="feature-foot">
                <Chips
                  items={[
                    "source & provenance",
                    "version",
                    "interface",
                    "runtime contract",
                    "operational envelope",
                    "benchmarks",
                    "verification metadata",
                  ]}
                />
              </div>
            </Tilt>

            <Tilt className="feature glass bento--wide" max={5}>
              <h3>NeuroStacks</h3>
              <p>Compose multiple Blocks into complete machine behaviors. Versioned, exportable, content-addressed.</p>
              <div className="feature-foot">
                <Flow nodes={["FlowSense", "TargetTrack", "HeadingCell", "LoomGuard", "BioPilot"]} />
              </div>
            </Tilt>

            <Tilt className="feature glass" max={5}>
              <h3>Visual Workbench</h3>
              <p>A typed node editor that validates compatibility, timing, priorities, and execution rules before compilation.</p>
            </Tilt>

            <Tilt className="feature glass" max={5}>
              <h3>3D Simulator</h3>
              <p>Test neural software before deployment. The simulator runs the same compiled modules you export.</p>
            </Tilt>

            <Tilt className="feature glass" max={5}>
              <h3>Deterministic runtime</h3>
              <p>Reproducible neural execution, which is what makes independent replay possible.</p>
              <div className="feature-foot">
                <div className="eq">
                  <span className="eq-side">Stack + Input + State</span>
                  <span className="eq-arrow" aria-hidden>
                    →
                  </span>
                  <span className="eq-side">Output + Next State + Trace</span>
                </div>
              </div>
            </Tilt>

            <Tilt className="feature glass" max={5}>
              <h3>NeuroReceipts</h3>
              <p>A receipt records the execution path from neural input to final action.</p>
              <div className="feature-foot">
                <blockquote className="feature-quote">
                  Not <i>“the model ran.”</i>
                  <b>“This exact Stack processed this committed state and produced this action.”</b>
                </blockquote>
              </div>
            </Tilt>

            <Tilt className="feature glass" max={5}>
              <h3>WHY?</h3>
              <p>Click any critical action and inspect its execution path instead of treating the model as a black box.</p>
              <div className="feature-foot">
                <ol className="path">
                  <li>stimulus</li>
                  <li>neural module</li>
                  <li>neural result</li>
                  <li>control rule</li>
                  <li>final action</li>
                  <li>replay verification</li>
                </ol>
              </div>
            </Tilt>

            <Tilt className="feature glass" max={5}>
              <h3>Portable export</h3>
              <p>
                Compile once, run anywhere. The hardware or application adapter changes — the
                NeuroBlock does not.
              </p>
              <div className="feature-foot">
                <Chips items={["drone", "rover", "car prototype", "browser", "game", "AR / VR", "edge app"]} />
              </div>
            </Tilt>
          </div>
        </Band>

        {/* ------------------------------------------------------- use cases */}
        <Band kicker="Use cases" title="Where neural reflexes fit.">
          <div className="case-rows">
            {USE_CASES.map((c, i) => (
              <article
                key={c.title}
                className="case-row reveal"
                data-flip={i % 2 === 1 ? "true" : undefined}
              >
                <div className="case-row-copy">
                  <h3>{c.title}</h3>
                  <p>{c.body}</p>
                  <div className="case-situations">
                    {c.situations.map((s) => (
                      <div key={s.title} className="case-situation">
                        <b>{s.title}</b>
                        <span>{s.blurb}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="case-row-media">
                  <CaseDither src={c.image} alt={c.alt} />
                </div>
              </article>
            ))}
          </div>
        </Band>

        {/* ---------------------------------------------------- verification */}
        <Band
          id="verify"
          kicker="Verification"
          title="Verification that follows the software."
          lead="Separate trust claims, instead of hiding them behind one green check."
          tone="deep"
        >
          <div className="ladder reveal">
            {VERIFICATION.map((v, i) => (
              <div key={v.title} className="ladder-row">
                <span className="ladder-idx">{String(i + 1).padStart(2, "0")}</span>
                <span className="ladder-title">{v.title}</span>
                <p className="ladder-body">{v.body}</p>
              </div>
            ))}
          </div>
          <p className="ladder-note reveal">
            <span className="dot" aria-hidden />
            Blockchain never sits inside the real-time reflex loop.
          </p>
        </Band>

        {/* ------------------------------------------------------ developers */}
        <Band
          id="developers"
          kicker="For developers"
          title="Neural software should feel like software."
          lead="Built from biology, not limited to it — connectomes, extracted circuits, trained SNNs, and synthetic models all compile through the same runtime and verification layer."
        >
          <DevTerminal />
        </Band>

        {/* ------------------------------------------------------- final CTA */}
        <section className="closer" aria-labelledby="closer-title">
          <div className="closer-stage">
            <ImpulseLife className="closer-canvas" />
            <div className="closer-copy">
              <p className="kicker">Start building</p>
              <h2 id="closer-title">
                Give your software a <em>nervous system.</em>
              </h2>
              <p className="closer-lead">
                Compose a NeuroStack locally. Simulate it live. Export it anywhere.
                Verify exactly what it did.
              </p>
              <div className="closer-actions">
                <Link href="/compose" className="btn btn-primary btn-lg">
                  Open Workbench
                  <IconArrowRight />
                </Link>
                <Link href="/explore" className="btn btn-glass btn-lg">
                  Explore NeuroBlocks
                </Link>
              </div>
              <p className="closer-meta mono">Discover · Compose · Simulate · Verify</p>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------- footer */}
        <footer className="lp-footer">
          <div className="lp-wrap lp-footer-grid">
            <div className="lp-footer-brand-block">
              <div className="lp-footer-brand">SynapseVM</div>
              <p>
                Portable SNN modules for software, robots, and autonomous systems.
                Local, deterministic, and replayable by design.
              </p>
            </div>
            <div className="lp-footer-col">
              <div className="lp-footer-head">Product</div>
              {NAV.map((item) => (
                <Link key={item.href} href={item.href}>
                  {item.label}
                </Link>
              ))}
              <Link href="/profile">Profile</Link>
            </div>
            <div className="lp-footer-col">
              <div className="lp-footer-head">Resources</div>
              <Link href="/docs">Docs</Link>
              <Link href="/community">Community</Link>
              <a href="https://x.com/" target="_blank" rel="noopener noreferrer">
                Twitter / X
              </a>
              <Link href="/explore">Library</Link>
            </div>
            <div className="lp-footer-col">
              <div className="lp-footer-head">Legal</div>
              <Link href="/terms">Terms</Link>
              <Link href="/privacy">Privacy</Link>
            </div>
            <div className="lp-footer-col">
              <div className="lp-footer-head">Export</div>
              <span>WASM</span>
              <span>Rust</span>
              <span>Python</span>
              <span>ROS2</span>
            </div>
          </div>
          <div className="lp-wrap lp-footer-bottom">
            <span>© {new Date().getFullYear()} SynapseVM. All rights reserved.</span>
          </div>
        </footer>
      </main>
    </>
  );
}
