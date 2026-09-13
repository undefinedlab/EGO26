import type { ReactNode } from "react";
import type { Metadata } from "next";
import { Inter, Inter_Tight, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const interTight = Inter_Tight({
  subsets: ["latin"],
  variable: "--font-inter-tight",
  weight: ["500", "600", "700", "800"],
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["400", "500", "600"],
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono-jb",
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "SynapseVM — NeuroLab",
    template: "%s · SynapseVM NeuroLab",
  },
  description:
    "Compile connectome-derived circuits into tiny deterministic controllers that run locally, then prove every critical action with a replayable NeuroReceipt.",
};

/**
 * Light is the only product theme. Clear any older dark preference so OS dark
 * mode and leftover localStorage cannot flip the palette.
 */
const THEME_BOOTSTRAP = `(function(){try{localStorage.removeItem("nl-theme")}catch(e){}document.documentElement.setAttribute("data-theme","light")})()`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      data-theme="light"
      className={`${interTight.variable} ${inter.variable} ${jetbrains.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
