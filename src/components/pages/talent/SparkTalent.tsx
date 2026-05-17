import { useState } from "react";
import Layout from "@/layout/Layout";

/**
 * Spark v2 — Talent search.
 * Wireframe: spark-demo/index.html lines 1359-1385 + baCard helper.
 *
 * Demo data for v1. Wiring to a real ambassador roster requires a new
 * GraphQL endpoint that surfaces ambassadors_ambassador with computed
 * rating + job-history fields (tracked in REBUILD-PLAN.md).
 */

type Tier = "CAPTAIN" | "TOP" | "RISING";

type BA = {
  name: string;
  initials: string;
  location: string;
  distance: string;
  rating: number;
  jobs: number;
  brands: string;
  tier: Tier;
  favorite: boolean;
};

const ROSTER: BA[] = [
  { name: "Maya R.", initials: "MR", location: "Austin", distance: "2.1 mi", rating: 4.9, jobs: 142, brands: "LD · WC · MA", tier: "CAPTAIN", favorite: true },
  { name: "Devon K.", initials: "DK", location: "Round Rock", distance: "12 mi", rating: 4.8, jobs: 98, brands: "LD · Constellation", tier: "TOP", favorite: true },
  { name: "Jordan T.", initials: "JT", location: "Austin", distance: "5 mi", rating: 4.9, jobs: 174, brands: "LD · Tito's · MA", tier: "CAPTAIN", favorite: true },
  { name: "Sasha P.", initials: "SP", location: "Austin", distance: "4 mi", rating: 4.7, jobs: 64, brands: "LD · Modelo", tier: "RISING", favorite: false },
  { name: "Cam S.", initials: "CS", location: "Austin", distance: "1.4 mi", rating: 4.5, jobs: 28, brands: "LD", tier: "RISING", favorite: false },
  { name: "Alex M.", initials: "AM", location: "Austin", distance: "8 mi", rating: 4.8, jobs: 110, brands: "LD · Diageo", tier: "TOP", favorite: false },
];

const TIER_CHIP: Record<Tier, string> = {
  CAPTAIN: "chip chip-lime",
  TOP: "chip chip-lime",
  RISING: "chip chip-sky",
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

export default function SparkTalent() {
  const [query, setQuery] = useState("");
  const [radius, setRadius] = useState("25");
  const [minRating, setMinRating] = useState("4.5");
  const [brand, setBrand] = useState("LD");

  const filtered = ROSTER.filter((b) => {
    const q = query.toLowerCase().trim();
    return !q || b.name.toLowerCase().includes(q) || b.location.toLowerCase().includes(q);
  });

  return (
    <Layout>
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
              ROSTER · {ROSTER.length} BAs
            </p>
            <h1
              className="display text-4xl font-bold mt-2"
              style={{ letterSpacing: "-0.04em" }}
            >
              Search talent.
            </h1>
          </div>
          <button
            className="px-4 py-2 rounded-xl text-sm font-semibold"
            style={{
              background: "var(--spark-lime)",
              color: "#0a0d09",
              boxShadow: "0 0 24px rgba(197,245,70,0.35)",
            }}
          >
            + Invite to apply
          </button>
        </div>

        {/* Filter row */}
        <div className="spark-card p-4 grid lg:grid-cols-4 gap-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name, city, skill…"
            style={inputStyle}
          />
          <select
            value={radius}
            onChange={(e) => setRadius(e.target.value)}
            style={inputStyle}
          >
            <option value="25">Within 25 mi</option>
            <option value="50">Within 50 mi</option>
            <option value="any">Any distance</option>
          </select>
          <select
            value={minRating}
            onChange={(e) => setMinRating(e.target.value)}
            style={inputStyle}
          >
            <option value="4.5">★ 4.5+</option>
            <option value="4.7">★ 4.7+</option>
            <option value="any">Any rating</option>
          </select>
          <select
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            style={inputStyle}
          >
            <option value="LD">Worked w/ Liquid Death</option>
            <option value="any">Any brand</option>
          </select>
        </div>

        {/* Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((b) => (
            <div
              key={b.name}
              className="spark-card hov p-5 cursor-pointer"
            >
              <div className="flex items-start gap-3">
                <span
                  className="spark-avatar"
                  style={{ width: 56, height: 56, fontSize: "1.05rem", borderRadius: 16 }}
                >
                  {b.initials}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-bold truncate">{b.name}</h4>
                    <span
                      className="text-lg"
                      style={{
                        color: b.favorite
                          ? "var(--spark-lime)"
                          : "rgba(255,255,255,0.3)",
                      }}
                    >
                      {b.favorite ? "★" : "☆"}
                    </span>
                  </div>
                  <p
                    className="mono text-[10px] uppercase mt-0.5"
                    style={{
                      letterSpacing: "0.14em",
                      color: "rgba(255,255,255,0.45)",
                    }}
                  >
                    {b.location} · {b.distance}
                  </p>
                  <span className={`${TIER_CHIP[b.tier]} mt-2 inline-flex`}>
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
                    ★ {b.rating}
                  </p>
                  <p className="label-mini">RATING</p>
                </div>
                <div>
                  <p className="tab-num text-lg font-bold">{b.jobs}</p>
                  <p className="label-mini">JOBS</p>
                </div>
                <div>
                  <p className="tab-num text-lg font-bold">98%</p>
                  <p className="label-mini">ON-TIME</p>
                </div>
              </div>
              <p
                className="text-[11px] mt-3 truncate"
                style={{ color: "rgba(255,255,255,0.55)" }}
              >
                Brands:{" "}
                <span style={{ color: "var(--spark-lime)" }}>{b.brands}</span>
              </p>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}
