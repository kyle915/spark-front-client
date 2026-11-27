import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router";
import PublicDeadLink from "@/public/PublicDeadLink";
import { RecapDocument } from "@/recap/RecapDocument";
import { RecapKpiStrip, type RecapKpiItem } from "@/recap/RecapDetailShell";
import { PhotoLightbox, type PhotoLightboxItem } from "@/shared/PhotoLightbox";

function apiOrigin(): string {
  const graphql = import.meta.env.VITE_GRAPHQL_ENDPOINT as string | undefined;
  if (!graphql) return "";
  try {
    return new URL(graphql).origin;
  } catch {
    return "";
  }
}

type PitchPayload = {
  ok?: boolean;
  locked?: boolean;
  title?: string;
  subtitle?: string;
  buyerName?: string;
  brandName?: string;
  requiresPasscode?: boolean;
  introNote?: string;
  sellStory?: string;
  sellStorySource?: string;
  periodStart?: string;
  periodEnd?: string;
  retailerFilter?: string;
  marketFilter?: string;
  includeCosts?: boolean;
  brand?: {
    name?: string;
    primary?: string | null;
    cssVariables?: Record<string, string>;
  };
  kpis?: Record<string, unknown>;
  retailerBreakdown?: Array<Record<string, unknown>>;
  topStoreWins?: Array<Record<string, unknown>>;
  photos?: Array<{
    id?: string;
    url: string;
    caption?: string;
    store?: string;
    retailer?: string;
    market?: string;
    eventDate?: string;
    category?: string;
  }>;
  error?: string;
  message?: string;
};

const muted = "var(--recap-muted, #5c6154)";
const ink = "var(--recap-text, #14160f)";
const border = "var(--recap-border, #e2e4d8)";

function fmtNum(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "number") return v.toLocaleString();
  return String(v);
}

function fmtPct(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  const raw = fmtNum(v);
  return raw.endsWith("%") ? raw : `${raw}%`;
}

/**
 * Public, no-login Buyer Pitch Deck. Token in the URL is the capability;
 * optional passcode unlocks KPIs + photos. Minted on client. host only.
 */
