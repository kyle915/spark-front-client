import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router";
import PublicDeadLink from "@/public/PublicDeadLink";
import { RecapDocument } from "@/recap/RecapDocument";
import { RecapKpiStrip } from "@/recap/RecapDetailShell";
import { PhotoLightbox } from "@/shared/PhotoLightbox";
import { directThumbUrl, handleThumbError } from "@/utils/thumb";
import { programStats, type ProgramSharePayload } from "./programShare";

function apiOrigin(): string {
  const graphql = import.meta.env.VITE_GRAPHQL_ENDPOINT as string | undefined;
  if (!graphql) return "";
  try {
    return new URL(graphql).origin;
  } catch {
    return "";
  }
}

const muted = "var(--recap-muted, #5c6154)";
const text = "var(--recap-text, #14160f)";
const border = "var(--recap-border, #e2e4d8)";

/**
 * Public, no-login live program microsite (/program/:token).
 * Editorial leave-behind with co-branded header, KPI strip, proportional
 * market-share bars, and click-to-zoom PhotoLightbox.
 */
const PublicProgram: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const origin = useMemo(apiOrigin, []);
  const [data, setData] = useState<ProgramSharePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    const prev = root.getAttribute("data-theme");
    root.setAttribute("data-theme", "spark-v2");
    return () => {
      if (prev) root.setAttribute("data-theme", prev);
      else root.removeAttribute("data-theme");
    };
  }, []);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setError("This link isn't valid. Double-check it or ask for a new one.");
      return;
    }
    let cancelled = false;
    fetch(`${origin}/api/public/program/${encodeURIComponent(token)}`)
      .then(async (res) => {
        const json = await res.json().catch(() => null);
        if (cancelled) return;
        if (res.ok && json && typeof json.brand === "string") {
          setData(json as ProgramSharePayload);
          return;
        }
        setError(
          res.status === 410
            ? "This link has expired. Ask your Ignite contact for a fresh one."
            : res.status === 404
              ? "This program page is no longer shared."
              : "This link isn't valid. Double-check it or ask for a new one.",
        );
      })
      .catch(() => {
        if (!cancelled) {
          setError("We couldn't reach the server. Check your connection and try again.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [origin, token]);

  if (loading) {
    return (
      <RecapDocument page>
        <main className="recap-doc-body">
          <p className="text-sm" style={{ color: muted }}>
            Loading…
          </p>
        </main>
      </RecapDocument>
    );
  }
  if (error || !data) {
    return (
      <PublicDeadLink
        eyebrow="Field program"
        title="This program page is unavailable."
        message={error ?? ""}
      />
    );
  }

  const stats = programStats(data.totals);
  const topMarkets = data.markets.slice(0, 12);
  const totalMarketActs = Math.max(
    1,
    data.totals.activations ||
      data.markets.reduce((sum, m) => sum + m.activations, 0),
  );
  const maxMarketActs = Math.max(
    1,
    ...topMarkets.map((m) => m.activations),
  );
  const convRate =
    data.totals.productsSold > 0 &&
    (data.totals.samplesDistributed > 0 || data.totals.consumersReached > 0)
      ? (() => {
          const base =
            data.totals.samplesDistributed > 0
              ? data.totals.samplesDistributed
              : data.totals.consumersReached;
          const pct = (data.totals.productsSold / base) * 100;
          return pct <= 100 ? `${pct.toFixed(1)}%` : null;
        })()
      : null;

  const lightboxItems = data.photos.map((p) => ({
    url: p.url,
    thumb: directThumbUrl(p.url, 400) || p.url,
    caption: p.caption || undefined,
  }));

  return (
    <>
      <RecapDocument page brandName={data.brand} status="APPROVED">
        <main className="recap-doc-body space-y-8">
          <header className="px-1 pt-1">
            <p className="text-xs font-medium m-0" style={{ color: muted }}>
              Live field program summary
            </p>
            <h1
              className="display font-semibold mt-1"
              style={{
                fontSize: "clamp(1.75rem, 4vw, 2.5rem)",
                letterSpacing: "-0.03em",
                lineHeight: 1.08,
                color: text,
                margin: 0,
              }}
            >
              {data.brand}
            </h1>
          </header>

          {stats.length > 0 ? (
            <section aria-label="Program totals">
              <RecapKpiStrip
                items={[
                  ...stats.map((s, idx) => ({
                    label: s.label,
                    value: s.value,
                    glow: idx === 0,
                  })),
                  ...(convRate ? [{ label: "Conversion", value: convRate }] : []),
                ]}
              />
            </section>
          ) : (
            <p className="text-sm" style={{ color: muted }}>
              Results will appear here once the first activations are approved.
            </p>
          )}

          {data.photos.length > 0 ? (
            <section aria-label="From the field">
              <div className="flex items-baseline justify-between gap-2 mb-3">
                <h2
                  className="display text-lg font-semibold m-0"
                  style={{ letterSpacing: "-0.02em", color: text }}
                >
                  From the field
                </h2>
                <span className="text-xs tab-num" style={{ color: muted }}>
                  {data.photos.length} {data.photos.length === 1 ? "photo" : "photos"} · click to zoom
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {data.photos.map((p, idx) => (
                  <button
                    key={p.url}
                    type="button"
                    onClick={() => setLightboxIdx(idx)}
                    className="group relative overflow-hidden text-left p-0 bg-transparent cursor-pointer"
                    style={{
                      borderRadius: 10,
                      border: `1px solid ${border}`,
                    }}
                    title={p.caption || "Inspect field photo"}
                  >
                    <img
                      src={directThumbUrl(p.url, 800) || p.url}
                      onError={(e) => handleThumbError(e.currentTarget, p.url, 800)}
                      alt={p.caption || "Field photo"}
                      loading="lazy"
                      className="w-full aspect-[4/3] object-cover transition-transform duration-200 group-hover:scale-[1.02] block"
                    />
                    {p.caption ? (
                      <span
                        className="block px-2.5 py-1.5 text-xs truncate"
                        style={{
                          background: "#ffffff",
                          color: muted,
                          borderTop: `1px solid ${border}`,
                        }}
                      >
                        {p.caption}
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {topMarkets.length > 0 ? (
            <section
              aria-label="Where we activated"
              className="spark-card p-5 sm:p-6"
            >
              <div className="flex items-baseline justify-between gap-2 mb-4">
                <h2
                  className="display text-lg font-semibold m-0"
                  style={{ letterSpacing: "-0.02em", color: text }}
                >
                  Where we activated
                </h2>
                <span className="text-xs tab-num" style={{ color: muted }}>
                  Top {topMarkets.length} {topMarkets.length === 1 ? "market" : "markets"}
                </span>
              </div>
              <ul className="grid sm:grid-cols-2 gap-x-8 gap-y-3 text-sm list-none p-0 m-0">
                {topMarkets.map((m) => {
                  const barPct = Math.min(
                    100,
                    Math.max(4, Math.round((m.activations / maxMarketActs) * 100)),
                  );
                  const sharePct = Math.round(
                    (m.activations / totalMarketActs) * 100,
                  );
                  return (
                    <li key={m.state} className="space-y-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="font-semibold" style={{ color: text }}>
                          {m.state}
                        </span>
                        <span className="tab-num text-xs" style={{ color: muted }}>
                          <strong className="font-semibold text-sm" style={{ color: text }}>
                            {m.activations.toLocaleString("en-US")}
                          </strong>
                          {sharePct > 0 ? ` · ${sharePct}%` : ""}
                        </span>
                      </div>
                      <div
                        className="h-1.5 rounded-sm overflow-hidden"
                        style={{ background: "rgba(20, 22, 15, 0.06)" }}
                        aria-hidden
                      >
                        <div
                          className="h-full rounded-sm"
                          style={{
                            width: `${barPct}%`,
                            background: "rgba(20, 22, 15, 0.72)",
                          }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          <p className="text-xs pt-2" style={{ color: muted }}>
            Compiled from approved activations on Spark by Ignite Productions. Figures update automatically as recaps are approved.
          </p>
        </main>
      </RecapDocument>

      {lightboxIdx !== null && lightboxItems.length > 0 ? (
        <PhotoLightbox
          photos={lightboxItems}
          index={lightboxIdx}
          onClose={() => setLightboxIdx(null)}
          onStep={setLightboxIdx}
          loop
        />
      ) : null}
    </>
  );
};

export default PublicProgram;
