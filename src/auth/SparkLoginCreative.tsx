import { useEffect, useState } from "react";
import type { TenantColorScheme } from "@/utils/tenantThemeConfig";

/**
 * Right-hand login panel — React port of the Spark Login Creative
 * handoff (`Spark Login Creative.html` → Option C, word-morph hero).
 *
 * This is the full Option C composition: flex-column rhythm, the
 * numbered left rail, the stacked/sliding headline, the cycle-progress
 * bar, the stat ledger, and corner registration marks.
 *
 * Deliberate deviations from the design file, all load-bearing:
 *  - No "LIVE OPS" pill in the header. Kyle cut it previously as
 *    redundant with the Spark wordmark sitting inches away; that call
 *    still holds, so the header is wordmark-only.
 *  - Image refs point at the Firebase-hosted `/legal/...` copies
 *    rather than the design's relative `assets/...` paths.
 *  - The headline and its window are clamp()-sized instead of the
 *    artboard's fixed 58px/152px. The artboard is a fixed 660px; this
 *    panel is `w-1/2` of any viewport >= 1024px, so at the low end a
 *    hard 58px overflows the 152px window and clips descenders.
 *
 * Keyframes (spk-*) live in src/index.css. WORD_INTERVAL_MS must stay
 * in sync with the spk-prog duration there, or the progress bar drifts
 * out of phase with the word changes.
 */

const WORDS = [
  "Book staff quicker.",
  "Manage your field team.",
  "Sample faster.",
  "Get recaps quicker.",
  "Track every shift.",
  "See what's working.",
] as const;

const WORD_INTERVAL_MS = 2400;

const LIME = "#D6F35F";
const BONE = "#F5F2EC";
const ORANGE = "#FF5A1F";

const STATS: ReadonlyArray<readonly [string, string]> = [
  ["257K+", "AMBASSADORS"],
  ["50", "STATES"],
  ["48HR", "RUSH STAFFING"],
];

/** Corner registration marks — [vertical, horizontal] edge pair. */
const CORNERS: ReadonlyArray<readonly ["top" | "bottom", "left" | "right"]> = [
  ["top", "left"],
  ["top", "right"],
  ["bottom", "left"],
  ["bottom", "right"],
];

type Props = {
  colorScheme: TenantColorScheme;
  onColorScheme: (s: TenantColorScheme) => void;
};

