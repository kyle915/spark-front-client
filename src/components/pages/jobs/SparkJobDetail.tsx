import { Suspense, useEffect, useMemo, useState } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import { useNavigate, useParams } from "react-router";
import Layout from "@/layout/Layout";
import JobBriefingPanel from "./JobBriefingPanel";
import JobApplicationsPanel from "./JobApplicationsPanel";
import { JobsQuery } from "@/api/queries/JobsQuery";
import type { JobsQuery as JobsQueryType } from "@api/queries/__generated__/JobsQuery.graphql";
import { useAuthStore } from "@/store/authStore";
import useSparkRole from "@/hooks/useSparkRole";
import {
  loadModules,
  KIND_COLOR,
  KIND_LABEL,
  type AcademyModule,
} from "@/lib/academy";

/**
 * Job brief lives in localStorage keyed by job uuid until a backend
 * model lands. Each brief: free-form "what to do / expect / bring"
 * text + a list of required academy module ids that the BA must
 * complete before clocking in.
 */
type JobBrief = {
  whatToDo: string;
  whatToExpect: string;
  whatToBring: string;
  talkingPoints: string;
  requiredModules: string[];
};

const briefKey = (uuid: string) => `@spark.jobBrief/${uuid}`;
const loadBrief = (uuid: string): JobBrief => {
  try {
    const raw = localStorage.getItem(briefKey(uuid));
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return {
    whatToDo: "",
    whatToExpect: "",
    whatToBring: "",
    talkingPoints: "",
    requiredModules: [],
  };
};
const saveBrief = (uuid: string, b: JobBrief) => {
  try {
    localStorage.setItem(briefKey(uuid), JSON.stringify(b));
  } catch {
    /* ignore */
  }
};

/**
 * Spark v2 — Job Detail.
 * Wireframe: spark-demo/index.html lines 1064-1132 + applicantRow helper.
 *
 * Loads the job by uuid from JobsQuery (we don't have a JobByUuidQuery yet
 * so we scan the page; this is fine for v1 — pagination follows).
 * Applicant data is placeholder until a JobApplicants query is wired.
 */

const fmtDate = (raw: string | null | undefined) => {
  if (!raw) return "—";
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

const APPLICANTS = [
  { name: "Maya R.", initials: "MR", distance: "2.1 mi", rating: 4.9, jobs: 142, tier: "TOP", endorsement: "LD ★ 24" },
  { name: "Tricia Moreno", initials: "TM", distance: "2.2 mi", rating: 4.7, jobs: 64, tier: "NEW" },
  { name: "Morgan Peterson", initials: "MP", distance: "2.4 mi", rating: 4.8, jobs: 98, tier: "NEW" },
  { name: "Jordan T.", initials: "JT", distance: "5.2 mi", rating: 4.9, jobs: 174, tier: "TOP", endorsement: "LD ★ 32" },
  { name: "Sasha P.", initials: "SP", distance: "3.8 mi", rating: 4.7, jobs: 64, tier: "NEW" },
  { name: "Alex M.", initials: "AM", distance: "7.8 mi", rating: 4.8, jobs: 110, tier: "TOP", endorsement: "LD ★ 18" },
];

const TIER_CHIP: Record<string, string> = {
  TOP: "chip chip-lime",
  NEW: "chip chip-sky",
  FAR: "chip chip-orange",
};

const Inner: React.FC<{ uuid: string }> = ({ uuid }) => {
  const navigate = useNavigate();
  const { tenantId } = useAuthStore();
  const { isAdmin } = useSparkRole();
  const [brief, setBrief] = useState<JobBrief>(() => loadBrief(uuid));
  const [briefOpen, setBriefOpen] = useState(false);
  const [modules, setModules] = useState<AcademyModule[]>([]);

  useEffect(() => {
    setBrief(loadBrief(uuid));
  }, [uuid]);
  useEffect(() => {
    if (tenantId) setModules(loadModules(tenantId));
  }, [tenantId]);

  const updateBrief = (patch: Partial<JobBrief>) => {
    const next = { ...brief, ...patch };
    setBrief(next);
    saveBrief(uuid, next);
  };

  const linkedModules = useMemo(
    () => modules.filter((m) => brief.requiredModules.includes(m.id)),
    [modules, brief.requiredModules],
  );
  const unlinkedModules = useMemo(
    () =>
      modules.filter(
        (m) => !brief.requiredModules.includes(m.id) && m.published,
      ),
    [modules, brief.requiredModules],
  );
  const data = useLazyLoadQuery<JobsQueryType>(
    JobsQuery,
    { first: 100, filters: tenantId ? { tenantId } : null },
    { fetchPolicy: "store-or-network" },
  );

  const node = data?.jobs?.edges?.map((e) => e?.node)?.find(
    (n) => n && String(n.uuid) === uuid,
  );

  if (!node) {
    return (
      <div
        className="spark-card p-8 text-center text-sm"
        style={{ color: "rgba(255,255,255,0.55)" }}
      >
        Job not found.
      </div>
    );
  }

  const status: "open" | "filling" | "confirmed" = node.closed
    ? "confirmed"
    : node.ongoing
      ? "filling"
      : "open";
  const urgent = !node.closed && !node.ongoing;
  const dateLabel = fmtDate(node.startDate);
  const startTime = "—"; // not on the list query
  const code = `JOB-${(node.code ?? String(node.id)).toString().slice(-4).toUpperCase()}`;

  return (
    <div className="space-y-6 max-w-7xl">
      <button
        onClick={() => navigate("/jobs")}
        className="mono text-[11px] transition"
        style={{
          letterSpacing: "0.14em",
          color: "rgba(255,255,255,0.45)",
        }}
      >
        ← BACK TO JOBS
      </button>

      {/* Title card */}
      <div className="spark-card p-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-start gap-4">
            <span
              className="spark-avatar"
              style={{ width: 56, height: 56, fontSize: "1.05rem", borderRadius: 16 }}
            >
              ◐
            </span>
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span
                  className="mono text-[10px]"
                  style={{
                    letterSpacing: "0.18em",
                    color: "var(--spark-lime)",
                  }}
                >
                  {code}
                </span>
                <span
                  className={`chip ${status === "open" ? "chip-orange" : "chip-lime"}`}
                >
                  {status.toUpperCase()}
                </span>
                {urgent && (
                  <span className="chip chip-orange">URGENT</span>
                )}
              </div>
              <h1
                className="display text-3xl font-bold"
                style={{ letterSpacing: "-0.03em" }}
              >
                {node.jobTitle?.name ?? "Brand Ambassador"}
              </h1>
              <p
                className="mt-1"
                style={{ color: "rgba(255,255,255,0.65)" }}
              >
                {node.event?.name ?? node.name ?? "—"}
                {node.address ? ` · ${node.address}` : ""}
              </p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              className="px-4 py-2 rounded-xl text-sm font-semibold transition"
              style={{
                background: "transparent",
                color: "var(--spark-text)",
                border: "1px solid var(--spark-border)",
              }}
            >
              ✎ Edit
            </button>
            <button
              className="px-4 py-2 rounded-xl text-sm font-semibold transition"
              style={{
                background: "transparent",
                color: "var(--spark-text)",
                border: "1px solid var(--spark-border)",
              }}
            >
              ⎘ Duplicate
            </button>
            <button
              className="px-4 py-2 rounded-xl text-sm font-semibold"
              style={{
                background: "var(--spark-lime)",
                color: "#0a0d09",
                boxShadow: "0 0 24px rgba(197,245,70,0.35)",
              }}
            >
              ⤴ Share job link
            </button>
          </div>
        </div>
        <div
          className="mt-5 pt-5 grid grid-cols-2 lg:grid-cols-5 gap-4"
          style={{ borderTop: "1px solid var(--spark-border)" }}
        >
          <div>
            <p className="label-mini">DATE</p>
            <p className="font-bold mt-1">{dateLabel}</p>
          </div>
          <div>
            <p className="label-mini">TIME</p>
            <p className="font-bold mt-1">{startTime}</p>
          </div>
          <div>
            <p className="label-mini">PAY</p>
            <p
              className="font-bold mt-1"
              style={{ color: "var(--spark-lime)" }}
            >
              —
            </p>
          </div>
          <div>
            <p className="label-mini">SLOTS</p>
            <p className="font-bold mt-1">—</p>
          </div>
          <div>
            <p className="label-mini">APPLICANTS</p>
            <p
              className="font-bold mt-1"
              style={{ color: "var(--spark-lime)" }}
            >
              {APPLICANTS.length} in pool
            </p>
          </div>
        </div>
      </div>

      {/* BA Briefing — admin-authored, shown in BA mobile app. Real
          data via jobBriefing(jobId); manage templates from /jobs. */}
      <JobBriefingPanel jobId={node.id} />

      {/* Applications — who's applied, accept/decline, open-to-all */}
      <JobApplicationsPanel
        jobId={node.id}
        lifecycleStatus={node.lifecycleStatus ?? "pending"}
        favoritesOnly={Boolean(node.favoritesOnly)}
      />

      {/* Job brief — what to do, expect, bring + linked academy modules */}
      <div className="spark-card p-6 space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <p
              className="mono text-[10px]"
              style={{
                letterSpacing: "0.18em",
                color: "var(--spark-lime)",
              }}
            >
              JOB BRIEF
            </p>
            <h3
              className="display text-lg font-bold mt-1"
              style={{ letterSpacing: "-0.02em" }}
            >
              What the BA needs to know
            </h3>
          </div>
          {isAdmin && (
            <button
              onClick={() => setBriefOpen((v) => !v)}
              className="mono text-[10px]"
              style={{
                letterSpacing: "0.14em",
                color: briefOpen
                  ? "var(--spark-orange)"
                  : "var(--spark-lime)",
              }}
            >
              {briefOpen ? "× CLOSE EDITOR" : "✎ EDIT BRIEF"}
            </button>
          )}
        </div>

        {briefOpen && isAdmin ? (
          <div className="grid sm:grid-cols-2 gap-4">
            {(
              [
                {
                  key: "whatToDo" as const,
                  label: "What to do",
                  ph: "Pour 6oz samples. Greet every shopper. Log every wastage.",
                },
                {
                  key: "whatToExpect" as const,
                  label: "What to expect",
                  ph: "Foot traffic peaks 5-7pm. Manager Joe is the contact. Cooler stock is in back-of-house.",
                },
                {
                  key: "whatToBring" as const,
                  label: "What to bring",
                  ph: "Black tee + black pants. Reliable car. Pour cups (Ignite provides product + ice).",
                },
                {
                  key: "talkingPoints" as const,
                  label: "Talking points",
                  ph: "Lead with humor. Cans are 100% aluminum + recyclable. Mango Chainsaw is the top-seller in TX.",
                },
              ]
            ).map((row) => (
              <div key={row.key}>
                <label className="label-mini block mb-1.5">
                  {row.label.toUpperCase()}
                </label>
                <textarea
                  style={{
                    background: "var(--spark-bg)",
                    border: "1px solid var(--spark-border)",
                    borderRadius: 12,
                    padding: "0.65rem 0.85rem",
                    color: "var(--spark-text)",
                    fontSize: "0.875rem",
                    outline: "none",
                    width: "100%",
                    resize: "vertical",
                    minHeight: 110,
                  }}
                  rows={5}
                  value={brief[row.key]}
                  onChange={(e) => updateBrief({ [row.key]: e.target.value })}
                  placeholder={row.ph}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-5">
            {(
              [
                ["What to do", brief.whatToDo, "var(--spark-lime)"],
                ["What to expect", brief.whatToExpect, "var(--spark-sky)"],
                ["What to bring", brief.whatToBring, "var(--spark-gold)"],
                ["Talking points", brief.talkingPoints, "var(--spark-purple)"],
              ] as const
            ).map(([label, value, color]) => (
              <div key={label}>
                <p
                  className="mono text-[10px] mb-2"
                  style={{
                    letterSpacing: "0.18em",
                    color,
                  }}
                >
                  {label.toUpperCase()}
                </p>
                {value ? (
                  <p
                    className="text-sm leading-relaxed whitespace-pre-wrap"
                    style={{ color: "rgba(255,255,255,0.85)" }}
                  >
                    {value}
                  </p>
                ) : (
                  <p
                    className="text-xs italic"
                    style={{ color: "rgba(255,255,255,0.4)" }}
                  >
                    {isAdmin
                      ? "Empty — click EDIT BRIEF to fill in."
                      : "TBD"}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Required Academy modules */}
      <div className="spark-card p-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="display font-bold">Required reading</h3>
          {isAdmin && unlinkedModules.length > 0 && (
            <select
              onChange={(e) => {
                const id = e.target.value;
                if (!id) return;
                updateBrief({
                  requiredModules: [...brief.requiredModules, id],
                });
                e.target.value = "";
              }}
              defaultValue=""
              className="rounded-xl text-xs"
              style={{
                padding: "0.45rem 0.9rem",
                background: "var(--spark-bg)",
                border: "1px solid var(--spark-border)",
                color: "var(--spark-text)",
                maxWidth: 240,
                outline: "none",
              }}
            >
              <option value="">+ Link an Academy module</option>
              {unlinkedModules.map((m) => (
                <option key={m.id} value={m.id}>
                  {KIND_LABEL[m.kind]} · {m.title}
                </option>
              ))}
            </select>
          )}
        </div>
        {linkedModules.length === 0 ? (
          <p
            className="text-xs"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            No academy modules linked yet.
            {isAdmin
              ? " Use the dropdown above to add brand/product/playbook training."
              : ""}
          </p>
        ) : (
          <div className="space-y-2">
            {linkedModules.map((m) => {
              const color = KIND_COLOR[m.kind];
              return (
                <div
                  key={m.id}
                  className="flex items-center gap-3 p-3 rounded-xl transition"
                  style={{
                    background: "rgba(255,255,255,0.025)",
                    border: "1px solid var(--spark-border)",
                  }}
                >
                  <span
                    className="mono text-[10px] w-20"
                    style={{
                      letterSpacing: "0.14em",
                      color,
                    }}
                  >
                    {KIND_LABEL[m.kind].split(" ")[0].toUpperCase()}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{m.title}</p>
                    <p
                      className="mono text-[10px] truncate"
                      style={{
                        letterSpacing: "0.14em",
                        color: "rgba(255,255,255,0.45)",
                      }}
                    >
                      {m.estMinutes} MIN · {m.attachments.length} ATTACHMENT
                      {m.attachments.length === 1 ? "" : "S"}
                    </p>
                  </div>
                  <button
                    onClick={() => navigate(`/academy/${m.id}`)}
                    className="mono text-[10px]"
                    style={{
                      letterSpacing: "0.14em",
                      color: "var(--spark-lime)",
                    }}
                  >
                    READ →
                  </button>
                  {isAdmin && (
                    <button
                      onClick={() =>
                        updateBrief({
                          requiredModules: brief.requiredModules.filter(
                            (id) => id !== m.id,
                          ),
                        })
                      }
                      className="mono text-[10px]"
                      style={{
                        letterSpacing: "0.14em",
                        color: "var(--spark-orange)",
                      }}
                    >
                      ×
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Two-col: Role overview | Applicants */}
      <div
        className="grid gap-5"
        style={{ gridTemplateColumns: "1fr 1.1fr" }}
      >
        <div className="spark-card p-6">
          <h3 className="font-bold mb-3">Role overview</h3>
          <p
            className="text-sm leading-relaxed"
            style={{ color: "rgba(255,255,255,0.75)" }}
          >
            {node.description ??
              "High-energy, sales-focused Brand Ambassador. Pour 6oz samples, photo upload hourly, log every cooler-stock pull."}
          </p>
          <h4 className="font-semibold text-sm mt-5 mb-2">Requirements</h4>
          <ul
            className="text-sm space-y-1.5 list-disc list-inside"
            style={{ color: "rgba(255,255,255,0.75)" }}
          >
            <li>21+ TABC certified</li>
            <li>Own black uniform tee + pants</li>
            <li>Reliable vehicle</li>
            <li>3+ months prior sampling preferred</li>
          </ul>
        </div>

        <div className="spark-card overflow-hidden flex flex-col">
          <div
            className="p-4 flex items-center justify-between"
            style={{ borderBottom: "1px solid var(--spark-border)" }}
          >
            <h3 className="font-bold">
              Applicants{" "}
              <span
                className="mono text-xs ml-1"
                style={{ color: "rgba(255,255,255,0.45)" }}
              >
                {APPLICANTS.length}
              </span>
            </h3>
            <button
              className="px-3 py-1.5 rounded-xl text-xs font-semibold transition"
              style={{
                background: "transparent",
                color: "var(--spark-text)",
                border: "1px solid var(--spark-border)",
              }}
            >
              ⚡ Auto-assign top 2
            </button>
          </div>

          <div className="px-4 pt-3 flex gap-1 overflow-x-auto hide-scroll">
            <button className="chip chip-muted">Hired 0/2</button>
            <button className="chip chip-muted">Offered 0</button>
            <button className="chip chip-lime">Applied {APPLICANTS.length}</button>
            <button className="chip chip-muted">Hidden 0</button>
          </div>

          <ul className="flex-1 overflow-y-auto">
            {APPLICANTS.map((a, i) => (
              <li
                key={a.name}
                className="p-3 cursor-pointer transition"
                style={{
                  borderBottom:
                    i < APPLICANTS.length - 1
                      ? "1px solid var(--spark-border)"
                      : "none",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "rgba(255,255,255,0.02)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
              >
                <div className="flex items-center gap-3">
                  <span className="spark-avatar">{a.initials}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm">{a.name}</p>
                      <span
                        className={`${TIER_CHIP[a.tier] ?? "chip chip-muted"}`}
                      >
                        {a.tier}
                      </span>
                      {a.endorsement && (
                        <span
                          className="mono text-[10px]"
                          style={{
                            letterSpacing: "0.14em",
                            color: "var(--spark-lime)",
                          }}
                        >
                          {a.endorsement}
                        </span>
                      )}
                    </div>
                    <p
                      className="mono text-[10px] uppercase mt-0.5"
                      style={{
                        letterSpacing: "0.14em",
                        color: "rgba(255,255,255,0.45)",
                      }}
                    >
                      {a.distance} · ★ {a.rating} · {a.jobs} jobs
                    </p>
                  </div>
                  <button
                    onClick={(e) => e.stopPropagation()}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold"
                    style={{
                      background: "var(--spark-lime)",
                      color: "#0a0d09",
                    }}
                  >
                    Hire
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default function SparkJobDetail() {
  const { uuid } = useParams<{ uuid: string }>();
  return (
    <Layout>
      <Suspense
        fallback={
          <div
            className="spark-card p-8 text-center text-sm max-w-7xl"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            Loading job…
          </div>
        }
      >
        <Inner uuid={uuid ?? ""} />
      </Suspense>
    </Layout>
  );
}
