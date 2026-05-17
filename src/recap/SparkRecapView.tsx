import { Suspense } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import { useNavigate, useParams } from "react-router";
import Layout from "@/layout/Layout";
import { RecapQuery } from "@/api/queries/RecapQuery";
import type { RecapQuery as RecapQueryType } from "@api/queries/__generated__/RecapQuery.graphql";

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
  const totalConsumer = engagement?.totalConsumer ?? null;
  const firstTime = engagement?.firstTimeConsumers ?? null;
  const brandAware = engagement?.brandAwareConsumers ?? null;
  const willing = engagement?.willingToPurchaseConsumers ?? null;
  const productsSold = recap.productsSold ?? null;
  const ambassadors = (recap.ambassadors ?? []).filter(Boolean);
  const photos = (recap.recapFiles ?? []).filter(
    (f) =>
      f &&
      (f.file?.toString() || "").length > 0 &&
      /(jpg|jpeg|png|webp)$/i.test(f.file ?? ""),
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
          <div className="flex gap-2">
            <button
              className="px-4 py-2 rounded-xl text-sm font-semibold transition"
              style={{
                background: "transparent",
                color: "var(--spark-text)",
                border: "1px solid var(--spark-border)",
              }}
            >
              ⬇ PDF
            </button>
            <button
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

          {/* Photos */}
          {photos.length > 0 && (
            <div className="spark-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="display font-bold">
                  Photos · {photos.length}
                </h3>
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                {photos.slice(0, 24).map((p, i) => (
                  <a
                    key={p?.uuid ?? i}
                    href={p?.file ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="block aspect-square rounded-lg overflow-hidden"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid var(--spark-border)",
                    }}
                  >
                    {p?.file && (
                      <img
                        src={p.file}
                        alt=""
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                    )}
                  </a>
                ))}
              </div>
            </div>
          )}

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
