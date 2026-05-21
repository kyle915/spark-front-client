/**
 * Per-job BA Briefing panel — read + edit on the admin job detail
 * page. Mirrored on the BA mobile app's job detail screen (read-only).
 *
 * Admins can:
 *   1. Apply a saved template (overwrites title/body/attachments)
 *   2. Edit inline (title/body/attachments)
 *
 * Both flows hit the backend immediately — no draft state — so the
 * BA sees the latest briefing the next time the job opens in the app.
 */
import { Suspense, useState } from "react";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { useAuthStore } from "@/store/authStore";
import { JobBriefingQuery } from "@/api/queries/JobBriefingQuery";
import type { JobBriefingQuery as JobBriefingQueryType } from "@api/queries/__generated__/JobBriefingQuery.graphql";
import { BriefingTemplatesQuery } from "@/api/queries/BriefingTemplatesQuery";
import type { BriefingTemplatesQuery as BriefingTemplatesQueryType } from "@api/queries/__generated__/BriefingTemplatesQuery.graphql";
import {
  SetJobBriefingMutation,
  ApplyBriefingTemplateMutation,
} from "@/api/mutations/BriefingTemplateMutations";
import type { BriefingTemplateMutations_SetJobBriefingMutation } from "@/api/mutations/__generated__/BriefingTemplateMutations_SetJobBriefingMutation.graphql";
import type { BriefingTemplateMutations_ApplyMutation } from "@/api/mutations/__generated__/BriefingTemplateMutations_ApplyMutation.graphql";

interface Props {
  jobId: string;
}

export default function JobBriefingPanel({ jobId }: Props) {
  return (
    <Suspense
      fallback={
        <div className="spark-card p-5 text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>
          Loading briefing…
        </div>
      }
    >
      <Inner jobId={jobId} />
    </Suspense>
  );
}

