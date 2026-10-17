/**
 * Public BA training hub — `/training/:code`, no login.
 *
 * A brand's BAs are usually not Spark users at the moment training matters:
 * they're hired for one campaign and get a link by text. So this page takes
 * no auth, holds no state, and renders whatever `GET /api/public/training/
 * <code>` returns — the backend owns the content, this owns the presentation.
 *
 * Tenant-skinned: Liquid Death keeps its own cream/blood/Bungee world (the
 * field guide it links into commits hard to that look). Every other brand
 * gets the neutral Spark dark chrome plus its own logo/name — never LD's
 * skin borrowed by accident. The hub payload carries no accent/logo, so
 * the logo resolves through the same tenant-logo candidates check-in uses.
 */

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useParams } from "react-router";
import PublicDeadLink from "@/public/PublicDeadLink";
import {
  normalizeTenantKey,
  tenantLogoCandidates,
  tenantLogoPlate,
} from "@/layout/tenantLogo";

type ResourceKind = "video" | "pdf" | "link" | "page";

type Resource = {
  id: number;
  kind: ResourceKind;
  title: string;
  description: string;
  url: string;
  embedUrl: string | null;
  metaLabel: string;
};

type Hub = {
  code: string;
  title: string;
  subtitle: string;
  intro: string;
  brandName: string;
  resources: Resource[];
};

function apiOrigin(): string {
  try {
    return new URL(import.meta.env.VITE_GRAPHQL_ENDPOINT as string).origin;
  } catch {
    return "";
  }
}

/* Impact is the one heavy condensed face present on effectively every phone
   and desktop, which is why the brand's own guide falls back to it. No
   webfont round trip on a page BAs open on store LTE. */
const DISPLAY =
  'Bungee, Impact, Haettenschweiler, "Arial Narrow Bold", "Franklin Gothic Bold", sans-serif';
const MONO = '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace';
const BODY =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif';

const INK = "#0A0A0A";
const CREAM = "#F4EFE3";
const BLOOD = "#D9251D";
const GOLD = "#FFD83D";
const MUTED = "#8C8880"; // warm grey, biased toward the cream rather than pure

export type TrainingHubTheme = {
  isLiquidDeath: boolean;
  displayFont: string;
  bg: string;
  text: string;
  accent: string;
  secondary: string;
  muted: string;
  cardBg: string;
  cardBorder: string;
  description: string;
  buttonBg: string;
  buttonColor: string;
  videoButtonBg: string;
};

export function isLiquidDeathBrand(
  brandName: string | null | undefined,
): boolean {
  return normalizeTenantKey(brandName).includes("liquiddeath");
}

/** LD keeps its guide skin; everyone else gets neutral Spark dark + lime. */
export function trainingHubTheme(
  brandName: string | null | undefined,
): TrainingHubTheme {
  if (isLiquidDeathBrand(brandName)) {
    return {
      isLiquidDeath: true,
      displayFont: DISPLAY,
      bg: INK,
      text: CREAM,
      accent: BLOOD,
      secondary: GOLD,
      muted: MUTED,
      cardBg: "#121110",
      cardBorder: "rgba(244,239,227,0.14)",
      description: "rgba(244,239,227,0.72)",
      buttonBg: CREAM,
      buttonColor: INK,
      videoButtonBg: GOLD,
    };
  }
  return {
    isLiquidDeath: false,
    displayFont:
      "'Space Grotesk', 'Helvetica Neue', Arial, sans-serif",
    bg: "#0A0B0D",
    text: "#F2F3EE",
    accent: "#c5f546",
    secondary: "#c5f546",
    muted: "rgba(242,243,238,0.55)",
    cardBg: "#11140e",
    cardBorder: "rgba(255,255,255,0.08)",
    description: "rgba(242,243,238,0.72)",
    buttonBg: "#c5f546",
    buttonColor: "#0A0B0D",
    videoButtonBg: "#c5f546",
  };
}

