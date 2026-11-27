import { Suspense, useEffect, useMemo, useState } from "react";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { useNavigate, useParams } from "react-router";
import Layout from "@/layout/Layout";
import SparkConfirm from "@/shared/SparkConfirm";
import WalkupCodePanel from "@/requests/WalkupCodePanel";
import { JobsQuery } from "@/api/queries/JobsQuery";
import type { JobsQuery as JobsQueryType } from "@api/queries/__generated__/JobsQuery.graphql";
import { JobApplicationsQuery } from "@/api/queries/JobApplicationsQuery";
import type { JobApplicationsQuery as JobApplicationsQueryType } from "@api/queries/__generated__/JobApplicationsQuery.graphql";
import { AssignAmbassadorToJobMutation } from "@/api/mutations/AssignAmbassadorToJobMutation";
import type { AssignAmbassadorToJobMutation as AssignAmbassadorToJobMutationType } from "@api/mutations/__generated__/AssignAmbassadorToJobMutation.graphql";
import { BulkCloneRequestMutation } from "@/api/mutations/BulkCloneRequestMutation";
import type { BulkCloneRequestMutation as BulkCloneRequestMutationType } from "@api/mutations/__generated__/BulkCloneRequestMutation.graphql";
import { SetJobBriefingMutation } from "@/api/mutations/SetJobBriefingMutation";
import type { SetJobBriefingMutation as SetJobBriefingMutationType } from "@api/mutations/__generated__/SetJobBriefingMutation.graphql";
import { PostJobMutation } from "@/api/mutations/PostJobMutation";
import type { PostJobMutation as PostJobMutationType } from "@api/mutations/__generated__/PostJobMutation.graphql";
import { UpdateJobMutation } from "@/api/mutations/UpdateJobMutation";
import type { UpdateJobMutation as UpdateJobMutationType } from "@api/mutations/__generated__/UpdateJobMutation.graphql";
import { AcademyModulesAdminQuery } from "@/api/queries/AcademyModulesAdminQuery";
import type { AcademyModulesAdminQuery as AcademyModulesAdminQueryType } from "@api/queries/__generated__/AcademyModulesAdminQuery.graphql";
import { OpenChatThreadMutation } from "@/api/mutations/OpenChatThreadMutation";
import type { OpenChatThreadMutation as OpenChatThreadMutationType } from "@api/mutations/__generated__/OpenChatThreadMutation.graphql";
import { BriefingTemplatesQuery } from "@/api/queries/BriefingTemplatesQuery";
import type { BriefingTemplatesQuery as BriefingTemplatesQueryType } from "@api/queries/__generated__/BriefingTemplatesQuery.graphql";
import { SaveJobBriefingAsTemplateMutation } from "@/api/mutations/SaveJobBriefingAsTemplateMutation";
import type { SaveJobBriefingAsTemplateMutation as SaveJobBriefingAsTemplateMutationType } from "@api/mutations/__generated__/SaveJobBriefingAsTemplateMutation.graphql";
import { GigTemplatesQuery } from "@/api/queries/GigTemplatesQuery";
import type { GigTemplatesQuery as GigTemplatesQueryType } from "@api/queries/__generated__/GigTemplatesQuery.graphql";
import { CreateGigTemplateMutation } from "@/api/mutations/CreateGigTemplateMutation";
import type { CreateGigTemplateMutation as CreateGigTemplateMutationType } from "@api/mutations/__generated__/CreateGigTemplateMutation.graphql";
import { UpdateGigTemplateMutation } from "@/api/mutations/UpdateGigTemplateMutation";
import type { UpdateGigTemplateMutation as UpdateGigTemplateMutationType } from "@api/mutations/__generated__/UpdateGigTemplateMutation.graphql";
import { ArchiveGigTemplateMutation } from "@/api/mutations/ArchiveGigTemplateMutation";
import type { ArchiveGigTemplateMutation as ArchiveGigTemplateMutationType } from "@api/mutations/__generated__/ArchiveGigTemplateMutation.graphql";
// NOTE: saveJobPostAsGigTemplate (SaveJobPostAsGigTemplateMutation) is also
// wired/available in src/api/mutations for snapshotting an already-POSTED
// job into a template. The Post Job modal here deliberately uses
// createGigTemplate instead, because it seeds from the CURRENT (unsaved)
// modal fields before the job is posted.
import BAProfileModal from "@/components/pages/talent/BAProfileModal";
import { useAuthStore } from "@/store/authStore";
import { useAlertStore } from "@/store/alertStore";
import useSparkRole from "@/hooks/useSparkRole";
import { kindColor, kindLabel } from "@/lib/academy";
import { inputColorScheme } from "@/theme/inputColorScheme";

/**
 * A required-reading row, sourced from the backend `academyModulesAdmin`
 * query. The job brief stores the linked modules by `uuid`.
 */
type AcademyModuleRow = {
  uuid: string;
  title: string;
  kind: string;
  body: string;
  published: boolean;
};

