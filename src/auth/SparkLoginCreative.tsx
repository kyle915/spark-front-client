import { useEffect, useState } from "react";
import ThemeToggle from "@/shared/ThemeToggle";
import type { TenantColorScheme } from "@/utils/tenantThemeConfig";

/**
 * Verbatim React port of the Spark Login Creative handoff
 * (`Spark Login Creative.html` → Option C, the word-morph hero).
 *
 * Every dimension, color, transform, animation, and copy line was
 * lifted from the design file. Only changes: split into a component
 * file, swapped the absolute `assets/...` image refs for the
 * Firebase-hosted `/legal/...` versions we copied over, and added a
 * TypeScript prop for the theme toggle.
 */
export default function SparkLoginCreative({
  colorScheme,
  onColorScheme,
}: {
  colorScheme: TenantColorScheme;
  onColorScheme: (s: TenantColorScheme) => void;
}) {
  const words = [
    "Book staff quicker.",
    "Manage your field team.",
    "Sample faster.",
    "Get recaps quicker.",
    "Track every shift.",
    "See what's working.",
  ];
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setIdx((i) => (i + 1) % words.length), 2400);
    return () => clearInterval(id);
  }, [words.length]);

  return (
    <div
      className="hidden lg:flex w-1/2 relative overflow-hidden"
      style={{
        background: "linear-gradient(180deg, #0A0B0D 0%, #14110D 100%)",
        color: "#F5F2EC",
        fontFamily: "var(--font-body, system-ui, sans-serif)",
      }}
    >
      {/* Theme toggle floats top-right corner so the design isn't
          intruded on. */}
      <div className="absolute top-4 right-4 z-30">
        <ThemeToggle value={colorScheme} onChange={onColorScheme} />
      </div>

      {/* Drifting grid */}
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
        }}
      />
      {/* Glow A — lime */}
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
        }}
      />
      {/* Glow B — orange */}
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
        }}
      />

      {/* Particle field — 22 dots, each pulsing on its own period */}
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
            background: "#D6F35F",
            opacity: 0.4,
            boxShadow: "0 0 6px #D6F35F",
            animation: `spk-pulse ${2 + (i % 5) * 0.4}s ease-in-out infinite`,
            animationDelay: i * 0.18 + "s",
          }}
        />
      ))}

      {/* Massive SPARK stencil at bottom-left, slowly panning */}
      <div
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
        }}
      >
        SPARK
      </div>

      {/* Top eyebrow */}
      <div
        style={{
          position: "absolute",
          top: 56,
          left: 56,
          right: 56,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          zIndex: 5,
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            padding: "8px 14px",
            borderRadius: 999,
            background: "rgba(214,243,95,0.1)",
            border: "1px solid rgba(214,243,95,0.4)",
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: "#D6F35F",
              boxShadow: "0 0 12px #D6F35F",
              animation: "spk-pulse 1.6s infinite",
            }}
          />
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.22em",
              color: "#D6F35F",
              textTransform: "uppercase",
            }}
          >
            LIVE OPS · BY IGNITE
          </span>
        </div>
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

      {/* Word-morph hero */}
      <div
        style={{
          position: "absolute",
          top: "38%",
          left: 56,
          right: 56,
          transform: "translateY(-50%)",
          zIndex: 5,
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            letterSpacing: "0.3em",
            color: "rgba(245,242,236,0.45)",
            textTransform: "uppercase",
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: 999,
              background: "#D6F35F",
              boxShadow: "0 0 8px #D6F35F",
              animation: "spk-pulse 1.6s infinite",
            }}
          />
          FIELD MARKETING, FINALLY ↓
        </div>
        <div style={{ position: "relative", height: 168, overflow: "hidden" }}>
          {words.map((w, i) => (
            <div
              key={w}
              style={{
                position: "absolute",
                inset: 0,
                fontFamily: "var(--font-display)",
                fontWeight: 800,
                fontSize: 62,
                lineHeight: 1.04,
                letterSpacing: "-0.04em",
                color: "#D6F35F",
                opacity: i === idx ? 1 : 0,
                transform:
                  i === idx
                    ? "translateY(0)"
                    : i < idx || (idx === 0 && i === words.length - 1)
                      ? "translateY(-30%)"
                      : "translateY(30%)",
                transition:
                  "opacity 600ms cubic-bezier(0.2,0.7,0.2,1), transform 600ms cubic-bezier(0.2,0.7,0.2,1)",
                textShadow:
                  "0 0 60px rgba(214,243,95,0.55), 0 0 18px rgba(214,243,95,0.3)",
                fontStyle: "italic",
              }}
            >
              {w}
            </div>
          ))}
        </div>
        <h3
          style={{
            marginTop: 20,
            fontFamily: "var(--font-display)",
            fontWeight: 800,
            fontSize: 42,
            lineHeight: 0.95,
            letterSpacing: "-0.03em",
            color: "#F5F2EC",
          }}
        >
          The command center
          <br />
          for field marketing.
        </h3>
        <p
          style={{
            marginTop: 20,
            fontSize: 16,
            lineHeight: 1.55,
            color: "rgba(245,242,236,0.78)",
            maxWidth: 460,
          }}
        >
          Live dashboards. GPS clock-ins. Auto-generated recaps. One
          platform, every program.
        </p>
      </div>

      {/* Bottom strip — Powered by Ignite + Veteran-owned tag */}
      <div
        style={{
          position: "absolute",
          bottom: 50,
          left: 56,
          right: 56,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          zIndex: 5,
        }}
      >
        <div
          style={{ display: "inline-flex", alignItems: "center", gap: 12 }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              letterSpacing: "0.22em",
              color: "rgba(245,242,236,0.45)",
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
            fontSize: 11,
            letterSpacing: "0.22em",
            color: "#FF5A1F",
            textTransform: "uppercase",
          }}
        >
          <span style={{ color: "#FF5A1F" }}>▲</span> VETERAN-OWNED
        </div>
      </div>
    </div>
  );
}
