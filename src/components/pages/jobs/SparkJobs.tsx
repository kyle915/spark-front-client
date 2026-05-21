/**
 * Spark v2 — Jobs board.
 *
 * Grouped by lifecycle:
 *   • Pending  — admin needs to set hours/pay and post
 *   • Posted   — visible to BAs (favorites-only by default)
 *   • Filled   — BA accepted, job locked
 *   • Completed / Canceled — archive
 *
 * Click a Pending row → Post Job modal (hours, hourly rate, uniform,
 * favorites-only toggle, max applications). The Briefing template
 * lives on the job-detail page after posting.
 *
 * Templates button opens the BA Briefing template manager
 * (BriefingTemplatesPanel).
 */
import { Suspense, useMemo, useState } from "react";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { useNavigate } from "react-router";
import Layout from "@/layout/Layout";
import PageErrorBoundary from "@/layout/PageErrorBoundary";
import { JobsQuery } from "@/api/queries/JobsQuery";
import type { JobsQuery as JobsQueryType } from "@api/queries/__generated__/JobsQuery.graphql";
import { PostJobMutation } from "@/api/mutations/JobLifecycleMutations";
import type { JobLifecycleMutations_PostJobMutation } from "@api/mutations/__generated__/JobLifecycleMutations_PostJobMutation.graphql";
import { ApplyBriefingTemplateMutation } from "@/api/mutations/BriefingTemplateMutations";
import type { BriefingTemplateMutations_ApplyMutation } from "@api/mutations/__generated__/BriefingTemplateMutations_ApplyMutation.graphql";
import { BriefingTemplatesQuery } from "@/api/queries/BriefingTemplatesQuery";
import type { BriefingTemplatesQuery as BriefingTemplatesQueryType } from "@api/queries/__generated__/BriefingTemplatesQuery.graphql";
import { useAuthStore } from "@/store/authStore";
import { useAlertStore } from "@/store/alertStore";
import BriefingTemplatesPanel from "./BriefingTemplatesPanel";

type LifecycleKey =
  | "pending"
  | "posted"
  | "filled"
  | "completed"
  | "canceled"
  | "unknown";

