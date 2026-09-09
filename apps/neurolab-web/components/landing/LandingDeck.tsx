"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { LandingNav } from "@/components/LandingNav";

export type DeckSlide = {
  id: string;
  label: string;
  children: ReactNode;
};

type DeckContextValue = {
  index: number;
  count: number;
  slides: { id: string; label: string }[];
  goTo: (index: number) => void;
  goToId: (id: string) => void;
  next: () => void;
  prev: () => void;
};

const DeckContext = createContext<DeckContextValue | null>(null);

export function useLandingDeck() {
  const ctx = useContext(DeckContext);
  if (!ctx) throw new Error("useLandingDeck must be used inside LandingDeck");
  return ctx;
}

export function useLandingDeckOptional() {
  return useContext(DeckContext);
}

const WHEEL_THRESHOLD = 48;
const TOUCH_THRESHOLD = 56;
const COOLDOWN_MS = 700;

type LandingDeckProps = {
  slides: DeckSlide[];
};

export function LandingDeck({ slides }: LandingDeckProps) {
  const [index, setIndex] = useState(0);
  const locked = useRef(false);
  const wheelAcc = useRef(0);
  const touchY = useRef<number | null>(null);
  const reduceMotion = useRef(false);

  const meta = useMemo(
    () => slides.map(({ id, label }) => ({ id, label })),
    [slides],
  );
  const count = slides.length;

  const goTo = useCallback(
    (next: number) => {
      setIndex((cur) => {
        const clamped = Math.max(0, Math.min(count - 1, next));
        if (clamped === cur) return cur;
        locked.current = true;
        window.setTimeout(
          () => {
            locked.current = false;
            wheelAcc.current = 0;
          },
          reduceMotion.current ? 80 : COOLDOWN_MS,
        );
        return clamped;
      });
    },
    [count],
  );

  const next = useCallback(() => goTo(index + 1), [goTo, index]);
  const prev = useCallback(() => goTo(index - 1), [goTo, index]);

  const goToId = useCallback(
    (id: string) => {
      const i = slides.findIndex((s) => s.id === id);
      if (i >= 0) goTo(i);
    },
    [goTo, slides],
  );

  const value = useMemo<DeckContextValue>(
    () => ({ index, count, slides: meta, goTo, goToId, next, prev }),
    [index, count, meta, goTo, goToId, next, prev],
  );

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("lp-deck-lock");
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reduceMotion.current = mq.matches;
    const onMq = () => {
      reduceMotion.current = mq.matches;
    };
    mq.addEventListener("change", onMq);
    return () => {
      root.classList.remove("lp-deck-lock");
      mq.removeEventListener("change", onMq);
    };
  }, []);

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "");
    if (!hash) return;
    const i = slides.findIndex((s) => s.id === hash);
    if (i >= 0) setIndex(i);
  }, [slides]);

  useEffect(() => {
    const id = slides[index]?.id;
    if (!id) return;
    const url = `${window.location.pathname}${window.location.search}#${id}`;
    window.history.replaceState(null, "", url);
  }, [index, slides]);

  useEffect(() => {
    const canAdvance = (dir: 1 | -1) => {
      if (locked.current) return false;
      goTo(index + dir);
      return true;
    };

    const onWheel = (e: WheelEvent) => {
      if (locked.current) {
        e.preventDefault();
        return;
      }

      e.preventDefault();
      wheelAcc.current += e.deltaY;
      if (Math.abs(wheelAcc.current) < WHEEL_THRESHOLD) return;
      const dir = wheelAcc.current > 0 ? 1 : -1;
      wheelAcc.current = 0;
      canAdvance(dir);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "ArrowDown" || e.key === "PageDown" || e.key === " ") {
        e.preventDefault();
        canAdvance(1);
      } else if (e.key === "ArrowUp" || e.key === "PageUp") {
        e.preventDefault();
        canAdvance(-1);
      } else if (e.key === "Home") {
        e.preventDefault();
        goTo(0);
      } else if (e.key === "End") {
        e.preventDefault();
        goTo(count - 1);
      }
    };

    const onTouchStart = (e: TouchEvent) => {
      touchY.current = e.touches[0]?.clientY ?? null;
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (touchY.current == null) return;
      const y = e.changedTouches[0]?.clientY;
      if (y == null) return;
      const dy = touchY.current - y;
      touchY.current = null;
      if (Math.abs(dy) < TOUCH_THRESHOLD) return;
      canAdvance(dy > 0 ? 1 : -1);
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKey);
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [count, goTo, index]);

  return (
    <DeckContext.Provider value={value}>
      <LandingNav />
      <main id="main" className="lp lp-deck" aria-live="polite">
        {slides.map((slide, i) => {
          const active = i === index;
          return (
            <section
              key={slide.id}
              id={slide.id}
              className="lp-slide"
              data-active={active ? "true" : "false"}
              aria-hidden={!active}
              aria-label={slide.label}
            >
              <div className="lp-slide-pane">
                {slide.children}
              </div>
            </section>
          );
        })}

        <div className="lp-deck-chrome">
          <div className="lp-deck-progress" role="tablist" aria-label="Sections">
            {meta.map((s, i) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={s.label}
                className="lp-deck-dot"
                data-active={i === index ? "true" : "false"}
                onClick={() => goTo(i)}
              />
            ))}
          </div>
        </div>
      </main>
    </DeckContext.Provider>
  );
}
