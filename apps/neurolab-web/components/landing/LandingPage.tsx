"use client";

import Link from "next/link";
import { useMemo, type ReactNode } from "react";
import { HeroCanvas } from "@/components/landing/HeroCanvas";
import ImpulseLife from "@/components/landing/ImpulseLife";
import { DevTerminal } from "@/components/landing/DevTerminal";
import { FloatingCluster, type ClusterCard } from "@/components/landing/FloatingCluster";
import { LandingDeck, type DeckSlide } from "@/components/landing/LandingDeck";
import { Tilt } from "@/components/landing/Tilt";
import {
  VizAudit,
  VizCompute,
  VizDeterminism,
  VizInfra,
  VizLatency,
} from "@/components/landing/TradeoffViz";
import { IconArrowRight } from "@/components/icons";

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

const WHY_CLUSTER: ClusterCard[] = [
  {
    id: "sync",
    kind: "metric",
    slot: "nw",
    label: "Module sync",
    value: "99.9%",
    unit: "deterministic ticks",
  },
  {
    id: "core",
    kind: "note",
    slot: "core",
    label: "Missing layer",
    title: "No shared software path",
    body: "Connectomes and SNNs exist — packaging, composition, and verification still do not.",
  },
  {
    id: "pack",
    kind: "note",
    slot: "ne",
    label: "Packaged",
    title: "Reusable modules",
    body: "Not notebooks. Versioned, typed, exportable.",
  },
  {
    id: "cu",
    kind: "metric",
    slot: "sw",
    label: "Sparse graph",
    value: "12 CU",
    unit: "local reflex budget",
  },
  {
    id: "live",
    kind: "accent",
    slot: "se",
    label: "Verified runs",
    title: "Replay ready",
    body: "Independent validation path",
    dots: 16,
    lit: 11,
  },
];

const HOW_CLUSTER: ClusterCard[] = [
  {
    id: "s1",
    kind: "step",
    slot: "nw",
    step: "01",
    title: "Explore",
    body: "Discover NeuroBlocks with provenance and interfaces.",
  },
  {
    id: "s2",
    kind: "step",
    slot: "ne",
    step: "02",
    title: "Compose",
    body: "Wire sensors → blocks → actuators in the Workbench.",
  },
  {
    id: "s3",
    kind: "step",
    slot: "core",
    step: "03",
    title: "Simulate",
    body: "Run the exact Stack live — signal flow and scenarios in one loop.",
  },
  {
    id: "s4",
    kind: "step",
    slot: "sw",
    step: "04",
    title: "Compile · Run",
    body: "Ship .synapse · WASM · Rust · Python · ROS2.",
  },
  {
    id: "s5",
    kind: "accent",
    slot: "se",
    label: "05 · Verify",
    title: "NeuroReceipts",
    body: "Replay the critical path",
    dots: 12,
    lit: 12,
  },
];

const USE_CASES = [
  {
    title: "Robotics",
    body: "Fast local reflexes for collision avoidance, visual motion, navigation, and stabilization.",
    points: ["Collision dodge", "Loom response", "Heading hold"],
  },
  {
    title: "Games & simulation",
    body: "Lightweight neural reactions for NPCs and agents — no large model in every frame loop.",
    points: ["NPC flinch", "Crowd motion", "Local pursuit"],
  },
  {
    title: "3D & spatial",
    body: "Camera collision avoidance, motion response, and event-driven spatial behaviors.",
    points: ["Camera dodge", "Motion snap", "Room tracking"],
  },
  {
    title: "Edge software",
    body: "Tiny deterministic SNN modules where latency, compute, privacy, or offline execution matter.",
    points: ["Offline reflex", "Private inference", "Low-power tick"],
  },
  {
    title: "Autonomous agents",
    body: "Pair high-level reasoning with low-level neural reflexes — planners decide; SynapseVM moves now.",
    points: ["Planner + reflex", "Safety interrupt", "Event veto"],
  },
] as const;

const VERIFICATION = [
  { title: "Artifact verification", body: "Confirm package, modules, versions, runtime, and graph." },
  { title: "Runtime receipt", body: "Record the exact execution context for a critical event." },
  { title: "Deterministic replay", body: "Re-run the same Stack with the same input and state." },
  { title: "External validation", body: "Verify execution in an independent environment." },
  { title: "Public anchor", body: "Commit compact roots for tamper-evident audit history." },
];

function SlideHead({
  kicker,
  title,
  lead,
}: {
  kicker: string;
  title: string;
  lead?: string;
}) {
  return (
    <header className="deck-head">
      <span className="kicker">{kicker}</span>
      <h2>{title}</h2>
      {lead ? <p className="deck-lead">{lead}</p> : null}
    </header>
  );
}

function Frame({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`deck-frame ${className}`.trim()}>{children}</div>;
}

