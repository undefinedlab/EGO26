import type { ReactNode } from "react";
import { LandingNav } from "@/components/LandingNav";

/** Landing-adjacent chrome for Contact / Terms / Docs mock pages. */
export function SiteFrame({ children }: { children: ReactNode }) {
  return (
    <div className="site">
      <LandingNav />
      {children}
    </div>
  );
}