const Inner: React.FC<Props> = ({ jobId }) => {
  const { tenantId } = useAuthStore();
  const data = useLazyLoadQuery<JobBriefingQueryType>(
    JobBriefingQuery,
    { jobId },
    { fetchPolicy: "network-only" },
  );
  const templates = useLazyLoadQuery<BriefingTemplatesQueryType>(
    BriefingTemplatesQuery,
    { tenantId: tenantId ?? null, includeArchived: false },
    { fetchPolicy: "store-or-network" },
  );

  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(data.jobBriefing?.title ?? "");
  const [body, setBody] = useState(data.jobBriefing?.body ?? "");
  const [attachments, setAttachments] = useState(
    (data.jobBriefing?.attachments ?? []).map((a) => ({ ...a })),
  );
  const [draftName, setDraftName] = useState("");
  const [draftUrl, setDraftUrl] = useState("");

  const [commitSet, saving] =
    useMutation<BriefingTemplateMutations_SetJobBriefingMutation>(
      SetJobBriefingMutation,
    );
  const [commitApply, applying] =
    useMutation<BriefingTemplateMutations_ApplyMutation>(
      ApplyBriefingTemplateMutation,
    );

  const inflight = saving || applying;

  const applyTemplate = (templateId: string) => {
    if (!templateId) return;
    if (
      data.jobBriefing?.title &&
      !confirm("This will overwrite the current briefing on this job. Proceed?")
    )
      return;
    commitApply({
      variables: { input: { jobId, templateId } },
      onCompleted: (resp) => {
        if (resp.applyBriefingTemplate?.success) window.location.reload();
        else alert(resp.applyBriefingTemplate?.message ?? "Apply failed.");
      },
    });
  };

  const save = () => {
    commitSet({
      variables: {
        input: {
          jobId,
          title,
          body,
          attachments: attachments.map((a) => ({
            name: a.name,
            url: a.url,
            contentType: a.contentType || null,
            size: a.size ?? null,
          })),
        },
      },
      onCompleted: (resp) => {
        if (resp.setJobBriefing?.success) {
          setEditing(false);
          window.location.reload();
        } else {
          alert(resp.setJobBriefing?.message ?? "Save failed.");
        }
      },
    });
  };

  const briefing = data.jobBriefing;
  const hasBriefing = (briefing?.title?.length ?? 0) > 0 ||
    (briefing?.body?.length ?? 0) > 0 ||
    (briefing?.attachments?.length ?? 0) > 0;

  return (
    <div className="spark-card p-5 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p
            className="mono text-[10px]"
            style={{ letterSpacing: "0.18em", color: "rgba(255,255,255,0.45)" }}
          >
            BA BRIEFING
          </p>
          <h2 className="display text-xl font-bold mt-1">
            {briefing?.title || (
              <span style={{ color: "rgba(255,255,255,0.4)" }}>
                No briefing yet
              </span>
            )}
          </h2>
        </div>
        <div className="flex gap-2 flex-wrap">
          {templates.briefingTemplates && templates.briefingTemplates.length > 0 && (
            <select
              onChange={(e) => applyTemplate(e.target.value)}
              defaultValue=""
              disabled={inflight}
              style={{
                background: "rgba(255,255,255,0.04)",
                color: "rgba(255,255,255,0.85)",
                border: "1px solid rgba(255,255,255,0.10)",
                borderRadius: 10,
                padding: "6px 10px",
                fontSize: 13,
              }}
            >
              <option value="">Apply template…</option>
              {templates.briefingTemplates.map((t) => (
                <option key={t.uuid} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          )}
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="px-3 py-1.5 rounded-md text-xs font-semibold"
              style={{
                background: "var(--spark-lime)",
                color: "#0a0d09",
              }}
            >
              {hasBriefing ? "Edit briefing" : "+ Add briefing"}
            </button>
          )}
        </div>
      </div>

      {!editing ? (
        <ReadView briefing={briefing} hasBriefing={hasBriefing} />
      ) : (
        <EditView
          title={title}
          body={body}
          attachments={attachments}
          draftName={draftName}
          draftUrl={draftUrl}
          inflight={inflight}
          onTitle={setTitle}
          onBody={setBody}
          onAddDraft={() => {
            if (!draftName.trim() || !draftUrl.trim()) return;
            setAttachments([
              ...attachments,
              {
                uuid: `pending-${Date.now()}`,
                name: draftName.trim(),
                url: draftUrl.trim(),
                contentType: "",
                size: null,
              },
            ]);
            setDraftName("");
            setDraftUrl("");
          }}
          onDraftName={setDraftName}
          onDraftUrl={setDraftUrl}
          onRemoveAttachment={(uuid) =>
            setAttachments(attachments.filter((a) => a.uuid !== uuid))
          }
          onSave={save}
          onCancel={() => {
            setEditing(false);
            setTitle(briefing?.title ?? "");
            setBody(briefing?.body ?? "");
            setAttachments((briefing?.attachments ?? []).map((a) => ({ ...a })));
          }}
        />
      )}
    </div>
  );
};

const ReadView: React.FC<{
  briefing: { body: string; attachments: ReadonlyArray<{ uuid: string; name: string; url: string }> } | null | undefined;
  hasBriefing: boolean;
}> = ({ briefing, hasBriefing }) => {
  if (!hasBriefing)
    return (
      <p className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
        Add a briefing so the BA knows the brand, the store, and the
        cadence before they arrive. Pick a saved template above or write
        a fresh one.
      </p>
    );
  return (
    <div className="space-y-3">
      {briefing?.body && (
        <pre
          className="text-sm whitespace-pre-wrap"
          style={{
            color: "rgba(255,255,255,0.8)",
            fontFamily: "inherit",
            lineHeight: 1.55,
          }}
        >
          {briefing.body}
        </pre>
      )}
      {briefing?.attachments && briefing.attachments.length > 0 && (
        <div>
          <p
            className="mono text-[10px] mb-1"
            style={{ letterSpacing: "0.18em", color: "rgba(255,255,255,0.45)" }}
          >
            ATTACHMENTS · {briefing.attachments.length}
          </p>
          <div className="space-y-1.5">
            {briefing.attachments.map((a) => (
              <a
                key={a.uuid}
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-sm font-semibold underline"
                style={{ color: "var(--spark-sky)" }}
              >
                📎 {a.name}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const EditView: React.FC<{
  title: string;
  body: string;
  attachments: Array<{ uuid: string; name: string; url: string }>;
  draftName: string;
  draftUrl: string;
  inflight: boolean;
  onTitle: (v: string) => void;
  onBody: (v: string) => void;
  onAddDraft: () => void;
  onDraftName: (v: string) => void;
  onDraftUrl: (v: string) => void;
  onRemoveAttachment: (uuid: string) => void;
  onSave: () => void;
  onCancel: () => void;
}> = (p) => {
  return (
    <div className="space-y-3">
      <input
        value={p.title}
        onChange={(e) => p.onTitle(e.target.value)}
        placeholder="Briefing title (e.g. Liquid Death · Whole Foods PDX)"
        style={inputStyle}
      />
      <textarea
        value={p.body}
        onChange={(e) => p.onBody(e.target.value)}
        rows={8}
        placeholder="Briefing body…"
        style={{ ...inputStyle, fontFamily: "inherit", resize: "vertical" }}
      />
      <div className="space-y-2">
        {p.attachments.map((a) => (
          <div
            key={a.uuid}
            className="flex items-center justify-between gap-2 px-3 py-2 rounded-md"
            style={{ background: "rgba(255,255,255,0.04)" }}
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate">{a.name}</p>
              <p
                className="text-xs truncate"
                style={{ color: "rgba(255,255,255,0.45)" }}
              >
                {a.url}
              </p>
            </div>
            <button
              onClick={() => p.onRemoveAttachment(a.uuid)}
              style={{ color: "var(--spark-orange)" }}
              className="text-xs"
            >
              Remove
            </button>
          </div>
        ))}
        <div className="flex gap-2">
          <input
            value={p.draftName}
            onChange={(e) => p.onDraftName(e.target.value)}
            placeholder="Attachment name"
            style={{ ...inputStyle, flex: 1 }}
          />
          <input
            value={p.draftUrl}
            onChange={(e) => p.onDraftUrl(e.target.value)}
            placeholder="https://…"
            style={{ ...inputStyle, flex: 2 }}
          />
          <button
            onClick={p.onAddDraft}
            className="px-3 py-2 rounded-md text-xs font-semibold"
            style={{
              background: "transparent",
              border: "1px solid var(--spark-border)",
              color: "var(--spark-text)",
            }}
          >
            + Add
          </button>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={p.onSave}
          disabled={p.inflight}
          className="px-4 py-2 rounded-xl text-sm font-semibold"
          style={{
            background: "var(--spark-lime)",
            color: "#0a0d09",
            opacity: p.inflight ? 0.5 : 1,
          }}
        >
          Save briefing
        </button>
        <button
          onClick={p.onCancel}
          disabled={p.inflight}
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
