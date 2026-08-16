import { useMemo } from "react";
import { MapContainer, TileLayer } from "react-leaflet";
import type { LatLngExpression, LatLngBoundsExpression } from "leaflet";
import "leaflet/dist/leaflet.css";
import CampaignPhotoHighlights from "./CampaignPhotoHighlights";
import { SparkLeafletCluster } from "@/shared/map/SparkLeafletCluster";
import { CARTO_DARK_TILE, STATUS_COLOR } from "@/shared/map/sparkMap";

/**
 * Shared, presentational campaign-report renderer.
 *
 * Drives BOTH report surfaces from one plain object:
 *   • the authenticated admin view (/report-view/:requestId), fed by the
 *     `campaignReport` GraphQL query, and
 *   • the public shareable page (/report/:token), fed by the no-auth REST
 *     endpoint.
 *
 * It takes a `CampaignReport`-shaped object MINUS `shareToken` (the public
 * payload never includes the token), so both callers map their data into
 * `CampaignReportData` and render the exact same screen. Action buttons
 * (copy link / download PDF) live on the page wrappers, not here — this
 * component stays pure and print/share-clean.
 *
 * Styling uses the spark-v2 dark tokens via inline CSS-var fallbacks so it
 * renders on-brand whether or not the surrounding app has applied the
 * theme class. The map reuses react-leaflet (already a project dep — no new
 * heavy dependency); when no event has usable coordinates it falls back to
 * a plain location list.
 */

// ─── Public data shape (CampaignReport minus shareToken) ───────────────
export type CampaignReportKpis = {
  events: number;
  recaps: number;
  consumersReached: number;
  samplesDistributed: number;
  productsSold: number;
  cansSold: number;
  packsSold: number;
  totalEngagements: number;
  firstTimeConsumers: number;
  brandAwareConsumers: number;
  willingToPurchase: number;
};

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

// ─── Brand tokens (fallbacks so we render on-brand even un-themed) ──────
const C = {
  bg: "var(--spark-bg, #0a0d09)",
  surface: "var(--spark-surface, #11140e)",
  surface2: "var(--spark-surface-2, #161a12)",
  border: "var(--spark-border, #1f2418)",
  text: "var(--spark-text, #f2f3ee)",
  lime: "var(--spark-lime, #c5f546)",
  sky: "var(--spark-sky, #5fb8ef)",
  gold: "var(--spark-gold, #ffc400)",
  orange: "var(--spark-orange, #ef5a2a)",
  muted: "rgba(255,255,255,0.55)",
  faint: "rgba(255,255,255,0.4)",
} as const;

const cardStyle: React.CSSProperties = {
  background: `linear-gradient(180deg, ${C.surface}, ${C.surface2})`,
  border: `1px solid ${C.border}`,
  borderRadius: 20,
};

// ─── Formatting helpers ─────────────────────────────────────────────────
const nf = (n: number | null | undefined): string =>
  typeof n === "number" && Number.isFinite(n) ? n.toLocaleString() : "0";

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

// Parse a "lat,lng" coordinate string into a finite [lat, lng] pair, or null.
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

// ─── Leaflet marker (default icon assets via Vite ?url imports) ─────────
const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// ─── Section header ─────────────────────────────────────────────────────
const SectionLabel: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <p
    className="mono"
    style={{
      fontSize: 10,
      letterSpacing: "0.18em",
      textTransform: "uppercase",
      color: C.faint,
      margin: 0,
    }}
  >
    {children}
  </p>
);

// ─── KPI tile ───────────────────────────────────────────────────────────
const Kpi: React.FC<{
  label: string;
  value: number;
  tone?: string;
  hint?: string;
}> = ({ label, value, tone, hint }) => (
  <div style={{ ...cardStyle, padding: "1.1rem 1.25rem" }}>
    <SectionLabel>{label}</SectionLabel>
    <p
      className="display tab-num"
      style={{
        fontSize: "2rem",
        fontWeight: 700,
        lineHeight: 1.05,
        marginTop: 6,
        color: tone ?? C.text,
        letterSpacing: "-0.02em",
      }}
    >
      {nf(value)}
    </p>
    {hint && (
      <p style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{hint}</p>
    )}
  </div>
);