/** Same official marks check-in / spark-form resolve; null when unknown. */
export function trainingHubLogoSrc(
  brandName: string | null | undefined,
): string | null {
  return tenantLogoCandidates({ name: brandName ?? "" })[0] ?? null;
}

const KIND_LABEL: Record<ResourceKind, string> = {
  page: "Guide",
  video: "Video",
  pdf: "PDF",
  link: "Website",
};

/** Open PDFs and external links in a new tab; keep the SPA tab alive. */
function openExternally(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}

function ResourceCard({
  res,
  index,
  theme,
}: {
  res: Resource;
  index: number;
  theme: TrainingHubTheme;
}) {
  const [playing, setPlaying] = useState(false);
  const isVideo = res.kind === "video";
  const selfHostedVideo = isVideo && !res.embedUrl;

  return (
    <li
      style={{
        listStyle: "none",
        border: `1px solid ${theme.cardBorder}`,
        background: theme.cardBg,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ display: "flex", gap: 16, padding: "20px 18px" }}>
        <div
          aria-hidden="true"
          style={{
            fontFamily: theme.displayFont,
            fontSize: 34,
            lineHeight: 1,
            color: theme.accent,
            minWidth: 40,
          }}
        >
          {String(index + 1).padStart(2, "0")}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: MONO,
              fontSize: 10,
              letterSpacing: "0.18em",
              color: theme.muted,
              textTransform: "uppercase",
              marginBottom: 8,
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <span>{KIND_LABEL[res.kind]}</span>
            {res.metaLabel ? (
              <span style={{ color: theme.secondary }}>{res.metaLabel}</span>
            ) : null}
          </div>

          <h2
            style={{
              fontFamily: theme.displayFont,
              fontSize: "clamp(20px, 5vw, 26px)",
              lineHeight: 1.1,
              color: theme.text,
              margin: "0 0 8px",
              textWrap: "balance",
            }}
          >
            {res.title}
          </h2>

          {res.description ? (
            <p
              style={{
                fontFamily: BODY,
                fontSize: 15,
                lineHeight: 1.55,
                color: theme.description,
                margin: "0 0 16px",
                maxWidth: "60ch",
              }}
            >
              {res.description}
            </p>
          ) : null}

          {/* Video plays inline; everything else opens in its own tab so the
              BA doesn't lose their place in the list. */}
          {!isVideo ? (
            <button
              type="button"
              onClick={() => openExternally(res.url)}
              style={{
                fontFamily: MONO,
                fontSize: 12,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: theme.buttonColor,
                background: theme.buttonBg,
                border: "none",
                padding: "11px 18px",
                cursor: "pointer",
                minHeight: 44,
              }}
            >
              {res.kind === "pdf" ? "Open PDF" : "Open"}
            </button>
          ) : null}

          {isVideo && !playing ? (
            <button
              type="button"
              onClick={() => setPlaying(true)}
              style={{
                fontFamily: MONO,
                fontSize: 12,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: theme.buttonColor,
                background: theme.videoButtonBg,
                border: "none",
                padding: "11px 18px",
                cursor: "pointer",
                minHeight: 44,
              }}
            >
              ▶ Play video
            </button>
          ) : null}
        </div>
      </div>

      {/* Mounted only after a tap. `preload="metadata"` alone still costs a
          request per card; not rendering the element at all costs nothing,
          which matters on a metered connection in a store. */}
      {isVideo && playing ? (
        <div style={{ background: "#000" }}>
          {selfHostedVideo ? (
            <video
              src={res.url}
              poster="/training/ld/video-poster.jpg"
              controls
              autoPlay
              playsInline
              preload="metadata"
              style={{ width: "100%", display: "block", maxHeight: "70vh" }}
            />
          ) : (
            <div style={{ position: "relative", paddingTop: "56.25%" }}>
              <iframe
                src={res.embedUrl ?? res.url}
                title={res.title}
                allow="accelerometer; autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  border: "none",
                }}
              />
            </div>
          )}
        </div>
      ) : null}
    </li>
  );
}

