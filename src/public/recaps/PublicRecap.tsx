import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router";
import {
  RecapClientSignoff,
  type SignoffStatus,
} from "@/recap/RecapClientSignoff";
import { TenantBrandedRecap, recapBrandBtn } from "@/recap/TenantBrandedRecap";
import PublicDeadLink from "@/public/PublicDeadLink";
import { thumbUrl } from "@/utils/thumb";
import type { CssVariablesMap } from "@/utils/tenantThemeConfig";

/**
 * Public, no-login recap — /r/:token.
 * Tenant-branded leave-behind (KPI strip, photos, $/sample, sign-off).
 * Admin chrome is not mounted here.
 */

type ApiError = { error: string; message: string };

type PublicKpi = { label: string; value: number | null };
type PublicSample = { name: string | null; quantity: number | null };
type PublicField = {
  section: string;
  name: string;
  value: string | null;
  imageUrl: string | null;
};
type PublicPhoto = { url: string; name: string | null; category: string };
type PublicBrand = {
  name: string | null;
  colorScheme: string | null;
  primary: string | null;
  cssVariables: CssVariablesMap | null;
};
type PublicSignoff = {
  status: SignoffStatus | string;
  comment: string;
  at: string | null;
};
type PublicRecapPayload = {
  kind: "legacy" | "custom";
  name: string;
  date: string | null;
  retailer: string | null;
  venue: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  approved: boolean;
  ambassadorName: string | null;
  templateName: string | null;
  kpis: PublicKpi[];
  samples: PublicSample[];
  fields: PublicField[];
  photos: PublicPhoto[];
  brand?: PublicBrand | null;
  clientSignoff?: PublicSignoff | null;
  sharedAt?: string | null;
};

function apiOrigin(): string {
  const graphql = import.meta.env.VITE_GRAPHQL_ENDPOINT as string | undefined;
  if (!graphql) return "";
  try {
    return new URL(graphql).origin;
  } catch {
    return "";
  }
}

function errorCopy(status: number, code: string, serverMessage?: string): string {
  if (status === 410 || code === "expired" || code === "token_expired") {
    return "This recap link has expired. Ask your Ignite contact for a fresh link.";
  }
  if (
    status === 400 ||
    code === "invalid" ||
    code === "bad_token" ||
    code === "not_found"
  ) {
    return "This recap link isn't valid. Double-check the link or ask for a new one.";
  }
  return serverMessage || "We couldn't load this recap. Please try again.";
}

const fmtNum = (v: number | null | undefined) =>
  typeof v === "number" ? v.toLocaleString() : "—";

const fmtDate = (raw: string | null | undefined) => {
  if (!raw) return "—";
  try {
    return new Date(raw).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return raw;
  }
};

