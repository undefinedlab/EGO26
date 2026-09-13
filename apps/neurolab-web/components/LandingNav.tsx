"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Brand } from "@/components/Shell";
import { NAV, SITE_LINKS } from "@/lib/nav";
import { IconClose, IconMenu } from "@/components/icons";

export function LandingNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      <header className="float-nav float-nav--plain" data-scrolled="false">
        <div className="float-nav-inner float-nav-inner--simple">
          <Brand sub={null} />

          <nav className="float-nav-links" aria-label="Site">
            {SITE_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="float-nav-link"
                aria-current={isActive(link.href) ? "page" : undefined}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="float-nav-actions">
            <Link href="/explore" className="btn btn-primary btn-sm btn-desktop">
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
        <nav className="mobile-sheet-inner" aria-label="Surfaces">
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
          {SITE_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              aria-current={isActive(link.href) ? "page" : undefined}
            >
              {link.label}
            </Link>
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
          <Link href="/explore" className="btn btn-primary" onClick={() => setOpen(false)}>
            Open Workbench
          </Link>
        </nav>
      </div>
    </>
  );
}
