import { Suspense, useMemo, useState } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import Layout from "@/layout/Layout";
import { AmbassadorsListQuery } from "@/api/queries/AmbassadorsListQuery";
import type { AmbassadorsListQuery as AmbassadorsListQueryType } from "@api/queries/__generated__/AmbassadorsListQuery.graphql";
import InviteNewBAModal from "./InviteNewBAModal";

/**
 * Spark v2 — Talent search.
 *
 * Wired to the live AmbassadorsListQuery (was hardcoded "Maya R. /
 * Devon K. / Jordan T." demo data). Fields we surface today:
 *   - name + initials (from user.firstName / lastName)
 *   - rating (live)
 *   - email + city (parsed from address when present)
 *   - active status
 *
 * Jobs count + brand history rely on a separate aggregation backend
 * that doesn't ship yet. Cards still render those slots as "—" so the
 * layout stays consistent for when they come online.
 */

type Tier = "CAPTAIN" | "TOP" | "RISING" | "NEW";

type BA = {
  uuid: string;
  name: string;
  email: string;
  initials: string;
  location: string;
  rating: number | null;
  jobs: number | null;
  tier: Tier;
  isActive: boolean;
};

const TIER_CHIP: Record<Tier, string> = {
  CAPTAIN: "chip chip-lime",
  TOP: "chip chip-lime",
  RISING: "chip chip-sky",
  NEW: "chip chip-muted",
};

const inputStyle: React.CSSProperties = {
  background: "var(--spark-bg)",
  border: "1px solid var(--spark-border)",
  borderRadius: 12,
  padding: "0.65rem 0.9rem",
  color: "var(--spark-text)",
  fontSize: "0.875rem",
  outline: "none",
  width: "100%",
};

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";

const tierFromRating = (
  rating: number | null,
  isActive: boolean,
): Tier => {
  if (!isActive) return "NEW";
  if (rating == null) return "NEW";
  if (rating >= 4.85) return "CAPTAIN";
  if (rating >= 4.6) return "TOP";
  if (rating >= 4.0) return "RISING";
  return "NEW";
};

// Pull a friendly city out of a free-text address. Cheap heuristic:
// last comma-separated segment that isn't a ZIP/country.
const cityFromAddress = (raw: string): string => {
  if (!raw) return "";
  const parts = raw
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  // Drop trailing "USA" / state-codes / zips
  for (let i = parts.length - 1; i >= 0; i--) {
    const seg = parts[i];
    if (/^(usa|united states|us)$/i.test(seg)) continue;
    if (/^\d{5}(-\d{4})?$/.test(seg)) continue;
    if (/^[A-Z]{2}( \d{5})?$/.test(seg)) continue;
    return seg;
  }
  return parts[0] ?? "";
};