export function LandingPage() {
  const slides = useMemo<DeckSlide[]>(
    () => [
    {
      id: "hero",
      label: "Home",
      children: (
        <section className="hero deck-hero">
          <div className="hero-stage hero-stage--immersive hero-stage--field">
            <div className="hero-ambient" aria-hidden>
              <span className="hero-orb hero-orb--a" />
              <span className="hero-orb hero-orb--b" />
              <span className="hero-orb hero-orb--c" />
            </div>
            <HeroCanvas />
            <div className="hero-veil" aria-hidden />

            <div className="hero-inner hero-inner--solo">
              <p className="hero-eyebrow anim-rise">Neural software runtime</p>
              <h1 className="anim-rise-delay">
                Build, ship, and <em>verify</em>
                <br />
                neural reflexes.
              </h1>
              <p className="hero-sub anim-rise-delay-2">
                Portable SNN modules for software, robots, and autonomous systems —
                local, deterministic, and replayable by design.
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

            <div className="hero-marquee" role="region" aria-label="What SynapseVM does">
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
      ),
    },
    {
      id: "problem",
      label: "Problem",
      children: (
        <Frame className="deck-frame--split">
          <div className="problem-split deck-problem">
            <SlideHead
              kicker="The problem"
              title="Autonomous systems are too dependent on oversized intelligence."
              lead="Many agents rely on large general-purpose models for tasks that need neither language nor deep reasoning."
            />
            <div className="tradeoff-cloud tradeoff-cloud--deck" aria-label="Wrong tradeoffs">
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
        </Frame>
      ),
    },
    {
      id: "reflex",
      label: "Reflex",
      children: (
        <figure className="impulse deck-impulse">
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
      ),
    },
    {
      id: "why",
      label: "Why now",
      children: (
        <Frame className="deck-frame--cluster">
          <SlideHead
            kicker="Why now"
            title="The pieces exist. The software layer does not."
          />
          <FloatingCluster cards={WHY_CLUSTER} className="float-cluster--why" />
          <p className="cluster-foot">
            Neural modules still have no shared way to be packaged, composed, exported, and verified.
          </p>
        </Frame>
      ),
    },
    {
      id: "solution",
      label: "Solution",
      children: (
        <Frame className="deck-frame--center">
          <SlideHead
            kicker="The solution"
            title="SynapseVM turns neural circuits into portable software."
            lead="Hugging Face for SNNs — with composable neural control and verifiable execution."
          />
          <div className="pitch-steps pitch-steps--inline">
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
        </Frame>
      ),
    },
    {
      id: "how",
      label: "How it works",
      children: (
        <Frame className="deck-frame--cluster">
          <SlideHead
            kicker="How it works"
            title="Explore, compose, simulate, compile, run, verify."
          />
          <FloatingCluster cards={HOW_CLUSTER} className="float-cluster--how" />
          <p className="cluster-foot">
            One path from neural module to replayable receipt — without a cloud in the reflex loop.
          </p>
        </Frame>
      ),
    },
    {
      id: "features",
      label: "Features",
      children: (
        <Frame>
          <SlideHead
            kicker="Core features"
            title="Neural modules with interfaces, not opaque model files."
          />
          <div className="bento bento--deck">
            <Tilt className="feature glass bento--wide" max={5}>
              <h3>NeuroBlocks</h3>
              <p>Small, reusable neural functions with typed inputs and outputs.</p>
            </Tilt>
            <Tilt className="feature glass bento--wide" max={5}>
              <h3>NeuroStacks</h3>
              <p>Compose Blocks into complete machine behaviors — versioned and exportable.</p>
            </Tilt>
            <Tilt className="feature glass" max={5}>
              <h3>Workbench</h3>
              <p>Typed node editor with validation before compile.</p>
            </Tilt>
            <Tilt className="feature glass" max={5}>
              <h3>3D Simulator</h3>
              <p>Test the same compiled modules you export.</p>
            </Tilt>
            <Tilt className="feature glass" max={5}>
              <h3>Deterministic runtime</h3>
              <p>Reproducible execution that makes independent replay possible.</p>
            </Tilt>
            <Tilt className="feature glass" max={5}>
              <h3>NeuroReceipts</h3>
              <p>From neural input to final action — recorded, not assumed.</p>
            </Tilt>
          </div>
        </Frame>
      ),
    },
    {
      id: "usecases",
      label: "Use cases",
      children: (
        <Frame>
          <SlideHead kicker="Use cases" title="Where neural reflexes fit." />
          <div className="case-list">
            {USE_CASES.map((c) => (
              <article key={c.title} className="case-list-row">
                <h3>{c.title}</h3>
                <div className="case-list-body">
                  <p>{c.body}</p>
                  <ul>
                    {c.points.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                </div>
              </article>
            ))}
          </div>
        </Frame>
      ),
    },
    {
      id: "verify",
      label: "Verify",
      children: (
        <Frame>
          <SlideHead
            kicker="Verification"
            title="Verification that follows the software."
            lead="Separate trust claims, instead of hiding them behind one green check."
          />
          <div className="ladder ladder--deck">
            {VERIFICATION.map((v, i) => (
              <div key={v.title} className="ladder-row">
                <span className="ladder-idx">{String(i + 1).padStart(2, "0")}</span>
                <span className="ladder-title">{v.title}</span>
                <p className="ladder-body">{v.body}</p>
              </div>
            ))}
          </div>
          <p className="ladder-note">
            <span className="dot" aria-hidden />
            Blockchain never sits inside the real-time reflex loop.
          </p>
        </Frame>
      ),
    },
    {
      id: "developers",
      label: "Developers",
      children: (
        <Frame>
          <SlideHead
            kicker="For developers"
            title="Neural software should feel like software."
            lead="Connectomes, extracted circuits, trained SNNs, and synthetic models compile through the same runtime and verification layer."
          />
          <DevTerminal />
        </Frame>
      ),
    },
    {
      id: "start",
      label: "Start",
      children: (
        <section className="closer closer--deck" aria-labelledby="closer-title">
          <div className="closer-stage">
            <ImpulseLife className="closer-canvas" />
            <div className="closer-copy">
              <p className="kicker">Start building</p>
              <h2 id="closer-title">
                Give your software a <em>nervous system.</em>
              </h2>
              <p className="closer-lead">
                Compose a NeuroStack locally. Simulate it live. Export it anywhere. Verify
                exactly what it did.
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
      ),
    },
    ],
    [],
  );

  return <LandingDeck slides={slides} />;
}
