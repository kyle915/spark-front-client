import { Suspense, useState } from "react";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { useNavigate, useParams } from "react-router";
import Layout from "@/layout/Layout";
import { RecapQuery } from "@/api/queries/RecapQuery";
import type { RecapQuery as RecapQueryType } from "@api/queries/__generated__/RecapQuery.graphql";
import { GenerateRecapPdfMutation } from "@/api/mutations/GenerateRecapPdfMutation";
import type { GenerateRecapPdfMutation as GenerateRecapPdfMutationType } from "@/api/mutations/__generated__/GenerateRecapPdfMutation.graphql";
import { recapFileKind, recapFileUrl, recapFileUrlFresh } from "@/utils/recapFileUrl";
import { useAlertStore } from "@/store/alertStore";
import HeicImage from "./HeicImage";
import RecapUploader from "./RecapUploader";

/**
 * Spark v2 — Recap Detail.
 * Wireframe: spark-demo/index.html lines 1228-1311.
 */

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

const fmtTime = (raw: string | null | undefined) => {
  if (!raw) return "";
  const [h, m] = raw.split(":");
  const hh = parseInt(h ?? "0", 10);
  const ampm = hh >= 12 ? "PM" : "AM";
  const h12 = ((hh + 11) % 12) + 1;
  return m && m !== "00" ? `${h12}:${m} ${ampm}` : `${h12} ${ampm}`;
};

const initials = (full: string) =>
  full
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";

const KpiTile: React.FC<{
  icon: string;
  label: string;
  value: string;
  delta?: string;
  glow?: boolean;
}> = ({ icon, label, value, delta, glow }) => (
  <div className={`kpi kpi-hover ${glow ? "kpi-glow" : ""}`}>
    <div className="flex items-start justify-between">
      <span className="kpi-icon" aria-hidden>
        {icon}
      </span>
      {delta && <span className="kpi-delta">{delta}</span>}
    </div>
    <p className="kpi-value">{value}</p>
    <p className="kpi-label">{label}</p>
  </div>
);

/* ─────────────────── inner ─────────────────── */

