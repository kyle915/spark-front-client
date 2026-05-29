import { Suspense, useEffect, useMemo, useState } from "react";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { useNavigate, useParams } from "react-router";
import Layout from "@/layout/Layout";
import { JobsQuery } from "@/api/queries/JobsQuery";
import type { JobsQuery as JobsQueryType } from "@api/queries/__generated__/JobsQuery.graphql";
import { JobApplicationsQuery } from "@/api/queries/JobApplicationsQuery";
import type { JobApplicationsQuery as JobApplicationsQueryType } from "@api/queries/__generated__/JobApplicationsQuery.graphql";
import { AssignAmbassadorToJobMutation } from "@/api/mutations/AssignAmbassadorToJobMutation";
import type { AssignAmbassadorToJobMutation as AssignAmbassadorToJobMutationType } from "@api/mutations/__generated__/AssignAmbassadorToJobMutation.graphql";
import { SetJobBriefingMutation } from "@/api/mutations/SetJobBriefingMutation";
import type { SetJobBriefingMutation as SetJobBriefingMutationType } from "@api/mutations/__generated__/SetJobBriefingMutation.graphql";
import { useAuthStore } from "@/store/authStore";
import { useAlertStore } from "@/store/alertStore";
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

const STATUS_CHIP: Record<string, string> = {
  applied: "chip chip-sky",
  accepted: "chip chip-lime",
  declined: "chip chip-muted",
  withdrawn: "chip chip-muted",
};

const initialsOf = (first: string, last: string): string => {
  const a = (first || "").trim()[0] ?? "";
  const b = (last || "").trim()[0] ?? "";
  return (a + b).toUpperCase() || "BA";
};