const TalentInner: React.FC = () => {
  const data = useLazyLoadQuery<AmbassadorsListQueryType>(
    AmbassadorsListQuery,
    { first: 200 },
    { fetchPolicy: "store-or-network" },
  );

  const [query, setQuery] = useState("");
  const [radius, setRadius] = useState("any");
  const [minRating, setMinRating] = useState("any");
  const [activeOnly, setActiveOnly] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);

  const all: BA[] = useMemo(() => {
    return (data?.ambassadors?.edges ?? [])
      .map((e) => e?.node)
      .filter((n): n is NonNullable<typeof n> => Boolean(n))
      .map((n) => {
        const firstName = n.user?.firstName ?? "";
        const lastName = n.user?.lastName ?? "";
        const name =
          [firstName, lastName].filter(Boolean).join(" ") ||
          n.user?.email ||
          "BA";
        const rating = typeof n.rating === "number" ? n.rating : null;
        const isActive = Boolean(n.isActive);
        return {
          uuid: String(n.uuid),
          name,
          email: n.user?.email ?? "",
          initials: initialsOf(name),
          location: cityFromAddress(n.address ?? ""),
          rating,
          jobs: null,
          tier: tierFromRating(rating, isActive),
          isActive,
        };
      });
  }, [data]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    const minR =
      minRating === "any" ? null : parseFloat(minRating);
    return all.filter((b) => {
      if (activeOnly && !b.isActive) return false;
      if (minR !== null && (b.rating == null || b.rating < minR)) return false;
      if (
        q &&
        !b.name.toLowerCase().includes(q) &&
        !b.location.toLowerCase().includes(q) &&
        !b.email.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [all, query, minRating, activeOnly]);

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <p
            className="mono text-[10px]"
            style={{
              letterSpacing: "0.18em",
              color: "rgba(255,255,255,0.45)",
            }}
          >
            ROSTER · {filtered.length} of {all.length} BAs
          </p>
          <h1
            className="display text-4xl font-bold mt-2"
            style={{ letterSpacing: "-0.04em" }}
          >
            Search talent.
          </h1>
          <p
            className="mt-2"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            Live from the BA roster. Jobs + brand history land when the
            ambassador-events aggregation backend ships.
          </p>
        </div>
        <button
          onClick={() => setInviteOpen(true)}
          className="px-4 py-2.5 rounded-xl text-sm font-semibold"
          style={{
            background: "var(--spark-lime)",
            color: "#0a0d09",
            boxShadow: "0 0 16px rgba(197,245,70,0.30)",
          }}
        >
          + Invite BA
        </button>
      </div>
      {inviteOpen && (
        <InviteNewBAModal onClose={() => setInviteOpen(false)} />
      )}

      {/* Filter row */}
      <div className="spark-card p-4 grid lg:grid-cols-4 gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Name, city, email…"
          style={inputStyle}
        />
        <select
          value={radius}
          onChange={(e) => setRadius(e.target.value)}
          style={inputStyle}
        >
          <option value="any">Any distance</option>
          <option value="25">Within 25 mi (when geocoded)</option>
          <option value="50">Within 50 mi (when geocoded)</option>
        </select>
        <select
          value={minRating}
          onChange={(e) => setMinRating(e.target.value)}
          style={inputStyle}
        >
          <option value="any">Any rating</option>
          <option value="4.0">★ 4.0+</option>
          <option value="4.5">★ 4.5+</option>
          <option value="4.7">★ 4.7+</option>
        </select>
        <label
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm cursor-pointer"
          style={{
            background: "var(--spark-bg)",
            border: "1px solid var(--spark-border)",
            color: "var(--spark-text)",
          }}
        >
          <input
            type="checkbox"
            checked={activeOnly}
            onChange={(e) => setActiveOnly(e.target.checked)}
            className="accent-[var(--spark-lime)]"
          />
          Active only
        </label>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div
          className="spark-card p-10 text-center text-sm"
          style={{ color: "rgba(255,255,255,0.55)" }}
        >
          No BAs match these filters.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((b) => (
            <div key={b.uuid} className="spark-card hov p-5">
              <div className="flex items-start gap-3">
                <span
                  className="spark-avatar"
                  style={{
                    width: 56,
                    height: 56,
                    fontSize: "1.05rem",
                    borderRadius: 16,
                  }}
                >
                  {b.initials}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-bold truncate">{b.name}</h4>
                    {!b.isActive && (
                      <span
                        className="mono text-[9px]"
                        style={{
                          letterSpacing: "0.16em",
                          color: "rgba(255,255,255,0.45)",
                        }}
                      >
                        INACTIVE
                      </span>
                    )}
                  </div>
                  {(b.location || b.email) && (
                    <p
                      className="mono text-[10px] uppercase mt-0.5 truncate"
                      style={{
                        letterSpacing: "0.14em",
                        color: "rgba(255,255,255,0.45)",
                      }}
                    >
                      {b.location || b.email}
                    </p>
                  )}
                  <span
                    className={`${TIER_CHIP[b.tier]} mt-2 inline-flex`}
                  >
                    {b.tier}
                  </span>
                </div>
              </div>
              <div
                className="mt-4 pt-3 grid grid-cols-3 gap-2 text-center"
                style={{ borderTop: "1px solid var(--spark-border)" }}
              >
                <div>
                  <p
                    className="tab-num text-lg font-bold"
                    style={{ color: "var(--spark-lime)" }}
                  >
                    {b.rating != null ? `★ ${b.rating.toFixed(1)}` : "—"}
                  </p>
                  <p className="label-mini">RATING</p>
                </div>
                <div>
                  <p className="tab-num text-lg font-bold">
                    {b.jobs != null ? b.jobs : "—"}
                  </p>
                  <p className="label-mini">JOBS</p>
                </div>
                <div>
                  <p className="tab-num text-lg font-bold">—</p>
                  <p className="label-mini">ON-TIME</p>
                </div>
              </div>
              {b.email && (
                <p
                  className="text-[11px] mt-3 truncate"
                  style={{ color: "rgba(255,255,255,0.55)" }}
                >
                  <a
                    href={`mailto:${b.email}`}
                    style={{
                      color: "var(--spark-sky)",
                      textDecoration: "none",
                    }}
                  >
                    {b.email}
                  </a>
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default function SparkTalent() {
  return (
    <Layout>
      <Suspense
        fallback={
          <div
            className="spark-card p-8 text-center text-sm max-w-7xl"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            Loading roster…
          </div>
        }
      >
        <TalentInner />
      </Suspense>
    </Layout>
  );
}
