import React, { Suspense, useMemo, useState } from "react";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import Layout from "@/layout/Layout";
import { useAuthStore } from "@/store/authStore";
import { useAlertStore } from "@/store/alertStore";
import { TenantFormsQuery } from "@/api/queries/TenantFormsQuery";
import type { TenantFormsQuery as TenantFormsQueryType } from "@api/queries/__generated__/TenantFormsQuery.graphql";
import { SaveFormMutation } from "@/api/mutations/SaveFormMutation";
import type { SaveFormMutation as SaveFormMutationType } from "@api/mutations/__generated__/SaveFormMutation.graphql";
import { UpdateFormMutation } from "@/api/mutations/UpdateFormMutation";
import type { UpdateFormMutation as UpdateFormMutationType } from "@api/mutations/__generated__/UpdateFormMutation.graphql";
import { DeleteFormMutation } from "@/api/mutations/DeleteFormMutation";
import type { DeleteFormMutation as DeleteFormMutationType } from "@api/mutations/__generated__/DeleteFormMutation.graphql";

/**
 * Spark v2 — Custom Form Builder.
 *
 * Lets admins define custom request types per tenant with their own field
 * sets. Form definitions persist to the tenantForms / saveForm / updateForm
 * / deleteForm backend (Relay), scoped to the active tenant. When wired,
 * the public form at /spark-form/:slug + the internal /requests/create form
 * both read from these definitions to render the right fields.
 *
 * FE↔backend mapping: only `name` + `isPublished` are top-level columns;
 * everything else (description, internal/external targets, the field list)
 * rides in the opaque `schema` JSON blob. A form is "published"
 * (isPublished) when it targets internal or external. On load we
 * reconstruct each FormDef from { id, name, ...schema, updatedAt }.
 */

type FieldKind =
  | "text"
  | "longtext"
  | "number"
  | "email"
  | "date"
  | "time"
  | "select"
  | "checkbox"
  | "file";

type CustomField = {
  id: string;
  label: string;
  kind: FieldKind;
  required: boolean;
  helpText?: string;
  options?: string[]; // for select
};

type FormDef = {
  id: string;
  name: string;
  description: string;
  internal: boolean; // visible on /requests/create
  external: boolean; // visible on /spark-form/:slug
  fields: CustomField[];
  updatedAt: string;
};

// Shape of the opaque `schema` JSON blob stored per form. The backend
// types it as a plain JSON scalar (TS `any`), so we cast at the boundary
// and apply defensive defaults for anything missing.
type FormSchemaBlob = {
  description?: string;
  internal?: boolean;
  external?: boolean;
  fields?: CustomField[];
};

const KIND_LABEL: Record<FieldKind, string> = {
  text: "Short text",
  longtext: "Long text",
  number: "Number",
  email: "Email",
  date: "Date",
  time: "Time",
  select: "Dropdown",
  checkbox: "Checkbox",
  file: "File upload",
};

