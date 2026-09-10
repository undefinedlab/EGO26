"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { IconClose, IconMenu, IconUser } from "@/components/icons";
import { NAV } from "@/lib/nav";

export function Brand({ sub = "NeuroLab" }: { sub?: string | null }) {
  return (
    <Link href="/" className="brand">
      <span className="brand-mark" aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/synapse-mark.png" alt="" width={22} height={33} className="brand-mark-img" />
      </span>
      SynapseVM
      {sub ? <span className="brand-sub">{sub}</span> : null}
    </Link>
  );
}

export function Shell({
  children,
  wide,
  canvas,
  bare,
}: {
  /** @deprecated the active surface is derived from the route. */
  active?: string;
  children: ReactNode;
  wide?: boolean;
  /** Full-bleed workspace (Compose canvas). */
  canvas?: boolean;
  /** Hide the app header — used for nested screens with their own back control. */
  bare?: boolean;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  // A route change should always dismiss the mobile sheet.
  useEffect(() => setMenuOpen(false), [pathname]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className={canvas ? "shell shell--canvas" : "shell"}>
      {!bare && (
        <>
      <header className="shell-header">
        <div className="shell-header-inner">
          <Brand />

          <nav className="shell-nav" aria-label="NeuroLab surfaces">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(item.href) ? "page" : undefined}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="nav-actions">
            <ThemeToggle className="theme-toggle--bare" />
            <Link
              href="/profile"
              className="shell-profile"
              title="Profile"
              aria-label="Profile"
              aria-current={isActive("/profile") ? "page" : undefined}
            >
              <IconUser />
            </Link>
            <button
              type="button"
              className="nav-toggle"
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-controls="shell-mobile-nav"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
            >
              {menuOpen ? <IconClose /> : <IconMenu />}
            </button>
          </div>
        </div>
      </header>

      <div
        className="mobile-sheet"
        id="shell-mobile-nav"
        data-open={menuOpen}
        onClick={(e) => {
          if (e.target === e.currentTarget) setMenuOpen(false);
        }}
      >
        <nav className="mobile-sheet-inner" aria-label="NeuroLab surfaces">
          <div className="mobile-sheet-top">
            <strong>Menu</strong>
            <button
              type="button"
              className="mobile-sheet-close"
              onClick={() => setMenuOpen(false)}
              aria-label="Close menu"
            >
              <IconClose />
            </button>
          </div>
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? "page" : undefined}
            >
              {item.label}
              <span>{item.blurb}</span>
            </Link>
          ))}
          <div className="mobile-sheet-divider" />
          <Link href="/profile" aria-current={isActive("/profile") ? "page" : undefined}>
            Profile
            <span>Local shelf · saved modules</span>
          </Link>
        </nav>
      </div>
        </>
      )}

      <main
        id="main"
        className={
          canvas
            ? "shell-body shell-body--canvas"
            : wide
              ? "shell-body shell-body--wide"
              : "shell-body"
        }
      >
        {children}
      </main>
    </div>
  );
}
