import { Suspense } from "react";
import { Link } from "react-router";
import { useLazyLoadQuery } from "react-relay/hooks";
import ErrorBoundary from "@/components/ErrorBoundary";
import { TenantCalloutsQuery } from "@/api/queries/TenantCalloutsQuery";
import type { TenantCalloutsQuery as TenantCalloutsQueryType } from "@api/queries/__generated__/TenantCalloutsQuery.graphql";
import { calloutLinkLabel, calloutRecapsHref } from "@/lib/dashboardExplain";

type Window = { tenantId: string; startDate: string; endDate: string };

const META = { color: "var(--spark-text-meta)" } as const;

const US_STATES: ReadonlyArray<[string, string]> = [
  ["Alabama", "AL"], ["Alaska", "AK"], ["Arizona", "AZ"], ["Arkansas", "AR"],
  ["California", "CA"], ["Colorado", "CO"], ["Connecticut", "CT"], ["Delaware", "DE"],
  ["Florida", "FL"], ["Georgia", "GA"], ["Hawaii", "HI"], ["Idaho", "ID"],
  ["Illinois", "IL"], ["Indiana", "IN"], ["Iowa", "IA"], ["Kansas", "KS"],
  ["Kentucky", "KY"], ["Louisiana", "LA"], ["Maine", "ME"], ["Maryland", "MD"],
  ["Massachusetts", "MA"], ["Michigan", "MI"], ["Minnesota", "MN"], ["Mississippi", "MS"],
  ["Missouri", "MO"], ["Montana", "MT"], ["Nebraska", "NE"], ["Nevada", "NV"],
  ["New Hampshire", "NH"], ["New Jersey", "NJ"], ["New Mexico", "NM"], ["New York", "NY"],
  ["North Carolina", "NC"], ["North Dakota", "ND"], ["Ohio", "OH"], ["Oklahoma", "OK"],
  ["Oregon", "OR"], ["Pennsylvania", "PA"], ["Rhode Island", "RI"], ["South Carolina", "SC"],
  ["South Dakota", "SD"], ["Tennessee", "TN"], ["Texas", "TX"], ["Utah", "UT"],
  ["Vermont", "VT"], ["Virginia", "VA"], ["Washington", "WA"], ["West Virginia", "WV"],
  ["Wisconsin", "WI"], ["Wyoming", "WY"],
];

const detectStateCode = (text: string): string | null => {
  for (const [name, code] of US_STATES) {
    const re = new RegExp(`\\b${name}\\b`, "i");
    if (re.test(text)) return code;
  }
  return null;
};

const Inner: React.FC<Window> = ({ tenantId, startDate, endDate }) => {
  const data = useLazyLoadQuery<TenantCalloutsQueryType>(
    TenantCalloutsQuery,
    { tenantId, startDate, endDate },
    { fetchPolicy: "store-or-network" },
  );
  const callouts = data.tenantCallouts ?? [];
  if (callouts.length === 0) return null;
  return (
    <section aria-label="Worth a look">
      <h3 className="text-[13px] font-medium mb-2" style={{ color: "var(--spark-text-secondary)" }}>
        Worth a look
      </h3>
      <ul className="m-0 p-0 list-none">
        {callouts.map((c, i) => {
          const stateCode = detectStateCode(c.text);
          const mapHref = stateCode
            ? `/account-map?state=${encodeURIComponent(stateCode)}`
            : "/account-map";
          return (
          <li
            key={c.key}
            className="py-3"
            style={i > 0 ? { borderTop: "1px solid var(--spark-border)" } : undefined}
          >
            <p className="text-sm leading-relaxed max-w-3xl" style={{ color: "var(--spark-text)" }}>
              {c.text}
            </p>
            <p className="text-xs mt-1 flex flex-wrap gap-x-4 gap-y-1 tab-num" style={META}>
              {c.numbers.map((n) => (
                <span key={n.label}>
                  {n.label}: {n.value}
                </span>
              ))}
            </p>
            <div className="mt-1.5 flex items-center gap-3 flex-wrap">
              <Link
                to={calloutRecapsHref(c.link, c.kind)}
                className="text-xs underline"
                style={{ color: "var(--spark-text-secondary)" }}
              >
                {calloutLinkLabel(c.link, c.kind)}
              </Link>
              <Link
                to={mapHref}
                className="text-xs font-semibold px-2.5 py-1 rounded-lg transition hover:opacity-80"
                style={{
                  border: "1px solid var(--spark-border)",
                  color: "var(--spark-text)",
                  textDecoration: "none",
                }}
              >
                {stateCode ? `Plan ${stateCode} wave on Map →` : "Plan wave on Map →"}
              </Link>
              <Link
                to="/requests/create"
                className="text-xs underline"
                style={{ color: "var(--spark-text-secondary)" }}
              >
                Schedule demo →
              </Link>
            </div>
          </li>
          );
        })}
      </ul>
    </section>
  );
};

/**
 * The few things in the program that stand out, each with its numbers and
 * a link to the recaps behind it. Nothing renders when the rules raise
 * nothing, while it loads, or if it fails.
 */
const Callouts: React.FC<Window & { className?: string }> = ({ className, ...window }) => (
  <ErrorBoundary key={`${window.tenantId}|${window.startDate}|${window.endDate}`} fallback={null}>
    <Suspense fallback={null}>
      <div className={className}>
        <Inner {...window} />
      </div>
    </Suspense>
  </ErrorBoundary>
);

export default Callouts;