// ─── Activation map (reuses react-leaflet; falls back to a list) ────────
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

  // No usable coordinates anywhere → simple location list fallback. Keeps
  // the report meaningful without forcing a map render on empty geo data.
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
                    className="mono"
                    style={{
                      margin: "2px 0 0",
                      fontSize: 11,
                      color: C.faint,
                      letterSpacing: "0.04em",
                    }}
                  >
                    {locationLabel(e)}
                  </p>
                </div>
                <span
                  className="mono"
                  style={{ fontSize: 11, color: C.faint, whiteSpace: "nowrap" }}
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
    <div
      style={{
        ...cardStyle,
        padding: 0,
        overflow: "hidden",
      }}
    >
      <MapContainer
        center={center}
        bounds={bounds}
        zoom={points.length > 1 ? undefined : 11}
        scrollWheelZoom={false}
        style={{ height: 360, width: "100%" }}
      >
        <TileLayer
          attribution={CARTO_DARK_TILE.attribution}
          url={CARTO_DARK_TILE.url}
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

// ─── Main view ──────────────────────────────────────────────────────────
const CampaignReportView: React.FC<{ report: CampaignReportData }> = ({
  report,
}) => {
  const { kpis } = report;

  return (
    <div style={{ color: C.text }}>
      {/* Branded header */}
      <header style={{ ...cardStyle, padding: "1.75rem 2rem", marginBottom: 24 }}>
        <SectionLabel>Campaign report · {report.brandName}</SectionLabel>
        <h1
          className="display"
          style={{
            fontSize: "2.4rem",
            fontWeight: 700,
            margin: "0.4rem 0 0",
            letterSpacing: "-0.03em",
            lineHeight: 1.05,
          }}
        >
          {report.title}
        </h1>
        <div
          className="mono"
          style={{
            marginTop: 10,
            fontSize: 12,
            color: C.muted,
            letterSpacing: "0.04em",
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          {report.dateRange && <span>{report.dateRange}</span>}
          {report.dateRange && <span style={{ color: C.border }}>·</span>}
          <span>Generated {formatGeneratedAt(report.generatedAt)}</span>
        </div>
      </header>

      {/* Headline KPI tiles */}
      <section style={{ marginBottom: 24 }}>
        <div
          style={{
            display: "grid",
            gap: 14,
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          }}
        >
          <Kpi
            label="Consumers reached"
            value={kpis.consumersReached}
            tone={C.lime}
          />
          <Kpi label="Samples distributed" value={kpis.samplesDistributed} />
          <Kpi label="Products sold" value={kpis.productsSold} />
          <Kpi label="Cans sold" value={kpis.cansSold} />
          <Kpi label="Packs sold" value={kpis.packsSold} />
          <Kpi
            label="Total engagements"
            value={kpis.totalEngagements}
            tone={C.sky}
          />
        </div>
      </section>

      {/* Consumer-sentiment breakdown */}
      <section style={{ marginBottom: 28 }}>
        <SectionLabel>Consumer insights</SectionLabel>
        <div
          style={{
            display: "grid",
            gap: 14,
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            marginTop: 10,
          }}
        >
          <Kpi
            label="First-time consumers"
            value={kpis.firstTimeConsumers}
            tone={C.gold}
          />
          <Kpi
            label="Brand-aware consumers"
            value={kpis.brandAwareConsumers}
          />
          <Kpi
            label="Willing to purchase"
            value={kpis.willingToPurchase}
            tone={C.lime}
          />
        </div>
        <div
          className="mono"
          style={{
            marginTop: 10,
            fontSize: 11,
            color: C.faint,
            letterSpacing: "0.04em",
          }}
        >
          {nf(kpis.events)} EVENT{kpis.events === 1 ? "" : "S"} ·{" "}
          {nf(kpis.recaps)} RECAP{kpis.recaps === 1 ? "" : "S"} FILED
        </div>
      </section>

      {/* Event table */}
      <section style={{ marginBottom: 28 }}>
        <SectionLabel>Events</SectionLabel>
        <div
          style={{
            ...cardStyle,
            marginTop: 10,
            overflow: "hidden",
          }}
        >
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 14,
                minWidth: 640,
              }}
            >
              <thead>
                <tr
                  className="mono"
                  style={{
                    textAlign: "left",
                    fontSize: 10,
                    letterSpacing: "0.14em",
                    color: C.faint,
                    background: C.surface2,
                    borderBottom: `1px solid ${C.border}`,
                  }}
                >
                  <th style={{ padding: "0.75rem 1rem" }}>EVENT</th>
                  <th style={{ padding: "0.75rem 1rem" }}>DATE</th>
                  <th style={{ padding: "0.75rem 1rem" }}>LOCATION</th>
                  <th style={{ padding: "0.75rem 1rem", textAlign: "right" }}>
                    RECAPS
                  </th>
                </tr>
              </thead>
              <tbody>
                {report.events.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      style={{
                        padding: "2.5rem 1rem",
                        textAlign: "center",
                        color: C.muted,
                      }}
                    >
                      No events yet.
                    </td>
                  </tr>
                ) : (
                  report.events.map((e) => (
                    <tr
                      key={e.id}
                      style={{ borderBottom: `1px solid ${C.border}` }}
                    >
                      <td
                        style={{
                          padding: "0.75rem 1rem",
                          fontWeight: 600,
                          color: C.text,
                        }}
                      >
                        {e.name || "—"}
                      </td>
                      <td
                        style={{ padding: "0.75rem 1rem", color: C.muted }}
                      >
                        {formatEventDate(e.date)}
                      </td>
                      <td
                        style={{ padding: "0.75rem 1rem", color: C.muted }}
                      >
                        {locationLabel(e)}
                      </td>
                      <td
                        className="tab-num"
                        style={{
                          padding: "0.75rem 1rem",
                          textAlign: "right",
                          color: e.recapCount > 0 ? C.lime : C.faint,
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

      {/* Photo highlights gallery (responsive grid + click-to-enlarge
          lightbox; renders nothing when there are no photos) */}
      <CampaignPhotoHighlights photos={report.photos} />

      {/* Activation map / location list */}
      <section style={{ marginBottom: 28 }}>
        <SectionLabel>Activation map</SectionLabel>
        <div style={{ marginTop: 10 }}>
          <ActivationMap events={report.events} />
        </div>
      </section>

      {/* BA roster */}
      {report.ambassadors.length > 0 && (
        <section style={{ marginBottom: 28 }}>
          <SectionLabel>Brand ambassadors</SectionLabel>
          <div
            style={{
              display: "grid",
              gap: 12,
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              marginTop: 10,
            }}
          >
            {report.ambassadors.map((ba, i) => (
              <div
                key={`${ba.name}-${i}`}
                style={{
                  ...cardStyle,
                  padding: "0.9rem 1.1rem",
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
                    className="chip"
                    style={{
                      marginTop: 6,
                      display: "inline-flex",
                      color: ba.isExternal ? C.gold : C.lime,
                      background: ba.isExternal
                        ? "rgba(255,201,96,0.10)"
                        : "rgba(197,245,70,0.10)",
                    }}
                  >
                    {ba.isExternal ? "EXTERNAL" : "ROSTER"}
                  </span>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p
                    className="tab-num"
                    style={{
                      margin: 0,
                      fontSize: "1.4rem",
                      fontWeight: 700,
                      color: C.text,
                      lineHeight: 1,
                    }}
                  >
                    {nf(ba.eventCount)}
                  </p>
                  <SectionLabel>
                    event{ba.eventCount === 1 ? "" : "s"}
                  </SectionLabel>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Consumer-quote highlights */}
      {report.highlights.length > 0 && (
        <section style={{ marginBottom: 8 }}>
          <SectionLabel>Highlights</SectionLabel>
          <div
            style={{
              display: "grid",
              gap: 12,
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              marginTop: 10,
            }}
          >
            {report.highlights.map((q, i) => (
              <blockquote
                key={i}
                style={{
                  ...cardStyle,
                  margin: 0,
                  padding: "1.1rem 1.25rem",
                  borderLeft: `3px solid ${C.lime}`,
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: 15,
                    lineHeight: 1.5,
                    color: C.text,
                  }}
                >
                  &ldquo;{q.text}&rdquo;
                </p>
                {q.source && (
                  <footer
                    className="mono"
                    style={{
                      marginTop: 8,
                      fontSize: 11,
                      letterSpacing: "0.06em",
                      color: C.faint,
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
