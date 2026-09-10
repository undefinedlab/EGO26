"use client";

import Link from "next/link";
import { useMemo, type CSSProperties, type ReactNode } from "react";
import { HeroCanvas } from "@/components/landing/HeroCanvas";
import ImpulseLife from "@/components/landing/ImpulseLife";
import { DevTerminal } from "@/components/landing/DevTerminal";
import { FeatureBento } from "@/components/landing/FeatureBento";
import { LandingDeck, type DeckSlide } from "@/components/landing/LandingDeck";
import { UseCaseSlider } from "@/components/landing/UseCaseSlider";
import { VerifySlider } from "@/components/landing/VerifySlider";
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

const WHY_GAP = [
  {
    id: "packaged",
    title: "Can't be Packaged",
    body: "Versioned modules with typed interfaces — not notebook dumps.",
  },
  {
    id: "composed",
    title: "Can't be Composed",
    body: "Wire sensors → blocks → actuators into one portable stack.",
  },
  {
    id: "exported",
    title: "Can't be Exported",
    body: "Ship the same graph to .synapse, WASM, Rust, Python, or ROS2.",
  },
  {
    id: "verified",
    title: "Can't be Verified",
    body: "Replay the critical path with receipts — independent of the author.",
    accent: true as const,
  },
] as const;

const HOW_CYCLE = [
  {
    id: "explore",
    title: "Explore",
    body: "Discover NeuroBlocks with provenance and interfaces.",
  },
  {
    id: "compose",
    title: "Compose",
    body: "Wire sensors → blocks → actuators in the Workbench.",
  },
  {
    id: "simulate",
    title: "Simulate",
    body: "Run the exact Stack live — signal flow in one loop.",
  },
  {
    id: "compile",
    title: "Compile · Run",
    body: "Ship .synapse · WASM · Rust · Python · ROS2.",
  },
  {
    id: "verify",
    title: "Verify",
    body: "Replay the critical path with NeuroReceipts.",
  },
] as const;

const USE_CASES = [
  {
    title: "Robotics",
    body: "Fast local reflexes for collision avoidance, visual motion, navigation, and stabilization.",
    points: ["Collision dodge", "Loom response", "Heading hold"],
    status: "REFLEX · LIVE",
  },
  {
    title: "Games & simulation",
    body: "Lightweight neural reactions for NPCs and agents — no large model in every frame loop.",
    points: ["NPC flinch", "Crowd motion", "Local pursuit"],
    status: "NPC LOOP · 16MS",
  },
  {
    title: "3D & spatial",
    body: "Camera collision avoidance, motion response, and event-driven spatial behaviors.",
    points: ["Camera dodge", "Motion snap", "Room tracking"],
    status: "CAM · ROOM LOCK",
  },
  {
    title: "Edge software",
    body: "Tiny deterministic SNN modules where latency, compute, privacy, or offline execution matter.",
    points: ["Offline reflex", "Private inference", "Low-power tick"],
    status: "EDGE · OFFLINE",
  },
  {
    title: "Autonomous agents",
    body: "Pair high-level reasoning with low-level neural reflexes — planners decide; SynapseVM moves now.",
    points: ["Planner + reflex", "Safety interrupt", "Event veto"],
    status: "PLAN + REFLEX",
  },
] as const;

