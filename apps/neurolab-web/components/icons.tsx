/**
 * Icon set — 16px grid, 1.5 stroke, currentColor.
 * Kept in one file so weight and metrics stay consistent across surfaces.
 */
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 16, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const IconSearch = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="7.2" cy="7.2" r="4.2" />
    <path d="M10.4 10.4 13.5 13.5" />
  </Svg>
);

export const IconArrowRight = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2.8 8h10.4" />
    <path d="M9.2 4 13.2 8l-4 4" />
  </Svg>
);

export const IconSun = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="8" cy="8" r="3.1" />
    <path d="M8 1.4v1.5M8 13.1v1.5M1.4 8h1.5M13.1 8h1.5M3.3 3.3l1.1 1.1M11.6 11.6l1.1 1.1M12.7 3.3l-1.1 1.1M4.4 11.6l-1.1 1.1" />
  </Svg>
);

export const IconMoon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M13.2 9.6A5.6 5.6 0 0 1 6.4 2.8a5.6 5.6 0 1 0 6.8 6.8Z" />
  </Svg>
);

export const IconMenu = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" />
  </Svg>
);

export const IconClose = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 4l8 8M12 4l-8 8" />
  </Svg>
);

export const IconUser = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="8" cy="5.5" r="2.6" />
    <path d="M2.8 13.4c.7-2.4 2.5-3.7 5.2-3.7s4.5 1.3 5.2 3.7" />
  </Svg>
);

export const IconCheck = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 8.4 6.2 11.6 13 4.8" />
  </Svg>
);

export const IconLayers = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8 1.8 14.2 5 8 8.2 1.8 5 8 1.8Z" />
    <path d="M1.8 8 8 11.2 14.2 8" />
    <path d="M1.8 11 8 14.2 14.2 11" />
  </Svg>
);

export const IconFolder = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2.4 12.6V4.6A1.2 1.2 0 0 1 3.6 3.4h3.1l1.3 1.6h4.4A1.2 1.2 0 0 1 13.6 6.2v6.4a1.2 1.2 0 0 1-1.2 1.2H3.6A1.2 1.2 0 0 1 2.4 12.6Z" />
  </Svg>
);

export const IconSave = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 2.8h8l2.2 2.2v8.2H3V2.8Z" />
    <path d="M5.6 2.8v2.8h5V2.8" />
  </Svg>
);

export const IconImport = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8 2.4v7.4" />
    <path d="M5.2 7.2 8 9.8l2.8-2.6" />
    <path d="M3.2 12.4h9.6" />
  </Svg>
);

export const IconPlay = (p: IconProps) => (
  <Svg {...p} fill="currentColor" stroke="none">
    <path d="M5.2 3.4v9.2L13 8 5.2 3.4Z" />
  </Svg>
);

export const IconDownload = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8 2.4v7.4" />
    <path d="M5.2 7.2 8 9.8l2.8-2.6" />
    <path d="M3.2 12.4h9.6" />
  </Svg>
);

export const IconSimulate = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="8" cy="8" r="5.4" />
    <path d="M6.6 5.6v4.8L11 8 6.6 5.6Z" fill="currentColor" stroke="none" />
  </Svg>
);

export const IconRefresh = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12.8 7.2A4.8 4.8 0 1 1 11.4 3.6" />
    <path d="M12.8 3.2v4h-4" />
  </Svg>
);

export const IconPanel = (p: IconProps) => (
  <Svg {...p} strokeWidth={1.25}>
    <rect x="2.6" y="2.6" width="10.8" height="10.8" rx="2" />
    <path d="M10.6 2.6v10.8" />
  </Svg>
);

export const IconCopy = (p: IconProps) => (
  <Svg {...p}>
    <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
    <path d="M10.5 5.5V4A1.5 1.5 0 0 0 9 2.5H4A1.5 1.5 0 0 0 2.5 4v5A1.5 1.5 0 0 0 4 10.5h1.5" />
  </Svg>
);
