"use client";

/**
 * Floating overlapping bento cluster — layout language from the reference
 * (centered stack of layered glass / metric / accent cards), light theme.
 */
import type { ReactNode } from "react";
import { Tilt } from "@/components/landing/Tilt";

export type ClusterCard = {
  id: string;
  kind: "metric" | "note" | "accent" | "step";
  slot: "nw" | "ne" | "core" | "sw" | "se" | "mid";
  label?: string;
  value?: string;
  unit?: string;
  title?: string;
  body?: string;
  step?: string;
  dots?: number;
  lit?: number;
  children?: ReactNode;
};

export function FloatingCluster({
  cards,
  className = "",
}: {
  cards: ClusterCard[];
  className?: string;
}) {
  return (
    <div className={`float-cluster ${className}`.trim()}>
      <div className="float-cluster-stage">
        {cards.map((card) => (
          <div
            key={card.id}
            className={`float-card-slot float-card-slot--${card.slot}`}
          >
            <Tilt
              className={`float-card float-card--${card.kind}${card.kind === "accent" ? "" : " glass"}`}
              max={6}
            >
              {card.kind === "metric" ? (
                <>
                  <span className="float-card-label">{card.label}</span>
                  <strong className="float-card-value">{card.value}</strong>
                  <span className="float-card-unit">{card.unit}</span>
                </>
              ) : null}

              {card.kind === "note" ? (
                <>
                  <span className="float-card-label">{card.label}</span>
                  <h3>{card.title}</h3>
                  <p>{card.body}</p>
                </>
              ) : null}

              {card.kind === "step" ? (
                <>
                  <span className="float-card-step">{card.step}</span>
                  <h3>{card.title}</h3>
                  <p>{card.body}</p>
                  {card.children}
                </>
              ) : null}

              {card.kind === "accent" ? (
                <>
                  <span className="float-card-label">{card.label}</span>
                  <h3>{card.title}</h3>
                  <p>{card.body}</p>
                  {typeof card.dots === "number" ? (
                    <div className="float-card-dots" aria-hidden>
                      {Array.from({ length: card.dots }, (_, i) => (
                        <i
                          key={i}
                          data-lit={i < (card.lit ?? card.dots ?? 0) ? "true" : "false"}
                        />
                      ))}
                    </div>
                  ) : null}
                </>
              ) : null}
            </Tilt>
          </div>
        ))}
      </div>
    </div>
  );
}
