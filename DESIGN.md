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

## Do not

- Restyle to white iOS light mode
- Liquid metal, orbs, 3D, big marketing heroes
- Homepage / `ignite-webflow-assets` restyle
- Install open-design, React Bits, Uiverse, Aura, mapcn
- Invent trademarks or AI-fake tenant logos — prefer API `image` / `logoUrl`
- Change lime, orange, or the Spark wordmark