const PublicPitch: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const origin = useMemo(apiOrigin, []);
  const [data, setData] = useState<PitchPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [passcode, setPasscode] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    const prev = root.getAttribute("data-theme");
    root.setAttribute("data-theme", "spark-v2");
    return () => {
      if (prev) root.setAttribute("data-theme", prev);
      else root.removeAttribute("data-theme");
    };
  }, []);

  const load = (body?: { passcode: string }) => {
    if (!token) {
      setLoading(false);
      setError("This link isn't valid. Double-check it or ask for a new one.");
      return;
    }
    setLoading(true);
    const url = `${origin}/api/public/pitch/${encodeURIComponent(token)}/`;
    const init: RequestInit = body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : { method: "GET" };
    fetch(url, init)
      .then(async (res) => {
        const json = (await res.json().catch(() => null)) as PitchPayload | null;
        if (!json) {
          setError("This link isn't valid. Double-check it or ask for a new one.");
          setData(null);
          return;
        }
        if (res.status === 403 && json.error === "passcode_required") {
          setError("Incorrect passcode. Try again.");
          setData((prev) => prev ?? { locked: true, requiresPasscode: true });
          return;
        }
        if (!res.ok) {
          setError(
            res.status === 410
              ? "This Buyer Pitch Deck has expired. Ask for a fresh link."
              : res.status === 403
                ? "This Buyer Pitch Deck link has been revoked."
                : json.message ||
                  "This link isn't valid. Double-check it or ask for a new one.",
          );
          setData(null);
          return;
        }
        setError(null);
        setData(json);
      })
      .catch(() => {
        setError("We couldn't reach the server. Check your connection and try again.");
        setData(null);
      })
      .finally(() => {
        setLoading(false);
        setUnlocking(false);
      });
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin, token]);

  useEffect(() => {
    const css = data?.brand?.cssVariables;
    if (!css || typeof css !== "object") return;
    const root = document.documentElement;
    const applied: string[] = [];
    for (const [key, value] of Object.entries(css)) {
      if (typeof value === "string" && key.startsWith("--")) {
        root.style.setProperty(key, value);
        applied.push(key);
      }
    }
    return () => {
      for (const key of applied) root.style.removeProperty(key);
    };
  }, [data?.brand?.cssVariables]);

  if (loading && !data) {
    return (
      <RecapDocument page>
        <main className="recap-doc-body">
          <p style={{ color: muted }}>Loading Buyer Pitch Deck…</p>
        </main>
      </RecapDocument>
    );
  }

  if (error && !data) {
    return (
      <PublicDeadLink
        eyebrow="Buyer Pitch Deck"
        title="This link isn't available"
        message={error}
      />
    );
  }

  const brandDisplayName = data?.brandName || data?.brand?.name || null;

  if (data?.locked || (data?.requiresPasscode && !data.kpis)) {
    return (
      <RecapDocument page brandName={brandDisplayName} status="Buyer deck">
        <main className="recap-doc-body max-w-md mx-auto space-y-4">
          <p
            className="text-xs font-semibold uppercase tracking-wider"
            style={{ color: muted }}
          >
            {brandDisplayName || "Brand"} · Buyer Pitch Deck
          </p>
          <h1
            className="display text-2xl font-bold"
            style={{ color: ink, letterSpacing: "-0.025em" }}
          >
            {data.title || "Buyer Pitch Deck"}
          </h1>
          {data.subtitle ? (
            <p style={{ color: muted }}>{data.subtitle}</p>
          ) : null}
          <p className="text-sm" style={{ color: muted }}>
            This deck is passcode-protected. Enter the code from your brand
            contact to view the numbers and store photos.
          </p>
          {error ? (
            <p className="text-sm font-medium" style={{ color: "#9c2d14" }}>
              {error}
            </p>
          ) : null}
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              setUnlocking(true);
              load({ passcode });
            }}
          >
            <input
              type="password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="Passcode"
              className="w-full px-3 py-2.5 rounded-lg border text-sm"
              style={{
                borderColor: border,
                color: ink,
                background: "#ffffff",
              }}
              autoComplete="current-password"
            />
            <button
              type="submit"
              disabled={unlocking || passcode.trim().length < 4}
              className="w-full px-4 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50"
              style={{
                background: ink,
                color: "#ffffff",
                border: `1px solid ${ink}`,
              }}
            >
              {unlocking ? "Unlocking…" : "Unlock deck"}
            </button>
          </form>
        </main>
      </RecapDocument>
    );
  }

  if (!data) {
    return (
      <PublicDeadLink
        eyebrow="Buyer Pitch Deck"
        title="This link isn't available"
        message={
          error ||
          "This link isn't valid. Double-check it or ask for a new one."
        }
      />
    );
  }

  const kpis = data.kpis || {};
  const photos = data.photos || [];
  const sellStory = (data.sellStory || data.introNote || "").trim();
  const lightbox: PhotoLightboxItem[] = photos.map((p) => {
    const store = (p.store || p.retailer || "").trim();
    const secondary = [store, p.category].filter(Boolean).join(" · ");
    const sellCaption = (p.caption || "").trim();
    let caption = sellCaption;
    if (sellCaption && secondary) {
      const alreadyNamesStore =
        !!store && sellCaption.toLowerCase().includes(store.toLowerCase());
      caption = alreadyNamesStore
        ? sellCaption
        : `${sellCaption} · ${secondary}`;
    } else if (!sellCaption) {
      caption = secondary;
    }
    return {
      url: p.url,
      caption,
      name: store || p.category || undefined,
    };
  });

  const kpiItems: RecapKpiItem[] = [
    { label: "Visits", value: fmtNum(kpis.totalVisits) },
    { label: "Stores activated", value: fmtNum(kpis.storesActivated) },
    { label: "Samples handed out", value: fmtNum(kpis.totalSamplesDistributed) },
    { label: "Rep-observed units", value: fmtNum(kpis.repObservedUnits), glow: true },
    { label: "Adjusted register units", value: fmtNum(kpis.adjustedRegisterUnits) },
    { label: "Sampling lift", value: fmtPct(kpis.samplingLiftPct) },
  ];

  if (data.includeCosts) {
    kpiItems.push(
      {
        label: "Supported spend",
        value:
          kpis.totalSupportedCost != null
            ? `$${fmtNum(kpis.totalSupportedCost)}`
            : "—",
      },
      {
        label: "Cost / unit sold",
        value:
          kpis.costPerUnitSold != null
            ? `$${fmtNum(kpis.costPerUnitSold)}`
            : "—",
      },
    );
  }

  return (
    <RecapDocument
      page
      brandName={brandDisplayName}
      status="Buyer deck"
      actions={
        <button
          type="button"
          onClick={() => window.print()}
          className="no-print print:hidden px-3 py-1.5 rounded-lg text-xs font-semibold transition hover:opacity-85 cursor-pointer"
          style={{
            border: `1px solid ${border}`,
            background: "#ffffff",
            color: ink,
          }}
        >
          ↓ Save PDF
        </button>
      }
    >
      <main className="recap-doc-body space-y-8">
        <header className="space-y-2">
          <p
            className="text-xs font-semibold uppercase tracking-wider"
            style={{ color: muted }}
          >
            {brandDisplayName || "Brand"} · Buyer Pitch Deck
            {data.buyerName ? ` · Prepared for ${data.buyerName}` : ""}
          </p>
          <h1
            className="display text-3xl sm:text-4xl font-bold"
            style={{ color: ink, letterSpacing: "-0.03em", lineHeight: 1.08 }}
          >
            {data.title}
          </h1>
          {data.subtitle ? (
            <p className="text-base" style={{ color: muted }}>
              {data.subtitle}
            </p>
          ) : null}
          <p className="text-sm tab-num" style={{ color: muted }}>
            {data.periodStart} → {data.periodEnd}
            {data.retailerFilter ? ` · ${data.retailerFilter}` : ""}
            {data.marketFilter ? ` · ${data.marketFilter}` : ""}
          </p>
          {sellStory ? (
            <p
              className="text-[15px] leading-relaxed max-w-3xl pt-1"
              style={{ color: ink }}
            >
              {sellStory}
            </p>
          ) : null}
        </header>

        <section aria-label="Program headline metrics">
          <RecapKpiStrip items={kpiItems} />
        </section>

        {(data.topStoreWins || []).length > 0 && (
          <section className="space-y-3">
            <h2
              className="display text-lg font-bold"
              style={{ color: ink, letterSpacing: "-0.02em" }}
            >
              Top store wins
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(data.topStoreWins || []).map((row, i) => (
                <div
                  key={`${row.storeLabel}-${i}`}
                  className="rounded-xl p-4 space-y-1.5"
                  style={{ border: `1px solid ${border}`, background: "#ffffff" }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-sm" style={{ color: ink }}>
                      {String(row.storeLabel || "Store")}
                    </p>
                    <span
                      className="text-[11px] font-medium px-2 py-0.5 rounded-md shrink-0 tab-num"
                      style={{
                        background: "#f4f5ef",
                        color: muted,
                        border: `1px solid ${border}`,
                      }}
                    >
                      {fmtNum(row.visits)} {Number(row.visits) === 1 ? "visit" : "visits"}
                    </span>
                  </div>
                  {[row.retailerBanner, row.market].filter(Boolean).length > 0 ? (
                    <p className="text-xs" style={{ color: muted }}>
                      {[row.retailerBanner, row.market].filter(Boolean).join(" · ")}
                    </p>
                  ) : null}
                  <p className="text-xs pt-0.5 tab-num font-medium" style={{ color: ink }}>
                    {fmtNum(row.samplesDistributed)} samples ·{" "}
                    {fmtNum(row.repObservedUnits)} rep units
                    {row.adjustedRegisterUnits != null
                      ? ` · ${fmtNum(row.adjustedRegisterUnits)} register`
                      : ""}
                  </p>
                  {row.highlight ? (
                    <p className="text-sm pt-1 leading-snug" style={{ color: muted }}>
                      {String(row.highlight)}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        )}

        {photos.length > 0 && (
          <section className="space-y-3">
            <h2
              className="display text-lg font-bold"
              style={{ color: ink, letterSpacing: "-0.02em" }}
            >
              In-store proof
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {photos.map((p, idx) => (
                <button
                  key={p.id || p.url}
                  type="button"
                  className="rounded-xl overflow-hidden text-left transition hover:opacity-95 cursor-pointer"
                  style={{ border: `1px solid ${border}`, background: "#ffffff" }}
                  onClick={() => setLightboxIndex(idx)}
                >
                  <img
                    src={p.url}
                    alt={p.caption || p.store || "Demo photo"}
                    className="w-full aspect-[4/3] object-cover"
                    loading="lazy"
                  />
                  <div className="p-2.5 space-y-0.5">
                    <p className="text-xs font-semibold" style={{ color: ink }}>
                      {p.store || p.retailer || "Store"}
                    </p>
                    {p.caption ? (
                      <p className="text-[11px] leading-snug" style={{ color: ink }}>
                        {p.caption}
                      </p>
                    ) : null}
                    <p className="text-[11px] tab-num" style={{ color: muted }}>
                      {[p.market, p.eventDate].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {lightboxIndex !== null && lightbox[lightboxIndex] && (
          <PhotoLightbox
            photos={lightbox}
            index={lightboxIndex}
            onClose={() => setLightboxIndex(null)}
            onStep={setLightboxIndex}
          />
        )}
      </main>
    </RecapDocument>
  );
};

export default PublicPitch;
