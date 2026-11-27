import { useMemo } from "react";
import { MapContainer, TileLayer } from "react-leaflet";
import type { LatLngExpression, LatLngBoundsExpression } from "leaflet";
import "leaflet/dist/leaflet.css";
import CampaignPhotoHighlights from "./CampaignPhotoHighlights";
import { SparkLeafletCluster } from "@/shared/map/SparkLeafletCluster";
import { OSM_LIGHT_TILE, STATUS_COLOR } from "@/shared/map/sparkMap";
import { RecapKpiStrip, type RecapKpiItem } from "@/recap/RecapDetailShell";
import {
  buildCampaignFunnel,
  computeCampaignConversionPct,
  type CampaignFunnelInput,
} from "./campaignFunnel";

export type CampaignReportKpis = CampaignFunnelInput;

export type CampaignReportEventRow = {
  id: string;
  name?: string | null;
  date?: string | null;
  locationName?: string | null;
  city?: string | null;
  state?: string | null;
  coordinates?: string | null;
  recapCount: number;
};

export type CampaignReportPhoto = { url: string; caption?: string | null };
export type CampaignReportBa = {
  name: string;
  isExternal: boolean;
  eventCount: number;
};
export type CampaignReportQuote = { text: string; source?: string | null };

export type CampaignReportData = {
  requestId: string;
  brandName: string;
  title: string;
  dateRange?: string | null;
  generatedAt: string;
  kpis: CampaignReportKpis;
  events: ReadonlyArray<CampaignReportEventRow>;
  photos: ReadonlyArray<CampaignReportPhoto>;
  ambassadors: ReadonlyArray<CampaignReportBa>;
  highlights: ReadonlyArray<CampaignReportQuote>;
};

const C = {
  surface: "var(--recap-surface, #ffffff)",
  border: "var(--recap-border, #e2e4d8)",
  text: "var(--recap-text, #14160f)",
  accent: "var(--recap-heading, #3f5c12)",
  muted: "var(--recap-muted, #5c6154)",
  faint: "var(--recap-faint, #7a7f70)",
} as const;

const cardStyle: React.CSSProperties = {
  background: C.surface,
  border: `1px solid ${C.border}`,
  borderRadius: 12,
};

const nf = (n: number | null | undefined): string =>
  typeof n === "number" && Number.isFinite(n) ? n.toLocaleString("en-US") : "0";

const formatGeneratedAt = (raw: string | null | undefined): string => {
  if (!raw) return "";
  try {
    return new Date(raw).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return raw;
  }
};

const formatEventDate = (raw: string | null | undefined): string => {
  if (!raw) return "—";
  try {
    return new Date(raw).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return raw;
  }
};

const parseCoords = (
  raw: string | null | undefined,
): [number, number] | null => {
  if (!raw) return null;
  const parts = String(raw)
    .split(/[,;\s]+/)
    .map((p) => Number.parseFloat(p))
    .filter((n) => Number.isFinite(n));
  if (parts.length < 2) return null;
  const [lat, lng] = parts;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return [lat, lng];
};

const locationLabel = (e: CampaignReportEventRow): string => {
  const place = [e.city, e.state].filter(Boolean).join(", ");
  return [e.locationName, place].filter(Boolean).join(" · ") || "—";
};

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const SectionHeading: React.FC<{
  title: string;
  subtitle?: string;
}> = ({ title, subtitle }) => (
  <div className="mb-3">
    <h2
      className="display font-semibold text-base"
      style={{ letterSpacing: "-0.02em", color: C.text, margin: 0 }}
    >
      {title}
    </h2>
    {subtitle ? (
      <p className="text-xs mt-0.5 m-0" style={{ color: C.muted }}>
        {subtitle}
      </p>
    ) : null}
  </div>
);