/**
 * Props are accepted but unused: the theme toggle that needed them was
 * moved out of this panel. They stay in the signature because Login,
 * ForgotPassword, and ResetPassword all pass them, and narrowing that
 * contract is a bigger change than a creative swap should make.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- see note above
export default function SparkLoginCreative(_props: Props) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(
      () => setIdx((i) => (i + 1) % WORDS.length),
      WORD_INTERVAL_MS,
    );
    return () => clearInterval(id);
  }, []);

  return (
    <div
      className="hidden lg:flex w-1/2 relative overflow-hidden"
      style={{
        background: "linear-gradient(180deg, #0A0B0D 0%, #14110D 100%)",
        color: BONE,
        fontFamily: "var(--font-body, system-ui, sans-serif)",
      }}
    >
      {/* ---------- Atmosphere ---------- */}

      {/* Drifting lime grid, masked to a soft center ellipse */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(214,243,95,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(214,243,95,0.06) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          animation: "spk-grid-drift 32s linear infinite",
          maskImage:
            "radial-gradient(ellipse 70% 60% at 50% 50%, black 30%, transparent 90%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 70% 60% at 50% 50%, black 30%, transparent 90%)",
          pointerEvents: "none",
        }}
      />
      {/* Glow A — lime, upper left */}
      <div
        style={{
          position: "absolute",
          left: "-15%",
          top: "10%",
          width: "80%",
          height: "70%",
          background:
            "radial-gradient(ellipse, rgba(214,243,95,0.30), transparent 65%)",
          filter: "blur(30px)",
          animation: "spk-glow-a 22s ease-in-out infinite",
          pointerEvents: "none",
        }}
      />
      {/* Glow B — orange, lower right */}
      <div
        style={{
          position: "absolute",
          right: "-10%",
          bottom: "-10%",
          width: "60%",
          height: "70%",
          background:
            "radial-gradient(ellipse, rgba(255,90,31,0.16), transparent 65%)",
          filter: "blur(28px)",
          animation: "spk-glow-b 18s ease-in-out infinite",
          pointerEvents: "none",
        }}
      />

      {/* Particle field — deterministic scatter, each dot on its own period */}
      {Array.from({ length: 22 }).map((_, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: ((i * 47) % 100) + "%",
            top: ((i * 73) % 100) + "%",
            width: 3,
            height: 3,
            borderRadius: 999,
            background: LIME,
            opacity: 0.4,
            boxShadow: `0 0 6px ${LIME}`,
            animation: `spk-pulse ${2 + (i % 5) * 0.4}s ease-in-out infinite`,
            animationDelay: i * 0.18 + "s",
            pointerEvents: "none",
          }}
        />
      ))}

      {/* Oversized SPARK stencil, bottom-left, slow horizontal pan */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: -100,
          bottom: -150,
          fontFamily: "var(--font-stencil)",
          fontSize: 380,
          fontWeight: 900,
          lineHeight: 0.85,
          letterSpacing: "-0.06em",
          color: "rgba(214,243,95,0.045)",
          textTransform: "uppercase",
          animation: "spk-stencil-pan 30s ease-in-out infinite alternate",
          pointerEvents: "none",
          userSelect: "none",
        }}
      >
        SPARK
      </div>

      {/* Corner registration marks — print-shop framing device */}
      {CORNERS.map(([v, h]) => (
        <span
          key={`${v}-${h}`}
          aria-hidden
          style={{
            position: "absolute",
            width: 36,
            height: 36,
            pointerEvents: "none",
            [v]: 32,
            [h]: 32,
            [v === "top" ? "borderTop" : "borderBottom"]:
              "1px solid rgba(214,243,95,0.3)",
            [h === "left" ? "borderLeft" : "borderRight"]:
              "1px solid rgba(214,243,95,0.3)",
          }}
        />
      ))}

      {/* ---------- Composition ---------- */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          padding: "56px 56px 50px",
          zIndex: 5,
        }}
      >
        {/* Header — wordmark only (see note above re: the LIVE OPS pill) */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            gap: 16,
          }}
        >
          <img
            src="/legal/spark-logo-full.png"
            alt="Spark by Ignite"
            style={{
              height: 42,
              width: "auto",
              filter: "drop-shadow(0 0 18px rgba(214,243,95,0.45))",
            }}
          />
        </div>

        {/* Hero — one dominant type block, vertically centered */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            minHeight: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 20,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: 999,
                background: LIME,
                boxShadow: `0 0 8px ${LIME}`,
                animation: "spk-pulse 1.6s infinite",
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                letterSpacing: "0.26em",
                color: "rgba(245,242,236,0.4)",
                textTransform: "uppercase",
              }}
            >
              The command center for field marketing
            </span>
          </div>

          {/* Numbered rail + morphing headline */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "52px 1fr",
              gap: 22,
              alignItems: "stretch",
            }}
          >
            <div
              aria-hidden
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: 10,
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 13,
                  fontWeight: 700,
                  color: LIME,
                  lineHeight: 1,
                }}
              >
                {String(idx + 1).padStart(2, "0")}
              </span>
              <span
                style={{
                  width: 1,
                  flex: 1,
                  background:
                    "linear-gradient(180deg, rgba(214,243,95,0.55), rgba(214,243,95,0.05))",
                }}
              />
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  color: "rgba(245,242,236,0.3)",
                  lineHeight: 1,
                }}
              >
                {String(WORDS.length).padStart(2, "0")}
              </span>
            </div>

            <div>
              {/* Stacked words — the active one sits at rest, the ones
                  already shown wait just above, the rest just below. */}
              <div
                aria-live="polite"
                style={{
                  position: "relative",
                  height: "clamp(96px, 9.5vw, 152px)",
                  overflow: "hidden",
                }}
              >
                {WORDS.map((w, i) => {
                  const isActive = i === idx;
                  const hasPassed =
                    i < idx || (idx === 0 && i === WORDS.length - 1);
                  return (
                    <div
                      key={w}
                      style={{
                        position: "absolute",
                        inset: 0,
                        fontFamily: "var(--font-display)",
                        fontWeight: 800,
                        fontSize: "clamp(34px, 3.6vw, 58px)",
                        lineHeight: 1.05,
                        letterSpacing: "-0.04em",
                        color: LIME,
                        fontStyle: "italic",
                        textWrap: "balance",
                        textShadow:
                          "0 0 60px rgba(214,243,95,0.5), 0 0 18px rgba(214,243,95,0.28)",
                        opacity: isActive ? 1 : 0,
                        transform: isActive
                          ? "translateY(0)"
                          : hasPassed
                            ? "translateY(-55%)"
                            : "translateY(55%)",
                        // Asymmetric fade: the outgoing line clears fast
                        // while the incoming one eases up. The artboard
                        // used a symmetric 600ms cross-fade at ±26%, but
                        // at our clamped sizes that leaves both lines lit
                        // at 50% for a beat, and the heavy lime glow turns
                        // the overlap into a smear. Same motion language,
                        // just no double-exposure.
                        transition: isActive
                          ? "opacity 420ms ease-out, transform 600ms cubic-bezier(0.2,0.7,0.2,1)"
                          : "opacity 200ms ease-in, transform 600ms cubic-bezier(0.2,0.7,0.2,1)",
                      }}
                    >
                      {w}
                    </div>
                  );
                })}
              </div>

              {/* Cycle progress — remounts per word so the fill restarts */}
              <div
                style={{
                  height: 2,
                  background: "rgba(245,242,236,0.1)",
                  overflow: "hidden",
                }}
              >
                <div
                  key={idx}
                  style={{
                    height: "100%",
                    background: LIME,
                    transformOrigin: "left center",
                    boxShadow: "0 0 10px rgba(214,243,95,0.6)",
                    animation: `spk-prog ${WORD_INTERVAL_MS}ms linear forwards`,
                  }}
                />
              </div>

              <p
                style={{
                  margin: "24px 0 0",
                  fontSize: 16,
                  lineHeight: 1.55,
                  color: "rgba(245,242,236,0.72)",
                  maxWidth: 440,
                }}
              >
                Live dashboards. GPS clock-ins. Auto-generated recaps. One
                platform, every program.
              </p>
            </div>
          </div>
        </div>

        {/* Stat ledger — hairline grid, lime figures */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 1,
            background: "rgba(245,242,236,0.1)",
            border: "1px solid rgba(245,242,236,0.1)",
            marginBottom: 28,
          }}
        >
          {STATS.map(([value, label]) => (
            <div
              key={label}
              style={{ background: "rgba(10,11,13,0.75)", padding: "18px 14px" }}
            >
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontWeight: 700,
                  fontSize: 24,
                  color: LIME,
                  letterSpacing: "-0.01em",
                }}
              >
                {value}
              </div>
              <div
                style={{
                  marginTop: 6,
                  fontFamily: "var(--font-mono)",
                  fontSize: 9.5,
                  letterSpacing: "0.16em",
                  color: "rgba(245,242,236,0.45)",
                }}
              >
                {label}
              </div>
            </div>
          ))}
        </div>

        {/* Footer — Powered by Ignite / veteran-owned */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
          }}
        >
          <div style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                letterSpacing: "0.22em",
                color: "rgba(245,242,236,0.4)",
                textTransform: "uppercase",
              }}
            >
              POWERED BY
            </span>
            <img
              src="/legal/ignite-full-white.png"
              alt="Ignite Productions"
              style={{ height: 22, width: "auto", opacity: 0.95 }}
            />
          </div>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontFamily: "var(--font-mono)",
              fontSize: 10.5,
              letterSpacing: "0.2em",
              color: ORANGE,
              textTransform: "uppercase",
            }}
          >
            <span aria-hidden>▲</span> VETERAN-OWNED
          </div>
        </div>
      </div>
    </div>
  );
}
