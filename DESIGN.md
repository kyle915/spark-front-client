# Spark design contract

This file restates tokens already in `src/index.css` (spark-v2) so coding agents stay on-brand. **Do not restyle the product from this file.** Recaps, Jump, and Today are an ops console, not a marketing site.

## Appearance

**Light is the default** (`src/theme/appearance.ts`); dark is a per-browser choice in the account menu. Every token below has a light and a dark value in `src/index.css`. Where this file says "near-black" or "dark ops", read it as the dark appearance, not the default. Design and check new work in light first, then dark.

## Type and shape scale (stage 1: Dashboard and Recaps)

Pages that opt in with `.spark-scale` follow a small fixed scale:

- **Type:** nothing smaller than 12px. 12px for labels and meta, 14px for body, the existing figure classes for numbers, the page title for titles.
- **Labels:** sentence case, no letter-spacing. No all-caps micro-labels, and no eyebrow line above a page title.
- **Text colour:** `--spark-text`, `--spark-text-secondary`, `--spark-text-meta` only. Orange (`--spark-flag-ink` for text) only for things that need someone.
- **Corners:** `--spark-radius-control` (8px), `--spark-radius-card` (14px), or a full pill.

New work on any page should follow this scale. When it has rolled out everywhere, the rules move onto the base classes and `.spark-scale` is removed.

## Tokens (already shipped)

| Token | Value | CSS |
| --- | --- | --- |
| Near-black | `#0A0B0D` | `--spark-bg`, Daisy `--color-base-200` |
| Quiet figure / `--spark-lime` | `#f2f3ee` | Off-white accent token name kept for callers; **not** highlighter lime |
| Orange | `#ef5a2a` | `--spark-orange` — sole chromatic brand mark (warnings, active nav tick, Needs-you) |
| Sky | `#5fb8ef` | `--spark-sky` |
| Surface | `#141416` / `#1a1a1d` | `--spark-surface` / `--spark-surface-2` |
| Border | `#2a2a2e` | `--spark-border` |
| Spring | `cubic-bezier(0.22, 1, 0.36, 1)` · `0.35s` | `--spark-spring` / `--spark-spring-duration` |

Daisy `--color-primary` on spark-v2 is the quiet off-white (`#f2f3ee`), not neon lime. Use DaisyUI plus `.spark-card`, `.chip`, `.chip-lime` (quiet fill), `.chip-orange`, `.label-mini`. Keep Space Grotesk + JetBrains Mono (already self-hosted). **Do not add San Francisco** (licensing).

Field public URLs live on `client.igniteproductions.co`.

## Quieter dark ops (shipped)

Dashboards and chrome lead with one off-white figure, sentence-case labels, and **orange only** for warnings / Needs-you / the active nav tick. Highlighter lime `#c5f546` is retired from ops chrome. Apple-ops means tighter surfaces, springy sheets (`SparkSheet` / overlays), and ticking KPI numbers (`CountReel`) — not SF Pro, Liquid Glass, lime neon, or a light iOS skin.

Light **RecapDocument** paper stays high-contrast readable. Do not paint dark-ops muted text onto recap paper.

**Less chrome (Linear restraint):** prefer `SparkPageHeader` (`.spark-page-header`) over handmade hero h1 stacks — quieter eyebrow, smaller title, shorter support.

## Pattern steals (into existing components — no stack swap)

1. **Tremor KPI lockups** — `.spark-kpi-lockup`: JetBrains figure, muted Space Grotesk label, optional `.spark-kpi-delta.is-attention`. Insights / AttentionEngine / Needs-you / Account Map. Chart.js stays; empty charts use `.spark-chart-empty`.
2. **DashWind card/stat spacing** — `.spark-stat-band` + `.spark-stat-band-grid` on Client Home / Today / Needs-you. Near-black + orange tokens only (ignore colorful Daisy themes).
3. **Origin / coss Jump** — refine `CommandPalette` (recents, recaps, events, requests, stores → Account Map `?q=`, clients, people). Spring from trigger. **No cmdk.**

## Apple-ish (steal 4 treatments, not a new religion)

Kyle liked a bit of Apple-ish scanability. Steal only these, on the dark ops chrome:

1. **Grouped inset lists** — Recaps compact + Jump groups: small section label, hairline dividers, 12–16px radius container (iOS Settings, not a white sheet).
2. **Slightly larger card radius** — sheets/cards ~22px. Not squircle soup.
3. **Frosted topbar** — translucent + blur over the near-black slab. Quiet chips, orange for attention.
4. **Soft shadow** — `0 8px 24px rgba(0,0,0,0.28)` on cards. Not neon glow, not glassmorphism.

System-like padding in sheets (enough to scan). Not empty marketing whitespace. Sheet / overlay motion uses `--spark-spring`.

## Popover density (Aakib + Collect UI — steal 3, refuse the rest)

X `1Aakib` 2089078856636588493 was 403 / credits-depleted, so Aakib is inferred from his usual dark SaaS cards (tight hierarchy, compact overlays). Collect UI popup/modal gallery is client-rendered; we stole patterns, not shots.

1. **Stole — compact confirm** — scale+fade from the trigger, dim scrim, 16–20px radius, hairline. Title + one sentence + stacked primary / muted-cancel actions. Not a full-screen takeover.
2. **Stole — action-sheet grouping** — Jump groups, Ask AI follow-ups, tenant picker rows stay inset lists. Primary quiet off-white or orange when it is attention; cancel muted.
3. **Stole — share/copy toast** — corner chip, 16px radius, scale+fade. Same chrome as Coming Soon.

Refused: glassmorphism soup, 3D, white iOS sheets, Geist/new fonts, copying Collect UI Dribbble chrome, restyling every page, PhotoLightbox redo (already shipped).

## Tanjim + Best Designs on X (steal 3, refuse the rest)

Fetched via FxTwitter after X MCP 402 / x.com 403. Posts, not the Best Designs library.

1. **Stole — bento KPI tiles** — Recaps list + Today / Needs-you: compact tiles, large tabular number (`CountReel` when the count is live), muted micro-label. Orange on real attention counts only.
2. **Stole — numbered / stat lockups** — Recaps scan rows: stacked ENG / SOLD instead of a mono run-on. Jump: `01` index matching arrow-key order.
3. **Stole — type hierarchy** — Big number, small label, quieter metadata. Same Space Grotesk + JetBrains Mono. Not a new typeface.

Refused from these posts: light-mode SaaS chrome, “Welcome back Jane”, 3D/isometric template cards, hexagonal heatmaps, honeycomb, dot-matrix charts, neon cyan power-grid viz, sidebar restyle, homepage / liquid metal / orbs / glass soup.

## Do not

- Restyle to white iOS light mode
- Liquid metal, orbs, 3D, big marketing heroes
- Homepage / `igniteproductions.co` / `ignite-webflow-assets` restyle
- Install open-design, React Bits, Uiverse, Aura, mapcn, or migrate Jump to cmdk
- Invent trademarks or AI-fake tenant logos — prefer API `image` / `logoUrl`
- Bring back highlighter lime as primary, or change the Spark wordmark
