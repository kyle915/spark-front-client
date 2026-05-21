/**
 * BA Briefing Templates manager.
 *
 * Per-tenant CRUD for reusable briefings (title, body, attachments).
 * Designed as a slide-over panel on the Jobs page — admins click
 * "📋 Templates" to manage; the saved templates show up in the Post
 * Job modal as a one-click apply.
 *
 * Attachments are stored as URLs (paste a GCS link or any public URL).
 * Uploading files directly is a Phase-2 — the BA app already renders
 * whatever URL we hand it.
 */
import { Suspense, useState } from "react";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { useAuthStore } from "@/store/authStore";
import { BriefingTemplatesQuery } from "@/api/queries/BriefingTemplatesQuery";
import type { BriefingTemplatesQuery as BriefingTemplatesQueryType } from "@api/queries/__generated__/BriefingTemplatesQuery.graphql";
import {
  CreateBriefingTemplateMutation,
  UpdateBriefingTemplateMutation,
  ArchiveBriefingTemplateMutation,
} from "@/api/mutations/BriefingTemplateMutations";
import type { BriefingTemplateMutations_CreateMutation } from "@/api/mutations/__generated__/BriefingTemplateMutations_CreateMutation.graphql";
import type { BriefingTemplateMutations_UpdateMutation } from "@/api/mutations/__generated__/BriefingTemplateMutations_UpdateMutation.graphql";
import type { BriefingTemplateMutations_ArchiveMutation } from "@/api/mutations/__generated__/BriefingTemplateMutations_ArchiveMutation.graphql";

type TemplateRow = {
  id: string;
  uuid: string;
  name: string;
  title: string;
  body: string;
  attachments: Array<{
    uuid: string;
    name: string;
    url: string;
    contentType: string;
    size: number | null | undefined;
  }>;
};

type Attachment = TemplateRow["attachments"][number];

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function BriefingTemplatesPanel({ open, onClose }: Props) {
  if (!open) return null;
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        zIndex: 50,
        display: "flex",
        justifyContent: "flex-end",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(720px, 100vw)",
          height: "100vh",
          background: "var(--spark-bg)",
          borderLeft: "1px solid var(--spark-border)",
          overflowY: "auto",
        }}
      >
        <Suspense
          fallback={
            <div className="p-8 text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>
              Loading templates…
            </div>
          }
        >
          <BriefingTemplatesInner onClose={onClose} />
        </Suspense>
      </div>
    </div>
  );
}