const PublicRecap: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const origin = useMemo(apiOrigin, []);
  const endpoint = token
    ? `${origin}/api/public/recap/${encodeURIComponent(token)}`
    : "";
  const pdfUrl = token
    ? `${origin}/api/public/recap/${encodeURIComponent(token)}/pdf`
    : "";
  const signoffUrl = token
    ? `${origin}/api/public/recap/${encodeURIComponent(token)}/signoff`
    : "";

  const [recap, setRecap] = useState<PublicRecapPayload | null>(null);
  const [loadErr, setLoadErr] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const [signoffBusy, setSignoffBusy] = useState(false);
  const [copied, setCopied] = useState(false);

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
    if (!endpoint) {
      setLoading(false);
      setLoadErr({ error: "invalid", message: errorCopy(400, "invalid") });
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(endpoint)
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          const code = (json as ApiError).error || "invalid";
          setLoadErr({
            error: code,
            message: errorCopy(res.status, code, (json as ApiError).message),
          });
          setRecap(null);
        } else {
          const payload = (json as { recap?: PublicRecapPayload }).recap ?? null;
          if (payload) {
            setRecap(payload);
            setLoadErr(null);
          } else {
            setLoadErr({ error: "invalid", message: errorCopy(400, "invalid") });
          }
        }
      })
      .catch(() => {
        if (cancelled) return;
        setLoadErr({
          error: "network",
          message:
            "We couldn't reach the server. Check your connection and try again.",
        });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [endpoint]);

  const brand = recap?.brand;
  const brandName = brand?.name || "Spark";

  const submitSignoff = async (
    status: "looks_good" | "need_more_photos",
    comment: string,
  ) => {
    if (!signoffUrl) return;
    setSignoffBusy(true);
    try {
      const res = await fetch(signoffUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, comment }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLoadErr({
          error: (json as ApiError).error || "invalid",
          message:
            (json as ApiError).message || "Couldn't save your sign-off.",
        });
        return;
      }
      const payload = (json as { recap?: PublicRecapPayload }).recap;
      if (payload) setRecap(payload);
    } finally {
      setSignoffBusy(false);
    }
  };

  const copyShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const shell = (children: React.ReactNode, actions?: React.ReactNode) => (
    <TenantBrandedRecap
      cssVariables={brand?.cssVariables}
      primary={brand?.primary}
      className="min-h-[100dvh]"
    >
      <div
        className="min-h-[100dvh]"
        style={{
          background: "var(--recap-bg, #0a0d09)",
          color: "var(--recap-text, #f2f3ee)",
        }}
      >
        <header
          className="sticky top-0 z-20 px-6 py-4 flex items-center justify-between gap-3 flex-wrap"
          style={{
            background: "color-mix(in srgb, var(--recap-bg, #0a0d09) 85%, transparent)",
            borderBottom: "1px solid var(--spark-border, #1f2418)",
            backdropFilter: "blur(12px)",
          }}
        >
          <p
            className="display"
            style={{
              fontWeight: 700,
              fontSize: 18,
              letterSpacing: "-0.02em",
              margin: 0,
            }}
          >
            {brandName}{" "}
            <span style={{ color: "var(--recap-brand, #c5f546)" }}>recap</span>
          </p>
          {actions}
        </header>
        <main className="max-w-5xl mx-auto px-5 py-8 sm:py-10">{children}</main>
        <footer
          className="max-w-5xl mx-auto px-5 pb-10 mono"
          style={{
            fontSize: 10,
            letterSpacing: "0.14em",
            color: "rgba(255,255,255,0.35)",
          }}
        >
          SPARK BY IGNITE · SHARED RECAP
        </footer>
      </div>
    </TenantBrandedRecap>
  );

  if (loading) {
    return shell(
      <div className="spark-card p-10 text-center text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>
        Loading recap…
      </div>,
    );
  }

  if (loadErr || !recap) {
    return (
      <PublicDeadLink
        eyebrow="Shared recap"
        title={
          loadErr?.error === "expired" || loadErr?.error === "token_expired"
            ? "This recap link has expired."
            : "We couldn't open this recap."
        }
        message={loadErr?.message ?? errorCopy(400, "invalid")}
      />
    );
  }

  const place = [recap.retailer, recap.venue, recap.city, recap.state]
    .filter(Boolean)
    .join(" · ");
  const kpis = (recap.kpis ?? []).filter((k) => k.value != null);

  return shell(
    <div className="space-y-6">
      <div className="spark-card p-6">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="display text-3xl font-bold" style={{ letterSpacing: "-0.03em" }}>
              {recap.name}
            </h1>
            <p className="mt-1" style={{ color: "rgba(255,255,255,0.65)" }}>
              {place || recap.address || "—"}
              {" · "}
              {fmtDate(recap.date)}
            </p>
            {recap.ambassadorName && (
              <p
                className="mono text-[10px] mt-2"
                style={{ letterSpacing: "0.14em", color: "rgba(255,255,255,0.45)" }}
              >
                {recap.ambassadorName.toUpperCase()}
              </p>
            )}
          </div>
        </div>
      </div>

      {recap.photos.length > 0 && (
        <div className="spark-card p-6">
          <p className="mono text-[10px] mb-4" style={{ letterSpacing: "0.18em", color: "rgba(255,255,255,0.5)" }}>
            PHOTOS · {recap.photos.length}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {recap.photos.map((p) => (
              <a
                key={p.url}
                href={p.url}
                target="_blank"
                rel="noreferrer"
                className="block overflow-hidden rounded-xl"
                style={{ border: "1px solid var(--spark-border)" }}
              >
                <img src={thumbUrl(p.url, 400) || p.url} alt={p.name ?? "Recap photo"} className="w-full h-40 object-cover" />
                {p.category && (
                  <p className="mono text-[9px] px-2 py-1.5" style={{ letterSpacing: "0.12em", color: "rgba(255,255,255,0.45)" }}>
                    {p.category.toUpperCase()}
                  </p>
                )}
              </a>
            ))}
          </div>
        </div>
      )}

      {kpis.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {kpis.slice(0, 4).map((k, i) => (
            <div
              key={k.label}
              className="kpi"
              style={
                i === 0
                  ? {
                      boxShadow:
                        "0 0 28px color-mix(in srgb, var(--recap-brand, #c5f546) 25%, transparent)",
                    }
                  : undefined
              }
            >
              <p className="kpi-value" style={{ color: "var(--recap-brand, var(--spark-lime))" }}>
                {typeof k.value === "number" && k.label.includes("$")
                  ? `$${k.value.toFixed(2)}`
                  : fmtNum(k.value)}
              </p>
              <p className="kpi-label">{k.label}</p>
            </div>
          ))}
        </div>
      )}

      <RecapClientSignoff
        existingStatus={recap.clientSignoff?.status}
        existingComment={recap.clientSignoff?.comment}
        existingAt={recap.clientSignoff?.at}
        busy={signoffBusy}
        onSubmit={submitSignoff}
      />
    </div>,
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={copyShare}
        className="px-4 py-2 rounded-xl text-sm font-semibold"
        style={{
          background: "transparent",
          border: "1px solid var(--spark-border, #1f2418)",
          color: "var(--recap-text, #f2f3ee)",
        }}
      >
        {copied ? "Copied" : "Share"}
      </button>
      <a
        href={pdfUrl}
        target="_blank"
        rel="noreferrer"
        className="px-4 py-2 rounded-xl text-sm font-semibold"
        style={{ ...recapBrandBtn(), textDecoration: "none" }}
        title="Download this recap as a PDF"
      >
        Download PDF
      </a>
    </div>,
  );
};

export default PublicRecap;
