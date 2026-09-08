"use client";

import { useEffect, useState } from "react";
import { IconMoon, IconSun } from "@/components/icons";

type Theme = "light" | "dark";

function systemTheme(): Theme {
  return typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem("nl-theme");
    setTheme(stored === "light" || stored === "dark" ? stored : systemTheme());
  }, []);

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      window.localStorage.setItem("nl-theme", next);
    } catch {
      /* storage unavailable — the toggle still applies for this session */
    }
  };

  // Render a stable shell until the client resolves the active theme, so the
  // button never flashes the wrong icon during hydration.
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Light theme" : "Dark theme"}
    >
      {theme === null ? <IconSun /> : isDark ? <IconSun /> : <IconMoon />}
    </button>
  );
}