const SparkRecapInner: React.FC<{ uuid: string }> = ({ uuid }) => {
  const navigate = useNavigate();
  const showAlert = useAlertStore((s) => s.showAlert);
  const [commitPdf, isPdfRunning] = useMutation<GenerateRecapPdfMutationType>(
    GenerateRecapPdfMutation,
  );
  const [isZipping, setIsZipping] = useState(false);
  const data = useLazyLoadQuery<RecapQueryType>(
    RecapQuery,
    { uuid },
    { fetchPolicy: "store-or-network" },
  );

  const recap = data?.recap;

  if (!recap) {
    return (
      <div
        className="spark-card p-8 text-center text-sm"
        style={{ color: "rgba(255,255,255,0.55)" }}
      >
        Recap not found.
      </div>
    );
  }

  const event = recap.event;
  const engagement = (recap.consumerEngagements ?? [])[0];
  const consumerFeedback = (recap.consumerFeedback ?? [])[0];
  const accountFeedback = (recap.accountFeedback ?? [])[0];
  const totalConsumer = engagement?.totalConsumer ?? null;
  const firstTime = engagement?.firstTimeConsumers ?? null;
  const brandAware = engagement?.brandAwareConsumers ?? null;
  const willing = engagement?.willingToPurchaseConsumers ?? null;
  const productsSold = recap.productsSold ?? null;
  const ambassadors = (recap.ambassadors ?? []).filter(Boolean);
  // All non-empty files. We split into renderable images (img tag) vs
  // unrenderable (HEIC + PDF + video), shown as labeled tiles.
  const allFiles = (recap.recapFiles ?? []).filter(
    (f) => f && (f.file?.toString() || "").length > 0,
  );
  const sales = (recap.salesPerformance ?? []).filter(Boolean);
  const notes = (recap.accountFeedback ?? [])[0]?.feedback ?? null;

  const fieldDate = event?.date ?? recap.createdAt;
  const fieldTime =
    event?.startTime && event?.endTime
      ? `${fmtTime(event.startTime)} – ${fmtTime(event.endTime)}`
      : "";

  return (
    <div className="space-y-6 max-w-7xl">
      <button
        onClick={() => navigate("/recap/list")}
        className="mono text-[11px] transition"
        style={{
          letterSpacing: "0.14em",
          color: "rgba(255,255,255,0.45)",
        }}
      >
        ← BACK TO RECAPS
      </button>

      {/* Title card */}
      <div className="spark-card p-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span
                className="mono"
                style={{
                  fontSize: 10,
                  letterSpacing: "0.16em",
                  padding: "0.2rem 0.55rem",
                  borderRadius: 6,
                  background: "rgba(255,255,255,0.05)",
                  color: "rgba(255,255,255,0.7)",
                }}
              >
                R-{uuid.slice(-4).toUpperCase()}
              </span>
              <span
                className={`chip ${recap.approved ? "chip-lime" : "chip-orange"}`}
              >
                {recap.approved ? "PUBLISHED" : "DRAFT"}
              </span>
            </div>
            <h1
              className="display text-3xl font-bold"
              style={{ letterSpacing: "-0.03em" }}
            >
              {recap.name ?? event?.name ?? "Recap"}
            </h1>
            <p
              className="mt-1"
              style={{ color: "rgba(255,255,255,0.65)" }}
            >
              {event?.request?.retailer?.name ?? event?.address ?? "—"}
              {" · "}
              {fmtDate(fieldDate)}
              {fieldTime ? ` · ${fieldTime}` : ""}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              disabled={isPdfRunning}
              onClick={() => {
                commitPdf({
                  variables: { input: { id: recap.id } },
                  onCompleted: (res) => {
                    if (res.generateRecapPdf?.success) {
                      const file = res.generateRecapPdf.recapFile?.file;
                      if (file) {
                        window.open(recapFileUrl(file), "_blank");
                      }
                      showAlert("PDF generated.", "success");
                    } else {
                      showAlert(
                        res.generateRecapPdf?.message ??
                          "PDF generation failed.",
                        "error",
                      );
                    }
                  },
                  onError: (err) =>
                    showAlert(`PDF failed: ${err.message}`, "error"),
                });
              }}
              className="px-4 py-2 rounded-xl text-sm font-semibold transition"
              style={{
                background: "transparent",
                color: "var(--spark-text)",
                border: "1px solid var(--spark-border)",
                opacity: isPdfRunning ? 0.5 : 1,
              }}
            >
              {isPdfRunning ? "Generating…" : "⬇ PDF"}
            </button>
            <button
              disabled={isZipping || allFiles.length === 0}
              onClick={async () => {
                setIsZipping(true);
                try {
                  const { default: JSZip } = await import("jszip");
                  const zip = new JSZip();
                  // Cap at 200 files for sanity. Order doesn't matter; the
                  // backend can mass-export later.
                  const subset = allFiles.slice(0, 200);
                  let added = 0;
                  for (const f of subset) {
                    const url = recapFileUrl(f?.file);
                    if (!url) continue;
                    try {
                      const resp = await fetch(url);
                      if (!resp.ok) continue;
                      const blob = await resp.blob();
                      const filename =
                        (f?.file ?? "").split("/").pop() || `file-${added}`;
                      zip.file(filename, blob);
                      added += 1;
                    } catch {
                      /* skip individual failures */
                    }
                  }
                  if (added === 0) {
                    showAlert("No downloadable files.", "warning");
                    setIsZipping(false);
                    return;
                  }
                  const out = await zip.generateAsync({
                    type: "blob",
                    compression: "DEFLATE",
                    compressionOptions: { level: 6 },
                  });
                  const a = document.createElement("a");
                  const downloadUrl = URL.createObjectURL(out);
                  a.href = downloadUrl;
                  a.download = `recap-${uuid.slice(-6)}-photos.zip`;
                  a.click();
                  URL.revokeObjectURL(downloadUrl);
                  showAlert(`Downloaded ${added} files.`, "success");
                } catch (e) {
                  showAlert(`Download failed: ${(e as Error).message}`, "error");
                } finally {
                  setIsZipping(false);
                }
              }}
              className="px-4 py-2 rounded-xl text-sm font-semibold transition"
              style={{
                background: "transparent",
                color: "var(--spark-text)",
                border: "1px solid var(--spark-border)",
                opacity:
                  isZipping || allFiles.length === 0 ? 0.5 : 1,
              }}
            >
              {isZipping
                ? "Zipping…"
                : `⬇ All photos (${allFiles.length})`}
            </button>
            <button
              onClick={() => {
                if (navigator.share) {
                  navigator
                    .share({
                      title: recap.name ?? "Spark recap",
                      url: window.location.href,
                    })
                    .catch(() => {});
                } else {
                  navigator.clipboard.writeText(window.location.href);
                  showAlert("Link copied.", "success");
                }
              }}
              className="px-4 py-2 rounded-xl text-sm font-semibold transition"
              style={{
                background: "transparent",
                color: "var(--spark-text)",
                border: "1px solid var(--spark-border)",
              }}
            >
              ↗ Share
            </button>
            <button
              onClick={() => navigate(`/recap/edit/${uuid}`)}
              className="px-4 py-2 rounded-xl text-sm font-semibold transition"
              style={{
                background: "transparent",
                color: "var(--spark-text)",
                border: "1px solid var(--spark-border)",
              }}
            >
              ✎ Edit
            </button>
          </div>
        </div>
      </div>

      {/* 5 KPI tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiTile
          icon="◉"
          label="Samples"
          value={fmtNum(totalConsumer)}
          glow
        />
        <KpiTile icon="★" label="First-time" value={fmtNum(firstTime)} />
        <KpiTile icon="◍" label="Brand aware" value={fmtNum(brandAware)} />
        <KpiTile icon="$" label="Willing to buy" value={fmtNum(willing)} />
        <KpiTile icon="$" label="Products sold" value={fmtNum(productsSold)} />
      </div>

      {/* Performance row — financial + qualitative signals */}
      {(recap.totalEarnings != null ||
        recap.accountSpendAmount != null ||
        recap.totalCansSold != null ||
        recap.totalPacksSold != null) && (
        <div className="spark-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="display font-bold">Performance</h3>
            <span
              className="mono text-[10px]"
              style={{
                letterSpacing: "0.16em",
                color: "rgba(255,255,255,0.45)",
              }}
            >
              FIELD-LOGGED · UNITS + DOLLARS
            </span>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <p className="label-mini">CANS SOLD</p>
              <p
                className="display tab-num font-bold mt-1"
                style={{
                  fontSize: "1.75rem",
                  letterSpacing: "-0.03em",
                  color: "var(--spark-lime)",
                }}
              >
                {fmtNum(recap.totalCansSold)}
              </p>
            </div>
            <div>
              <p className="label-mini">PACKS SOLD</p>
              <p
                className="display tab-num font-bold mt-1"
                style={{
                  fontSize: "1.75rem",
                  letterSpacing: "-0.03em",
                }}
              >
                {fmtNum(recap.totalPacksSold)}
              </p>
            </div>
            <div>
              <p className="label-mini">REVENUE</p>
              <p
                className="display tab-num font-bold mt-1"
                style={{
                  fontSize: "1.75rem",
                  letterSpacing: "-0.03em",
                  color: "var(--spark-lime)",
                }}
              >
                {typeof recap.totalEarnings === "number"
                  ? `$${recap.totalEarnings.toLocaleString()}`
                  : "—"}
              </p>
            </div>
            <div>
              <p className="label-mini">ACCOUNT SPEND</p>
              <p
                className="display tab-num font-bold mt-1"
                style={{
                  fontSize: "1.75rem",
                  letterSpacing: "-0.03em",
                }}
              >
                {typeof recap.accountSpendAmount === "number"
                  ? `$${recap.accountSpendAmount.toLocaleString()}`
                  : "—"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Consumer voice — quotes, demographics, positive stories, reasons-to-decline */}
      {consumerFeedback && (
        consumerFeedback.feedback ||
        consumerFeedback.quotes ||
        consumerFeedback.demographics ||
        consumerFeedback.positiveStories ||
        consumerFeedback.reasonsToDecline
      ) ? (
        <div className="spark-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="display font-bold">Consumer voice</h3>
            <p
              className="mono text-[10px]"
              style={{
                letterSpacing: "0.16em",
                color: "rgba(255,255,255,0.45)",
              }}
            >
              QUOTES · DEMOGRAPHICS · WHAT WORKED
            </p>
          </div>
          {consumerFeedback.quotes && (
            <div>
              <p
                className="mono text-[10px] mb-2"
                style={{
                  letterSpacing: "0.18em",
                  color: "var(--spark-lime)",
                }}
              >
                QUOTES FROM THE FLOOR
              </p>
              <blockquote
                className="italic text-sm leading-relaxed pl-4"
                style={{
                  color: "rgba(255,255,255,0.85)",
                  borderLeft: "2px solid rgba(197,245,70,0.5)",
                }}
              >
                "{consumerFeedback.quotes}"
              </blockquote>
            </div>
          )}
          <div className="grid lg:grid-cols-2 gap-5">
            {consumerFeedback.feedback && (
              <div>
                <p
                  className="mono text-[10px] mb-2"
                  style={{
                    letterSpacing: "0.18em",
                    color: "var(--spark-sky)",
                  }}
                >
                  GENERAL FEEDBACK
                </p>
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: "rgba(255,255,255,0.85)" }}
                >
                  {consumerFeedback.feedback}
                </p>
              </div>
            )}
            {consumerFeedback.demographics && (
              <div>
                <p
                  className="mono text-[10px] mb-2"
                  style={{
                    letterSpacing: "0.18em",
                    color: "var(--spark-sky)",
                  }}
                >
                  DEMOGRAPHICS
                </p>
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: "rgba(255,255,255,0.85)" }}
                >
                  {consumerFeedback.demographics}
                </p>
              </div>
            )}
            {consumerFeedback.positiveStories && (
              <div>
                <p
                  className="mono text-[10px] mb-2"
                  style={{
                    letterSpacing: "0.18em",
                    color: "var(--spark-lime)",
                  }}
                >
                  POSITIVE STORIES
                </p>
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: "rgba(255,255,255,0.85)" }}
                >
                  {consumerFeedback.positiveStories}
                </p>
              </div>
            )}
            {consumerFeedback.reasonsToDecline && (
              <div>
                <p
                  className="mono text-[10px] mb-2"
                  style={{
                    letterSpacing: "0.18em",
                    color: "var(--spark-orange)",
                  }}
                >
                  REASONS TO DECLINE
                </p>
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: "rgba(255,255,255,0.85)" }}
                >
                  {consumerFeedback.reasonsToDecline}
                </p>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* Account feedback */}
      {accountFeedback &&
        (accountFeedback.feedback ||
          accountFeedback.doDifferentlyFeedback ||
          accountFeedback.wasCorpoCardUsed) ? (
        <div className="spark-card p-6 space-y-4">
          <h3 className="display font-bold">Account feedback</h3>
          <div className="grid lg:grid-cols-2 gap-5">
            {accountFeedback.feedback && (
              <div>
                <p
                  className="mono text-[10px] mb-2"
                  style={{
                    letterSpacing: "0.18em",
                    color: "var(--spark-sky)",
                  }}
                >
                  WHAT WENT WELL
                </p>
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: "rgba(255,255,255,0.85)" }}
                >
                  {accountFeedback.feedback}
                </p>
              </div>
            )}
            {accountFeedback.doDifferentlyFeedback && (
              <div>
                <p
                  className="mono text-[10px] mb-2"
                  style={{
                    letterSpacing: "0.18em",
                    color: "var(--spark-orange)",
                  }}
                >
                  DO DIFFERENTLY
                </p>
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: "rgba(255,255,255,0.85)" }}
                >
                  {accountFeedback.doDifferentlyFeedback}
                </p>
              </div>
            )}
          </div>
          {accountFeedback.wasCorpoCardUsed !== null && (
            <p
              className="mono text-[10px]"
              style={{
                letterSpacing: "0.16em",
                color: accountFeedback.wasCorpoCardUsed
                  ? "var(--spark-lime)"
                  : "rgba(255,255,255,0.45)",
              }}
            >
              CORPORATE CARD ·{" "}
              {accountFeedback.wasCorpoCardUsed ? "USED" : "NOT USED"}
            </p>
          )}
        </div>
      ) : null}

      {/* Upload zone — admin/BA can add photos + receipts on the fly */}
      <div
        className="spark-card p-6"
        style={{
          borderColor: "rgba(197,245,70,0.25)",
          background:
            "linear-gradient(180deg, rgba(197,245,70,0.04), transparent)",
        }}
      >
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <p
              className="mono text-[10px]"
              style={{
                letterSpacing: "0.18em",
                color: "var(--spark-lime)",
              }}
            >
              UPLOAD · CAPTURES + RECEIPTS
            </p>
            <h3
              className="display font-bold mt-1"
              style={{ letterSpacing: "-0.02em" }}
            >
              Add files to this recap
            </h3>
          </div>
          <div className="flex gap-2 flex-wrap">
            <RecapUploader
              recapUuid={uuid}
              category="photo"
              onUploaded={(blobName) => {
                // Backend AddRecapFile mutation is the next step. For now
                // we surface the uploaded blob name so an admin can verify
                // the file landed in GCS.
                showAlert(
                  `Photo uploaded: ${blobName}. (Linking to recap requires the AddRecapFile backend mutation.)`,
                  "success",
                );
              }}
            />
            <RecapUploader
              recapUuid={uuid}
              category="receipt"
              onUploaded={(blobName) => {
                showAlert(
                  `Receipt uploaded: ${blobName}. Visible in the Files grid once linked server-side.`,
                  "success",
                );
              }}
            />
          </div>
        </div>
        <p
          className="text-xs"
          style={{ color: "rgba(255,255,255,0.55)" }}
        >
          Photos and receipts upload directly to GCS via signed URL.
          Server-side linking via{" "}
          <span className="mono">AddRecapFile</span> mutation is the last
          backend step before they appear in the file grid automatically.
        </p>
      </div>

      {/* Field intelligence — traffic + competitive presence */}
      {(recap.trafficDescription || recap.competitivePresence) && (
        <div className="grid lg:grid-cols-2 gap-5">
          {recap.trafficDescription && (
            <div className="spark-card p-6">
              <p
                className="mono text-[10px] mb-3"
                style={{
                  letterSpacing: "0.18em",
                  color: "var(--spark-sky)",
                }}
              >
                TRAFFIC · ON THE GROUND
              </p>
              <p
                className="text-sm leading-relaxed"
                style={{ color: "rgba(255,255,255,0.85)" }}
              >
                {recap.trafficDescription}
              </p>
            </div>
          )}
          {recap.competitivePresence && (
            <div className="spark-card p-6">
              <p
                className="mono text-[10px] mb-3"
                style={{
                  letterSpacing: "0.18em",
                  color: "var(--spark-orange)",
                }}
              >
                COMPETITIVE PRESENCE
              </p>
              <p
                className="text-sm leading-relaxed"
                style={{ color: "rgba(255,255,255,0.85)" }}
              >
                {recap.competitivePresence}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Two-col: SKU + Photos + Notes | Team + Compare */}
      <div className="grid lg:grid-cols-[1fr_300px] gap-5">
        <div className="space-y-5">
          {/* SKU breakdown */}
          {sales.length > 0 && (
            <div className="spark-card p-6">
              <h3 className="display font-bold mb-3">Per-SKU breakdown</h3>
              <div className="space-y-2">
                {sales.map((s, i) => (
                  <div
                    key={s?.uuid ?? i}
                    className="flex items-center justify-between py-2"
                    style={{
                      borderBottom:
                        i < sales.length - 1
                          ? "1px solid var(--spark-border)"
                          : "none",
                    }}
                  >
                    <p className="text-sm font-medium">
                      {s?.product?.name ?? "—"}
                    </p>
                    <div className="flex items-center gap-3">
                      {s?.typeOfGood?.name && (
                        <span
                          className="mono text-[10px]"
                          style={{
                            letterSpacing: "0.14em",
                            color: "rgba(255,255,255,0.55)",
                          }}
                        >
                          {s.typeOfGood.name.toUpperCase()}
                        </span>
                      )}
                      <p
                        className="tab-num text-sm font-bold"
                        style={{ color: "var(--spark-lime)" }}
                      >
                        {s?.price ? `$${s.price}` : "—"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Files: images render inline, HEIC + PDF + video shown as
              kind-labeled tiles that open in a new tab. Always rendered
              so missing-data states are visible, not silent. */}
          <div className="spark-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="display font-bold">
                  Files · {allFiles.length}
                </h3>
                <p
                  className="mono text-[10px]"
                  style={{
                    letterSpacing: "0.16em",
                    color: "rgba(255,255,255,0.45)",
                  }}
                >
                  CLICK ANY TILE →
                </p>
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                {allFiles.slice(0, 36).map((p, i) => {
                  const kind = recapFileKind(p?.file);
                  const url = recapFileUrlFresh(p?.file);
                  const labelByKind: Record<typeof kind, string> = {
                    image: "",
                    heic: "HEIC",
                    pdf: "PDF",
                    video: "VIDEO",
                    other: "FILE",
                  };
                  return (
                    <a
                      key={p?.uuid ?? i}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="block aspect-square rounded-lg overflow-hidden relative"
                      style={{
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid var(--spark-border)",
                      }}
                    >
                      {kind === "image" ? (
                        <img
                          src={url}
                          alt=""
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            // Make failures visible — don't hide. Show
                            // the URL so we can diagnose in the wild.
                            const t = e.currentTarget as HTMLImageElement;
                            t.outerHTML = `<div style="font:9px/12px monospace;color:#ef5a2a;padding:6px;word-break:break-all;background:rgba(239,90,42,0.08)">IMG FAILED<br/>${url}</div>`;
                          }}
                        />
                      ) : kind === "heic" ? (
                        <HeicImage
                          url={url}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full grid place-items-center">
                          <div className="text-center">
                            <span
                              className="mono"
                              style={{
                                fontSize: 10,
                                letterSpacing: "0.16em",
                                color: "var(--spark-lime)",
                              }}
                            >
                              {labelByKind[kind]}
                            </span>
                            <p
                              className="mono mt-1"
                              style={{
                                fontSize: 8,
                                letterSpacing: "0.14em",
                                color: "rgba(255,255,255,0.45)",
                              }}
                            >
                              OPEN →
                            </p>
                          </div>
                        </div>
                      )}
                    </a>
                  );
                })}
              </div>
              {allFiles.length > 36 && (
                <p
                  className="mt-3 mono text-[10px]"
                  style={{
                    letterSpacing: "0.16em",
                    color: "rgba(255,255,255,0.45)",
                  }}
                >
                  + {allFiles.length - 36} more files
                </p>
              )}
              {allFiles.length === 0 && (
                <p
                  className="text-sm py-6 text-center"
                  style={{ color: "rgba(255,255,255,0.55)" }}
                >
                  No files attached yet. BAs upload photos + PDFs from the
                  field; they show up here.
                </p>
              )}
            </div>

          {/* BA notes */}
          {notes && (
            <div className="spark-card p-6">
              <h3 className="display font-bold mb-3">BA notes from the field</h3>
              <blockquote
                className="italic text-sm leading-relaxed pl-4"
                style={{
                  color: "rgba(255,255,255,0.75)",
                  borderLeft: "2px solid rgba(197,245,70,0.5)",
                }}
              >
                "{notes}"
              </blockquote>
              {ambassadors[0]?.user && (
                <p
                  className="mono text-[10px] mt-3"
                  style={{
                    letterSpacing: "0.14em",
                    color: "rgba(255,255,255,0.45)",
                  }}
                >
                  — {ambassadors[0].user.firstName?.toUpperCase() ?? ""}{" "}
                  {ambassadors[0].user.lastName?.toUpperCase() ?? ""}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <aside className="space-y-4">
          <div className="spark-card p-5">
            <h3 className="font-bold mb-3">Team</h3>
            {ambassadors.length === 0 ? (
              <p
                className="text-sm"
                style={{ color: "rgba(255,255,255,0.55)" }}
              >
                No team logged yet.
              </p>
            ) : (
              ambassadors.map((a) => {
                const fullName = `${a?.user?.firstName ?? ""} ${a?.user?.lastName ?? ""}`.trim();
                return (
                  <div
                    key={a?.uuid}
                    className="flex items-center gap-3 mb-3 last:mb-0"
                  >
                    <span
                      className="spark-avatar"
                      style={{ width: 32, height: 32, fontSize: "0.75rem" }}
                    >
                      {initials(fullName || "BA")}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">
                        {fullName || "Ambassador"}
                      </p>
                      <p
                        className="mono text-[10px]"
                        style={{ color: "rgba(255,255,255,0.45)" }}
                      >
                        {typeof a?.rating === "number"
                          ? `★ ${a.rating.toFixed(1)}`
                          : "BA"}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};

/* ─────────────────── page ─────────────────── */

export default function SparkRecapView() {
  const { uuid } = useParams<{ uuid: string }>();
  return (
    <Layout>
      <Suspense
        fallback={
          <div
            className="spark-card p-8 text-center text-sm max-w-7xl"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            Loading recap…
          </div>
        }
      >
        <SparkRecapInner uuid={uuid ?? ""} />
      </Suspense>
    </Layout>
  );
}
