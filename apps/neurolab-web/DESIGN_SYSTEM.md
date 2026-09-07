# NeuroLab design system — "Instrument"

One visual language across the marketing page and the five app surfaces.
Everything lives in [`app/globals.css`](app/globals.css), organised in numbered
sections. **No raw hex outside section 01.**

## Direction

Monochrome graphite, one signal accent, and a dithered spike field as the brand
texture. The texture is not decoration: dot density stands in for spike density,
which is what the runtime actually computes.

Two surface registers, one system:

- **Document** — white/paper surfaces, hairline rules, generous whitespace. Used
  for reading and for working: library, verify, benchmark.
- **Glass** — translucent cards floating over a live 3D field, on an airy light
  stage. Used only on the landing (see below).
- **Instrument** — a near-black stage with floating glass rails. Used wherever a
  machine is running: the Sim Lab viewport, the WHY overlay, the recorded-action
  banner, the inverted architecture section. The stage stays dark in **both**
  light and dark themes, so "this is live execution" always reads the same.

## Themes

`:root` is light. `[data-theme="dark"]` and a `prefers-color-scheme` block
(guarded with `:root:not([data-theme="light"])`) supply the dark palette. The
choice is stored in `localStorage` under `nl-theme` and applied before first
paint by a small inline script in `app/layout.tsx`.

The primary CTA never hardcodes black or white — it uses the `--ink` / `--on-ink`
pair, which flips per theme.

## Colour

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` / `--bg-sunken` | `#f2f2f0` / `#e9e9e6` | `#0b0c0d` / `#08090a` | page, alternating sections |
| `--surface` … `--surface-3` | `#fff` → `#eeeeec` | `#131416` → `#1d1f22` | cards, inputs, hover fills |
| `--stage` / `--stage-2` | `#101113` / `#191b1e` | same | live-execution panels |
| `--text` | `#101113` | `#f1f1ef` | body, headings |
| `--text-muted` | `#5c5f63` | `#a2a5a9` | secondary copy (≥5.6:1) |
| `--text-subtle` | `#66696e` | `#85888d` | labels, kickers (≥4.8:1) |
| `--line` / `--line-strong` / `--line-heavy` | 3 steps | 3 steps | hairline, control border, emphasis |
| `--ink` / `--on-ink` | `#101113` / `#fff` | `#f1f1ef` / `#0b0c0d` | primary CTA, active nav |
| `--accent` | `#ff4d12` | `#ff4d12` | live state, trigger, focus ring, chart highlight |
| `--accent-text` | `#b33a05` | `#ff7a4d` | accent used as text |
| `--ok` / `--warn` / `--err` / `--info` | | | status, always paired with a label |

The accent is a *signal*, not a brand wash: reflex fired, live telemetry, the
measured row in a table. Primary buttons stay ink. Status is never communicated
by colour alone — every badge carries its word (`PASS`, `FAIL`, `IDLE`), and the
receipt checklist pairs its glyph with screen-reader text.

## Typography

Inter Tight (display) · Inter (body) · JetBrains Mono (data).

| Token | Size | Used for |
|---|---|---|
| `--fs-display` | `clamp(2.85rem, …, 6rem)` | hero |
| `--fs-h1` … `--fs-h4` | fluid | page and section headings |
| `--fs-lg` / `--fs-base` / `--fs-sm` / `--fs-xs` / `--fs-2xs` | 18 → 12px | lead, body, secondary, dense |
| `--fs-label` | 11px | `.kicker`, badges, metric labels |

Tracking tightens as size grows (`--tr-display: -0.045em` → `--tr-body: -0.011em`),
and labels open up (`--tr-label: 0.11em`, uppercase). Every number that can change
is set in the mono face with `tabular-nums` so readouts don't jitter.

## Spacing, radius, elevation

