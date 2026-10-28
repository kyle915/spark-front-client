/**
 * Custom Recap Template EDITOR — admin-only. (/recap-templates/:uuid/edit)
 *
 * The companion to SparkRecapTemplateCreate: this edits an EXISTING
 * template in place. You can add / rename / retype / require-toggle /
 * delete fields, reorder them with ↑/↓, and move a field to a different
 * section — then Save once.
 *
 * Save goes through the single `updateCustomRecapTemplate` sync mutation:
 * every field is sent with its id (existing) or no id (new) plus its
 * `order` = row index. The backend creates new rows, updates existing,
 * reorders by `order`, and deletes any field omitted from the list —
 * EXCEPT a field that already has submitted recap values (the backend
 * refuses with a clear error; nothing is lost).
 *
 * ⚠ Editing a live template changes the form for EVERY recap on it, so we
 * show that warning up top.
 */

import { Suspense, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import Layout from "@/layout/Layout";
import useSparkRole from "@/hooks/useSparkRole";
import { useAuthStore } from "@/store/authStore";
import { useAlertStore } from "@/store/alertStore";
import { CustomRecapTemplateBuilderQuery } from "@/api/queries/CustomRecapTemplateBuilderQuery";
import type { CustomRecapTemplateBuilderQuery as CustomRecapTemplateBuilderQueryType } from "@api/queries/__generated__/CustomRecapTemplateBuilderQuery.graphql";
import { UpdateCustomRecapTemplateMutation } from "@/api/mutations/UpdateCustomRecapTemplateMutation";
import type { UpdateCustomRecapTemplateMutation as UpdateCustomRecapTemplateMutationType } from "@api/mutations/__generated__/UpdateCustomRecapTemplateMutation.graphql";
import { CreateRecapSectionMutation } from "@/api/mutations/CreateRecapSectionMutation";
import type { CreateRecapSectionMutation as CreateRecapSectionMutationType } from "@api/mutations/__generated__/CreateRecapSectionMutation.graphql";

type DraftField = {
  key: string;
  // Existing field's Relay id, or null for a newly-added row.
  id: string | null;
  name: string;
  fieldTypeId: string;
  sectionId: string;
  required: boolean;
  // Allowed choices (one per line) for dropdown / multi-select fields.
  options: string;
};

let _rowCounter = 0;
const nextKey = () => `erow-${++_rowCounter}`;

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

const Inner: React.FC<{ tenantId: string; uuid: string }> = ({
  tenantId,
  uuid,
}) => {
  const navigate = useNavigate();
  const { showAlert } = useAlertStore();
  const data = useLazyLoadQuery<CustomRecapTemplateBuilderQueryType>(
    CustomRecapTemplateBuilderQuery,
    { tenantId },
    // network-only so a fresh edit always reflects the latest saved state.
    { fetchPolicy: "network-only" },
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
  const template = useMemo(
    () =>
      (data.customRecapTemplates?.edges ?? [])
        .map((e) => e?.node)
        .find((n) => n && String(n.uuid) === uuid) ?? null,
    [data, uuid],
  );
  // Event types for the (now editable) type selector — same source the
  // create form uses.
  const eventTypes = useMemo(
    () =>
      (data.eventTypes?.edges ?? [])
        .map((e) => e?.node)
        .filter((n): n is NonNullable<typeof n> => Boolean(n)),
    [data],
  );

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

  // Choice (dropdown / multi-select) types need an admin-defined option list.
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
  const typeLabel = (name: string) => {
    const n = (name ?? "").toLowerCase();
    if (n === "multiselect") return "Multi-select (choose any)";
    if (n === "select") return "Dropdown (choose one)";
    return name;
  };

  // ---- form state, seeded once from the loaded template ---------------
  const [name, setName] = useState(template?.name ?? "");
  const [eventTypeId, setEventTypeId] = useState(
    String(template?.eventType?.id ?? ""),
  );
  const [productSamples, setProductSamples] = useState(
    Boolean(template?.productSamples),
  );
  const [salesPerformance, setSalesPerformance] = useState(
    Boolean(template?.salesPerformance),
  );
  const [fields, setFields] = useState<DraftField[]>(() =>
    [...(template?.customField ?? [])]
      // Backend returns these order-sorted; sort again defensively.
      .sort((a, b) => (a?.order ?? 0) - (b?.order ?? 0))
      .map((f) => ({
        key: nextKey(),
        id: f?.id ? String(f.id) : null,
        name: f?.name ?? "",
        fieldTypeId: f?.customFieldType?.id ? String(f.customFieldType.id) : "",
        sectionId: f?.recapSectionId ? String(f.recapSectionId) : "",
        required: Boolean(f?.required),
        options: ((f?.options ?? []) as readonly string[]).join("\n"),
      })),
  );

  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [newSectionName, setNewSectionName] = useState("");

  const [commitUpdate, isUpdating] =
    useMutation<UpdateCustomRecapTemplateMutationType>(
      UpdateCustomRecapTemplateMutation,
    );
  const [commitSection, isCreatingSection] =
    useMutation<CreateRecapSectionMutationType>(CreateRecapSectionMutation);

  const addField = () =>
    setFields((rows) => [
      ...rows,
      {
        key: nextKey(),
        id: null,
        name: "",
        fieldTypeId: rows.at(-1)?.fieldTypeId ?? "",
        sectionId: rows.at(-1)?.sectionId ?? "",
        required: false,
        options: "",
      },
    ]);
  const removeField = (key: string) =>
    setFields((rows) => rows.filter((r) => r.key !== key));
  const updateField = (key: string, patch: Partial<DraftField>) =>
    setFields((rows) =>
      rows.map((r) => (r.key === key ? { ...r, ...patch } : r)),
    );
  const moveField = (idx: number, dir: -1 | 1) =>
    setFields((rows) => {
      const j = idx + dir;
      if (j < 0 || j >= rows.length) return rows;
      const next = [...rows];
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });

  const createSection = () => {
    const trimmed = newSectionName.trim();
    if (!trimmed) return;
    commitSection({
      variables: { input: { name: trimmed, tenantId } },
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

  const validate = (): string | null => {
    if (!name.trim()) return "Give the template a name.";
    if (!eventTypeId) return "Pick an event type.";
    if (fields.length === 0) return "A template needs at least one field.";
    for (const f of fields) {
      if (!f.name.trim()) return "Every field needs a name.";
      if (!f.fieldTypeId) return "Pick a type for every field.";
      if (!f.sectionId) return "Pick a section for every field.";
      if (isChoiceType(f.fieldTypeId) && parseOptions(f.options).length === 0)
        return `Add at least one option for "${f.name.trim() || "the multi-select field"}".`;
    }
    return null;
  };

  const handleSave = () => {
    setSubmitAttempted(true);
    const msg = validate();
    if (msg) {
      showAlert(msg, "error");
      return;
    }
    if (!template) return;
    commitUpdate({
      variables: {
        input: {
          id: String(template.id),
          name: name.trim(),
          eventTypeId,
          productSamples,
          salesPerformance,
          // order = row index → the form renders fields top-to-bottom in this
          // order. id present → update; absent → create; omitted existing →
          // deleted (backend blocks delete if the field has submitted values).
          customFields: fields.map((f, idx) => ({
            ...(f.id ? { id: f.id } : {}),
            name: f.name.trim(),
            customFieldTypeId: f.fieldTypeId,
            recapSectionId: f.sectionId,
            required: f.required,
            order: idx,
            options: isChoiceType(f.fieldTypeId) ? parseOptions(f.options) : [],
          })),
        },
      },
      onCompleted: (resp) => {
        const r = resp.updateCustomRecapTemplate;
        if (r?.success) {
          showAlert("Template saved.", "success");
          navigate("/recap-templates");
        } else {
          showAlert(r?.message || "Couldn't save the template.", "error");
        }
      },
      onError: (err) => showAlert(err.message, "error"),
    });
  };

  if (!template) {
    return (
      <div className="max-w-2xl space-y-3">
        <h1 className="display text-3xl font-bold">Template not found.</h1>
        <p style={{ color: "rgba(255,255,255,0.55)" }}>
          It may belong to a different client.{" "}
          <button
            onClick={() => navigate("/recap-templates")}
            className="underline"
          >
            Back to templates
          </button>
        </p>
      </div>
    );
  }

  const saveDisabled = isUpdating || !!validate();

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <p
          className="mono text-[10px]"
          style={{ letterSpacing: "0.18em", color: "rgba(255,255,255,0.45)" }}
        >
          ADMIN · EDIT RECAP TEMPLATE
        </p>
        <h1
          className="display text-4xl font-bold mt-2"
          style={{ letterSpacing: "-0.04em" }}
        >
          Edit “{template.name}”.
        </h1>
        <p
          className="mt-2 text-sm"
          style={{ color: "var(--spark-orange, #ef5a2a)" }}
        >
          ⚠ This template is used by the “{template.eventType?.name}” recap
          form — changes apply to every recap on it.
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
            style={{
              ...inputStyle,
              borderColor:
                submitAttempted && !name.trim()
                  ? "var(--spark-orange, #ef5a2a)"
                  : "var(--spark-border)",
            }}
          />
        </label>
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

      {/* Add-a-section */}
      <div className="spark-card p-5">
        <p
          className="mono text-[10px] mb-2"
          style={{ letterSpacing: "0.18em", color: "rgba(255,255,255,0.45)" }}
        >
          SECTIONS · {sections.length}
        </p>
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
              style={{ letterSpacing: "0.18em", color: "rgba(255,255,255,0.45)" }}
            >
              FIELDS · {fields.length}
            </p>
            <p
              className="text-[12px] mt-1"
              style={{ color: "rgba(255,255,255,0.55)" }}
            >
              Use ↑/↓ to reorder. Order top-to-bottom (within a section) is
              the order BAs see them.
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
                {/* Reorder arrows */}
                <div
                  className="flex flex-col self-center"
                  style={{ width: 26 }}
                >
                  <button
                    onClick={() => moveField(idx, -1)}
                    disabled={idx === 0}
                    className="text-xs leading-none disabled:opacity-25"
                    style={{ color: "rgba(255,255,255,0.6)", padding: "1px 0" }}
                    title="Move up"
                    aria-label="Move field up"
                  >
                    ▲
                  </button>
                  <button
                    onClick={() => moveField(idx, 1)}
                    disabled={idx === fields.length - 1}
                    className="text-xs leading-none disabled:opacity-25"
                    style={{ color: "rgba(255,255,255,0.6)", padding: "1px 0" }}
                    title="Move down"
                    aria-label="Move field down"
                  >
                    ▼
                  </button>
                </div>
                <input
                  value={f.name}
                  onChange={(e) => updateField(f.key, { name: e.target.value })}
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
                  className="px-2 rounded-lg text-sm self-center"
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

      {/* Footer / save */}
      <div className="flex items-center justify-end gap-2">
        <button
          onClick={() => navigate("/recap-templates")}
          disabled={isUpdating}
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
          onClick={handleSave}
          disabled={saveDisabled}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40"
          style={{
            background: "var(--spark-lime)",
            color: "#0a0d09",
            boxShadow: saveDisabled ? "none" : "0 0 16px rgba(242,243,238,0.30)",
          }}
        >
          {isUpdating ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
};

export default function SparkRecapTemplateEdit() {
  const { isAdmin } = useSparkRole();
  const { tenantId } = useAuthStore();
  const { uuid } = useParams<{ uuid: string }>();
  const navigate = useNavigate();

  if (!isAdmin) {
    return (
      <Layout>
        <div className="max-w-2xl space-y-3">
          <h1 className="display text-3xl font-bold">Admin only.</h1>
          <p style={{ color: "rgba(255,255,255,0.55)" }}>
            Recap templates are a Spark Admin feature.{" "}
            <button onClick={() => navigate("/recaps")} className="underline">
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
            Loading template…
          </div>
        }
      >
        {tenantId && uuid ? (
          <Inner tenantId={tenantId} uuid={uuid} />
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
