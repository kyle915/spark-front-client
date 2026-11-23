import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router";
import {
  RecapClientSignoff,
  type SignoffStatus,
} from "@/recap/RecapClientSignoff";
import { TenantBrandedRecap, recapBrandBtn } from "@/recap/TenantBrandedRecap";
import { RecapDocument } from "@/recap/RecapDocument";
import { RecapKpiStrip } from "@/recap/RecapDetailShell";
import { RecapShareFieldSections } from "@/recap/RecapFieldRows";
import PublicDeadLink from "@/public/PublicDeadLink";
import { RecapComments } from "./RecapComments";
import type { RecapCommentItem } from "./recapCommentValidation";
import { PhotoLightbox } from "@/shared/PhotoLightbox";
import { RecapVideoPlayer } from "@/shared/RecapVideoPlayer";
import { thumbUrl } from "@/utils/thumb";
import { recapFileKind, recapVideoPlayUrl } from "@/utils/recapFileUrl";
import type { CssVariablesMap } from "@/utils/tenantThemeConfig";

/**
 * Public, no-login recap — /r/:token.
 * Tenant-branded, photo-first leave-behind. Admin chrome is not mounted.
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
  comments?: RecapCommentItem[];
  sharedAt?: string | null;
  viewCount?: number | null;
  lastViewedAt?: string | null;
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
  const commentsUrl = token
    ? `${origin}/api/public/recap/${encodeURIComponent(token)}/comments`
    : "";

  const [recap, setRecap] = useState<PublicRecapPayload | null>(null);
  const [loadErr, setLoadErr] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const [signoffBusy, setSignoffBusy] = useState(false);
  const [commentBusy, setCommentBusy] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [playingVideo, setPlayingVideo] = useState<{
    url: string;
    name: string | null;
  } | null>(null);

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
            // Fire-and-forget view analytics — optional token tracking.
            fetch(`${endpoint}/view`, { method: "POST" }).catch(() => {});
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

  const submitComment = async (input: {
    authorName: string;
    authorEmail: string;
    body: string;
  }) => {
    if (!commentsUrl) return;
    setCommentBusy(true);
    setCommentError(null);
    try {
      const res = await fetch(commentsUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCommentError(
          (json as ApiError).message || "Couldn't post your comment.",
        );
        return;
      }
      const payload = (json as { recap?: PublicRecapPayload }).recap;
      if (payload) setRecap(payload);
    } catch {
      setCommentError("We couldn't post your comment. Check your connection and try again.");
    } finally {
      setCommentBusy(false);
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
      <RecapDocument
        page
        status={recap ? (recap.approved ? "APPROVED" : "DRAFT") : null}
        actions={actions}
      >
        <main
          className="recap-doc-body"
          style={{ paddingBottom: "calc(2.5rem + env(safe-area-inset-bottom, 0px))" }}
        >
          {children}
        </main>
      </RecapDocument>
    </TenantBrandedRecap>
  );

  if (loading) {
    return shell(
      <div className="spark-card p-10 text-center text-sm" style={{ color: "var(--recap-muted, #5c6154)" }}>
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
  const allPhotos = recap.photos ?? [];
  const photos = allPhotos.filter((p) => recapFileKind(p.url) !== "video");
  const videos = allPhotos.filter((p) => recapFileKind(p.url) === "video");
  const hero = photos[0];
  const restPhotos = photos.slice(1);
  const lightboxPhotos = photos.map((p) => ({
    name: p.name ?? p.category ?? "Photo",
    url: p.url,
    caption: p.category || undefined,
  }));

  return (
    <>
      {shell(
        <div className="space-y-6">
          {/* Brand + title — tenant first, not Spark ops chrome */}
          <header className="px-1 pt-1">
            {brandName && brandName !== "Spark" ? (
              <p
                className="display"
                style={{
                  fontWeight: 800,
                  fontSize: "clamp(1.75rem, 5vw, 2.5rem)",
                  letterSpacing: "-0.04em",
                  lineHeight: 1.05,
                  margin: 0,
                  color: "var(--recap-brand, var(--recap-heading, #3f5c12))",
                }}
              >
                {brandName}
              </p>
            ) : null}
            <h1
              className="display font-bold mt-2"
              style={{
                letterSpacing: "-0.03em",
                fontSize: brandName && brandName !== "Spark" ? "1.35rem" : "1.875rem",
                margin: 0,
                color: "var(--recap-text, #14160f)",
              }}
            >
              {recap.name}
            </h1>
            <p className="mt-1 recap-doc-kicker">
              {place || recap.address || "—"}
              {" · "}
              {fmtDate(recap.date)}
              {recap.ambassadorName ? ` · ${recap.ambassadorName}` : ""}
            </p>
          </header>

          {/* Engagements / Sold / Conv / Photos — under title, above photos. */}
          {kpis.length > 0 ? (
            <RecapKpiStrip
              items={kpis.slice(0, 4).map((k, i) => ({
                label: k.label,
                value:
                  typeof k.value === "number" && k.label.includes("$")
                    ? `$${k.value.toFixed(2)}`
                    : fmtNum(k.value),
                glow: i === 0,
              }))}
            />
          ) : null}

          {/* Match client detail: field cards fill a 2-col grid; media on the right (xl). */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 items-start">
            {(photos.length > 0 || videos.length > 0) && (
              <div className="order-1 md:col-span-2 xl:order-none xl:col-span-1 xl:col-start-3 xl:row-start-1 xl:row-span-[100] xl:sticky xl:top-4 space-y-4">
                {photos.length > 0 ? (
                  <section aria-label="Recap photos">
                    {hero && (
                      <button
                        type="button"
                        onClick={() => setLightboxIndex(0)}
                        className="block w-full overflow-hidden rounded-2xl text-left"
                        style={{
                          border: "1px solid var(--recap-border, #e2e4d8)",
                          background: "var(--recap-surface, #fff)",
                          padding: 0,
                          cursor: "zoom-in",
                        }}
                      >
                        <img
                          src={thumbUrl(hero.url, 800) || hero.url}
                          alt={hero.name ?? "Recap photo"}
                          className="w-full object-cover"
                          style={{
                            maxHeight: "min(50vh, 420px)",
                            minHeight: 180,
                          }}
                        />
                      </button>
                    )}
                    {restPhotos.length > 0 && (
                      <div className="mt-3 grid grid-cols-2 gap-2.5 sm:[grid-template-columns:repeat(auto-fill,minmax(120px,1fr))]">
                        {restPhotos.map((p, i) => (
                          <button
                            key={p.url}
                            type="button"
                            onClick={() => setLightboxIndex(i + 1)}
                            className="block overflow-hidden rounded-xl text-left"
                            style={{
                              border: "1px solid var(--recap-border, #e2e4d8)",
                              padding: 0,
                              cursor: "zoom-in",
                              background: "transparent",
                            }}
                          >
                            <img
                              src={thumbUrl(p.url, 400) || p.url}
                              alt={p.name ?? "Recap photo"}
                              className="w-full h-32 md:h-36 object-cover"
                            />
                          </button>
                        ))}
                      </div>
                    )}
                    <p
                      className="mono text-[10px] mt-2"
                      style={{
                        letterSpacing: "0.14em",
                        color: "var(--recap-muted, #5c6154)",
                      }}
                    >
                      {photos.length} PHOTO{photos.length === 1 ? "" : "S"} · TAP TO ENLARGE
                    </p>
                  </section>
                ) : null}

                {videos.length > 0 ? (
                  <section aria-label="Recap videos" className="space-y-2">
                    <p
                      className="mono text-[10px]"
                      style={{
                        letterSpacing: "0.14em",
                        color: "var(--recap-muted, #5c6154)",
                      }}
                    >
                      {videos.length} VIDEO{videos.length === 1 ? "" : "S"}
                    </p>
                    <div className="grid grid-cols-2 gap-2.5 sm:[grid-template-columns:repeat(auto-fill,minmax(120px,1fr))]">
                      {videos.map((p) => (
                        <button
                          key={p.url}
                          type="button"
                          onClick={() => setPlayingVideo({ url: p.url, name: p.name })}
                          className="relative block h-32 w-full overflow-hidden rounded-xl text-left"
                          style={{
                            border: "1px solid var(--recap-border, #e2e4d8)",
                            color: "var(--recap-heading, #3f5c12)",
                            fontWeight: 800,
                            letterSpacing: "0.12em",
                            fontSize: 12,
                            background: "var(--recap-surface, #fff)",
                            padding: 0,
                            cursor: "pointer",
                          }}
                        >
                          <video
                            src={p.url}
                            muted
                            playsInline
                            preload="metadata"
                            className="pointer-events-none h-full w-full object-cover"
                          />
                          <span
                            className="absolute inset-0 flex items-center justify-center"
                            style={{ background: "rgba(10,13,9,0.28)" }}
                          >
                            PLAY
                          </span>
                        </button>
                      ))}
                    </div>
                  </section>
                ) : null}
              </div>
            )}

            <RecapShareFieldSections
              className="contents"
              cardClassName="order-2"
              sections={Array.from(
                (recap.fields ?? []).reduce((map, field) => {
                  const key = field.section || "Details";
                  const list = map.get(key) ?? [];
                  list.push(field);
                  map.set(key, list);
                  return map;
                }, new Map<string, PublicField[]>()),
              ).map(([name, fields]) => ({ name, fields }))}
            />

            <div className="order-3 md:col-span-2 xl:col-span-2 space-y-6">
              <RecapClientSignoff
                existingStatus={recap.clientSignoff?.status}
                existingComment={recap.clientSignoff?.comment}
                existingAt={recap.clientSignoff?.at}
                busy={signoffBusy}
                onSubmit={submitSignoff}
              />

              {recap.approved ? (
                <RecapComments
                  comments={recap.comments ?? []}
                  busy={commentBusy}
                  error={commentError}
                  onSubmit={submitComment}
                />
              ) : null}
            </div>
          </div>
        </div>,
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={copyShare}
            className="px-4 py-2 rounded-xl text-sm font-semibold"
            style={{
              background: "transparent",
              border: "1px solid var(--recap-border, #e2e4d8)",
              color: "var(--recap-text, #14160f)",
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
            title="Download branded PDF matching this recap"
          >
            Download PDF
          </a>
        </div>,
      )}

      {lightboxIndex != null && lightboxPhotos.length > 0 && (
        <PhotoLightbox
          photos={lightboxPhotos}
          index={lightboxIndex}
          loop={lightboxPhotos.length > 1}
          onClose={() => setLightboxIndex(null)}
          onStep={setLightboxIndex}
        />
      )}
      {playingVideo ? (
        <RecapVideoPlayer
          src={recapVideoPlayUrl(playingVideo.url)}
          fileUrl={playingVideo.url}
          name={playingVideo.name || "Video"}
          onClose={() => setPlayingVideo(null)}
        />
      ) : null}
    </>
  );
};

export default PublicRecap;
