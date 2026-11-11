import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router";
import PublicDeadLink from "@/public/PublicDeadLink";
import { RecapDocument } from "@/recap/RecapDocument";
import { programStats, type ProgramSharePayload } from "./programShare";

function apiOrigin(): string {
  const graphql = import.meta.env.VITE_GRAPHQL_ENDPOINT as string | undefined;
  if (!graphql) return "";
  try {
    return new URL(graphql).origin;
  } catch {
    return "";
  }
}

const muted = "var(--recap-muted, #5c6154)";

/**
 * Public, no-login program page for a brand. The signed token in the URL is
 * the key; the brand can switch the link off at any time, after which this
 * shows the dead-link message. Shows totals, markets and field photos only.
 */
const PublicProgram: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const origin = useMemo(apiOrigin, []);
  const [data, setData] = useState<ProgramSharePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
    if (!token) {
      setLoading(false);
      setError("This link isn't valid. Double-check it or ask for a new one.");
      return;
    }
    let cancelled = false;
    fetch(`${origin}/api/public/program/${encodeURIComponent(token)}`)
      .then(async (res) => {
        const json = await res.json().catch(() => null);
        if (cancelled) return;
        if (res.ok && json && typeof json.brand === "string") {
          setData(json as ProgramSharePayload);
          return;
        }
        setError(
          res.status === 410
            ? "This link has expired. Ask your Ignite contact for a fresh one."
            : res.status === 404
              ? "This program page is no longer shared."
              : "This link isn't valid. Double-check it or ask for a new one.",
        );
      })
      .catch(() => {
        if (!cancelled) {
          setError("We couldn't reach the server. Check your connection and try again.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [origin, token]);

  if (loading) {
    return (
      <RecapDocument page>
        <main className="recap-doc-body">
          <p className="text-sm" style={{ color: muted }}>
            Loading…
          </p>
        </main>
      </RecapDocument>
    );
  }
  if (error || !data) {
    return (
      <PublicDeadLink
        eyebrow="Field program"
        title="This program page is unavailable."
        message={error ?? ""}
      />
    );
  }

  const stats = programStats(data.totals);
  const topMarkets = data.markets.slice(0, 12);

  return (
    <RecapDocument page>
      <main className="recap-doc-body">
        <header className="mb-8">
          <p
            className="text-xs uppercase mb-2"
            style={{ letterSpacing: "0.14em", color: muted }}
          >
            Field program
          </p>
          <h1 className="text-4xl font-semibold" style={{ letterSpacing: "-0.03em" }}>
            {data.brand}
          </h1>
        </header>

        {stats.length > 0 ? (
          <section
            aria-label="Program totals"
            className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-6 mb-10"
          >
            {stats.map((s) => (
              <div key={s.label}>
                <p
                  className="text-3xl font-semibold tabular-nums"
                  style={{ letterSpacing: "-0.03em" }}
                >
                  {s.value}
                </p>
                <p
                  className="text-xs uppercase mt-1"
                  style={{ letterSpacing: "0.12em", color: muted }}
                >
                  {s.label}
                </p>
              </div>
            ))}
          </section>
        ) : (
          <p className="text-sm mb-10" style={{ color: muted }}>
            Results will appear here once the first activations are approved.
          </p>
        )}

        {data.photos.length > 0 ? (
          <section aria-label="From the field" className="mb-10">
            <h2 className="text-lg font-semibold mb-3">From the field</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {data.photos.map((p) => (
                <figure key={p.url} className="m-0">
                  <img
                    src={p.url}
                    alt={p.caption || "Field photo"}
                    loading="lazy"
                    className="w-full aspect-[4/3] object-cover"
                    style={{ borderRadius: 10 }}
                  />
                </figure>
              ))}
            </div>
          </section>
        ) : null}

        {topMarkets.length > 0 ? (
          <section aria-label="Where we activated">
            <h2 className="text-lg font-semibold mb-3">Where we activated</h2>
            <ul className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-2 text-sm list-none p-0 m-0">
              {topMarkets.map((m) => (
                <li key={m.state} className="flex justify-between gap-3">
                  <span>{m.state}</span>
                  <span className="tabular-nums" style={{ color: muted }}>
                    {m.activations.toLocaleString("en-US")}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <p className="text-xs mt-12" style={{ color: muted }}>
          Run by Ignite Productions on Spark. Figures update as recaps are approved.
        </p>
      </main>
    </RecapDocument>
  );
};

export default PublicProgram;