export default function TrainingHub() {
  const { code = "" } = useParams<{ code: string }>();
  const [hub, setHub] = useState<Hub | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${apiOrigin()}/api/public/training/${encodeURIComponent(code)}`,
      );
      if (!res.ok) {
        setError(
          res.status === 404
            ? "This training link isn't active. Check the link, or ask your Ignite contact for a new one."
            : "Couldn't load the training. Check your connection and try again.",
        );
        return;
      }
      setHub((await res.json()) as Hub);
    } catch {
      setError("Couldn't load the training. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [code]);

  useEffect(() => {
    void load();
  }, [load]);

  const theme = trainingHubTheme(hub?.brandName);
  const shell = (children: ReactNode) => (
    <div
      style={{
        minHeight: "100vh",
        background: theme.bg,
        color: theme.text,
        fontFamily: BODY,
        padding: "0 0 64px",
      }}
    >
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "0 18px" }}>
        {children}
      </div>
    </div>
  );

  if (loading) {
    return shell(
      <p
        style={{
          fontFamily: MONO,
          fontSize: 12,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: theme.muted,
          paddingTop: 80,
        }}
      >
        Loading…
      </p>,
    );
  }

  if (error || !hub) {
    return (
      <PublicDeadLink
        eyebrow="Training"
        title="This training link isn't active."
        message={
          error ||
          "Check the link you were sent, or ask your Ignite contact for a new one."
        }
      />
    );
  }

  const logoSrc = theme.isLiquidDeath
    ? null
    : trainingHubLogoSrc(hub.brandName);
  const logoPlate = tenantLogoPlate({ name: hub.brandName }, true);

  return shell(
    <>
      <header style={{ padding: "56px 0 36px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 14,
          }}
        >
          {logoSrc ? (
            <img
              src={logoSrc}
              alt={hub.brandName || "Brand"}
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
              style={{
                width: 44,
                height: 44,
                objectFit: "contain",
                borderRadius: 10,
                padding: 6,
                background: logoPlate === "dark" ? "#0A0B0D" : "#fff",
                border: `1px solid ${theme.cardBorder}`,
              }}
            />
          ) : null}
          <div
            style={{
              fontFamily: MONO,
              fontSize: 10,
              letterSpacing: "0.24em",
              textTransform: "uppercase",
              color: theme.accent,
            }}
          >
            {hub.brandName || "Brand Ambassador"} · Training
          </div>
        </div>
        <h1
          style={{
            fontFamily: theme.displayFont,
            fontSize: "clamp(34px, 9vw, 56px)",
            lineHeight: 0.98,
            margin: "0 0 14px",
            textWrap: "balance",
          }}
        >
          {hub.title}
        </h1>
        {hub.subtitle ? (
          <p
            style={{
              fontSize: 17,
              color: theme.secondary,
              margin: "0 0 18px",
              fontWeight: 600,
            }}
          >
            {hub.subtitle}
          </p>
        ) : null}
        {hub.intro ? (
          <p
            style={{
              fontSize: 16,
              lineHeight: 1.6,
              color: theme.description,
              margin: 0,
              maxWidth: "62ch",
            }}
          >
            {hub.intro}
          </p>
        ) : null}
      </header>

      <ul
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 14,
          margin: 0,
          padding: 0,
        }}
      >
        {hub.resources.map((res, i) => (
          <ResourceCard key={res.id} res={res} index={i} theme={theme} />
        ))}
      </ul>

      <footer
        style={{
          marginTop: 48,
          paddingTop: 22,
          borderTop: `1px solid ${theme.cardBorder}`,
          fontFamily: MONO,
          fontSize: 11,
          letterSpacing: "0.1em",
          color: theme.muted,
          lineHeight: 1.8,
        }}
      >
        <div>Questions? Text your Ignite contact.</div>
        <div>Ignite Productions · Spark</div>
      </footer>
    </>,
  );
}