const ActivationMap: React.FC<{ events: ReadonlyArray<CampaignReportEventRow> }> = ({
  events,
}) => {
  const points = useMemo(
    () =>
      events
        .map((e) => ({ event: e, pos: parseCoords(e.coordinates) }))
        .filter(
          (p): p is { event: CampaignReportEventRow; pos: [number, number] } =>
            p.pos !== null,
        ),
    [events],
  );

  if (points.length === 0) {
    return (
      <div style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {events.length === 0 ? (
            <li style={{ padding: "1.25rem", color: C.muted, fontSize: 14 }}>
              No activation locations yet.
            </li>
          ) : (
            events.map((e, i) => (
              <li
                key={e.id}
                style={{
                  padding: "0.85rem 1.1rem",
                  borderTop: i === 0 ? "none" : `1px solid ${C.border}`,
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <p
                    style={{
                      margin: 0,
                      fontWeight: 600,
                      color: C.text,
                      fontSize: 14,
                    }}
                  >
                    {e.name || e.locationName || "Activation"}
                  </p>
                  <p
                    style={{
                      margin: "2px 0 0",
                      fontSize: 12,
                      color: C.muted,
                    }}
                  >
                    {locationLabel(e)}
                  </p>
                </div>
                <span
                  className="tab-num"
                  style={{ fontSize: 12, color: C.muted, whiteSpace: "nowrap" }}
                >
                  {formatEventDate(e.date)}
                </span>
              </li>
            ))
          )}
        </ul>
      </div>
    );
  }

  const center: LatLngExpression = points[0].pos;
  const bounds: LatLngBoundsExpression | undefined =
    points.length > 1 ? points.map((p) => p.pos) : undefined;

  return (
    <div style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
      <MapContainer
        center={center}
        bounds={bounds}
        zoom={points.length > 1 ? undefined : 11}
        scrollWheelZoom={false}
        style={{ height: 340, width: "100%" }}
      >
        <TileLayer
          attribution={OSM_LIGHT_TILE.attribution}
          url={OSM_LIGHT_TILE.url}
        />
        <SparkLeafletCluster
          pins={points.map(({ event, pos }) => ({
            id: event.id,
            position: pos,
            color: STATUS_COLOR.recent,
            popupHtml: `<div style="min-width:140px">
              <strong>${escapeHtml(event.name || event.locationName || "Activation")}</strong>
              <p style="margin:2px 0 0;font-size:12px">${escapeHtml(locationLabel(event))}</p>
              <p style="margin:4px 0 0;font-size:12px">${escapeHtml(formatEventDate(event.date))} · ${event.recapCount} recap${event.recapCount === 1 ? "" : "s"}</p>
            </div>`,
          }))}
        />
      </MapContainer>
    </div>
  );
};

const CampaignReportView: React.FC<{ report: CampaignReportData }> = ({
  report,
}) => {
  const { kpis } = report;
  const convPct = computeCampaignConversionPct(kpis);
  const funnel = useMemo(() => buildCampaignFunnel(kpis), [kpis]);

  const kpiItems = useMemo<RecapKpiItem[]>(() => {
    const out: RecapKpiItem[] = [
      { label: "Events run", value: nf(kpis.events) },
      { label: "Consumers reached", value: nf(kpis.consumersReached), glow: true },
      { label: "Samples handed out", value: nf(kpis.samplesDistributed) },
      { label: "Units sold", value: nf(kpis.productsSold) },
    ];
    if (convPct) {
      out.push({ label: "Conversion", value: convPct });
    } else if (kpis.totalEngagements > 0) {
      out.push({ label: "Engagements", value: nf(kpis.totalEngagements) });
    }
    return out;
  }, [kpis, convPct]);

  const packSplit = [
    kpis.cansSold > 0 ? `${nf(kpis.cansSold)} cans sold` : null,
    kpis.packsSold > 0 ? `${nf(kpis.packsSold)} packs sold` : null,
    kpis.brandAwareConsumers > 0
      ? `${nf(kpis.brandAwareConsumers)} already brand-aware`
      : null,
  ].filter(Boolean);

  return (
    <div className="space-y-6" style={{ color: C.text }}>
      {/* Editorial masthead (RecapDocument above already carries Brand × Spark mark) */}
      <header className="px-1 pt-1">
        <p className="text-xs font-medium m-0" style={{ color: C.muted }}>
          Campaign report
          {report.brandName ? ` · ${report.brandName}` : ""}
          {` · ${nf(kpis.recaps)} filed ${kpis.recaps === 1 ? "recap" : "recaps"}`}
        </p>
        <h1
          className="display font-semibold mt-1"
          style={{
            fontSize: "clamp(1.65rem, 3.5vw, 2.25rem)",
            margin: 0,
            letterSpacing: "-0.03em",
            lineHeight: 1.1,
          }}
        >
          {report.title}
        </h1>
        <p className="text-xs mt-1.5 m-0 tab-num" style={{ color: C.muted }}>
          {report.dateRange ? `${report.dateRange} · ` : ""}
          Generated {formatGeneratedAt(report.generatedAt)}
        </p>
      </header>

      {/* Connected KPI strip */}
      <div>
        <RecapKpiStrip items={kpiItems} />
        {packSplit.length > 0 ? (
          <p className="text-xs mt-2 px-1 tab-num" style={{ color: C.muted }}>
            {packSplit.join(" · ")}
          </p>
        ) : null}
      </div>

      {/* Visual Trial & Conversion Funnel */}
      {funnel.length > 1 ? (
        <section
          aria-label="Trial and conversion funnel"
          style={{ ...cardStyle, padding: "1.25rem 1.35rem" }}
          className="spark-print-keep"
        >
          <SectionHeading
            title="Shopper trial & conversion funnel"
            subtitle="Progression from activation reach through sampling, purchase intent, and units sold."
          />
          <div className="space-y-3 mt-3">
            {funnel.map((stage) => (
              <div key={stage.key} className="space-y-1">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium" style={{ color: C.text }}>
                    {stage.label}
                  </span>
                  <span className="tab-num flex items-baseline gap-2">
                    {stage.rateNote ? (
                      <span className="text-xs" style={{ color: C.muted }}>
                        {stage.rateNote}
                      </span>
                    ) : null}
                    <strong className="font-semibold" style={{ color: C.text }}>
                      {nf(stage.value)}
                    </strong>
                  </span>
                </div>
                <div
                  className="h-2 rounded-sm overflow-hidden"
                  style={{ background: "rgba(20, 22, 15, 0.06)" }}
                  aria-hidden
                >
                  <div
                    className="h-full rounded-sm"
                    style={{
                      width: `${stage.barPct}%`,
                      background:
                        stage.key === "sold" ? C.accent : "rgba(20, 22, 15, 0.78)",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Event table */}
      <section className="spark-print-keep">
        <SectionHeading title="Activations in this report" />
        <div style={{ ...cardStyle, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 14,
                minWidth: 560,
              }}
            >
              <thead>
                <tr
                  style={{
                    textAlign: "left",
                    fontSize: 12,
                    color: C.muted,
                    borderBottom: `1px solid ${C.border}`,
                  }}
                >
                  <th style={{ padding: "0.7rem 1rem", fontWeight: 500 }}>Event</th>
                  <th style={{ padding: "0.7rem 1rem", fontWeight: 500 }}>Date</th>
                  <th style={{ padding: "0.7rem 1rem", fontWeight: 500 }}>Location</th>
                  <th style={{ padding: "0.7rem 1rem", textAlign: "right", fontWeight: 500 }}>
                    Recaps
                  </th>
                </tr>
              </thead>
              <tbody>
                {report.events.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      style={{
                        padding: "2rem 1rem",
                        textAlign: "center",
                        color: C.muted,
                      }}
                    >
                      No events yet.
                    </td>
                  </tr>
                ) : (
                  report.events.map((e, idx) => (
                    <tr
                      key={e.id}
                      style={idx > 0 ? { borderTop: `1px solid ${C.border}` } : undefined}
                    >
                      <td
                        style={{
                          padding: "0.7rem 1rem",
                          fontWeight: 500,
                          color: C.text,
                        }}
                      >
                        {e.name || "—"}
                      </td>
                      <td
                        className="tab-num whitespace-nowrap"
                        style={{ padding: "0.7rem 1rem", color: C.muted }}
                      >
                        {formatEventDate(e.date)}
                      </td>
                      <td style={{ padding: "0.7rem 1rem", color: C.muted }}>
                        {locationLabel(e)}
                      </td>
                      <td
                        className="tab-num font-semibold"
                        style={{
                          padding: "0.7rem 1rem",
                          textAlign: "right",
                          color: e.recapCount > 0 ? C.accent : C.faint,
                        }}
                      >
                        {nf(e.recapCount)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Photo highlights gallery */}
      <CampaignPhotoHighlights photos={report.photos} />

      {/* Activation map */}
      <section className="spark-print-keep">
        <SectionHeading title="Activation map" />
        <ActivationMap events={report.events} />
      </section>

      {/* BA roster */}
      {report.ambassadors.length > 0 && (
        <section className="spark-print-keep">
          <SectionHeading title="Brand ambassadors" />
          <div
            style={{
              display: "grid",
              gap: 12,
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            }}
          >
            {report.ambassadors.map((ba, i) => (
              <div
                key={`${ba.name}-${i}`}
                style={{
                  ...cardStyle,
                  padding: "0.85rem 1rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <p
                    style={{
                      margin: 0,
                      fontWeight: 600,
                      color: C.text,
                      fontSize: 14,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {ba.name}
                  </p>
                  <span
                    className={`chip mt-1.5 ${ba.isExternal ? "chip-muted" : "chip-lime"}`}
                  >
                    {ba.isExternal ? "External" : "Roster"}
                  </span>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p
                    className="display tab-num"
                    style={{
                      margin: 0,
                      fontSize: "1.35rem",
                      fontWeight: 600,
                      letterSpacing: "-0.03em",
                      color: C.text,
                      lineHeight: 1,
                    }}
                  >
                    {nf(ba.eventCount)}
                  </p>
                  <p className="text-xs m-0 mt-0.5" style={{ color: C.muted }}>
                    {ba.eventCount === 1 ? "event" : "events"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Consumer-quote highlights */}
      {report.highlights.length > 0 && (
        <section className="spark-print-keep">
          <SectionHeading title="Shopper & field highlights" />
          <div
            style={{
              display: "grid",
              gap: 12,
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            }}
          >
            {report.highlights.map((q, i) => (
              <blockquote
                key={i}
                style={{
                  ...cardStyle,
                  margin: 0,
                  padding: "1rem 1.15rem",
                  borderLeft: `3px solid ${C.accent}`,
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: 14,
                    lineHeight: 1.5,
                    color: C.text,
                  }}
                >
                  &ldquo;{q.text}&rdquo;
                </p>
                {q.source && (
                  <footer
                    style={{
                      marginTop: 6,
                      fontSize: 12,
                      color: C.muted,
                    }}
                  >
                    — {q.source}
                  </footer>
                )}
              </blockquote>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default CampaignReportView;
