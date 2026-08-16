# Spark design contract

This file restates tokens already in `src/index.css` (spark-v2) so coding agents stay on-brand. **Do not restyle the product from this file.** Recaps, Jump, and Today are an ops console, not a marketing site.

## Tokens (already shipped)

| Token | Value | CSS |
| --- | --- | --- |
| Near-black | `#0a0d09` | `--spark-bg`, Daisy `--color-base-200` |
| Lime | `#c5f546` | `--spark-lime`, Daisy `--color-primary` |
| Orange | `#ef5a2a` | `--spark-orange` |
| Sky | `#5fb8ef` | `--spark-sky` |
| Surface | `#11140e` / `#161a12` | `--spark-surface` / `--spark-surface-2` |
| Border | `#1f2418` | `--spark-border` |

Use DaisyUI plus the existing `.spark-card`, `.chip`, `.chip-lime`, `.chip-orange`, `.label-mini` utilities. Keep Space Grotesk + JetBrains Mono (already self-hosted). **Do not add San Francisco** (licensing).

Field public URLs live on `client.igniteproductions.co`.

## Apple-ish (steal 4 treatments, not a new religion)

Kyle liked a bit of Apple-ish scanability. Steal only these, on the dark ops chrome:

1. **Grouped inset lists** — Recaps compact + Jump groups: small section label, hairline dividers, 12–16px radius container (iOS Settings, not a white sheet).
2. **Slightly larger card radius** — sheets/cards ~22px. Not squircle soup.
3. **Frosted topbar** — translucent + blur over the near-black slab. Keep lime chips.
4. **Soft shadow** — `0 8px 24px rgba(0,0,0,0.28)` on cards. Not neon lime glow, not glassmorphism.

System-like padding in sheets (enough to scan). Not empty marketing whitespace.

## Popover density (Aakib + Collect UI — steal 3, refuse the rest)

X `1Aakib` 2089078856636588493 was 403 / credits-depleted, so Aakib is inferred from his usual dark SaaS cards (tight hierarchy, compact overlays). Collect UI popup/modal gallery is client-rendered; we stole patterns, not shots.

1. **Stole — compact confirm** — scale+fade from the trigger, dim scrim, 16–20px radius, hairline. Title + one sentence + stacked lime / muted-cancel actions. Not a full-screen takeover.
2. **Stole — action-sheet grouping** — Jump groups, Ask AI follow-ups, tenant picker rows stay inset lists. Primary lime, cancel muted.
3. **Stole — share/copy toast** — corner chip, 16px radius, scale+fade. Same chrome as Coming Soon.

Refused: glassmorphism soup, 3D, white iOS sheets, Geist/new fonts, copying Collect UI Dribbble chrome, restyling every page, PhotoLightbox redo (already shipped).

## Tanjim + Best Designs on X (steal 3, refuse the rest)

Fetched via FxTwitter after X MCP 402 / x.com 403. Posts, not the Best Designs library.

1. **Stole — bento KPI tiles** — Recaps list + Today: compact 3–4 tiles, large tabular number, muted micro-label, optional hint. Lime / orange on real counts only. From Tanjim Lumis dashboard (`2072733178435862728`) and Tanjim data-heavy (`2029592653306753420`).
2. **Stole — numbered / stat lockups** — Recaps scan rows: stacked ENG / SOLD instead of a mono run-on. Jump: `01` index matching arrow-key order. From Abrar via Best Designs (`2089019356390834639`) + Tanjim data-heavy.
3. **Stole — type hierarchy** — Big number, small label, quieter metadata. Same Space Grotesk + JetBrains Mono. Not a new typeface.

Refused from these posts: light-mode SaaS chrome, “Welcome back Jane”, 3D/isometric template cards, hexagonal heatmaps, honeycomb, dot-matrix charts, neon cyan power-grid viz, sidebar restyle, homepage / liquid metal / orbs / glass soup. Did not redo PR 526 inset/frost/radius/shadow or PR 529 scale-from-trigger / action-sheet / toasts.

## Do not

- Restyle to white iOS light mode
- Liquid metal, orbs, 3D, big marketing heroes
- Homepage / `ignite-webflow-assets` restyle
- Install open-design, React Bits, Uiverse, Aura, mapcn
- Invent trademarks or AI-fake tenant logos — prefer API `image` / `logoUrl`
- Change lime, orange, or the Spark wordmark
