"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DOC_NAV } from "@/lib/docsContent";

export function DocsNav() {
  const pathname = usePathname();
  const active = pathname?.replace(/\/$/, "") ?? "";

  return (
    <nav className="docs-nav" aria-label="Documentation">
      <p className="kicker">Docs</p>
      <ul>
        {DOC_NAV.map((item) => {
          const href = `/docs/${item.slug}`;
          const isActive = active === href || (item.slug === "overview" && active === "/docs");
          return (
            <li key={item.slug}>
              <Link
                href={href}
                className="docs-nav-btn"
                data-active={isActive ? "true" : "false"}
                aria-current={isActive ? "page" : undefined}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