const VERIFICATION = [
  {
    title: "Artifact verification",
    body: "Confirm package, modules, versions, runtime, and graph.",
    detail:
      "The uploaded package is rebuilt and compared — identity, lockfile, and module bytes. A matching digest is comparison to expected bytes, not a publisher seal.",
    points: [
      "Graph, lockfile, and locked module identities recomputed",
      "Expected SHA-256 compared when you supply one",
      "Structure checked; signature remains a separate claim",
    ],
  },
  {
    title: "Runtime receipt",
    body: "Record the exact execution context for a critical event.",
    detail:
      "A receipt binds the Stack to the tick: input, pre-state, outputs, and commands. It is evidence of what ran — not a certificate that the world matched.",
    points: [
      "Input, pre-state, neural outputs, and actuator commands",
      "Commitments so the same path can be replayed later",
      "Local evidence; unsigned until a signed module receipt is supplied",
    ],
  },
  {
    title: "Deterministic replay",
    body: "Re-run the same Stack with the same input and state.",
    detail:
      "A fresh runtime replays the disclosed path. Match means the same graph, same input, and same state produced the same outputs — not that a robot moved.",
    points: [
      "Same Stack, same input, same complete pre-state",
      "Exact output and post-state equality — no approximate matching",
      "Replay withheld if the supplied commitments already fail",
    ],
  },
  {
    title: "External validation",
    body: "Verify execution in an independent environment.",
    detail:
      "Another runtime — including the local Rust verifier for a signed module receipt — can witness the same claims. A missing independent result stays unverified; it is never a green check.",
    points: [
      "Independent implementation, not only the author's session",
      "Local Rust replay of a neuroreceipt when evidence is supplied",
      "Absence of an external result remains an open claim",
    ],
  },
  {
    title: "Public anchor",
    body: "Commit compact roots for tamper-evident audit history.",
    detail:
      "Compact identity roots can be recorded so later auditors detect tampering. Inclusion is a separate claim — a local receipt is not a public record.",
    points: [
      "Compact roots (package, receipt, trace) — not full traces",
      "Tamper-evident history only when an inclusion proof is checked",
      "No public record is assumed from a local run",
    ],
  },
] as const;

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

            <div className="hero-marquee glass" role="region" aria-label="What SynapseVM does">
              <div className="hero-marquee-track">
                {[0, 1, 2, 3].map((copy) => (
                  <div key={copy} className="hero-marquee-strip" aria-hidden={copy > 0}>
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
        <Frame className="deck-frame--problem">
          <SlideHead
            kicker="The problem"
            title="Autonomous systems are too dependent on oversized intelligence."
            lead="Many agents rely on large general-purpose models for tasks that need neither language nor deep reasoning."
          />
          <div className="problem-bento" aria-label="Wrong tradeoffs">
            {TRADEOFFS.map(({ Viz, ...t }) => (
              <Tilt
                key={t.label}
                className={`tradeoff glass problem-bento-card${t.label === "compute" ? " problem-bento-card--hero" : ""}`}
                max={6}
                data-kind={t.kind}
                data-area={t.label}
              >
                <div className="tradeoff-frame">
                  <Viz />
                </div>
                <div className="tradeoff-meta">
                  <span className="tradeoff-qty">{t.qty}</span>
                  <span className="tradeoff-label">{t.label}</span>
                </div>
              </Tilt>
            ))}
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

<p className="cluster-foot">
            Neural modules still have no shared way to be packaged, composed, exported, and verified.
          </p>
          <div className="deck-bento deck-bento--gap" aria-label="Missing shared software path">
            {WHY_GAP.map((card) => (
              <Tilt
                key={card.id}
                className={`deck-tile${"accent" in card ? " deck-tile--accent" : " glass"}`}
                max={5}
              >
                <h3>{card.title}</h3>
                <p>{card.body}</p>
              </Tilt>
            ))}
          </div>
       
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
        </Frame>
      ),
    },
    {
      id: "how",
      label: "How it works",
      children: (
        <Frame className="deck-frame--cycle">
          <div className="how-cycle" aria-label="SynapseVM loop">
            <div className="how-cycle-ring" style={{ "--n": HOW_CYCLE.length } as CSSProperties}>
              <div className="how-cycle-track" aria-hidden>
                <svg viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="38" />
                </svg>
              </div>
              <div className="how-cycle-hub" aria-hidden>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/synapse-mark.png" alt="" className="how-cycle-hub-mark" width={48} height={72} />
              </div>
              {HOW_CYCLE.map((step, i) => (
                <div
                  key={step.id}
                  className="how-cycle-slot"
                  style={{ "--i": i } as CSSProperties}
                >
                  <Tilt className="how-cycle-node glass" max={5}>
                    <h3>{step.title}</h3>
                    <p>{step.body}</p>
                  </Tilt>
                </div>
              ))}
            </div>
          </div>
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
        <Frame className="deck-frame--cluster">
          <SlideHead
            kicker="Core features"
            title="Neural modules with interfaces, not opaque model files."
          />
          <FeatureBento />
          <p className="cluster-foot">
            Package once — compose, simulate, export, and verify the same graph.
          </p>
        </Frame>
      ),
    },
    {
      id: "usecases",
      label: "Use cases",
      children: (
        <Frame className="deck-frame--cases">
          <UseCaseSlider cases={USE_CASES} />
        </Frame>
      ),
    },
    {
      id: "verify",
      label: "Verify",
      children: (
        <Frame className="deck-frame--verify">
          <SlideHead
            kicker="Verification"
            title="Verification that follows the software."
            lead="Separate trust claims, instead of hiding them behind one green check."
          />
          <VerifySlider layers={VERIFICATION} />
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
