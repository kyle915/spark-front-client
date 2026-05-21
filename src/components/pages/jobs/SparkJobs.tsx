import { Suspense, useMemo, useState } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import { useNavigate } from "react-router";
import Layout from "@/layout/Layout";
import { JobsQuery } from "@/api/queries/JobsQuery";
import type { JobsQuery as JobsQueryType } from "@api/queries/__generated__/JobsQuery.graphql";
import { useAuthStore } from "@/store/authStore";
import BriefingTemplatesPanel from "./BriefingTemplatesPanel";

/**
 * Spark v2 — Jobs board.
 * Wireframe: spark-demo/index.html lines 1029-1061 + jobRow helper (3913).
 */

type JobRow = {
  uuid: string;
  code: string;
  venue: string;
  when: string;
  role: string;
  status: "open" | "filling" | "confirmed";
  urgent: boolean;
};

const fmtDate = (raw: string | null | undefined) => {
  if (!raw) return "";
  try {
    return new Date(raw).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  } catch {
    return raw;
  }
};

const JobsInner: React.FC = () => {
  const navigate = useNavigate();
  const { tenantId } = useAuthStore();

  const data = useLazyLoadQuery<JobsQueryType>(
    JobsQuery,
    { first: 50, filters: tenantId ? { tenantId } : null },
    { fetchPolicy: "store-or-network" },
  );

  const jobs: JobRow[] = useMemo(() => {
    return (
      data?.jobs?.edges
        ?.map((e) => e?.node)
        ?.filter((n): n is NonNullable<typeof n> => Boolean(n))
        ?.map((n) => {
          const status: JobRow["status"] = n.closed
            ? "confirmed"
            : n.ongoing
              ? "filling"
              : "open";
          const when = [fmtDate(n.startDate), fmtDate(n.endDate)]
            .filter(Boolean)
            .join(" – ");
          return {
            uuid: String(n.uuid),
            code: `JOB-${(n.code ?? String(n.id)).toString().slice(-4).toUpperCase()}`,
            venue: n.event?.name ?? n.name ?? "—",
            when: when || "—",
            role: n.jobTitle?.name ?? "Brand Ambassador",
            status,
            urgent: !n.closed && !n.ongoing,
          };
        }) ?? []
    );
  }, [data]);

  if (jobs.length === 0) {
    return (
      <div
        className="spark-card p-8 text-center text-sm"
        style={{ color: "rgba(255,255,255,0.55)" }}
      >
        No jobs posted yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {jobs.map((j) => (
        <div
          key={j.uuid}
          onClick={() => navigate(`/job/view/${j.uuid}`)}
          className="spark-card hov p-5 cursor-pointer"
        >
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <span
                className={`spark-dot mt-2 ${j.urgent ? "" : ""}`}
                style={
                  j.urgent
                    ? { background: "var(--spark-orange)", boxShadow: "0 0 10px var(--spark-orange)" }
                    : undefined
                }
              />
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span
                    className="mono text-[10px]"
                    style={{
                      letterSpacing: "0.14em",
                      color: "rgba(255,255,255,0.45)",
                    }}
                  >
                    {j.code}
                  </span>
                  <span
                    className={`chip ${
                      j.status === "open"
                        ? "chip-orange"
                        : "chip-lime"
                    }`}
                  >
                    {j.status.toUpperCase()}
                  </span>
                  {j.urgent && (
                    <span className="chip chip-orange">URGENT</span>
                  )}
                </div>
                <h3 className="font-bold truncate">{j.venue}</h3>
                <p
                  className="text-xs mt-0.5"
                  style={{ color: "rgba(255,255,255,0.55)" }}
                >
                  {j.when}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-6 flex-wrap">
              <div className="text-right">
                <p className="label-mini">ROLE</p>
                <p className="font-semibold text-sm">{j.role}</p>
              </div>
              <div className="text-right">
                <p className="label-mini">SLOTS</p>
                <p className="font-semibold text-sm tab-num">—</p>
              </div>
              <div className="text-right">
                <p className="label-mini">APPLICANTS</p>
                <p
                  className="font-semibold text-sm tab-num"
                  style={{ color: "var(--spark-lime)" }}
                >
                  —
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/job/view/${j.uuid}`);
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold"
                style={{
                  background: "var(--spark-lime)",
                  color: "#0a0d09",
                  boxShadow: "0 0 18px rgba(197,245,70,0.35)",
                }}
              >
                Review
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default function SparkJobs() {
  const navigate = useNavigate();
  const [templatesOpen, setTemplatesOpen] = useState(false);
  return (
    <Layout>
      <div className="space-y-6 max-w-7xl">
        {/* Header */}
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <p
              className="mono text-[10px]"
              style={{
                letterSpacing: "0.18em",
                color: "rgba(255,255,255,0.45)",
              }}
            >
              JOB BOARD
            </p>
            <h1
              className="display text-4xl font-bold mt-2"
              style={{ letterSpacing: "-0.04em" }}
            >
              Post jobs. Assign the best.
            </h1>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setTemplatesOpen(true)}
              className="px-4 py-2 rounded-xl text-sm font-semibold transition"
              style={{
                background: "transparent",
                color: "var(--spark-text)",
                border: "1px solid var(--spark-border)",
              }}
              title="Manage BA briefing templates"
            >
              📋 Briefing templates
            </button>
            <button
              onClick={() => navigate("/requests/create")}
              className="px-4 py-2 rounded-xl text-sm font-semibold"
              style={{
                background: "var(--spark-lime)",
                color: "#0a0d09",
                boxShadow: "0 0 24px rgba(197,245,70,0.35)",
              }}
            >
              + Post new job
            </button>
          </div>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="spark-card p-4">
            <p className="label-mini">OPEN</p>
            <p
              className="tab-num text-3xl font-bold mt-1"
              style={{ color: "var(--spark-orange)" }}
            >
              —
            </p>
          </div>
          <div className="spark-card p-4">
            <p className="label-mini">FILLING</p>
            <p className="tab-num text-3xl font-bold mt-1">—</p>
          </div>
          <div className="spark-card p-4">
            <p className="label-mini">CONFIRMED</p>
            <p
              className="tab-num text-3xl font-bold mt-1"
              style={{ color: "var(--spark-lime)" }}
            >
              —
            </p>
          </div>
          <div className="spark-card p-4">
            <p className="label-mini">TODAY</p>
            <p className="tab-num text-3xl font-bold mt-1">—</p>
          </div>
          <div className="spark-card p-4">
            <p className="label-mini">FILL RATE</p>
            <p
              className="tab-num text-3xl font-bold mt-1"
              style={{ color: "var(--spark-lime)" }}
            >
              —
            </p>
          </div>
        </div>

        <Suspense
          fallback={
            <div
              className="spark-card p-8 text-center text-sm"
              style={{ color: "rgba(255,255,255,0.55)" }}
            >
              Loading jobs…
            </div>
          }
        >
          <JobsInner />
        </Suspense>
      </div>

      <BriefingTemplatesPanel
        open={templatesOpen}
        onClose={() => setTemplatesOpen(false)}
      />
    </Layout>
  );
}