type JobRow = {
  id: string;
  uuid: string;
  code: string;
  venue: string;
  when: string;
  role: string;
  status: LifecycleKey;
  totalHours: number | null;
  hourlyRate: number | null;
  favoritesOnly: boolean;
  applicationsCount: number;
  appliedCount: number;
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

const STAGE_ORDER: LifecycleKey[] = [
  "pending",
  "posted",
  "filled",
  "completed",
  "canceled",
];
const STAGE_LABEL: Record<LifecycleKey, string> = {
  pending: "Pending — needs posting",
  posted: "Posted — visible to BAs",
  filled: "Filled — BA confirmed",
  completed: "Completed",
  canceled: "Canceled",
  unknown: "Other",
};
const STAGE_TONE: Record<LifecycleKey, string> = {
  pending: "var(--spark-orange)",
  posted: "var(--spark-sky)",
  filled: "var(--spark-lime)",
  completed: "rgba(255,255,255,0.45)",
  canceled: "rgba(255,255,255,0.30)",
  unknown: "rgba(255,255,255,0.30)",
};

const JobsInner: React.FC<{
  onPostJob: (job: JobRow) => void;
}> = ({ onPostJob }) => {
  const navigate = useNavigate();
  const { tenantId } = useAuthStore();

  const data = useLazyLoadQuery<JobsQueryType>(
    JobsQuery,
    { first: 100, filters: tenantId ? { tenantId } : null },
    { fetchPolicy: "store-or-network" },
  );

  const jobs: JobRow[] = useMemo(() => {
    return (
      data?.jobs?.edges
        ?.map((e) => e?.node)
        ?.filter((n): n is NonNullable<typeof n> => Boolean(n))
        ?.map((n) => {
          const raw = (n.lifecycleStatus ?? "").toLowerCase();
          const status: LifecycleKey = STAGE_ORDER.includes(
            raw as LifecycleKey,
          )
            ? (raw as LifecycleKey)
            : "unknown";
          const when = [fmtDate(n.startDate), fmtDate(n.endDate)]
            .filter(Boolean)
            .join(" – ");
          return {
            id: String(n.id),
            uuid: String(n.uuid),
            code: `JOB-${(n.code ?? String(n.id)).toString().slice(-4).toUpperCase()}`,
            venue: n.event?.name ?? n.name ?? "—",
            when: when || "—",
            role: n.jobTitle?.name ?? "Brand Ambassador",
            status,
            totalHours: n.totalHours ?? null,
            hourlyRate: n.hourlyRate ?? null,
            favoritesOnly: Boolean(n.favoritesOnly),
            applicationsCount: n.applicationsCount ?? 0,
            appliedCount: n.appliedCount ?? 0,
          };
        }) ?? []
    );
  }, [data]);

  const grouped = useMemo(() => {
    const out: Record<LifecycleKey, JobRow[]> = {
      pending: [],
      posted: [],
      filled: [],
      completed: [],
      canceled: [],
      unknown: [],
    };
    for (const j of jobs) out[j.status].push(j);
    return out;
  }, [jobs]);

  const stages: LifecycleKey[] = STAGE_ORDER.filter(
    (k) => grouped[k].length > 0,
  );
  if (grouped.unknown.length > 0) stages.push("unknown");

  if (jobs.length === 0) {
    return (
      <div
        className="spark-card p-8 text-center text-sm"
        style={{ color: "rgba(255,255,255,0.55)" }}
      >
        No jobs yet. Approve a request to spin one up.
      </div>
    );
  }

  return (
    <>
      {/* Live stats strip */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {(["pending", "posted", "filled", "completed"] as const).map((k) => (
          <div key={k} className="spark-card p-4">
            <p className="label-mini">{k.toUpperCase()}</p>
            <p
              className="tab-num text-3xl font-bold mt-1"
              style={{ color: STAGE_TONE[k] }}
            >
              {grouped[k].length}
            </p>
          </div>
        ))}
        <div className="spark-card p-4">
          <p className="label-mini">FILL RATE</p>
          <p
            className="tab-num text-3xl font-bold mt-1"
            style={{ color: "var(--spark-lime)" }}
          >
            {jobs.length === 0
              ? "—"
              : `${Math.round(
                  ((grouped.filled.length + grouped.completed.length) /
                    jobs.length) *
                    100,
                )}%`}
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {stages.map((stage) => (
          <div key={stage}>
            <div className="flex items-center gap-3 mb-2">
              <span
                className="spark-dot"
                style={{
                  background: STAGE_TONE[stage],
                  boxShadow: `0 0 8px ${STAGE_TONE[stage]}`,
                }}
              />
              <p
                className="mono text-[10px]"
                style={{
                  letterSpacing: "0.18em",
                  color: "rgba(255,255,255,0.65)",
                }}
              >
                {STAGE_LABEL[stage].toUpperCase()} · {grouped[stage].length}
              </p>
            </div>
            <div className="space-y-2">
              {grouped[stage].map((j) => (
                <div
                  key={j.uuid}
                  onClick={() => navigate(`/job/view/${j.uuid}`)}
                  className="spark-card hov p-4 cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
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
                          {j.favoritesOnly && stage === "posted" && (
                            <span
                              className="mono text-[10px]"
                              style={{
                                letterSpacing: "0.14em",
                                color: "var(--spark-gold)",
                              }}
                              title="Only favorites can apply"
                            >
                              ★ FAVORITES ONLY
                            </span>
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
                        <p className="label-mini">HOURS</p>
                        <p className="font-semibold text-sm tab-num">
                          {j.totalHours ?? "—"}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="label-mini">RATE</p>
                        <p className="font-semibold text-sm tab-num">
                          {j.hourlyRate ? `$${j.hourlyRate}/hr` : "—"}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="label-mini">APPLICANTS</p>
                        <p
                          className="font-semibold text-sm tab-num"
                          style={{
                            color:
                              j.appliedCount > 0
                                ? "var(--spark-gold)"
                                : j.applicationsCount > 0
                                  ? "var(--spark-lime)"
                                  : "rgba(255,255,255,0.55)",
                          }}
                          title={
                            j.appliedCount > 0
                              ? `${j.appliedCount} pending`
                              : `${j.applicationsCount} total`
                          }
                        >
                          {j.applicationsCount}
                          {j.appliedCount > 0 ? ` · ${j.appliedCount}↑` : ""}
                        </p>
                      </div>
                      {stage === "pending" ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onPostJob(j);
                          }}
                          className="px-4 py-2 rounded-xl text-xs font-semibold"
                          style={{
                            background: "var(--spark-lime)",
                            color: "#0a0d09",
                            boxShadow: "0 0 18px rgba(197,245,70,0.35)",
                          }}
                        >
                          Post job →
                        </button>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/job/view/${j.uuid}`);
                          }}
                          className="px-4 py-2 rounded-xl text-xs font-semibold"
                          style={{
                            background: "transparent",
                            border: "1px solid var(--spark-border)",
                            color: "var(--spark-text)",
                          }}
                        >
                          Review
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
};

/* ───────────────────── Post Job modal ───────────────────── */

const PostJobModal: React.FC<{
  job: JobRow;
  onClose: () => void;
}> = ({ job, onClose }) => {
  const { tenantId } = useAuthStore();
  const showAlert = useAlertStore((s) => s.showAlert);
  const [totalHours, setTotalHours] = useState<string>(
    job.totalHours ? String(job.totalHours) : "",
  );
  const [hourlyRate, setHourlyRate] = useState<string>(
    job.hourlyRate ? String(job.hourlyRate) : "",
  );
  const [uniformNotes, setUniformNotes] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(true);
  const [maxApplications, setMaxApplications] = useState<string>("");
  const [briefingTemplateId, setBriefingTemplateId] = useState<string>("");

  // Briefing templates picker — optional. After postJob succeeds, if
  // the admin picked one, we also fire applyBriefingTemplate so the
  // BA sees the briefing on the shift-offer screen.
  const templates = useLazyLoadQuery<BriefingTemplatesQueryType>(
    BriefingTemplatesQuery,
    { tenantId: tenantId ?? null, includeArchived: false },
    { fetchPolicy: "store-or-network" },
  );

  const [commit, posting] =
    useMutation<JobLifecycleMutations_PostJobMutation>(PostJobMutation);
  const [commitApplyBriefing, applyingBriefing] =
    useMutation<BriefingTemplateMutations_ApplyMutation>(
      ApplyBriefingTemplateMutation,
    );
  const inflight = posting || applyingBriefing;

  const submit = () => {
    const hoursNum = totalHours ? Number(totalHours) : null;
    const rateNum = hourlyRate ? Number(hourlyRate) : null;
    const maxNum = maxApplications ? Number(maxApplications) : null;
    if (hoursNum != null && Number.isNaN(hoursNum)) {
      showAlert("Hours must be a number.", "warning");
      return;
    }
    if (rateNum != null && Number.isNaN(rateNum)) {
      showAlert("Rate must be a number.", "warning");
      return;
    }
    commit({
      variables: {
        input: {
          jobId: job.id,
          totalHours: hoursNum,
          hourlyRate: rateNum,
          uniformNotes: uniformNotes || null,
          favoritesOnly,
          maxApplications: maxNum,
        },
      },
      onCompleted: (resp) => {
        if (!resp.postJob?.success) {
          showAlert(resp.postJob?.message ?? "Post failed.", "warning");
          return;
        }
        // Chain: apply briefing template if one was picked.
        if (briefingTemplateId) {
          commitApplyBriefing({
            variables: {
              input: { jobId: job.id, templateId: briefingTemplateId },
            },
            onCompleted: () => {
              showAlert("Job posted with briefing applied.", "success");
              window.location.reload();
            },
            onError: () => {
              showAlert(
                "Job posted, but briefing apply failed — set it from the job page.",
                "warning",
              );
              window.location.reload();
            },
          });
        } else {
          showAlert("Job posted to the board.", "success");
          window.location.reload();
        }
      },
      onError: (err) => showAlert(err.message, "error"),
    });
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="spark-card"
        style={{ width: 520, maxWidth: "100%", padding: 24 }}
      >
        <p
          className="mono text-[10px]"
          style={{ letterSpacing: "0.18em", color: "rgba(255,255,255,0.45)" }}
        >
          POST JOB
        </p>
        <h2 className="display text-xl font-bold mt-1">{job.venue}</h2>
        <p
          className="text-sm mt-1"
          style={{ color: "rgba(255,255,255,0.55)" }}
        >
          {job.code} · {job.when}
        </p>

        <div className="space-y-3 mt-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Total hours">
              <input
                value={totalHours}
                onChange={(e) => setTotalHours(e.target.value)}
                placeholder="4"
                style={inputStyle}
                inputMode="decimal"
              />
            </Field>
            <Field label="Hourly rate ($)">
              <input
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
                placeholder="35"
                style={inputStyle}
                inputMode="decimal"
              />
            </Field>
          </div>
          <Field label="Uniform / what to bring">
            <textarea
              value={uniformNotes}
              onChange={(e) => setUniformNotes(e.target.value)}
              placeholder="All-black, closed-toe shoes. Bring water + ID."
              rows={3}
              style={{ ...inputStyle, fontFamily: "inherit", resize: "vertical" }}
            />
          </Field>
          <Field
            label="Cap applications"
            hint="Optional. Leave blank for unlimited."
          >
            <input
              value={maxApplications}
              onChange={(e) => setMaxApplications(e.target.value)}
              placeholder="Optional"
              style={inputStyle}
              inputMode="numeric"
            />
          </Field>
          <Field
            label="BA briefing template"
            hint="Optional. Pick a saved briefing the BA will see on the shift-offer screen."
          >
            <select
              value={briefingTemplateId}
              onChange={(e) => setBriefingTemplateId(e.target.value)}
              style={inputStyle}
            >
              <option value="">No briefing — add later from job detail</option>
              {(templates.briefingTemplates ?? []).map((t) => (
                <option key={t.uuid} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
          <label
            className="flex items-center gap-2 cursor-pointer"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.10)",
              borderRadius: 10,
              padding: "10px 12px",
            }}
          >
            <input
              type="checkbox"
              checked={favoritesOnly}
              onChange={(e) => setFavoritesOnly(e.target.checked)}
            />
            <div>
              <p className="text-sm font-semibold">★ Gate to favorites only</p>
              <p
                className="text-xs"
                style={{ color: "rgba(255,255,255,0.5)" }}
              >
                Only BAs on the tenant's favorites list can apply. Open it up
                later with "Open to all" on the job detail page.
              </p>
            </div>
          </label>
        </div>

        <div className="flex gap-2 mt-5">
          <button
            onClick={submit}
            disabled={inflight}
            className="px-4 py-2 rounded-xl text-sm font-semibold"
            style={{
              background: "var(--spark-lime)",
              color: "#0a0d09",
              opacity: inflight ? 0.5 : 1,
            }}
          >
            {inflight ? "Posting…" : "Post job"}
          </button>
          <button
            onClick={onClose}
            disabled={inflight}
            className="px-4 py-2 rounded-xl text-sm"
            style={{
              background: "transparent",
              border: "1px solid var(--spark-border)",
              color: "var(--spark-text)",
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

const inputStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  color: "rgba(255,255,255,0.9)",
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: 10,
  padding: "8px 12px",
  fontSize: 14,
  width: "100%",
};

const Field: React.FC<{
  label: string;
  hint?: string;
  children: React.ReactNode;
}> = ({ label, hint, children }) => (
  <div>
    <label
      className="mono text-[10px]"
      style={{ letterSpacing: "0.18em", color: "rgba(255,255,255,0.45)" }}
    >
      {label.toUpperCase()}
    </label>
    <div className="mt-1.5">{children}</div>
    {hint && (
      <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>
        {hint}
      </p>
    )}
  </div>
);

/* ───────────────────────── PAGE ───────────────────────── */

export default function SparkJobs() {
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [postingJob, setPostingJob] = useState<JobRow | null>(null);

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
              JOB BOARD
            </p>
            <h1
              className="display text-4xl font-bold mt-2"
              style={{ letterSpacing: "-0.04em" }}
            >
              Pending. Posted. Filled.
            </h1>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setTemplatesOpen(true)}
              className="px-4 py-2 rounded-xl text-sm font-semibold"
              style={{
                background: "transparent",
                color: "var(--spark-text)",
                border: "1px solid var(--spark-border)",
              }}
              title="Manage BA briefing templates"
            >
              📋 Briefing templates
            </button>
          </div>
        </div>

        <PageErrorBoundary label="jobs board">
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
            <JobsInner onPostJob={(j) => setPostingJob(j)} />
          </Suspense>
        </PageErrorBoundary>
      </div>

      <BriefingTemplatesPanel
        open={templatesOpen}
        onClose={() => setTemplatesOpen(false)}
      />
      {postingJob && (
        <Suspense fallback={null}>
          <PostJobModal
            job={postingJob}
            onClose={() => setPostingJob(null)}
          />
        </Suspense>
      )}
    </Layout>
  );
}
