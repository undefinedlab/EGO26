"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Brand } from "@/components/Shell";
import { NAV } from "@/lib/nav";
import { ThemeToggle } from "@/components/ThemeToggle";
import { IconClose, IconMenu } from "@/components/icons";

const SECTIONS = [
  { href: "#problem", label: "Problem" },
  { href: "#how", label: "How it works" },
  { href: "#features", label: "Features" },
  { href: "#verify", label: "Verify" },
] as const;

export function LandingNav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <header className="float-nav" data-scrolled={scrolled ? "true" : "false"}>
        <div className="float-nav-inner">
          <Brand sub={null} />

          <nav className="float-nav-pill" aria-label="Sections">
            {SECTIONS.map((s) => (
              <a key={s.href} href={s.href}>
                {s.label}
              </a>
            ))}
          </nav>

          <div className="float-nav-actions">
            <ThemeToggle />
            <Link href="/compose" className="btn btn-primary btn-sm btn-desktop">
              Open Workbench
            </Link>
            <button
              type="button"
              className="nav-toggle"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls="landing-mobile-nav"
              aria-label={open ? "Close menu" : "Open menu"}
            >
              {open ? <IconClose /> : <IconMenu />}
            </button>
          </div>
        </div>
      </header>

      <div
        className="mobile-sheet"
        id="landing-mobile-nav"
        data-open={open}
        onClick={(e) => {
          if (e.target === e.currentTarget) setOpen(false);
        }}
      >
        <nav className="mobile-sheet-inner" aria-label="Sections and surfaces">
          <div className="mobile-sheet-top">
            <strong>Menu</strong>
            <button
              type="button"
              className="mobile-sheet-close"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
            >
              <IconClose />
            </button>
          </div>
          {SECTIONS.map((s) => (
            <a key={s.href} href={s.href} onClick={() => setOpen(false)}>
              {s.label}
            </a>
          ))}
          <div className="mobile-sheet-divider" />
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} onClick={() => setOpen(false)}>
              {item.label}
              <span>{item.blurb}</span>
            </Link>
          ))}
          <Link href="/profile" onClick={() => setOpen(false)}>
            Profile
            <span>Local shelf · saved modules</span>
          </Link>
          <div className="mobile-sheet-divider" />
          <Link href="/compose" className="btn btn-primary" onClick={() => setOpen(false)}>
            Open Workbench
          </Link>
        </nav>
      </div>
    </>
  );
}
