/**
 * Custom Recap Template builder — admin-only.
 *
 * Solves the last manual onboarding step for new tenants. Until now
 * we ran `onboard_<tenant>.py` management commands to spin up
 * recap templates + field rows. This page lets non-engineers do the
 * same from /recap-templates/new.
 *
 * Surface:
 *   - Tenant comes from authStore (current tenant)
 *   - Event Type picker (required — template attaches to one)
 *   - Toggles for product_samples + sales_performance bookkeeping
 *   - Section + Field rows (add / remove / reorder via insertion order)
 *   - Inline "+ New section" creates a RecapSection on the fly so
 *     a fresh tenant can build from zero without leaving the page
 *
 * Once submitted, the createCustomRecapTemplate mutation creates the
 * template + all child CustomField rows in a single transaction.
 *
 * Why not edit-in-place: the v1 builder ships create-only. Edit
 * already exists via the `updateCustomRecapTemplate` mutation but
 * the field-row UX gets noisy. We'll add an /edit/:uuid mode after
 * Nevena's first round of templates lands.
 */

import { Suspense, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import Layout from "@/layout/Layout";
import useSparkRole from "@/hooks/useSparkRole";
import { useAuthStore } from "@/store/authStore";
import { useAlertStore } from "@/store/alertStore";
import { CustomRecapTemplateBuilderQuery } from "@/api/queries/CustomRecapTemplateBuilderQuery";
import type { CustomRecapTemplateBuilderQuery as CustomRecapTemplateBuilderQueryType } from "@api/queries/__generated__/CustomRecapTemplateBuilderQuery.graphql";
import { CreateCustomRecapTemplateMutation } from "@/api/mutations/CreateCustomRecapTemplateMutation";
import type { CreateCustomRecapTemplateMutation as CreateCustomRecapTemplateMutationType } from "@api/mutations/__generated__/CreateCustomRecapTemplateMutation.graphql";
import { CreateRecapSectionMutation } from "@/api/mutations/CreateRecapSectionMutation";
import type { CreateRecapSectionMutation as CreateRecapSectionMutationType } from "@api/mutations/__generated__/CreateRecapSectionMutation.graphql";

type DraftField = {
  // Local row id — React key. Backend assigns the real id on save.
  key: string;
  name: string;
  fieldTypeId: string;
  sectionId: string;
  required: boolean;
  // Allowed choices (one per line) for dropdown / multi-select fields.
  options: string;
};

let _rowCounter = 0;
const nextKey = () => `row-${++_rowCounter}`;

const inputStyle: React.CSSProperties = {
  background: "var(--spark-bg)",
  border: "1px solid var(--spark-border)",
  borderRadius: 10,
  padding: "0.55rem 0.75rem",
  color: "var(--spark-text)",
  fontSize: "0.85rem",
  outline: "none",
  width: "100%",
};

const Inner: React.FC<{ tenantId: string }> = ({ tenantId }) => {
  const navigate = useNavigate();
  const { showAlert } = useAlertStore();
  const data = useLazyLoadQuery<CustomRecapTemplateBuilderQueryType>(
    CustomRecapTemplateBuilderQuery,
    { tenantId },
    { fetchPolicy: "store-or-network" },
  );

  const eventTypes = useMemo(
    () =>
      (data.eventTypes?.edges ?? [])
        .map((e) => e?.node)
        .filter((n): n is NonNullable<typeof n> => Boolean(n)),
    [data],
  );
  const fieldTypes = useMemo(
    () =>
      (data.customRecapFieldTypes?.edges ?? [])
        .map((e) => e?.node)
        .filter((n): n is NonNullable<typeof n> => Boolean(n)),
    [data],
  );
  const sectionsFromServer = useMemo(
    () =>
      (data.recapSections?.edges ?? [])
        .map((e) => e?.node)
        .filter((n): n is NonNullable<typeof n> => Boolean(n)),
    [data],
  );
  const existingTemplates = useMemo(
    () =>
      (data.customRecapTemplates?.edges ?? [])
        .map((e) => e?.node)
        .filter((n): n is NonNullable<typeof n> => Boolean(n)),
    [data],
  );

  // Lowercased type-name by id, so we can tell which fields are choice
  // (dropdown / multi-select) types that need an admin-defined option list.
  const typeNameById = useMemo(() => {
    const m: Record<string, string> = {};
    fieldTypes.forEach((ft) => {
      m[String(ft.id)] = (ft.name ?? "").toLowerCase();
    });
    return m;
  }, [fieldTypes]);
  const isChoiceType = (fieldTypeId: string) => {
    const n = typeNameById[String(fieldTypeId)] ?? "";
    return n === "select" || n === "multiselect";
  };
  const parseOptions = (raw: string) =>
    raw
      .split("\n")
      .map((o) => o.trim())
      .filter(Boolean);
  // Friendlier labels for the choice types in the Type dropdown.
  const typeLabel = (name: string) => {
    const n = (name ?? "").toLowerCase();
    if (n === "multiselect") return "Multi-select (choose any)";
    if (n === "select") return "Dropdown (choose one)";
    return name;
  };

  // Section list is server-side + anything the admin creates inline.
  const [localSections, setLocalSections] = useState<
    { id: string; name: string }[]
  >([]);
  const sections = useMemo(
    () => [
      ...sectionsFromServer.map((s) => ({ id: String(s.id), name: s.name })),
      ...localSections,
    ],
    [sectionsFromServer, localSections],
  );

  // ---- form state -----------------------------------------------------
  const [name, setName] = useState("");
  const [eventTypeId, setEventTypeId] = useState("");
  const [productSamples, setProductSamples] = useState(false);
  const [salesPerformance, setSalesPerformance] = useState(false);
  const [fields, setFields] = useState<DraftField[]>(() => [
    {
      key: nextKey(),
      name: "",
      fieldTypeId: "",
      sectionId: "",
      required: false,
      options: "",
    },
  ]);

  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [newSectionName, setNewSectionName] = useState("");

  const [commitCreate, isCreating] =
    useMutation<CreateCustomRecapTemplateMutationType>(
      CreateCustomRecapTemplateMutation,
    );
  const [commitSection, isCreatingSection] =
    useMutation<CreateRecapSectionMutationType>(CreateRecapSectionMutation);

  // Find a template that already targets the same EventType — flag it
  // so the admin doesn't accidentally clone an existing form.
  const dupeForEventType = useMemo(() => {
    if (!eventTypeId) return null;
    return existingTemplates.find(
      (t) => String(t.eventType?.id ?? "") === eventTypeId,
    );
  }, [eventTypeId, existingTemplates]);

  const addField = () => {
    setFields((rows) => [
      ...rows,
      {
        key: nextKey(),
        name: "",
        fieldTypeId: rows.at(-1)?.fieldTypeId ?? "",
        sectionId: rows.at(-1)?.sectionId ?? "",
        required: false,
        options: "",
      },
    ]);
  };
  const removeField = (key: string) => {
    setFields((rows) =>
      rows.length === 1 ? rows : rows.filter((r) => r.key !== key),
    );
  };
  const updateField = (key: string, patch: Partial<DraftField>) => {
    setFields((rows) =>
      rows.map((r) => (r.key === key ? { ...r, ...patch } : r)),
    );
  };

  const createSection = () => {
    const trimmed = newSectionName.trim();
    if (!trimmed) return;
    commitSection({
      variables: {
        input: { name: trimmed, tenantId },
      },
      onCompleted: (resp) => {
        const r = resp.createRecapSection;
        if (r?.success && r.recapSection) {
          setLocalSections((prev) => [
            ...prev,
            { id: String(r.recapSection!.id), name: r.recapSection!.name },
          ]);
          setNewSectionName("");
          showAlert(`Section "${trimmed}" added.`, "success");
        } else {
          showAlert(r?.message || "Couldn't create section.", "error");
        }
      },
      onError: (err) => showAlert(err.message, "error"),
    });
  };

  // Validation gates submit. Returns the first user-visible message
  // for whatever's missing, or null if good to go.
  const validate = (): string | null => {
    if (!name.trim()) return "Give the template a name.";
    if (!eventTypeId) return "Pick an event type.";
    if (fields.length === 0) return "Add at least one field.";
    for (const f of fields) {
      if (!f.name.trim()) return "Every field needs a name.";
      if (!f.fieldTypeId) return "Pick a type for every field.";
      if (!f.sectionId) return "Pick a section for every field.";
      if (isChoiceType(f.fieldTypeId) && parseOptions(f.options).length === 0)
        return `Add at least one option for "${f.name.trim() || "the multi-select field"}".`;
    }
    return null;
  };

  const handleSubmit = () => {
    setSubmitAttempted(true);
    const msg = validate();
    if (msg) {
      showAlert(msg, "error");
      return;
    }
    commitCreate({
      variables: {
        input: {
          name: name.trim(),
          eventTypeId,
          productSamples,
          salesPerformance,
          customFields: fields.map((f) => ({
            name: f.name.trim(),
            customFieldTypeId: f.fieldTypeId,
            recapSectionId: f.sectionId,
            required: f.required,
            options: isChoiceType(f.fieldTypeId) ? parseOptions(f.options) : [],
          })),
        },
      },
      onCompleted: (resp) => {
        const r = resp.createCustomRecapTemplate;
        if (r?.success) {
          showAlert(
            `Template "${name}" created with ${fields.length} field${fields.length === 1 ? "" : "s"}.`,
            "success",
          );
          navigate("/recap-templates");
        } else {
          showAlert(r?.message || "Couldn't create template.", "error");
        }
      },
      onError: (err) => showAlert(err.message, "error"),
    });
  };

  const submitDisabled = isCreating || !!validate();

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <p
          className="mono text-[10px]"
          style={{
            letterSpacing: "0.18em",
            color: "rgba(255,255,255,0.45)",
          }}
        >
          ADMIN · RECAP TEMPLATE
        </p>
        <h1
          className="display text-4xl font-bold mt-2"
          style={{ letterSpacing: "-0.04em" }}
        >
          Build a recap template.
        </h1>
        <p
          className="mt-2"
          style={{ color: "rgba(255,255,255,0.55)" }}
        >
          BAs see this form when they submit a recap for the chosen
          event type. Fields are grouped by section in the order you
          list them.
        </p>
      </div>

      {/* Basics */}
      <div className="spark-card p-5 space-y-3">
        <label className="block">
          <span
            className="label-mini block mb-1"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            Template name
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Liquid Death Retail Sampling"
            style={{
              ...inputStyle,
              borderColor:
                submitAttempted && !name.trim()
                  ? "var(--spark-orange, #ef5a2a)"
                  : "var(--spark-border)",
            }}
          />
        </label>

        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block">
            <span
              className="label-mini block mb-1"
              style={{ color: "rgba(255,255,255,0.55)" }}
            >
              Event type
            </span>
            <select
              value={eventTypeId}
              onChange={(e) => setEventTypeId(e.target.value)}
              style={{
                ...inputStyle,
                borderColor:
                  submitAttempted && !eventTypeId
                    ? "var(--spark-orange, #ef5a2a)"
                    : "var(--spark-border)",
              }}
            >
              <option value="">Select…</option>
              {eventTypes.map((et) => (
                <option key={String(et.id)} value={String(et.id)}>
                  {et.name}
                </option>
              ))}
            </select>
            {dupeForEventType && (
              <p
                className="mono text-[10px] mt-1.5"
                style={{
                  letterSpacing: "0.14em",
                  color: "var(--spark-orange, #ef5a2a)",
                }}
              >
                ⚠ A template named &ldquo;{dupeForEventType.name}&rdquo; already
                covers this event type.
              </p>
            )}
          </label>

          <div className="space-y-2">
            <span
              className="label-mini block mb-1"
              style={{ color: "rgba(255,255,255,0.55)" }}
            >
              Bookkeeping
            </span>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={productSamples}
                onChange={(e) => setProductSamples(e.target.checked)}
                className="accent-[var(--spark-lime)]"
              />
              Track sampled products
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={salesPerformance}
                onChange={(e) => setSalesPerformance(e.target.checked)}
                className="accent-[var(--spark-lime)]"
              />
              Track sales performance (cans / packs)
            </label>
          </div>
        </div>
      </div>

      {/* Sections + new section */}
      <div className="spark-card p-5">
        <p
          className="mono text-[10px] mb-2"
          style={{
            letterSpacing: "0.18em",
            color: "rgba(255,255,255,0.45)",
          }}
        >
          SECTIONS · {sections.length}
        </p>
        <p
          className="text-[12px] mb-3"
          style={{ color: "rgba(255,255,255,0.55)" }}
        >
          Sections group fields visually on the recap form (e.g.
          &ldquo;Sampling&rdquo;, &ldquo;Sales&rdquo;, &ldquo;Photos&rdquo;).
          Add new ones below — they save right away so you can attach
          fields to them.
        </p>
        <div className="flex flex-wrap gap-2 mb-3">
          {sections.length === 0 ? (
            <span
              className="text-[12px]"
              style={{ color: "rgba(255,255,255,0.45)" }}
            >
              No sections yet — add one to get started.
            </span>
          ) : (
            sections.map((s) => (
              <span
                key={s.id}
                className="mono text-[10px] px-2 py-1 rounded-full"
                style={{
                  letterSpacing: "0.14em",
                  color: "var(--spark-lime)",
                  background: "rgba(242,243,238,0.08)",
                  border: "1px solid rgba(242,243,238,0.25)",
                }}
              >
                {s.name.toUpperCase()}
              </span>
            ))
          )}
        </div>
        <div className="flex gap-2">
          <input
            value={newSectionName}
            onChange={(e) => setNewSectionName(e.target.value)}
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                newSectionName.trim() &&
                !isCreatingSection
              )
                createSection();
            }}
            placeholder="New section name (e.g. Sampling)"
            style={inputStyle}
          />
          <button
            onClick={createSection}
            disabled={!newSectionName.trim() || isCreatingSection}
            className="px-3 py-2 rounded-xl text-sm font-semibold whitespace-nowrap disabled:opacity-40"
            style={{
              background: "transparent",
              color: "var(--spark-text)",
              border: "1px solid var(--spark-border)",
            }}
          >
            {isCreatingSection ? "Adding…" : "+ Add section"}
          </button>
        </div>
      </div>

      {/* Fields */}
      <div className="spark-card p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p
              className="mono text-[10px]"
              style={{
                letterSpacing: "0.18em",
                color: "rgba(255,255,255,0.45)",
              }}
            >
              FIELDS · {fields.length}
            </p>
            <p
              className="text-[12px] mt-1"
              style={{ color: "rgba(255,255,255,0.55)" }}
            >
              Order top-to-bottom is the order BAs see them.
            </p>
          </div>
          <button
            onClick={addField}
            className="px-3 py-2 rounded-xl text-sm font-semibold whitespace-nowrap"
            style={{
              background: "transparent",
              color: "var(--spark-text)",
              border: "1px solid var(--spark-border)",
            }}
          >
            + Add field
          </button>
        </div>
        <div className="space-y-2">
          {fields.map((f, idx) => {
            const showError =
              submitAttempted &&
              (!f.name.trim() || !f.fieldTypeId || !f.sectionId);
            return (
              <div
                key={f.key}
                className="grid gap-2 items-start"
                style={{
                  gridTemplateColumns: "auto 1fr 1fr 1fr auto auto",
                  padding: "0.5rem",
                  borderRadius: 12,
                  border: `1px solid ${showError ? "var(--spark-orange, #ef5a2a)" : "var(--spark-border)"}`,
                  background: "rgba(255,255,255,0.02)",
                }}
              >
                <span
                  className="mono text-[10px] grid place-items-center"
                  style={{
                    letterSpacing: "0.16em",
                    color: "rgba(255,255,255,0.35)",
                    width: 24,
                    minHeight: 36,
                  }}
                >
                  {String(idx + 1).padStart(2, "0")}
                </span>
                <input
                  value={f.name}
                  onChange={(e) =>
                    updateField(f.key, { name: e.target.value })
                  }
                  placeholder="Field name"
                  style={inputStyle}
                />
                <select
                  value={f.fieldTypeId}
                  onChange={(e) =>
                    updateField(f.key, { fieldTypeId: e.target.value })
                  }
                  style={inputStyle}
                >
                  <option value="">Type…</option>
                  {fieldTypes.map((ft) => (
                    <option key={String(ft.id)} value={String(ft.id)}>
                      {typeLabel(ft.name)}
                    </option>
                  ))}
                </select>
                <select
                  value={f.sectionId}
                  onChange={(e) =>
                    updateField(f.key, { sectionId: e.target.value })
                  }
                  style={inputStyle}
                >
                  <option value="">Section…</option>
                  {sections.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <label
                  className="flex items-center gap-1.5 text-[11px] px-2 cursor-pointer self-center"
                  title="Required: BAs can't submit a recap if this is blank."
                >
                  <input
                    type="checkbox"
                    checked={f.required}
                    onChange={(e) =>
                      updateField(f.key, { required: e.target.checked })
                    }
                    className="accent-[var(--spark-lime)]"
                  />
                  Req
                </label>
                <button
                  onClick={() => removeField(f.key)}
                  disabled={fields.length === 1}
                  className="px-2 rounded-lg text-sm self-center disabled:opacity-30"
                  style={{
                    background: "transparent",
                    color: "rgba(255,255,255,0.55)",
                    border: "1px solid var(--spark-border)",
                    minHeight: 32,
                  }}
                  title="Remove field"
                  aria-label="Remove field"
                >
                  ×
                </button>
                {isChoiceType(f.fieldTypeId) && (
                  <div style={{ gridColumn: "2 / -1" }}>
                    <textarea
                      value={f.options}
                      onChange={(e) =>
                        updateField(f.key, { options: e.target.value })
                      }
                      placeholder={"Options — one per line\nDetroit\nGrand Rapids\nLansing"}
                      rows={3}
                      style={{
                        ...inputStyle,
                        width: "100%",
                        minHeight: 64,
                        resize: "vertical",
                        fontFamily: "inherit",
                      }}
                    />
                    <div
                      className="text-[11px] mt-1"
                      style={{ color: "rgba(255,255,255,0.4)" }}
                    >
                      One choice per line — BAs pick from these when filling the recap.
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer / submit */}
      <div className="flex items-center justify-end gap-2">
        <button
          onClick={() => navigate("/recap-templates")}
          disabled={isCreating}
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
          onClick={handleSubmit}
          disabled={submitDisabled}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40"
          style={{
            background: "var(--spark-lime)",
            color: "#0a0d09",
            boxShadow: submitDisabled
              ? "none"
              : "0 0 16px rgba(242,243,238,0.30)",
          }}
        >
          {isCreating ? "Saving…" : "Create template"}
        </button>
      </div>
    </div>
  );
};

export default function SparkRecapTemplateCreate() {
  const { isAdmin } = useSparkRole();
  const { tenantId } = useAuthStore();
  const navigate = useNavigate();

  if (!isAdmin) {
    return (
      <Layout>
        <div className="max-w-2xl space-y-3">
          <h1 className="display text-3xl font-bold">Admin only.</h1>
          <p style={{ color: "rgba(255,255,255,0.55)" }}>
            Recap templates are a Spark Admin feature.{" "}
            <button
              onClick={() => navigate("/recaps")}
              className="underline"
            >
              Back to recaps
            </button>
          </p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <Suspense
        fallback={
          <div
            className="grid place-items-center text-xs py-12"
            style={{ color: "rgba(255,255,255,0.45)" }}
          >
            Loading reference data…
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