const newField = (): CustomField => ({
  id: `f_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
  label: "New field",
  kind: "text",
  required: false,
});

/**
 * Reconstruct the FE's FormDef from a backend CustomFormType row: id /
 * name / updatedAt come from top-level columns, the rest is spread out
 * of the `schema` JSON blob with defensive defaults.
 */
const toFormDef = (row: {
  readonly id: string;
  readonly name: string;
  readonly schema: unknown;
  readonly updatedAt: string;
}): FormDef => {
  const blob = (row.schema ?? {}) as FormSchemaBlob;
  return {
    id: row.id,
    name: row.name,
    description: blob.description ?? "",
    internal: blob.internal ?? false,
    external: blob.external ?? false,
    fields: Array.isArray(blob.fields) ? blob.fields : [],
    updatedAt: row.updatedAt,
  };
};

/** Pack a FormDef back into the { schema blob, isPublished } the backend wants. */
const toSchemaBlob = (def: FormDef): FormSchemaBlob => ({
  description: def.description,
  internal: def.internal,
  external: def.external,
  fields: def.fields,
});

const inputStyle: React.CSSProperties = {
  background: "var(--spark-bg)",
  border: "1px solid var(--spark-border)",
  borderRadius: 10,
  padding: "0.55rem 0.8rem",
  color: "var(--spark-text)",
  fontSize: "0.875rem",
  outline: "none",
  width: "100%",
};

const FieldRow: React.FC<{
  field: CustomField;
  onChange: (next: CustomField) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}> = ({ field, onChange, onRemove, onMoveUp, onMoveDown }) => (
  <div
    className="rounded-xl p-4"
    style={{
      background: "rgba(255,255,255,0.025)",
      border: "1px solid var(--spark-border)",
    }}
  >
    <div className="grid sm:grid-cols-[1fr_180px_auto_auto] gap-2 items-center">
      <input
        style={inputStyle}
        value={field.label}
        onChange={(e) => onChange({ ...field, label: e.target.value })}
        placeholder="Field label"
      />
      <select
        style={inputStyle}
        value={field.kind}
        onChange={(e) =>
          onChange({ ...field, kind: e.target.value as FieldKind })
        }
      >
        {(
          Object.keys(KIND_LABEL) as FieldKind[]
        ).map((k) => (
          <option key={k} value={k}>
            {KIND_LABEL[k]}
          </option>
        ))}
      </select>
      <label
        className="flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer"
        style={{
          background: field.required
            ? "rgba(242,243,238,0.10)"
            : "transparent",
          border: `1px solid ${field.required ? "rgba(242,243,238,0.4)" : "var(--spark-border)"}`,
          color: field.required ? "var(--spark-lime)" : "rgba(255,255,255,0.65)",
          fontSize: "0.75rem",
          fontFamily: "JetBrains Mono, monospace",
          letterSpacing: "0.14em",
          whiteSpace: "nowrap",
        }}
      >
        <input
          type="checkbox"
          checked={field.required}
          onChange={(e) =>
            onChange({ ...field, required: e.target.checked })
          }
          style={{ accentColor: "var(--spark-lime)" }}
        />
        REQUIRED
      </label>
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={onMoveUp}
          title="Move up"
          className="w-7 h-7 rounded-md text-xs"
          style={{
            background: "transparent",
            color: "rgba(255,255,255,0.55)",
            border: "1px solid var(--spark-border)",
          }}
        >
          ↑
        </button>
        <button
          onClick={onMoveDown}
          title="Move down"
          className="w-7 h-7 rounded-md text-xs"
          style={{
            background: "transparent",
            color: "rgba(255,255,255,0.55)",
            border: "1px solid var(--spark-border)",
          }}
        >
          ↓
        </button>
        <button
          onClick={onRemove}
          title="Remove"
          className="w-7 h-7 rounded-md text-xs"
          style={{
            background: "transparent",
            color: "var(--spark-orange)",
            border: "1px solid rgba(255,138,76,0.3)",
          }}
        >
          ×
        </button>
      </div>
    </div>
    {field.kind === "select" && (
      <div className="mt-2">
        <input
          style={inputStyle}
          value={(field.options ?? []).join(", ")}
          onChange={(e) =>
            onChange({
              ...field,
              options: e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
          placeholder="Comma-separated options: Retail, On-premise, Event"
        />
      </div>
    )}
    <div className="mt-2">
      <input
        style={{ ...inputStyle, fontSize: "0.8rem" }}
        value={field.helpText ?? ""}
        onChange={(e) => onChange({ ...field, helpText: e.target.value })}
        placeholder="Help text (optional)"
      />
    </div>
  </div>
);

const FormDefCard: React.FC<{
  def: FormDef;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}> = ({ def, onEdit, onDelete, onDuplicate }) => (
  <div
    className="spark-card hov p-5 cursor-pointer"
    onClick={onEdit}
  >
    <div className="flex items-center justify-between mb-2">
      <span
        className="mono text-[10px]"
        style={{
          letterSpacing: "0.16em",
          color: "var(--spark-lime)",
        }}
      >
        FORM · {def.fields.length} FIELD
        {def.fields.length === 1 ? "" : "S"}
      </span>
      <div className="flex gap-1">
        {def.internal && (
          <span className="chip chip-lime">INTERNAL</span>
        )}
        {def.external && (
          <span className="chip chip-sky">EXTERNAL</span>
        )}
      </div>
    </div>
    <h3
      className="display text-lg font-bold mb-1"
      style={{ letterSpacing: "-0.02em" }}
    >
      {def.name}
    </h3>
    {def.description && (
      <p
        className="text-xs"
        style={{ color: "rgba(255,255,255,0.55)" }}
      >
        {def.description}
      </p>
    )}
    <div className="flex items-center justify-between mt-4">
      <span
        className="mono text-[10px]"
        style={{
          letterSpacing: "0.16em",
          color: "rgba(255,255,255,0.4)",
        }}
      >
        UPDATED · {new Date(def.updatedAt).toLocaleDateString()}
      </span>
      <div className="flex gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDuplicate();
          }}
          className="mono text-[10px]"
          style={{
            letterSpacing: "0.14em",
            color: "rgba(255,255,255,0.55)",
          }}
        >
          DUPLICATE
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="mono text-[10px]"
          style={{
            letterSpacing: "0.14em",
            color: "var(--spark-orange)",
          }}
        >
          DELETE
        </button>
      </div>
    </div>
  </div>
);

const Inner: React.FC<{ tenantId: string }> = ({ tenantId }) => {
  const showAlert = useAlertStore((s) => s.showAlert);

  // Bumped after every create/update/delete so the list re-queries the
  // network and the change shows immediately — no manual page refresh.
  const [refreshKey, setRefreshKey] = useState(0);
  const data = useLazyLoadQuery<TenantFormsQueryType>(
    TenantFormsQuery,
    { tenantId },
    { fetchPolicy: "store-and-network", fetchKey: refreshKey },
  );

  // Backend rows mapped back into the FE's FormDef shape (schema blob
  // spread out, id/name/updatedAt from the top level).
  const defs = useMemo<FormDef[]>(
    () => (data.tenantForms ?? []).map(toFormDef),
    [data],
  );

  const [editingId, setEditingId] = useState<string | null>(null);
  // Local editing buffer: the open form's edits live here for snappy
  // controlled inputs, then commit to the backend via updateForm on
  // "Save". `editingId === null` means we're on the list view.
  const [draft, setDraft] = useState<FormDef | null>(null);

  const [saveCommit, saving] =
    useMutation<SaveFormMutationType>(SaveFormMutation);
  const [updateCommit, updating] =
    useMutation<UpdateFormMutationType>(UpdateFormMutation);
  const [deleteCommit, deleting] =
    useMutation<DeleteFormMutationType>(DeleteFormMutation);
  const busy = saving || updating || deleting;

  const openEditor = (def: FormDef) => {
    setEditingId(def.id);
    setDraft(def);
  };
  const closeEditor = () => {
    setEditingId(null);
    setDraft(null);
  };

  // Create: mint a new form on the backend immediately (we need the
  // server-assigned id), then open the editor on the returned form.
  const createNew = () => {
    const seed: FormDef = {
      id: "",
      name: "Untitled form",
      description: "",
      internal: true,
      external: false,
      fields: [newField()],
      updatedAt: new Date().toISOString(),
    };
    saveCommit({
      variables: {
        input: {
          name: seed.name,
          tenantId,
          schema: toSchemaBlob(seed),
          isPublished: seed.internal || seed.external,
        },
      },
      onCompleted: (resp) => {
        const r = resp.saveForm;
        if (r?.success && r.form) {
          setRefreshKey((k) => k + 1);
          openEditor(toFormDef(r.form));
        } else {
          showAlert(r?.message || "Couldn't create form.", "error");
        }
      },
      onError: (e) => showAlert(e.message || "Couldn't create form.", "error"),
    });
  };

  // Duplicate: persist a copy of an existing form, then refetch the list.
  const duplicate = (def: FormDef) => {
    const copy: FormDef = { ...def, name: `${def.name} (copy)` };
    saveCommit({
      variables: {
        input: {
          name: copy.name,
          tenantId,
          schema: toSchemaBlob(copy),
          isPublished: copy.internal || copy.external,
        },
      },
      onCompleted: (resp) => {
        const r = resp.saveForm;
        if (r?.success) {
          showAlert("Form duplicated.", "success");
          setRefreshKey((k) => k + 1);
        } else {
          showAlert(r?.message || "Couldn't duplicate form.", "error");
        }
      },
      onError: (e) =>
        showAlert(e.message || "Couldn't duplicate form.", "error"),
    });
  };

  const remove = (def: FormDef) => {
    if (!confirm(`Delete "${def.name}"?`)) return;
    deleteCommit({
      variables: { input: { id: def.id } },
      onCompleted: (resp) => {
        const r = resp.deleteForm;
        if (r?.success) {
          showAlert("Form deleted.", "success");
          if (editingId === def.id) closeEditor();
          setRefreshKey((k) => k + 1);
        } else {
          showAlert(r?.message || "Couldn't delete form.", "error");
        }
      },
      onError: (e) => showAlert(e.message || "Couldn't delete form.", "error"),
    });
  };

  // Local-only edit of the open draft (no network until "Save").
  const patchDraft = (patch: Partial<FormDef>) => {
    setDraft((d) => (d ? { ...d, ...patch } : d));
  };

  // Persist the open draft via updateForm, then refetch the list.
  const saveDraft = () => {
    if (!draft) return;
    if (!draft.name.trim()) {
      showAlert("Give the form a name first.", "warning");
      return;
    }
    updateCommit({
      variables: {
        input: {
          id: draft.id,
          name: draft.name,
          schema: toSchemaBlob(draft),
          isPublished: draft.internal || draft.external,
        },
      },
      onCompleted: (resp) => {
        const r = resp.updateForm;
        if (r?.success) {
          showAlert("Form saved.", "success");
          if (r.form) setDraft(toFormDef(r.form));
          setRefreshKey((k) => k + 1);
        } else {
          showAlert(r?.message || "Couldn't save form.", "error");
        }
      },
      onError: (e) => showAlert(e.message || "Couldn't save form.", "error"),
    });
  };

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
            CUSTOM FORMS · {defs.length}
          </p>
          <h1
            className="display text-4xl font-bold mt-2"
            style={{ letterSpacing: "-0.04em" }}
          >
            Form builder.
          </h1>
          <p className="mt-2" style={{ color: "rgba(255,255,255,0.55)" }}>
            Design custom request forms per brand. Each form can be
            published to the internal admin queue, the public client
            link, or both.
          </p>
        </div>
        {!draft && (
          <button
            onClick={createNew}
            disabled={busy}
            className="px-5 py-3 rounded-2xl text-sm font-semibold"
            style={{
              background: "var(--spark-lime)",
              color: "#0a0d09",
              boxShadow: "0 0 20px rgba(242,243,238,0.35)",
              opacity: busy ? 0.6 : 1,
            }}
          >
            + New form
          </button>
        )}
      </div>

      {!draft && (
        <>
          {defs.length === 0 ? (
            <div
              className="spark-card p-10 text-center text-sm"
              style={{ color: "rgba(255,255,255,0.55)" }}
            >
              <p className="mb-4">
                No custom forms yet. Build one to capture brand-specific
                fields when requests come in.
              </p>
              <button
                onClick={createNew}
                disabled={busy}
                className="px-5 py-3 rounded-2xl text-sm font-semibold"
                style={{
                  background: "var(--spark-lime)",
                  color: "#0a0d09",
                  opacity: busy ? 0.6 : 1,
                }}
              >
                + Build your first form
              </button>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {defs.map((d) => (
                <FormDefCard
                  key={d.id}
                  def={d}
                  onEdit={() => openEditor(d)}
                  onDelete={() => remove(d)}
                  onDuplicate={() => duplicate(d)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {draft && (
        <div className="space-y-5">
          <button
            onClick={closeEditor}
            className="mono text-[11px] transition"
            style={{
              letterSpacing: "0.14em",
              color: "rgba(255,255,255,0.45)",
            }}
          >
            ← BACK TO FORMS
          </button>

          <div className="spark-card p-6 space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label-mini block mb-1.5">Form name</label>
                <input
                  style={inputStyle}
                  value={draft.name}
                  onChange={(e) => patchDraft({ name: e.target.value })}
                />
              </div>
              <div>
                <label className="label-mini block mb-1.5">Description</label>
                <input
                  style={inputStyle}
                  value={draft.description}
                  onChange={(e) =>
                    patchDraft({ description: e.target.value })
                  }
                  placeholder="What this form is for"
                />
              </div>
            </div>
            <div className="flex gap-3 flex-wrap">
              <label
                className="flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer text-sm"
                style={{
                  background: draft.internal
                    ? "rgba(242,243,238,0.10)"
                    : "rgba(255,255,255,0.025)",
                  border: `1px solid ${draft.internal ? "rgba(242,243,238,0.4)" : "var(--spark-border)"}`,
                }}
              >
                <input
                  type="checkbox"
                  checked={draft.internal}
                  onChange={(e) =>
                    patchDraft({ internal: e.target.checked })
                  }
                  style={{ accentColor: "var(--spark-lime)" }}
                />
                Publish to internal /requests/create
              </label>
              <label
                className="flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer text-sm"
                style={{
                  background: draft.external
                    ? "rgba(95,184,239,0.10)"
                    : "rgba(255,255,255,0.025)",
                  border: `1px solid ${draft.external ? "rgba(95,184,239,0.4)" : "var(--spark-border)"}`,
                }}
              >
                <input
                  type="checkbox"
                  checked={draft.external}
                  onChange={(e) =>
                    patchDraft({ external: e.target.checked })
                  }
                  style={{ accentColor: "var(--spark-sky)" }}
                />
                Publish to public /spark-form/&lt;slug&gt;
              </label>
            </div>
          </div>

          <div className="space-y-3">
            {draft.fields.map((f, idx) => (
              <FieldRow
                key={f.id}
                field={f}
                onChange={(next) =>
                  patchDraft({
                    fields: draft.fields.map((x) =>
                      x.id === f.id ? next : x,
                    ),
                  })
                }
                onRemove={() =>
                  patchDraft({
                    fields: draft.fields.filter((x) => x.id !== f.id),
                  })
                }
                onMoveUp={() => {
                  if (idx === 0) return;
                  const next = [...draft.fields];
                  [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                  patchDraft({ fields: next });
                }}
                onMoveDown={() => {
                  if (idx === draft.fields.length - 1) return;
                  const next = [...draft.fields];
                  [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
                  patchDraft({ fields: next });
                }}
              />
            ))}
            <button
              onClick={() =>
                patchDraft({
                  fields: [...draft.fields, newField()],
                })
              }
              className="w-full py-3 rounded-xl text-sm transition"
              style={{
                background: "transparent",
                color: "rgba(255,255,255,0.55)",
                border: "1px dashed var(--spark-border)",
              }}
            >
              + Add field
            </button>
          </div>

          <div
            className="spark-card p-5"
            style={{
              borderColor: "rgba(95,184,239,0.25)",
              background:
                "linear-gradient(180deg, rgba(95,184,239,0.06), transparent)",
            }}
          >
            <p
              className="mono text-[10px]"
              style={{
                letterSpacing: "0.16em",
                color: "var(--spark-sky)",
              }}
            >
              SAVES TO BACKEND
            </p>
            <p
              className="mt-2 text-sm"
              style={{ color: "rgba(255,255,255,0.75)" }}
            >
              Form definitions persist per brand to the Spark backend. Edits
              here stay local until you save; the internal + external request
              forms read these definitions on load.
            </p>
            <button
              onClick={saveDraft}
              disabled={busy}
              className="mt-3 px-4 py-2 rounded-xl text-sm font-semibold"
              style={{
                background: "var(--spark-lime)",
                color: "#0a0d09",
                boxShadow: "0 0 14px rgba(242,243,238,0.25)",
                opacity: busy ? 0.6 : 1,
              }}
            >
              {updating ? "Saving…" : "Save form →"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default function SparkFormBuilder() {
  const { tenantId } = useAuthStore();

  return (
    <Layout>
      <Suspense
        fallback={
          <div
            className="grid place-items-center text-xs py-12"
            style={{ color: "rgba(255,255,255,0.45)" }}
          >
            Loading forms…
          </div>
        }
      >
        {tenantId ? (
          <Inner tenantId={tenantId} />
        ) : (
          <div
            className="text-xs"
            style={{ color: "rgba(255,255,255,0.45)" }}
          >
            No tenant selected.
          </div>
        )}
      </Suspense>
    </Layout>
  );
}