const BriefingTemplatesInner: React.FC<{ onClose: () => void }> = ({
  onClose,
}) => {
  const { tenantId } = useAuthStore();
  const data = useLazyLoadQuery<BriefingTemplatesQueryType>(
    BriefingTemplatesQuery,
    { tenantId: tenantId ?? null, includeArchived: false },
    { fetchPolicy: "network-only" },
  );
  const [editing, setEditing] = useState<TemplateRow | null>(null);
  const [creating, setCreating] = useState(false);

  const templates: TemplateRow[] = (data?.briefingTemplates ?? []).map((t) => ({
    id: String(t.id),
    uuid: String(t.uuid),
    name: t.name,
    title: t.title,
    body: t.body,
    attachments: (t.attachments ?? []).map((a) => ({ ...a })),
  }));

  if (editing) {
    return (
      <TemplateEditor
        template={editing}
        onSaved={() => {
          setEditing(null);
          // Cheap reload — hard nav.
          window.location.reload();
        }}
        onCancel={() => setEditing(null)}
      />
    );
  }
  if (creating) {
    return (
      <TemplateEditor
        template={null}
        onSaved={() => {
          setCreating(false);
          window.location.reload();
        }}
        onCancel={() => setCreating(false)}
      />
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p
            className="mono text-[10px]"
            style={{ letterSpacing: "0.18em", color: "rgba(255,255,255,0.45)" }}
          >
            BA BRIEFING TEMPLATES
          </p>
          <h2
            className="display text-2xl font-bold mt-1"
            style={{ letterSpacing: "-0.03em" }}
          >
            Briefings the BA sees on every shift
          </h2>
        </div>
        <button
          onClick={onClose}
          className="text-sm"
          style={{ color: "rgba(255,255,255,0.55)" }}
        >
          ✕ Close
        </button>
      </div>

      <button
        onClick={() => setCreating(true)}
        className="px-4 py-2 rounded-xl text-sm font-semibold"
        style={{
          background: "var(--spark-lime)",
          color: "#0a0d09",
          boxShadow: "0 0 18px rgba(197,245,70,0.35)",
        }}
      >
        + New briefing template
      </button>

      {templates.length === 0 ? (
        <div
          className="spark-card p-8 text-center text-sm"
          style={{ color: "rgba(255,255,255,0.55)" }}
        >
          No templates yet. Create one to fast-fill briefings on every job.
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((t) => (
            <div key={t.uuid} className="spark-card p-4 hov">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold">{t.name}</h3>
                  <p
                    className="text-sm mt-1 truncate"
                    style={{ color: "rgba(255,255,255,0.65)" }}
                  >
                    {t.title || <span style={{ opacity: 0.4 }}>(no title)</span>}
                  </p>
                  <div className="flex gap-3 items-center mt-2 text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
                    <span>📄 {t.attachments.length} attachment{t.attachments.length === 1 ? "" : "s"}</span>
                    <span>·</span>
                    <span>{t.body.length > 0 ? `${t.body.length} chars body` : "no body"}</span>
                  </div>
                </div>
                <button
                  onClick={() => setEditing(t)}
                  className="px-3 py-1.5 rounded-md text-xs font-semibold"
                  style={{
                    background: "transparent",
                    border: "1px solid var(--spark-border)",
                    color: "var(--spark-text)",
                  }}
                >
                  Edit
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/* ─────────────────── editor (create / edit) ─────────────────── */

const TemplateEditor: React.FC<{
  template: TemplateRow | null;
  onSaved: () => void;
  onCancel: () => void;
}> = ({ template, onSaved, onCancel }) => {
  const { tenantId } = useAuthStore();
  const [name, setName] = useState(template?.name ?? "");
  const [title, setTitle] = useState(template?.title ?? "");
  const [body, setBody] = useState(template?.body ?? "");
  const [attachments, setAttachments] = useState<Attachment[]>(
    template?.attachments ?? [],
  );
  const [draftName, setDraftName] = useState("");
  const [draftUrl, setDraftUrl] = useState("");

  const [commitCreate, creating] =
    useMutation<BriefingTemplateMutations_CreateMutation>(
      CreateBriefingTemplateMutation,
    );
  const [commitUpdate, updating] =
    useMutation<BriefingTemplateMutations_UpdateMutation>(
      UpdateBriefingTemplateMutation,
    );
  const [commitArchive, archiving] =
    useMutation<BriefingTemplateMutations_ArchiveMutation>(
      ArchiveBriefingTemplateMutation,
    );

  const inflight = creating || updating || archiving;

  const addAttachment = () => {
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
  };
  const removeAttachment = (uuid: string) =>
    setAttachments(attachments.filter((a) => a.uuid !== uuid));

  const save = () => {
    if (!name.trim()) {
      alert("Template name is required.");
      return;
    }
    const attsPayload = attachments.map((a) => ({
      name: a.name,
      url: a.url,
      contentType: a.contentType || null,
      size: a.size ?? null,
    }));
    if (template) {
      commitUpdate({
        variables: {
          input: {
            templateId: template.id,
            name,
            title,
            body,
            attachments: attsPayload,
          },
        },
        onCompleted: (resp) => {
          if (resp.updateBriefingTemplate?.success) onSaved();
          else alert(resp.updateBriefingTemplate?.message ?? "Save failed.");
        },
      });
    } else {
      commitCreate({
        variables: {
          input: {
            tenantId: tenantId ?? null,
            name,
            title,
            body,
            attachments: attsPayload,
          },
        },
        onCompleted: (resp) => {
          if (resp.createBriefingTemplate?.success) onSaved();
          else alert(resp.createBriefingTemplate?.message ?? "Save failed.");
        },
      });
    }
  };

  const archive = () => {
    if (!template) return;
    if (!confirm("Archive this template?")) return;
    commitArchive({
      variables: { input: { templateId: template.id } },
      onCompleted: () => onSaved(),
    });
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p
            className="mono text-[10px]"
            style={{ letterSpacing: "0.18em", color: "rgba(255,255,255,0.45)" }}
          >
            {template ? "EDIT TEMPLATE" : "NEW TEMPLATE"}
          </p>
          <h2 className="display text-2xl font-bold mt-1">
            {template?.name ?? "Untitled briefing"}
          </h2>
        </div>
        <button
          onClick={onCancel}
          className="text-sm"
          style={{ color: "rgba(255,255,255,0.55)" }}
        >
          ← Back
        </button>
      </div>

      <Field label="Template name" hint="Internal — what admins see in the picker.">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Liquid Death · Whole Foods PDX"
          className="spark-input"
          style={inputStyle}
        />
      </Field>

      <Field
        label="Briefing title"
        hint="Shown to the BA above the body on the job detail screen."
      >
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Setup, sampling cadence, and uniform"
          style={inputStyle}
        />
      </Field>

      <Field label="Briefing body" hint="Plain text or simple Markdown.">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={10}
          placeholder="Arrive 15 minutes early. Check in with store manager. Sample…"
          style={{ ...inputStyle, fontFamily: "inherit", resize: "vertical" }}
        />
      </Field>

      <Field
        label="Attachments"
        hint="Add any GCS or public URL. PDFs, decks, photos — the BA app lists them all."
      >
        <div className="space-y-2">
          {attachments.map((a) => (
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
                onClick={() => removeAttachment(a.uuid)}
                style={{ color: "var(--spark-orange)" }}
                className="text-xs"
              >
                Remove
              </button>
            </div>
          ))}
          <div className="flex gap-2">
            <input
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              placeholder="Display name"
              style={{ ...inputStyle, flex: 1 }}
            />
            <input
              value={draftUrl}
              onChange={(e) => setDraftUrl(e.target.value)}
              placeholder="https://…"
              style={{ ...inputStyle, flex: 2 }}
            />
            <button
              onClick={addAttachment}
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
      </Field>

      <div className="flex gap-2 pt-4 flex-wrap">
        <button
          onClick={save}
          disabled={inflight}
          className="px-4 py-2 rounded-xl text-sm font-semibold"
          style={{
            background: "var(--spark-lime)",
            color: "#0a0d09",
            opacity: inflight ? 0.5 : 1,
          }}
        >
          {template ? "Save changes" : "Create template"}
        </button>
        <button
          onClick={onCancel}
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
        {template && (
          <button
            onClick={archive}
            disabled={inflight}
            className="px-4 py-2 rounded-xl text-sm ml-auto"
            style={{
              background: "transparent",
              border: "1px solid var(--spark-orange)",
              color: "var(--spark-orange)",
            }}
          >
            Archive
          </button>
        )}
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