`--sp-1` … `--sp-13` on a 4px base; `--gutter` and `--section-y` are fluid.
Radii run `--r-xs` (4px) → `--r-2xl` (28px) → `--r-full`; controls are pills,
containers are 10–20px, and nothing gets a radius "because it's a card".
Five shadow steps, used sparingly — the light theme leans on hairlines, and
elevation is reserved for things that genuinely float (toolbars, menus, the
stage, toasts).

## The landing layer

The marketing page runs on the same tokens but adds a glass layer over a live
3D scene, in the register of the NEXA / Milo / SugarCRM references: an airy
light stage, one hero object, translucent cards floating above it.

**`.glass`** is the primitive — a two-stop translucent gradient, a bright inner
top edge, a hairline ring (`0 0 0 1px`) that separates it from a light ground,
and a long soft shadow. `<Tilt>` writes `--rx / --ry / --mx / --my` onto the
element so the card leans a few degrees toward the cursor while a specular
sweep tracks it; both flatten under `prefers-reduced-motion`.

**The hero scene** (`components/landing/NeuralField.tsx`) is a connectome:
nine bundles of fibres arcing across a volume, sampled into points and line
segments that share one spike model. Each fibre carries an action potential for
20% of its own cycle and is dark for the rest, so only a fraction of the field
fires at any instant — sparse, the way a spiking network actually behaves. A
shell of 1,100 drifting particles sits behind for depth, and everything fades
with distance. The scene reads `--text` and `--accent` from the page, follows
the theme toggle through a `MutationObserver`, parallaxes toward the pointer,
and stops rendering entirely when the hero scrolls out of view or the tab is
hidden.

It is loaded with `next/dynamic({ ssr: false })` behind a WebGL check, so the
landing's First Load JS stays at ~110 kB and the page is complete — with a CSS
dither field in place of the canvas — if WebGL is unavailable.

Hero figures are read from `public/benchmarks/latest.json` at build time, so the
numbers on the page are the measured ones or the cards do not render.

## Components

Primitives in section 04, all with hover / focus-visible / active / disabled and,
where relevant, loading and selected states:

`.btn` (`-primary`, `-ghost`, `-quiet`, `-danger`, `-sm`, `-lg`, `-block`,
`[data-loading]`) · `.icon-btn` · `.input` `.select` `.textarea` `.search-wrap`
`.switch` `.range` · `.field` + `.field-label` / `-hint` / `-error` ·
`.chip` · `.badge` · `.segmented` · `.tabs` / `.tab` · `.table` · `.tooltip` ·
`.panel` / `.card` / `.card-interactive` · `.notice` (ok/warn/err/info) ·
`.empty-state` · `.skeleton` · `.metric` · `.dither`.

Surface-specific styles build on these in sections 05–10 rather than restyling
from scratch.

## Responsive

Breakpoints at 1180 / 1024 / 820 / 560px, plus a `(pointer: coarse)` block that
raises every control to a comfortable target. Mobile is re-laid-out, not
compressed — the Sim Lab control rail unsticks and becomes a two-column grid,
the telemetry rail moves out of the 3D scene and under it, the search row
becomes block flow, and the compose inspector becomes an overlay drawer.

## Motion

`--dur-1` … `--dur-4` with `--ease` / `--ease-out`. Section reveals use
`animation-timeline: view()` behind `@supports`, so content is visible by
default where that is unsupported. Everything collapses under
`prefers-reduced-motion: reduce`, including the marquees, the card tilt, the
specular sweep and the hero scene's own animation.

## Accessibility

- Body and secondary text clear WCAG AA in both themes; label greys were tuned
  to `#66696e` / `#85888d` specifically to pass at 11px.
- Visible `:focus-visible` ring on the accent, offset from the control.
- Skip link to `#main`; every page's content is inside `<main id="main">`.
- Interactive targets ≥24px everywhere, ≥44px on coarse pointers.
- `prefers-contrast: more` thickens borders and darkens greys.
