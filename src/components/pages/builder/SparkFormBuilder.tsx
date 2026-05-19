import { useEffect, useMemo, useState } from "react";
import Layout from "@/layout/Layout";
import { useAuthStore } from "@/store/authStore";
import { useAlertStore } from "@/store/alertStore";

/**
 * Spark v2 — Custom Form Builder.
 *
 * Lets admins define custom request types per tenant with their own field
 * sets. The form definition persists to localStorage v1; backend support
 * is the next step (CreateRequestType + a CustomField model + mutations
 * to add/remove fields per type). When wired, the public form at
 * /spark-form/:slug + the internal /requests/create form both read from
 * these definitions to render the right fields.
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

const STORAGE_KEY = (tenantId: string) => `@spark.formBuilder/${tenantId}`;

const newField = (): CustomField => ({
  id: `f_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
  label: "New field",
  kind: "text",
  required: false,
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
            ? "rgba(197,245,70,0.10)"
            : "transparent",
          border: `1px solid ${field.required ? "rgba(197,245,70,0.4)" : "var(--spark-border)"}`,
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

export default function SparkFormBuilder() {
  const { tenantId } = useAuthStore();
  const showAlert = useAlertStore((s) => s.showAlert);
  const [defs, setDefs] = useState<FormDef[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId) return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY(tenantId));
      setDefs(raw ? JSON.parse(raw) : []);
    } catch {
      setDefs([]);
    }
  }, [tenantId]);

  const persist = (next: FormDef[]) => {
    if (!tenantId) return;
    localStorage.setItem(STORAGE_KEY(tenantId), JSON.stringify(next));
    setDefs(next);
  };

  const editing = useMemo(
    () => defs.find((d) => d.id === editingId),
    [defs, editingId],
  );

  const createNew = () => {
    const def: FormDef = {
      id: `def_${Date.now()}`,
      name: "Untitled form",
      description: "",
      internal: true,
      external: false,
      fields: [newField()],
      updatedAt: new Date().toISOString(),
    };
    persist([def, ...defs]);
    setEditingId(def.id);
  };

  const updateEditing = (patch: Partial<FormDef>) => {
    if (!editing) return;
    const next = defs.map((d) =>
      d.id === editing.id
        ? { ...d, ...patch, updatedAt: new Date().toISOString() }
        : d,
    );
    persist(next);
  };

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
          {!editing && (
            <button
              onClick={createNew}
              className="px-5 py-3 rounded-2xl text-sm font-semibold"
              style={{
                background: "var(--spark-lime)",
                color: "#0a0d09",
                boxShadow: "0 0 20px rgba(197,245,70,0.35)",
              }}
            >
              + New form
            </button>
          )}
        </div>

        {!editing && (
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
                  className="px-5 py-3 rounded-2xl text-sm font-semibold"
                  style={{
                    background: "var(--spark-lime)",
                    color: "#0a0d09",
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
                    onEdit={() => setEditingId(d.id)}
                    onDelete={() => {
                      if (!confirm(`Delete "${d.name}"?`)) return;
                      persist(defs.filter((x) => x.id !== d.id));
                    }}
                    onDuplicate={() => {
                      const copy: FormDef = {
                        ...d,
                        id: `def_${Date.now()}`,
                        name: `${d.name} (copy)`,
                        updatedAt: new Date().toISOString(),
                      };
                      persist([copy, ...defs]);
                    }}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {editing && (
          <div className="space-y-5">
            <button
              onClick={() => setEditingId(null)}
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
                    value={editing.name}
                    onChange={(e) =>
                      updateEditing({ name: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="label-mini block mb-1.5">Description</label>
                  <input
                    style={inputStyle}
                    value={editing.description}
                    onChange={(e) =>
                      updateEditing({ description: e.target.value })
                    }
                    placeholder="What this form is for"
                  />
                </div>
              </div>
              <div className="flex gap-3 flex-wrap">
                <label
                  className="flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer text-sm"
                  style={{
                    background: editing.internal
                      ? "rgba(197,245,70,0.10)"
                      : "rgba(255,255,255,0.025)",
                    border: `1px solid ${editing.internal ? "rgba(197,245,70,0.4)" : "var(--spark-border)"}`,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={editing.internal}
                    onChange={(e) =>
                      updateEditing({ internal: e.target.checked })
                    }
                    style={{ accentColor: "var(--spark-lime)" }}
                  />
                  Publish to internal /requests/create
                </label>
                <label
                  className="flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer text-sm"
                  style={{
                    background: editing.external
                      ? "rgba(95,184,239,0.10)"
                      : "rgba(255,255,255,0.025)",
                    border: `1px solid ${editing.external ? "rgba(95,184,239,0.4)" : "var(--spark-border)"}`,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={editing.external}
                    onChange={(e) =>
                      updateEditing({ external: e.target.checked })
                    }
                    style={{ accentColor: "var(--spark-sky)" }}
                  />
                  Publish to public /spark-form/&lt;slug&gt;
                </label>
              </div>
            </div>

            <div className="space-y-3">
              {editing.fields.map((f, idx) => (
                <FieldRow
                  key={f.id}
                  field={f}
                  onChange={(next) =>
                    updateEditing({
                      fields: editing.fields.map((x) =>
                        x.id === f.id ? next : x,
                      ),
                    })
                  }
                  onRemove={() =>
                    updateEditing({
                      fields: editing.fields.filter((x) => x.id !== f.id),
                    })
                  }
                  onMoveUp={() => {
                    if (idx === 0) return;
                    const next = [...editing.fields];
                    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                    updateEditing({ fields: next });
                  }}
                  onMoveDown={() => {
                    if (idx === editing.fields.length - 1) return;
                    const next = [...editing.fields];
                    [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
                    updateEditing({ fields: next });
                  }}
                />
              ))}
              <button
                onClick={() =>
                  updateEditing({
                    fields: [...editing.fields, newField()],
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
                BACKEND WIRING PENDING
              </p>
              <p
                className="mt-2 text-sm"
                style={{ color: "rgba(255,255,255,0.75)" }}
              >
                Form definitions persist to localStorage for now. To make
                them render in the internal + external request forms,
                we need backend mutations to (a) save the form definition,
                (b) attach custom fields to a RequestType, and (c) read
                them on form load. Schedule the backend work and I'll wire
                the mutations.
              </p>
              <button
                onClick={() => {
                  if (!editing.name.trim()) {
                    showAlert("Give the form a name first.", "warning");
                    return;
                  }
                  showAlert(
                    "Form saved locally. Backend persistence ships next.",
                    "success",
                  );
                }}
                className="mt-3 px-4 py-2 rounded-xl text-sm font-semibold"
                style={{
                  background: "var(--spark-lime)",
                  color: "#0a0d09",
                  boxShadow: "0 0 14px rgba(197,245,70,0.25)",
                }}
              >
                Save (local) →
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