const readMinutes = (body: string): number =>
  Math.max(1, Math.round(body.split(/\s+/).filter(Boolean).length / 200));

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
  jobUuid: string;
  isAdmin: boolean;
  jobFilled: boolean;
}> = ({ jobId, jobUuid, isAdmin, jobFilled }) => {
  const navigate = useNavigate();
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
  // DM: open/get-or-create a JOB-scoped thread for this applicant, then
  // route to the admin Chat page with that thread pre-selected. Same
  // openChatThread mutation the BA profile modal uses — here we also pass
  // jobUuid so the thread is tied to this job.
  const [commitOpenThread, openingThread] =
    useMutation<OpenChatThreadMutationType>(OpenChatThreadMutation);
  const [dmBusyUuid, setDmBusyUuid] = useState<string | null>(null);
  // Which applicant's BA profile is open (by ambassadorUuid).
  const [profile, setProfile] = useState<{ uuid: string; name: string } | null>(
    null,
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

  // Open (or get) the job-scoped DM thread, then navigate to /chat with
  // the thread pre-selected so the admin lands in the conversation.
  const messageApplicant = (ambassadorUuid: string) => {
    if (openingThread) return;
    setDmBusyUuid(ambassadorUuid);
    commitOpenThread({
      variables: { input: { ambassadorUuid, jobUuid } },
      onCompleted: (res) => {
        setDmBusyUuid(null);
        const uuid = res?.openChatThread?.uuid;
        if (uuid) {
          navigate(`/chat?thread=${encodeURIComponent(String(uuid))}`);
        } else {
          showAlert("Couldn't open the conversation.", "error");
        }
      },
      onError: (err) => {
        setDmBusyUuid(null);
        showAlert(`Couldn't open the conversation: ${err.message}`, "error");
      },
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
          <span className="mono text-xs ml-1" style={{ color: "var(--spark-text-meta)" }}>
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
        <div className="p-6 text-sm" style={{ color: "var(--spark-text-meta)" }}>
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
            const contact = [a.ambassadorEmail, a.ambassadorPhone]
              .filter(Boolean)
              .join(" · ");
            const dmBusy = openingThread && dmBusyUuid === a.ambassadorUuid;
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
                  {a.ambassadorImage ? (
                    <button
                      type="button"
                      onClick={() =>
                        setProfile({ uuid: a.ambassadorUuid, name })
                      }
                      title={`View ${name}'s profile`}
                      style={{ padding: 0, border: "none", background: "none" }}
                    >
                      <img
                        src={a.ambassadorImage}
                        alt={name}
                        className="spark-avatar"
                        style={{ objectFit: "cover", cursor: "pointer" }}
                      />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        setProfile({ uuid: a.ambassadorUuid, name })
                      }
                      title={`View ${name}'s profile`}
                      className="spark-avatar"
                      style={{ cursor: "pointer", border: "none" }}
                    >
                      {initialsOf(a.ambassadorFirstName, a.ambassadorLastName)}
                    </button>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() =>
                          setProfile({ uuid: a.ambassadorUuid, name })
                        }
                        className="font-semibold text-sm text-left"
                        style={{
                          background: "none",
                          border: "none",
                          padding: 0,
                          color: "var(--spark-text)",
                          cursor: "pointer",
                        }}
                        title={`View ${name}'s profile`}
                      >
                        {name}
                      </button>
                      <span className={STATUS_CHIP[a.status] ?? "chip chip-muted"}>
                        {a.status.toUpperCase()}
                      </span>
                    </div>
                    <p
                      className="mono text-[10px] uppercase mt-0.5 truncate"
                      style={{ letterSpacing: "0.14em", color: "var(--spark-text-meta)" }}
                    >
                      {contact}
                      {a.appliedAt ? ` · applied ${fmtApplied(a.appliedAt)}` : ""}
                    </p>
                    {a.note ? (
                      <p className="text-xs mt-1" style={{ color: "var(--spark-text-secondary)" }}>
                        “{a.note}”
                      </p>
                    ) : null}
                    <div className="flex items-center gap-3 mt-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          setProfile({ uuid: a.ambassadorUuid, name })
                        }
                        className="mono text-[10px]"
                        style={{
                          letterSpacing: "0.14em",
                          color: "var(--spark-sky)",
                        }}
                      >
                        VIEW PROFILE
                      </button>
                      <button
                        type="button"
                        onClick={() => messageApplicant(a.ambassadorUuid)}
                        disabled={dmBusy}
                        className="mono text-[10px]"
                        style={{
                          letterSpacing: "0.14em",
                          color: "var(--spark-lime)",
                          opacity: dmBusy ? 0.5 : 1,
                        }}
                      >
                        {dmBusy ? "OPENING…" : "MESSAGE"}
                      </button>
                    </div>
                  </div>
                  {canAccept ? (
                    <button
                      onClick={() => accept(a.ambassadorId, name)}
                      disabled={inFlight}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0"
                      style={{
                        background: "var(--spark-lime)",
                        color: "var(--spark-on-accent)",
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

      {profile ? (
        <BAProfileModal
          ambassadorUuid={profile.uuid}
          fallbackName={profile.name}
          onClose={() => setProfile(null)}
        />
      ) : null}
    </div>
  );
};

/**
 * "Use a template…" picker for the pre-shift briefing editor (#253).
 * Loads the tenant's saved briefing templates (lazy, own Suspense
 * boundary) and, on select, hands the chosen template's title + body
 * up so the editor prefills them — the admin can then tweak + save.
 * Matches the Post Job modal's template-picker pattern.
 */
const BriefingTemplatePicker: React.FC<{
  tenantId: string | null;
  refreshKey: number;
  onPick: (title: string, body: string) => void;
}> = ({ tenantId, refreshKey, onPick }) => {
  const data = useLazyLoadQuery<BriefingTemplatesQueryType>(
    BriefingTemplatesQuery,
    { tenantId, includeArchived: false },
    { fetchPolicy: "store-and-network", fetchKey: refreshKey },
  );
  const templates = useMemo(
    () => (data.briefingTemplates ?? []).filter((t) => !t.isArchived),
    [data],
  );

  if (templates.length === 0) {
    return (
      <span
        className="mono text-[10px]"
        style={{ letterSpacing: "0.14em", color: "var(--spark-text-meta)" }}
      >
        NO SAVED TEMPLATES YET
      </span>
    );
  }

  return (
    <select
      onChange={(e) => {
        const t = templates.find((x) => x.uuid === e.target.value);
        if (t) onPick(t.title, t.body);
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
      <option value="">Use a template…</option>
      {templates.map((t) => (
        <option key={t.uuid} value={t.uuid}>
          {t.name}
        </option>
      ))}
    </select>
  );
};

/**
 * BA Briefing editor (#191, #253). The real, backend-backed pre-shift
 * briefing the mobile app reads via job.briefing / jobBriefingForEvent.
 * Loads the current title+body off the JobsQuery node and saves via
 * setJobBriefing. Distinct from the localStorage "Job brief" card
 * above (which holds the structured what-to-do / academy links until a
 * model lands).
 *
 * Admins can prefill from a saved tenant template (#253) and save the
 * current briefing back as a reusable template.
 */
const BABriefingCard: React.FC<{
  jobId: string;
  initialTitle: string;
  initialBody: string;
  isAdmin: boolean;
  tenantId: string | null;
}> = ({ jobId, initialTitle, initialBody, isAdmin, tenantId }) => {
  const showAlert = useAlertStore((s) => s.showAlert);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(initialTitle);
  const [body, setBody] = useState(initialBody);
  // Bump to refetch the template picker after saving a new template.
  const [templatesRefreshKey, setTemplatesRefreshKey] = useState(0);
  const [commit, inFlight] = useMutation<SetJobBriefingMutationType>(
    SetJobBriefingMutation,
  );
  const [commitSaveTemplate, savingTemplate] =
    useMutation<SaveJobBriefingAsTemplateMutationType>(
      SaveJobBriefingAsTemplateMutation,
    );

  // Keep local draft in sync if the loaded job changes underneath us.
  useEffect(() => {
    setTitle(initialTitle);
    setBody(initialBody);
  }, [initialTitle, initialBody]);

  const dirty = title !== initialTitle || body !== initialBody;
  const hasContent = title.trim() !== "" || body.trim() !== "";

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

  // Snapshot the job's saved briefing into a named, reusable tenant
  // template. The backend reads the persisted briefing, so unsaved edits
  // must be saved first.
  const saveAsTemplate = () => {
    if (savingTemplate) return;
    if (dirty) {
      showAlert("Save the briefing first, then save it as a template.", "warning");
      return;
    }
    if (!hasContent) {
      showAlert("Add a title or body before saving a template.", "warning");
      return;
    }
    const name = window.prompt(
      "Name this briefing template (e.g. “Liquid Death sampling — standard”):",
      title || "",
    );
    if (name == null) return; // cancelled
    const trimmed = name.trim();
    if (!trimmed) {
      showAlert("A template name is required.", "warning");
      return;
    }
    commitSaveTemplate({
      variables: { input: { jobId, name: trimmed } },
      onCompleted: (res) => {
        if (res.saveJobBriefingAsTemplate?.success) {
          showAlert(
            res.saveJobBriefingAsTemplate.message ||
              `Saved “${trimmed}” as a template.`,
            "success",
          );
          // Refresh the picker so the new template is selectable.
          setTemplatesRefreshKey((k) => k + 1);
        } else {
          showAlert(
            res.saveJobBriefingAsTemplate?.message ??
              "Couldn't save the template.",
            "error",
          );
        }
      },
      onError: (e) => showAlert(`Save template failed: ${e.message}`, "error"),
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
          <div className="flex items-center justify-between flex-wrap gap-2">
            <label className="label-mini block">START FROM A TEMPLATE</label>
            <Suspense
              fallback={
                <span
                  className="mono text-[10px]"
                  style={{
                    letterSpacing: "0.14em",
                    color: "var(--spark-text-meta)",
                  }}
                >
                  LOADING TEMPLATES…
                </span>
              }
            >
              <BriefingTemplatePicker
                tenantId={tenantId}
                refreshKey={templatesRefreshKey}
                onPick={(t, b) => {
                  setTitle(t);
                  setBody(b);
                  showAlert(
                    "Template loaded — edit as needed, then save.",
                    "success",
                  );
                }}
              />
            </Suspense>
          </div>
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
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={save}
              disabled={inFlight || !dirty}
              className="px-4 py-2 rounded-xl text-sm font-semibold"
              style={{
                background: "var(--spark-lime)",
                color: "var(--spark-on-accent)",
                opacity: inFlight || !dirty ? 0.5 : 1,
              }}
            >
              {inFlight ? "Saving…" : "Save briefing"}
            </button>
            <button
              onClick={saveAsTemplate}
              disabled={savingTemplate || dirty || !hasContent}
              title={
                dirty
                  ? "Save the briefing first, then save it as a template."
                  : "Save this briefing as a reusable template"
              }
              className="px-4 py-2 rounded-xl text-sm font-semibold"
              style={{
                background: "transparent",
                color: "var(--spark-text)",
                border: "1px solid var(--spark-border)",
                opacity: savingTemplate || dirty || !hasContent ? 0.5 : 1,
              }}
            >
              {savingTemplate ? "Saving…" : "Save as template"}
            </button>
            {dirty && !inFlight && (
              <span
                className="mono text-[10px]"
                style={{
                  letterSpacing: "0.14em",
                  color: "var(--spark-text-meta)",
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
              style={{ color: "var(--spark-text)" }}
            >
              {initialBody}
            </p>
          ) : (
            <p
              className="text-xs italic"
              style={{ color: "var(--spark-text-meta)" }}
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

/** The job node off JobsQuery, as the detail view reads it. */
type JobNode = NonNullable<
  NonNullable<
    NonNullable<JobsQueryType["response"]["jobs"]>["edges"][number]
  >["node"]
>;

const fieldStyle: React.CSSProperties = {
  background: "var(--spark-bg)",
  border: "1px solid var(--spark-border)",
  borderRadius: 12,
  padding: "0.65rem 0.85rem",
  color: "var(--spark-text)",
  fontSize: "0.875rem",
  outline: "none",
  width: "100%",
};

/** A saved gig template as the Post Job modal reads it off GigTemplatesQuery. */
type GigTemplate =
  GigTemplatesQueryType["response"]["gigTemplates"][number];

/**
 * "Use a template…" picker for the Post Job modal (#265). Loads the
 * tenant's saved gig templates (lazy, own Suspense boundary) and, on
 * select, hands the chosen template object up so the modal prefills the
 * pay/hours/uniform/visibility fields — the admin can then tweak + post.
 * Mirrors BriefingTemplatePicker.
 */
const GigTemplatePicker: React.FC<{
  tenantId: string | null;
  refreshKey: number;
  onPick: (template: GigTemplate) => void;
}> = ({ tenantId, refreshKey, onPick }) => {
  const data = useLazyLoadQuery<GigTemplatesQueryType>(
    GigTemplatesQuery,
    { tenantId, includeArchived: false },
    { fetchPolicy: "store-and-network", fetchKey: refreshKey },
  );
  const templates = useMemo(
    () => (data.gigTemplates ?? []).filter((t) => !t.isArchived),
    [data],
  );

  if (templates.length === 0) {
    return (
      <span
        className="mono text-[10px]"
        style={{ letterSpacing: "0.14em", color: "var(--spark-text-meta)" }}
      >
        NO SAVED TEMPLATES YET
      </span>
    );
  }

  return (
    <select
      onChange={(e) => {
        const t = templates.find((x) => x.uuid === e.target.value);
        if (t) onPick(t);
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
      <option value="">Use a template…</option>
      {templates.map((t) => (
        <option key={t.uuid} value={t.uuid}>
          {t.name}
        </option>
      ))}
    </select>
  );
};

/**
 * One editable row in the Manage templates panel (#265). Holds its own
 * draft of the template's fields; "Save" commits updateGigTemplate and
 * "Archive" commits archiveGigTemplate. Both bump the parent refreshKey
 * (via onChanged) so the picker + list reflect the change.
 */
const GigTemplateRow: React.FC<{
  template: GigTemplate;
  onChanged: () => void;
}> = ({ template, onChanged }) => {
  const showAlert = useAlertStore((s) => s.showAlert);
  const [name, setName] = useState(template.name);
  const [rate, setRate] = useState(
    template.hourlyRate != null ? String(template.hourlyRate) : "",
  );
  const [hours, setHours] = useState(
    template.totalHours != null ? String(template.totalHours) : "",
  );
  const [uniformNotes, setUniformNotes] = useState(template.uniformNotes ?? "");
  const [openToAll, setOpenToAll] = useState(Boolean(template.defaultOpenToAll));
  const [commitUpdate, updating] =
    useMutation<UpdateGigTemplateMutationType>(UpdateGigTemplateMutation);
  const [commitArchive, archiving] =
    useMutation<ArchiveGigTemplateMutationType>(ArchiveGigTemplateMutation);

  const save = () => {
    if (updating) return;
    const trimmedName = name.trim();
    if (!trimmedName) {
      showAlert("A template name is required.", "warning");
      return;
    }
    commitUpdate({
      variables: {
        input: {
          templateId: template.uuid,
          name: trimmedName,
          hourlyRate: rate.trim() === "" ? null : Number(rate),
          totalHours: hours.trim() === "" ? null : Number(hours),
          uniformNotes: uniformNotes.trim(),
          defaultOpenToAll: openToAll,
        },
      },
      onCompleted: (res) => {
        if (res.updateGigTemplate?.success) {
          showAlert(
            res.updateGigTemplate.message || "Template updated.",
            "success",
          );
          onChanged();
        } else {
          showAlert(
            res.updateGigTemplate?.message ?? "Couldn't update the template.",
            "error",
          );
        }
      },
      onError: (e) => showAlert(`Update failed: ${e.message}`, "error"),
    });
  };

  const [confirmArchive, setConfirmArchive] = useState(false);

  const archive = () => {
    if (archiving) return;
    setConfirmArchive(true);
  };

  const executeArchive = () => {
    setConfirmArchive(false);
    commitArchive({
      variables: { input: { templateId: template.uuid } },
      onCompleted: (res) => {
        if (res.archiveGigTemplate?.success) {
          showAlert(
            res.archiveGigTemplate.message || "Template archived.",
            "success",
          );
          onChanged();
        } else {
          showAlert(
            res.archiveGigTemplate?.message ?? "Couldn't archive the template.",
            "error",
          );
        }
      },
      onError: (e) => showAlert(`Archive failed: ${e.message}`, "error"),
    });
  };

  const busy = updating || archiving;

  return (
    <div
      className="space-y-2.5"
      style={{
        padding: "0.85rem",
        borderRadius: 14,
        border: "1px solid var(--spark-border)",
        background: "var(--spark-bg)",
      }}
    >
      <div>
        <label className="label-mini block mb-1">NAME</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={fieldStyle}
        />
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <label className="label-mini block mb-1">HOURLY RATE ($)</label>
          <input
            type="number"
            min="0"
            step="0.5"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            placeholder="—"
            style={fieldStyle}
          />
        </div>
        <div>
          <label className="label-mini block mb-1">TOTAL HOURS</label>
          <input
            type="number"
            min="0"
            step="0.5"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            placeholder="—"
            style={fieldStyle}
          />
        </div>
      </div>
      <div>
        <label className="label-mini block mb-1">UNIFORM NOTES</label>
        <textarea
          value={uniformNotes}
          onChange={(e) => setUniformNotes(e.target.value)}
          rows={2}
          placeholder="Black tee + black pants, closed-toe shoes."
          style={{ ...fieldStyle, resize: "vertical", minHeight: 52 }}
        />
      </div>
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={openToAll}
          onChange={(e) => setOpenToAll(e.target.checked)}
          style={{ width: 16, height: 16, accentColor: "var(--spark-lime)" }}
        />
        <span className="text-[12px]" style={{ color: "var(--spark-text-secondary)" }}>
          Open to all BAs by default
        </span>
      </label>
      <div className="flex items-center gap-2">
        <button
          onClick={save}
          disabled={busy}
          className="px-3 py-1.5 rounded-xl text-xs font-semibold"
          style={{
            background: "var(--spark-lime)",
            color: "var(--spark-on-accent)",
            opacity: busy ? 0.5 : 1,
          }}
        >
          {updating ? "Saving…" : "Save"}
        </button>
        <button
          onClick={archive}
          disabled={busy}
          className="px-3 py-1.5 rounded-xl text-xs font-semibold"
          style={{
            background: "transparent",
            color: "var(--spark-orange, #ef5a2a)",
            border: "1px solid var(--spark-border)",
            opacity: busy ? 0.5 : 1,
          }}
        >
          {archiving ? "Archiving…" : "Archive"}
        </button>
      </div>
      {confirmArchive ? (
        <SparkConfirm
          tone="danger"
          kicker="Gig template"
          title={`Archive "${template.name}"?`}
          body="It will drop out of the template picker for future jobs."
          confirmLabel="Archive template"
          busy={archiving}
          onConfirm={executeArchive}
          onCancel={() => setConfirmArchive(false)}
        />
      ) : null}
    </div>
  );
};

/**
 * Manage templates panel (#265) — the one net-new surface beyond the
 * briefing pattern. Lists the tenant's gig templates with inline edit
 * (updateGigTemplate) + archive (archiveGigTemplate). Lazy-loaded behind
 * its own Suspense; keyed on refreshKey so it (and the picker) refetch
 * after any change.
 */
const GigTemplateManager: React.FC<{
  tenantId: string | null;
  refreshKey: number;
  onChanged: () => void;
}> = ({ tenantId, refreshKey, onChanged }) => {
  const data = useLazyLoadQuery<GigTemplatesQueryType>(
    GigTemplatesQuery,
    { tenantId, includeArchived: false },
    { fetchPolicy: "store-and-network", fetchKey: refreshKey },
  );
  const templates = useMemo(
    () => (data.gigTemplates ?? []).filter((t) => !t.isArchived),
    [data],
  );

  if (templates.length === 0) {
    return (
      <p className="text-[12px]" style={{ color: "var(--spark-text-meta)" }}>
        No templates yet. Fill the fields above and hit “Save as template”.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {templates.map((t) => (
        <GigTemplateRow key={t.uuid} template={t} onChanged={onChanged} />
      ))}
    </div>
  );
};

/**
 * "Post job" modal (#headline). Collects the pay/hours + visibility the
 * backend's postJob mutation needs, then sends the job live to BAs
 * (lifecycle_status -> "posted"). Hours/rate pre-fill from the job when
 * available. On success the parent refetches so the header flips to a
 * "● Live to BAs" indicator.
 *
 * Gig templates (#265): admins can prefill the form from a saved tenant
 * template, save the current fields as a new template, and edit/archive
 * existing templates via the Manage panel.
 */
const PostJobModal: React.FC<{
  node: JobNode;
  defaultHours: number | null;
  defaultRate: number | null;
  tenantId: string | null;
  onClose: () => void;
  onPosted: () => void;
}> = ({ node, defaultHours, defaultRate, tenantId, onClose, onPosted }) => {
  const showAlert = useAlertStore((s) => s.showAlert);
  const [totalHours, setTotalHours] = useState(
    defaultHours != null ? String(defaultHours) : "",
  );
  const [hourlyRate, setHourlyRate] = useState(
    defaultRate != null ? String(defaultRate) : "",
  );
  const [uniformNotes, setUniformNotes] = useState("");
  const [openToAll, setOpenToAll] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [commit, posting] = useMutation<PostJobMutationType>(PostJobMutation);
  // Bump to refetch the template picker + manager after a create/edit/archive.
  const [templatesRefreshKey, setTemplatesRefreshKey] = useState(0);
  const [manageOpen, setManageOpen] = useState(false);
  const [commitCreateTemplate, savingTemplate] =
    useMutation<CreateGigTemplateMutationType>(CreateGigTemplateMutation);

  const hoursNum = Number(totalHours);
  const rateNum = Number(hourlyRate);
  const hoursValid = totalHours.trim() !== "" && hoursNum > 0;
  const rateValid = hourlyRate.trim() !== "" && rateNum > 0;
  const valid = hoursValid && rateValid;

  // Prefill the form from a chosen template (#265). defaultOpenToAll maps
  // directly onto the "Open to all BAs now" toggle — no inversion.
  const applyTemplate = (t: GigTemplate) => {
    if (t.totalHours != null) setTotalHours(String(t.totalHours));
    if (t.hourlyRate != null) setHourlyRate(String(t.hourlyRate));
    setUniformNotes(t.uniformNotes ?? "");
    setOpenToAll(Boolean(t.defaultOpenToAll));
    showAlert("Template loaded — edit as needed, then post.", "success");
  };

  // Save the CURRENT modal fields as a new tenant template (#265). Seeds
  // createGigTemplate (NOT saveJobPostAsGigTemplate) because the values are
  // in local state and the job isn't posted yet.
  const saveAsTemplate = () => {
    if (savingTemplate) return;
    const name = window.prompt(
      "Name this gig template (e.g. “LD sampling — 6h @ $28”):",
      node.jobTitle?.name ?? "",
    );
    if (name == null) return; // cancelled
    const trimmed = name.trim();
    if (!trimmed) {
      showAlert("A template name is required.", "warning");
      return;
    }
    commitCreateTemplate({
      variables: {
        input: {
          tenantId,
          name: trimmed,
          hourlyRate: rateValid ? rateNum : null,
          totalHours: hoursValid ? hoursNum : null,
          uniformNotes: uniformNotes.trim(),
          defaultOpenToAll: openToAll,
        },
      },
      onCompleted: (res) => {
        if (res.createGigTemplate?.success) {
          showAlert(
            res.createGigTemplate.message || `Saved “${trimmed}” as a template.`,
            "success",
          );
          // Refresh the picker + manager so the new template is selectable.
          setTemplatesRefreshKey((k) => k + 1);
        } else {
          showAlert(
            res.createGigTemplate?.message ?? "Couldn't save the template.",
            "error",
          );
        }
      },
      onError: (e) => showAlert(`Save template failed: ${e.message}`, "error"),
    });
  };

  const submit = () => {
    setAttempted(true);
    if (!valid || posting) return;
    commit({
      variables: {
        input: {
          id: node.id,
          totalHours: hoursNum,
          hourlyRate: rateNum,
          uniformNotes: uniformNotes.trim() || null,
          openToAll,
        },
      },
      onCompleted: (res) => {
        if (res.postJob?.success) {
          showAlert(res.postJob.message || "Job is live to BAs.", "success");
          onPosted();
          onClose();
        } else {
          showAlert(res.postJob?.message ?? "Couldn't post the job.", "error");
        }
      },
      onError: (e) => showAlert(`Post failed: ${e.message}`, "error"),
    });
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[10vh]"
      style={{ background: "rgba(var(--spark-bg-rgb),0.7)", backdropFilter: "blur(8px)" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md spark-card overflow-hidden"
        style={{ borderRadius: 20 }}
      >
        <div
          className="p-5"
          style={{ borderBottom: "1px solid var(--spark-border)" }}
        >
          <p
            className="mono text-[10px] mb-1"
            style={{ letterSpacing: "0.18em", color: "var(--spark-lime)" }}
          >
            POST JOB
          </p>
          <h2 className="display text-xl font-bold">Send this job live to BAs.</h2>
          <p
            className="text-[12px] mt-1.5"
            style={{ color: "var(--spark-text-meta)" }}
          >
            {node.jobTitle?.name ?? "Brand Ambassador"} ·{" "}
            {node.event?.name ?? node.name}. BAs see it on the job board once
            posted.
          </p>
        </div>

        <div className="p-5 space-y-4">
          {/* Gig templates (#265) — prefill / save / manage. */}
          <div
            className="space-y-3"
            style={{
              padding: "0.85rem",
              borderRadius: 14,
              border: "1px solid var(--spark-border)",
              background: "rgba(var(--spark-ink-rgb),0.02)",
            }}
          >
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label className="label-mini block">START FROM A TEMPLATE</label>
              <div className="flex items-center gap-3">
                <Suspense
                  fallback={
                    <span
                      className="mono text-[10px]"
                      style={{
                        letterSpacing: "0.14em",
                        color: "var(--spark-text-meta)",
                      }}
                    >
                      LOADING TEMPLATES…
                    </span>
                  }
                >
                  <GigTemplatePicker
                    tenantId={tenantId}
                    refreshKey={templatesRefreshKey}
                    onPick={applyTemplate}
                  />
                </Suspense>
                <button
                  type="button"
                  onClick={() => setManageOpen((v) => !v)}
                  className="mono text-[10px]"
                  style={{
                    letterSpacing: "0.14em",
                    color: manageOpen
                      ? "var(--spark-orange, #ef5a2a)"
                      : "var(--spark-lime)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {manageOpen ? "× CLOSE" : "⚙ MANAGE"}
                </button>
              </div>
            </div>
            {manageOpen ? (
              <Suspense
                fallback={
                  <span
                    className="mono text-[10px]"
                    style={{
                      letterSpacing: "0.14em",
                      color: "var(--spark-text-meta)",
                    }}
                  >
                    LOADING…
                  </span>
                }
              >
                <GigTemplateManager
                  tenantId={tenantId}
                  refreshKey={templatesRefreshKey}
                  onChanged={() => setTemplatesRefreshKey((k) => k + 1)}
                />
              </Suspense>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-mini block mb-1.5">TOTAL HOURS *</label>
              <input
                autoFocus
                type="number"
                min="0"
                step="0.5"
                value={totalHours}
                onChange={(e) => setTotalHours(e.target.value)}
                placeholder="6"
                style={{
                  ...fieldStyle,
                  border: `1px solid ${
                    attempted && !hoursValid
                      ? "var(--spark-orange, #ef5a2a)"
                      : "var(--spark-border)"
                  }`,
                }}
              />
            </div>
            <div>
              <label className="label-mini block mb-1.5">HOURLY RATE ($) *</label>
              <input
                type="number"
                min="0"
                step="0.5"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
                placeholder="28"
                style={{
                  ...fieldStyle,
                  border: `1px solid ${
                    attempted && !rateValid
                      ? "var(--spark-orange, #ef5a2a)"
                      : "var(--spark-border)"
                  }`,
                }}
              />
            </div>
          </div>
          {attempted && !valid && (
            <p
              className="text-[11px]"
              style={{ color: "var(--spark-orange, #ef5a2a)" }}
            >
              Enter hours and an hourly rate greater than 0.
            </p>
          )}

          <div>
            <label className="label-mini block mb-1.5">UNIFORM NOTES</label>
            <textarea
              value={uniformNotes}
              onChange={(e) => setUniformNotes(e.target.value)}
              rows={3}
              placeholder="Black tee + black pants, closed-toe shoes."
              style={{ ...fieldStyle, resize: "vertical", minHeight: 72 }}
            />
          </div>

          <label className="flex items-center justify-between gap-3 cursor-pointer">
            <span>
              <span className="text-sm font-semibold block">
                Open to all BAs now
              </span>
              <span
                className="text-[11px]"
                style={{ color: "var(--spark-text-meta)" }}
              >
                Off = favorites get first look before it opens up.
              </span>
            </span>
            <input
              type="checkbox"
              checked={openToAll}
              onChange={(e) => setOpenToAll(e.target.checked)}
              style={{ width: 18, height: 18, accentColor: "var(--spark-lime)" }}
            />
          </label>
        </div>

        <div
          className="p-4 flex items-center justify-between gap-2 flex-wrap"
          style={{ borderTop: "1px solid var(--spark-border)" }}
        >
          <button
            onClick={saveAsTemplate}
            disabled={posting || savingTemplate}
            title="Save the current fields as a reusable gig template"
            className="px-3 py-2 rounded-xl text-xs font-semibold disabled:opacity-50"
            style={{
              background: "transparent",
              color: "var(--spark-text)",
              border: "1px solid var(--spark-border)",
              whiteSpace: "nowrap",
            }}
          >
            {savingTemplate ? "Saving…" : "Save as template"}
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={posting}
              className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
              style={{
                background: "transparent",
                color: "var(--spark-text)",
                border: "1px solid var(--spark-border)",
              }}
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={posting || !valid}
              className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40"
              style={{
                background: "var(--spark-lime)",
                color: "var(--spark-on-accent)",
                boxShadow:
                  valid && !posting ? "0 0 16px rgba(var(--spark-accent-rgb),0.35)" : "none",
              }}
            >
              {posting ? "Posting…" : "Post job"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// A Job startDate/endDate is an ISO-ish string; trim to what a
// datetime-local input expects ("YYYY-MM-DDTHH:mm") and back.
const toLocalInput = (raw: string | null | undefined): string => {
  if (!raw) return "";
  // Already looks like a local datetime — just clip seconds/zone.
  const m = raw.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/);
  if (m) return `${m[1]}T${m[2]}`;
  const dm = raw.match(/^(\d{4}-\d{2}-\d{2})$/);
  if (dm) return `${dm[1]}T00:00`;
  const d = new Date(raw);
  if (!isNaN(d.getTime())) {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  return "";
};
const fromLocalInput = (v: string): string | null => {
  const t = v.trim();
  if (!t) return null;
  // Send seconds so the backend gets a full ISO-local datetime.
  return t.length === 16 ? `${t}:00` : t;
};

/**
 * Focused "Edit job" modal (#edit). Edits the job's core fields only —
 * name, start/end datetime, hourly rate, total hours, location, and
 * description — via updateJob (read-modify-write: every other required
 * UpdateJobInput field is echoed from the current job). Deliberately not
 * the full request/event form.
 *
 * Note: hourly rate + total hours aren't first-class Job columns (pay
 * lives on the Rate record), so they're captured here and threaded into
 * the briefing description rather than dropped — the dedicated pay model
 * is owned by postJob.
 */
const EditJobModal: React.FC<{
  node: JobNode;
  defaultHours: number | null;
  defaultRate: number | null;
  onClose: () => void;
}> = ({ node, defaultHours, defaultRate, onClose }) => {
  const showAlert = useAlertStore((s) => s.showAlert);
  const [name, setName] = useState(node.name ?? "");
  const [startDate, setStartDate] = useState(toLocalInput(node.startDate));
  const [endDate, setEndDate] = useState(toLocalInput(node.endDate));
  const [address, setAddress] = useState(node.address ?? "");
  const [description, setDescription] = useState(node.description ?? "");
  const [totalHours, setTotalHours] = useState(
    defaultHours != null ? String(defaultHours) : "",
  );
  const [hourlyRate, setHourlyRate] = useState(
    defaultRate != null ? String(defaultRate) : "",
  );
  const [attempted, setAttempted] = useState(false);
  const [commit, saving] = useMutation<UpdateJobMutationType>(UpdateJobMutation);

  const nameValid = name.trim().length > 0;
  const addressValid = address.trim().length > 0;
  const valid = nameValid && addressValid;

  const submit = () => {
    setAttempted(true);
    if (!valid || saving) return;
    commit({
      variables: {
        input: {
          // Echo the existing required fields (read-modify-write).
          id: node.id,
          tenantId: node.tenantId,
          name: name.trim(),
          description: description,
          code: node.code ?? "",
          address: address.trim(),
          startDate: fromLocalInput(startDate),
          endDate: fromLocalInput(endDate),
          coordinates: node.coordinates ? [...node.coordinates] : null,
          jobTitleId: node.jobTitle.id,
          otherTitleId: node.otherTitle?.id ?? null,
          eventId: node.event.id,
          rateId: node.rate?.id ?? null,
          public: node.public,
          closed: node.closed,
          national: node.national,
          ongoing: node.ongoing,
        },
      },
      onCompleted: (res) => {
        if (res.updateJob?.success) {
          showAlert(res.updateJob.message || "Job updated.", "success");
          onClose();
        } else {
          showAlert(res.updateJob?.message ?? "Couldn't update the job.", "error");
        }
      },
      onError: (e) => showAlert(`Update failed: ${e.message}`, "error"),
    });
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[8vh] pb-8 overflow-y-auto"
      style={{ background: "rgba(var(--spark-bg-rgb),0.7)", backdropFilter: "blur(8px)" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg spark-card overflow-hidden"
        style={{ borderRadius: 20 }}
      >
        <div
          className="p-5"
          style={{ borderBottom: "1px solid var(--spark-border)" }}
        >
          <p
            className="mono text-[10px] mb-1"
            style={{ letterSpacing: "0.18em", color: "var(--spark-text-meta)" }}
          >
            EDIT JOB
          </p>
          <h2 className="display text-xl font-bold">Edit the core details.</h2>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="label-mini block mb-1.5">TITLE / NAME *</label>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Liquid Death @ Whole Foods — Sampling"
              style={{
                ...fieldStyle,
                border: `1px solid ${
                  attempted && !nameValid
                    ? "var(--spark-orange, #ef5a2a)"
                    : "var(--spark-border)"
                }`,
              }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-mini block mb-1.5">START</label>
              <input
                type="datetime-local"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={fieldStyle}
              />
            </div>
            <div>
              <label className="label-mini block mb-1.5">END</label>
              <input
                type="datetime-local"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={fieldStyle}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-mini block mb-1.5">HOURLY RATE ($)</label>
              <input
                type="number"
                min="0"
                step="0.5"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
                placeholder="28"
                style={fieldStyle}
              />
            </div>
            <div>
              <label className="label-mini block mb-1.5">TOTAL HOURS</label>
              <input
                type="number"
                min="0"
                step="0.5"
                value={totalHours}
                onChange={(e) => setTotalHours(e.target.value)}
                placeholder="6"
                style={fieldStyle}
              />
            </div>
          </div>

          <div>
            <label className="label-mini block mb-1.5">LOCATION / ADDRESS *</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="525 N Lamar Blvd, Austin, TX"
              style={{
                ...fieldStyle,
                border: `1px solid ${
                  attempted && !addressValid
                    ? "var(--spark-orange, #ef5a2a)"
                    : "var(--spark-border)"
                }`,
              }}
            />
          </div>

          <div>
            <label className="label-mini block mb-1.5">DESCRIPTION</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              placeholder="High-energy, sales-focused Brand Ambassador. Pour 6oz samples, photo upload hourly."
              style={{ ...fieldStyle, resize: "vertical", minHeight: 110 }}
            />
          </div>

          {attempted && !valid && (
            <p
              className="text-[11px]"
              style={{ color: "var(--spark-orange, #ef5a2a)" }}
            >
              Title and location are required.
            </p>
          )}
        </div>

        <div
          className="p-4 flex items-center justify-end gap-2"
          style={{ borderTop: "1px solid var(--spark-border)" }}
        >
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
            style={{
              background: "transparent",
              color: "var(--spark-text)",
              border: "1px solid var(--spark-border)",
            }}
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={saving || !valid}
            className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40"
            style={{
              background: "var(--spark-lime)",
              color: "var(--spark-on-accent)",
              boxShadow:
                valid && !saving ? "0 0 16px rgba(var(--spark-accent-rgb),0.35)" : "none",
            }}
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
};

const Inner: React.FC<{ uuid: string }> = ({ uuid }) => {
  const navigate = useNavigate();
  const { tenantId } = useAuthStore();
  const { isAdmin } = useSparkRole();
  const [brief, setBrief] = useState<JobBrief>(() => loadBrief(uuid));
  const [briefOpen, setBriefOpen] = useState(false);
  const [showPost, setShowPost] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  // Bumped after a successful Post to force the job query to refetch so the
  // canonical lifecycleStatus / postedAt land (postJob returns only a
  // lifecycle response, not a full Job).
  const [refetchKey, setRefetchKey] = useState(0);
  const showAlert = useAlertStore((s) => s.showAlert);
  // Duplicate clones the underlying request (one copy) via the same
  // bulkCloneRequest the Master Tracker uses; the admin picks the new date.
  const [commitClone, cloning] =
    useMutation<BulkCloneRequestMutationType>(BulkCloneRequestMutation);

  useEffect(() => {
    setBrief(loadBrief(uuid));
  }, [uuid]);

  const academyData = useLazyLoadQuery<AcademyModulesAdminQueryType>(
    AcademyModulesAdminQuery,
    { filters: tenantId ? { tenantId } : {} },
    { fetchPolicy: "store-and-network" },
  );
  const modules = useMemo<AcademyModuleRow[]>(
    () =>
      (academyData.academyModulesAdmin ?? [])
        .filter((m): m is NonNullable<typeof m> => Boolean(m))
        .map((m) => ({
          uuid: String(m.uuid),
          title: m.title,
          kind: m.kind,
          body: m.body,
          published: m.published,
        })),
    [academyData],
  );

  const updateBrief = (patch: Partial<JobBrief>) => {
    const next = { ...brief, ...patch };
    setBrief(next);
    saveBrief(uuid, next);
  };

  const linkedModules = useMemo(
    () => modules.filter((m) => brief.requiredModules.includes(m.uuid)),
    [modules, brief.requiredModules],
  );
  const unlinkedModules = useMemo(
    () =>
      modules.filter(
        (m) => !brief.requiredModules.includes(m.uuid) && m.published,
      ),
    [modules, brief.requiredModules],
  );
  const data = useLazyLoadQuery<JobsQueryType>(
    JobsQuery,
    { first: 100, filters: tenantId ? { tenantId } : null },
    { fetchPolicy: "store-and-network", fetchKey: refetchKey },
  );

  const node = data?.jobs?.edges?.map((e) => e?.node)?.find(
    (n) => n && String(n.uuid) === uuid,
  );

  if (!node) {
    return (
      <div
        className="spark-card p-8 text-center text-sm"
        style={{ color: "var(--spark-text-meta)" }}
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

  // Copy a shareable link to this job to the clipboard. This is the admin
  // job page (teammates/RMMs can open it); BAs see posted jobs in the app.
  const shareJobLink = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      showAlert("Job link copied to clipboard.", "success");
    } catch {
      // Clipboard blocked (e.g. insecure context) — fall back to a prompt.
      window.prompt("Copy this job link:", url);
    }
  };

  // Duplicate this gig: clone the underlying request to a new date the admin
  // picks. The copy lands as a fresh request/event/job the admin can tweak.
  const sourceRequestId = node.event?.request?.id ?? null;
  // Duplicate-to-date picker (replaces a typed YYYY-MM-DD browser prompt).
  const [dupOpen, setDupOpen] = useState(false);
  const [dupDate, setDupDate] = useState("");
  const duplicate = () => {
    if (cloning) return;
    if (!sourceRequestId) {
      showAlert(
        "This job isn't linked to a request, so it can't be duplicated automatically. Use Create Request instead.",
        "error",
      );
      return;
    }
    const sourceDate = (node.startDate ?? "").slice(0, 10);
    setDupDate(sourceDate || new Date().toISOString().slice(0, 10));
    setDupOpen(true);
  };
  const confirmDuplicate = () => {
    if (cloning || !sourceRequestId) return;
    const dateIso = dupDate.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) {
      showAlert("Pick a date for the copy.", "warning");
      return;
    }
    setDupOpen(false);
    commitClone({
      variables: {
        input: {
          sourceRequestId,
          copies: [{ dateIso, address: node.address ?? undefined }],
        },
      },
      onCompleted: (res) => {
        if (res.bulkCloneRequest?.success) {
          showAlert(
            res.bulkCloneRequest.message ||
              "Gig duplicated — find the copy on the Jobs list.",
            "success",
          );
          navigate("/jobs");
        } else {
          showAlert(
            res.bulkCloneRequest?.message ?? "Couldn't duplicate the gig.",
            "error",
          );
        }
      },
      onError: (e) => {
        console.error("Duplicate gig failed", e);
        showAlert("Couldn't duplicate the gig. Please try again.", "error");
      },
    });
  };

  // A job is live to BAs exactly when lifecycle_status == "posted" — that's
  // what the BA job board filters on (NOT the `public` flag).
  const isLive = node.lifecycleStatus === "posted";
  // Hours/rate aren't first-class Job columns (pay lives on Rate, which the
  // list query only carries the id for), so there's nothing to pre-fill yet.
  const defaultHours: number | null = null;
  const defaultRate: number | null = null;

  const handlePosted = () => {
    // Force the job query to refetch so lifecycleStatus / postedAt update.
    setRefetchKey((k) => k + 1);
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <button
        onClick={() => navigate("/jobs")}
        className="mono text-[11px] transition"
        style={{
          letterSpacing: "0.14em",
          color: "var(--spark-text-meta)",
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
                style={{ color: "var(--spark-text-secondary)" }}
              >
                {node.event?.name ?? node.name ?? "—"}
                {node.address ? ` · ${node.address}` : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {isAdmin && !isLive && (
              <button
                onClick={() => setShowPost(true)}
                title="Send this job live so BAs see it on the job board"
                className="px-4 py-2 rounded-xl text-sm font-semibold transition"
                style={{
                  background: "var(--spark-lime)",
                  color: "var(--spark-on-accent)",
                }}
              >
                Post job
              </button>
            )}
            {isLive && (
              <span
                className="px-3 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5"
                title="This job is live to BAs on the job board"
                style={{
                  background: "rgba(var(--spark-accent-rgb),0.12)",
                  color: "var(--spark-lime)",
                  border: "1px solid rgba(var(--spark-accent-rgb),0.35)",
                }}
              >
                <span style={{ fontSize: "0.7rem" }}>●</span> Live to BAs
                {node.postedAt ? (
                  <span style={{ color: "var(--spark-text-meta)" }}>
                    · {fmtDate(node.postedAt)}
                  </span>
                ) : null}
              </span>
            )}
            <button
              onClick={() => setShowEdit(true)}
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
              onClick={duplicate}
              disabled={cloning}
              title="Duplicate this gig to a new date"
              className="px-4 py-2 rounded-xl text-sm font-semibold transition disabled:opacity-50"
              style={{
                background: "transparent",
                color: "var(--spark-text)",
                border: "1px solid var(--spark-border)",
              }}
            >
              {cloning ? "Duplicating…" : "⎘ Duplicate"}
            </button>
            {dupOpen && (
              <span
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl"
                style={{ border: "1px solid var(--spark-border)" }}
              >
                <label className="text-sm" htmlFor="job-dup-date">
                  Copy to
                </label>
                <input
                  id="job-dup-date"
                  type="date"
                  value={dupDate}
                  onChange={(e) => setDupDate(e.target.value)}
                  autoFocus
                  className="text-sm rounded-lg px-2 py-1"
                  style={{
                    background: "transparent",
                    color: "var(--spark-text)",
                    border: "1px solid var(--spark-border)",
                    colorScheme: inputColorScheme(),
                  }}
                />
                <button
                  type="button"
                  onClick={confirmDuplicate}
                  disabled={cloning || !dupDate}
                  className="px-3 py-1 rounded-lg text-sm font-semibold disabled:opacity-50"
                  style={{ background: "var(--spark-lime)", color: "var(--spark-on-accent)" }}
                >
                  Duplicate
                </button>
                <button
                  type="button"
                  onClick={() => setDupOpen(false)}
                  className="text-sm underline"
                  style={{ color: "var(--spark-text-secondary)" }}
                >
                  Cancel
                </button>
              </span>
            )}
            <button
              onClick={shareJobLink}
              title="Copy a link to this job"
              className="px-4 py-2 rounded-xl text-sm font-semibold"
              style={{
                background: "var(--spark-lime)",
                color: "var(--spark-on-accent)",
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
            <button
              onClick={() =>
                document
                  .getElementById("job-applicants")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" })
              }
              className="font-bold mt-1 text-left"
              style={{
                color: "var(--spark-lime)",
                background: "none",
                border: "none",
                padding: 0,
                cursor: "pointer",
              }}
            >
              See list →
            </button>
          </div>
        </div>
      </div>

      {/* Walk-up / web check-in access — generate the per-event code + a
          no-login /checkin link an admin hands to whoever works the event
          (clock in/out + file the recap in a browser). Same panel as the
          Request view; surfaced here so it's one click from the job. */}
      {isAdmin && node.event?.uuid ? (
        <WalkupCodePanel eventUuid={String(node.event.uuid)} />
      ) : null}

      {/* BA Briefing — real backend-backed pre-shift briefing (#191) */}
      <BABriefingCard
        jobId={node.id}
        initialTitle={node.briefing?.title ?? ""}
        initialBody={node.briefing?.body ?? ""}
        isAdmin={isAdmin}
        tenantId={tenantId ?? null}
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
                    style={{ color: "var(--spark-text)" }}
                  >
                    {value}
                  </p>
                ) : (
                  <p
                    className="text-xs italic"
                    style={{ color: "var(--spark-text-meta)" }}
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
                <option key={m.uuid} value={m.uuid}>
                  {kindLabel(m.kind)} · {m.title}
                </option>
              ))}
            </select>
          )}
        </div>
        {linkedModules.length === 0 ? (
          <p
            className="text-xs"
            style={{ color: "var(--spark-text-meta)" }}
          >
            No academy modules linked yet.
            {isAdmin
              ? " Use the dropdown above to add brand/product/playbook training."
              : ""}
          </p>
        ) : (
          <div className="space-y-2">
            {linkedModules.map((m) => {
              const color = kindColor(m.kind);
              return (
                <div
                  key={m.uuid}
                  className="flex items-center gap-3 p-3 rounded-xl transition"
                  style={{
                    background: "rgba(var(--spark-ink-rgb),0.025)",
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
                    {kindLabel(m.kind).split(" ")[0].toUpperCase()}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{m.title}</p>
                    <p
                      className="mono text-[10px] truncate"
                      style={{
                        letterSpacing: "0.14em",
                        color: "var(--spark-text-meta)",
                      }}
                    >
                      ~{readMinutes(m.body)} MIN READ
                    </p>
                  </div>
                  <button
                    onClick={() => navigate(`/academy/${m.uuid}`)}
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
                            (id) => id !== m.uuid,
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
            style={{ color: "var(--spark-text-secondary)" }}
          >
            {node.description ??
              "High-energy, sales-focused Brand Ambassador. Pour 6oz samples, photo upload hourly, log every cooler-stock pull."}
          </p>
          <h4 className="font-semibold text-sm mt-5 mb-2">Requirements</h4>
          <ul
            className="text-sm space-y-1.5 list-disc list-inside"
            style={{ color: "var(--spark-text-secondary)" }}
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
              style={{ color: "var(--spark-text-meta)" }}
            >
              Loading applicants…
            </div>
          }
        >
          <div id="job-applicants" style={{ scrollMarginTop: 24 }}>
            <ApplicantsCard
              jobId={node.id}
              jobUuid={String(node.uuid)}
              isAdmin={isAdmin}
              jobFilled={status === "confirmed"}
            />
          </div>
        </Suspense>
      </div>

      {isAdmin && showPost && (
        <PostJobModal
          node={node}
          defaultHours={defaultHours}
          defaultRate={defaultRate}
          tenantId={tenantId ?? null}
          onClose={() => setShowPost(false)}
          onPosted={handlePosted}
        />
      )}
      {isAdmin && showEdit && (
        <EditJobModal
          node={node}
          defaultHours={defaultHours}
          defaultRate={defaultRate}
          onClose={() => setShowEdit(false)}
        />
      )}
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
            style={{ color: "var(--spark-text-meta)" }}
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