const fmtApplied = (raw: string | null | undefined): string => {
  if (!raw) return "";
  try {
    return new Date(raw).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
};

/**
 * Real applicant-review panel (#181). Loads jobApplications for the job
 * and lets an admin accept one (assignAmbassadorToJob — which also
 * declines the rest + moves the job to filled). Replaces the old
 * placeholder roster.
 */
const ApplicantsCard: React.FC<{
  jobId: string;
  isAdmin: boolean;
  jobFilled: boolean;
}> = ({ jobId, isAdmin, jobFilled }) => {
  const showAlert = useAlertStore((s) => s.showAlert);
  const data = useLazyLoadQuery<JobApplicationsQueryType>(
    JobApplicationsQuery,
    { jobId },
    { fetchPolicy: "store-and-network" },
  );
  const apps = useMemo(() => data.jobApplications ?? [], [data]);
  const [commit, inFlight] = useMutation<AssignAmbassadorToJobMutationType>(
    AssignAmbassadorToJobMutation,
  );

  const counts = useMemo(() => {
    const c = { applied: 0, accepted: 0, declined: 0, withdrawn: 0 };
    for (const a of apps) {
      if (a.status in c) (c as Record<string, number>)[a.status] += 1;
    }
    return c;
  }, [apps]);

  const accept = (ambassadorId: string, name: string) => {
    if (inFlight) return;
    commit({
      variables: { input: { jobId, ambassadorId } },
      onCompleted: (res) => {
        if (res.assignAmbassadorToJob?.success) {
          showAlert(`${name} accepted — others declined, job marked filled.`, "success");
          // Reload so the job status chip + roster reflect the change.
          window.location.reload();
        } else {
          showAlert(
            res.assignAmbassadorToJob?.message ?? "Couldn't accept applicant.",
            "error",
          );
        }
      },
      onError: (e) => showAlert(`Accept failed: ${e.message}`, "error"),
    });
  };

  return (
    <div className="spark-card overflow-hidden flex flex-col">
      <div
        className="p-4 flex items-center justify-between"
        style={{ borderBottom: "1px solid var(--spark-border)" }}
      >
        <h3 className="font-bold">
          Applicants{" "}
          <span className="mono text-xs ml-1" style={{ color: "rgba(255,255,255,0.45)" }}>
            {apps.length}
          </span>
        </h3>
      </div>

      <div className="px-4 pt-3 flex gap-1 overflow-x-auto hide-scroll">
        <button className="chip chip-lime">Applied {counts.applied}</button>
        <button className="chip chip-muted">Accepted {counts.accepted}</button>
        <button className="chip chip-muted">Declined {counts.declined}</button>
      </div>

      {apps.length === 0 ? (
        <div className="p-6 text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>
          No applications yet. BAs who apply from the mobile app will show up here.
        </div>
      ) : (
        <ul className="flex-1 overflow-y-auto">
          {apps.map((a, i) => {
            const name =
              `${a.ambassadorFirstName} ${a.ambassadorLastName}`.trim() ||
              a.ambassadorEmail ||
              "Ambassador";
            const canAccept =
              isAdmin && !jobFilled && a.status === "applied";
            return (
              <li
                key={a.uuid}
                className="p-3"
                style={{
                  borderBottom:
                    i < apps.length - 1 ? "1px solid var(--spark-border)" : "none",
                }}
              >
                <div className="flex items-center gap-3">
                  <span className="spark-avatar">
                    {initialsOf(a.ambassadorFirstName, a.ambassadorLastName)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm">{name}</p>
                      <span className={STATUS_CHIP[a.status] ?? "chip chip-muted"}>
                        {a.status.toUpperCase()}
                      </span>
                    </div>
                    <p
                      className="mono text-[10px] uppercase mt-0.5 truncate"
                      style={{ letterSpacing: "0.14em", color: "rgba(255,255,255,0.45)" }}
                    >
                      {a.ambassadorEmail}
                      {a.appliedAt ? ` · applied ${fmtApplied(a.appliedAt)}` : ""}
                    </p>
                    {a.note ? (
                      <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.6)" }}>
                        “{a.note}”
                      </p>
                    ) : null}
                  </div>
                  {canAccept ? (
                    <button
                      onClick={() => accept(a.ambassadorId, name)}
                      disabled={inFlight}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0"
                      style={{
                        background: "var(--spark-lime)",
                        color: "#0a0d09",
                        opacity: inFlight ? 0.6 : 1,
                      }}
                    >
                      Accept
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

/**
 * BA Briefing editor (#191). The real, backend-backed pre-shift
 * briefing the mobile app reads via job.briefing / jobBriefingForEvent.
 * Loads the current title+body off the JobsQuery node and saves via
 * setJobBriefing. Distinct from the localStorage "Job brief" card
 * above (which holds the structured what-to-do / academy links until a
 * model lands).
 */
const BABriefingCard: React.FC<{
  jobId: string;
  initialTitle: string;
  initialBody: string;
  isAdmin: boolean;
}> = ({ jobId, initialTitle, initialBody, isAdmin }) => {
  const showAlert = useAlertStore((s) => s.showAlert);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(initialTitle);
  const [body, setBody] = useState(initialBody);
  const [commit, inFlight] = useMutation<SetJobBriefingMutationType>(
    SetJobBriefingMutation,
  );

  // Keep local draft in sync if the loaded job changes underneath us.
  useEffect(() => {
    setTitle(initialTitle);
    setBody(initialBody);
  }, [initialTitle, initialBody]);

  const dirty = title !== initialTitle || body !== initialBody;

  const save = () => {
    if (inFlight) return;
    commit({
      variables: { input: { jobId, title, body } },
      onCompleted: (res) => {
        if (res.setJobBriefing?.success) {
          showAlert(
            res.setJobBriefing.message || "Briefing saved.",
            "success",
          );
          setOpen(false);
        } else {
          showAlert(
            res.setJobBriefing?.message ?? "Couldn't save briefing.",
            "error",
          );
        }
      },
      onError: (e) => showAlert(`Save failed: ${e.message}`, "error"),
    });
  };

  return (
    <div className="spark-card p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p
            className="mono text-[10px]"
            style={{ letterSpacing: "0.18em", color: "var(--spark-lime)" }}
          >
            BA BRIEFING
          </p>
          <h3
            className="display text-lg font-bold mt-1"
            style={{ letterSpacing: "-0.02em" }}
          >
            Pre-shift briefing
          </h3>
        </div>
        {isAdmin && (
          <button
            onClick={() => setOpen((v) => !v)}
            className="mono text-[10px]"
            style={{
              letterSpacing: "0.14em",
              color: open ? "var(--spark-orange)" : "var(--spark-lime)",
            }}
          >
            {open ? "× CLOSE EDITOR" : "✎ EDIT BRIEFING"}
          </button>
        )}
      </div>

      {open && isAdmin ? (
        <div className="space-y-4">
          <div>
            <label className="label-mini block mb-1.5">TITLE</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Liquid Death @ Whole Foods — Sampling 101"
              style={{
                background: "var(--spark-bg)",
                border: "1px solid var(--spark-border)",
                borderRadius: 12,
                padding: "0.65rem 0.85rem",
                color: "var(--spark-text)",
                fontSize: "0.875rem",
                outline: "none",
                width: "100%",
              }}
            />
          </div>
          <div>
            <label className="label-mini block mb-1.5">BODY</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              placeholder="What the BA needs to know before clocking in — arrival, contact, dress code, talking points, what to bring."
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
                minHeight: 180,
                lineHeight: 1.6,
              }}
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={save}
              disabled={inFlight || !dirty}
              className="px-4 py-2 rounded-xl text-sm font-semibold"
              style={{
                background: "var(--spark-lime)",
                color: "#0a0d09",
                opacity: inFlight || !dirty ? 0.5 : 1,
                boxShadow: "0 0 24px rgba(197,245,70,0.35)",
              }}
            >
              {inFlight ? "Saving…" : "Save briefing"}
            </button>
            {dirty && !inFlight && (
              <span
                className="mono text-[10px]"
                style={{
                  letterSpacing: "0.14em",
                  color: "rgba(255,255,255,0.45)",
                }}
              >
                UNSAVED CHANGES
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {initialTitle ? (
            <p className="font-semibold text-base">{initialTitle}</p>
          ) : null}
          {initialBody ? (
            <p
              className="text-sm leading-relaxed whitespace-pre-wrap"
              style={{ color: "rgba(255,255,255,0.85)" }}
            >
              {initialBody}
            </p>
          ) : (
            <p
              className="text-xs italic"
              style={{ color: "rgba(255,255,255,0.4)" }}
            >
              {isAdmin
                ? "No briefing yet — click EDIT BRIEFING to write the pre-shift instructions BAs see in the app."
                : "No briefing posted yet."}
            </p>
          )}
        </div>
      )}
    </div>
  );
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
              See list →
            </p>
          </div>
        </div>
      </div>

      {/* BA Briefing — real backend-backed pre-shift briefing (#191) */}
      <BABriefingCard
        jobId={node.id}
        initialTitle={node.briefing?.title ?? ""}
        initialBody={node.briefing?.body ?? ""}
        isAdmin={isAdmin}
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

        <Suspense
          fallback={
            <div
              className="spark-card p-6 text-sm"
              style={{ color: "rgba(255,255,255,0.55)" }}
            >
              Loading applicants…
            </div>
          }
        >
          <ApplicantsCard
            jobId={node.id}
            isAdmin={isAdmin}
            jobFilled={status === "confirmed"}
          />
        </Suspense>
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
