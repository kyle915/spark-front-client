import { Suspense, useMemo, useState } from "react";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { useNavigate } from "react-router";
import Layout from "@/layout/Layout";
import { GetCustomRecapsQuery } from "@/api/queries/CustomRecapsQuery";
import type { CustomRecapsQuery as CustomRecapsQueryType } from "@api/queries/__generated__/CustomRecapsQuery.graphql";
import { CustomRecapTemplateBuilderQuery } from "@/api/queries/CustomRecapTemplateBuilderQuery";
import type { CustomRecapTemplateBuilderQuery as CustomRecapTemplateBuilderQueryType } from "@api/queries/__generated__/CustomRecapTemplateBuilderQuery.graphql";
import { RemoveCustomFieldMutation } from "@/api/mutations/RemoveCustomFieldMutation";
import type { RemoveCustomFieldMutation as RemoveCustomFieldMutationType } from "@api/mutations/__generated__/RemoveCustomFieldMutation.graphql";
import { CreateCustomFieldMutation } from "@/api/mutations/CreateCustomFieldMutation";
import type { CreateCustomFieldMutation as CreateCustomFieldMutationType } from "@api/mutations/__generated__/CreateCustomFieldMutation.graphql";
import { UpdateCustomRecapTemplateMutation } from "@/api/mutations/UpdateCustomRecapTemplateMutation";
import type { UpdateCustomRecapTemplateMutation as UpdateCustomRecapTemplateMutationType } from "@api/mutations/__generated__/UpdateCustomRecapTemplateMutation.graphql";
import { MoveCustomFieldToSectionMutation } from "@/api/mutations/MoveCustomFieldToSectionMutation";
import type { MoveCustomFieldToSectionMutation as MoveCustomFieldToSectionMutationType } from "@api/mutations/__generated__/MoveCustomFieldToSectionMutation.graphql";
import { DeleteRecapSectionMutation } from "@/api/mutations/DeleteRecapSectionMutation";
import type { DeleteRecapSectionMutation as DeleteRecapSectionMutationType } from "@api/mutations/__generated__/DeleteRecapSectionMutation.graphql";
import { useAuthStore } from "@/store/authStore";
import { useAlertStore } from "@/store/alertStore";

/**
 * Spark v2 — Recap Templates.
 * Wireframe: spark-demo/index.html recapBuilder (~line 2744) and adjacent.
 *
 * We surface templates by reducing the customRecaps result set down to
 * unique customRecapTemplate entries, with usage counts. A dedicated
 * templates-list endpoint would be cleaner; until then, this works against
 * the existing schema.
 */

type Template = {
  id: string;
  uuid: string;
  name: string;
  usage: number;
  lastUsed: string | null;
};

const fmtDate = (raw: string | null | undefined) => {
  if (!raw) return null;
  try {
    return new Date(raw).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return raw;
  }
};

// Shared input/select styling for the "Add a field" form — mirrors the
// inputStyle used by the create-template builder so the two surfaces feel
// like the same product.
const fieldInputStyle: React.CSSProperties = {
  background: "var(--spark-card-bg, rgba(var(--spark-ink-rgb),0.02))",
  border: "1px solid var(--spark-border)",
  borderRadius: 10,
  padding: "0.5rem 0.65rem",
  color: "var(--spark-text)",
  fontSize: "0.8rem",
  outline: "none",
  width: "100%",
};

const Inner: React.FC = () => {
  const navigate = useNavigate();
  const { tenantId } = useAuthStore();
  // Template manager modal state. Keyed off template id; null = closed.
  // Lives on the page (not per-card) so we can refetch + re-render
  // when a field is removed.
  const [managingTemplateId, setManagingTemplateId] = useState<string | null>(
    null,
  );
  // Bumped after a field is added/removed in the modal to force the
  // builder query to re-fetch so the field list (and the card's FIELDS
  // count) update in place — same pattern as the ratings card on the
  // BA detail page (fetchKey bump on save).
  const [fieldsFetchKey, setFieldsFetchKey] = useState(0);

  const data = useLazyLoadQuery<CustomRecapsQueryType>(
    GetCustomRecapsQuery,
    { first: 500, filters: tenantId ? { tenantId } : null },
    { fetchPolicy: "store-or-network" },
  );

  // Templates-with-fields, fetched separately so the modal can list
  // the actual CustomField rows (the recaps query only exposes id +
  // name on customRecapTemplate, not the fields underneath).
  const templateData = useLazyLoadQuery<CustomRecapTemplateBuilderQueryType>(
    CustomRecapTemplateBuilderQuery,
    { tenantId: tenantId ?? "" },
    { fetchPolicy: "store-and-network", fetchKey: fieldsFetchKey },
  );

  // Field types (text / number / photo / …) come bundled in the same
  // builder query the create-template page uses, so the modal can reuse
  // them for the "Add a field" type dropdown without a second request.
  const fieldTypes = useMemo(
    () =>
      (templateData?.customRecapFieldTypes?.edges ?? [])
        .map((e) => e?.node)
        .filter((n): n is NonNullable<typeof n> => Boolean(n))
        .map((n) => ({ id: String(n.id), name: n.name })),
    [templateData],
  );
  // All tenant sections — used as a fallback when a template has no
  // fields yet (so we can't derive its sections from existing rows).
  const allSections = useMemo(
    () =>
      (templateData?.recapSections?.edges ?? [])
        .map((e) => e?.node)
        .filter((n): n is NonNullable<typeof n> => Boolean(n))
        .map((n) => ({ id: String(n.id), name: n.name })),
    [templateData],
  );
  const templatesWithFields = useMemo(
    () =>
      (templateData?.customRecapTemplates?.edges ?? [])
        .map((e) => e?.node)
        .filter((n): n is NonNullable<typeof n> => Boolean(n)),
    [templateData],
  );
  const managingTemplate = useMemo(
    () =>
      managingTemplateId
        ? templatesWithFields.find(
            (t) => String(t.id) === managingTemplateId,
          ) ?? null
        : null,
    [managingTemplateId, templatesWithFields],
  );

  const templates: Template[] = useMemo(() => {
    // Usage stats come from filed custom recaps, keyed by template id.
    // This is a SECONDARY overlay — it must NOT decide which templates
    // appear. Previously the list was built entirely from this map, so
    // a template with zero recaps filed was invisible (the page showed
    // "0 ACTIVE / no templates" even though the template existed — which
    // is exactly what the create-form's duplicate-check correctly
    // flagged). Now the list is driven by the actual customRecapTemplates
    // rows below and usage is layered on, defaulting to 0.
    const usageById = new Map<string, { usage: number; lastUsed: string | null }>();
    const recaps =
      data?.customRecaps?.edges
        ?.map((e) => e?.node)
        ?.filter((n): n is NonNullable<typeof n> => Boolean(n)) ?? [];
    for (const r of recaps) {
      const t = r.customRecapTemplate;
      if (!t) continue;
      const id = String(t.id);
      const submittedAt = r.submittedAt ?? r.createdAt ?? null;
      const existing = usageById.get(id);
      if (!existing) {
        usageById.set(id, { usage: 1, lastUsed: submittedAt });
      } else {
        existing.usage += 1;
        if (
          submittedAt &&
          (!existing.lastUsed ||
            new Date(submittedAt) > new Date(existing.lastUsed))
        ) {
          existing.lastUsed = submittedAt;
        }
      }
    }

    // Source of truth = the real CustomRecapTemplate rows (same data the
    // create-form duplicate-check reads). A template shows the moment it
    // exists, with 0 usage until recaps start coming in.
    return templatesWithFields
      .map((t) => {
        const id = String(t.id);
        const stats = usageById.get(id);
        return {
          id,
          uuid: String(t.uuid),
          name: t.name ?? "Untitled template",
          usage: stats?.usage ?? 0,
          lastUsed: stats?.lastUsed ?? null,
        };
      })
      // Most-used first, then alphabetical so unused templates sort
      // predictably instead of by insertion order.
      .sort((a, b) => b.usage - a.usage || a.name.localeCompare(b.name));
  }, [data, templatesWithFields]);

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <p
            className="mono text-[10px]"
            style={{
              letterSpacing: "0.18em",
              color: "var(--spark-text-meta)",
            }}
          >
            RECAP TEMPLATES · {templates.length} ACTIVE
          </p>
          <h1
            className="display text-4xl font-bold mt-2"
            style={{ letterSpacing: "-0.04em" }}
          >
            Build the recap.
          </h1>
          <p className="mt-2" style={{ color: "var(--spark-text-meta)" }}>
            Custom recap shapes per brand — what BAs see when they file
            from the field.
          </p>
        </div>
        <button
          onClick={() => navigate("/recaps/templates/new")}
          className="px-4 py-2 rounded-xl text-sm font-semibold"
          style={{
            background: "var(--spark-lime)",
            color: "var(--spark-on-accent)",
          }}
        >
          + New template
        </button>
      </div>

      {/* Templates grid */}
      {templates.length === 0 ? (
        <div
          className="spark-card p-10 text-center text-sm"
          style={{ color: "var(--spark-text-meta)" }}
        >
          No templates yet. Build one to start collecting custom recap
          fields per brand.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((t) => {
            const fieldsList =
              templatesWithFields.find((tw) => String(tw.id) === t.id)
                ?.customField ?? [];
            return (
              <div key={t.id} className="spark-card hov p-5">
                <div className="flex items-center justify-between mb-3">
                  <span
                    className="mono text-[10px]"
                    style={{
                      letterSpacing: "0.16em",
                      color: "var(--spark-lime)",
                    }}
                  >
                    TPL-{t.id.slice(-4).toUpperCase()}
                  </span>
                  <span className="chip chip-lime">● ACTIVE</span>
                </div>
                <h3
                  className="display text-lg font-bold mb-1"
                  style={{ letterSpacing: "-0.02em" }}
                >
                  {t.name}
                </h3>
                {t.lastUsed && (
                  <p
                    className="mono text-[10px] uppercase mt-1"
                    style={{
                      letterSpacing: "0.14em",
                      color: "var(--spark-text-meta)",
                    }}
                  >
                    Last used · {fmtDate(t.lastUsed)}
                  </p>
                )}
                <div
                  className="mt-4 pt-3 grid grid-cols-2 gap-2 text-center"
                  style={{ borderTop: "1px solid var(--spark-border)" }}
                >
                  <div>
                    <p
                      className="tab-num text-lg font-bold"
                      style={{ color: "var(--spark-lime)" }}
                    >
                      {t.usage}
                    </p>
                    <p className="label-mini">RECAPS</p>
                  </div>
                  <div>
                    <p
                      className="tab-num text-lg font-bold"
                      style={{
                        color:
                          fieldsList.length > 0
                            ? "var(--spark-text)"
                            : "rgba(var(--spark-ink-rgb),0.4)",
                      }}
                    >
                      {fieldsList.length || "—"}
                    </p>
                    <p className="label-mini">FIELDS</p>
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => navigate("/recap/custom-list")}
                    className="flex-1 px-3 py-2 rounded-xl text-xs font-semibold"
                    style={{
                      background: "transparent",
                      color: "var(--spark-text)",
                      border: "1px solid var(--spark-border)",
                    }}
                  >
                    View recaps
                  </button>
                  <button
                    onClick={() => setManagingTemplateId(t.id)}
                    disabled={fieldsList.length === 0}
                    className="flex-1 px-3 py-2 rounded-xl text-xs font-semibold"
                    style={{
                      background: "transparent",
                      color:
                        fieldsList.length === 0
                          ? "rgba(var(--spark-ink-rgb),0.35)"
                          : "var(--spark-text)",
                      border: "1px solid var(--spark-border)",
                      cursor:
                        fieldsList.length === 0
                          ? "not-allowed"
                          : "pointer",
                    }}
                    title={
                      fieldsList.length === 0
                        ? "No fields loaded yet"
                        : "Manage fields on this template"
                    }
                  >
                    Manage fields
                  </button>
                  <button
                    onClick={() =>
                      navigate(`/recap-templates/${t.uuid}/edit`)
                    }
                    className="flex-1 px-3 py-2 rounded-xl text-xs font-semibold"
                    style={{
                      background: "var(--spark-lime)",
                      color: "var(--spark-on-accent)",
                      border: "1px solid var(--spark-lime)",
                    }}
                    title="Add, rename, reorder, or delete fields + sections"
                  >
                    Edit template
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {managingTemplate && (
        <ManageFieldsModal
          // Remount per template so the "Add a field" form state (incl.
          // the auto-defaulted single section) resets when switching.
          key={String(managingTemplate.id)}
          templateId={String(managingTemplate.id)}
          templateName={managingTemplate.name ?? "Template"}
          // Current values for the partial update payload. The toggle
          // only changes productSamples; name + eventTypeId are sent
          // unchanged (both are non-null inputs) so nothing else moves,
          // and customFields is deliberately omitted so the backend
          // preserves the template's existing field rows.
          eventTypeId={String(managingTemplate.eventType?.id ?? "")}
          productSamples={Boolean(managingTemplate.productSamples)}
          fields={(managingTemplate.customField ?? [])
            .filter((f): f is NonNullable<typeof f> => Boolean(f))
            .map((f) => ({
              id: String(f.id),
              name: f.name ?? "(unnamed)",
              required: Boolean(f.required),
              typeName: f.customFieldType?.name ?? null,
              // The section this field currently lives in — drives the
              // per-row "Move to section" select's default value and the
              // per-section field-count guard for delete.
              sectionId: String(f.recapSectionId ?? f.recapSection?.id ?? ""),
            }))}
          // Sections this template already uses, derived from its fields.
          // De-duped by id, preserving first-seen order. Falls back to all
          // tenant sections when the template has no fields to derive from.
          sections={(() => {
            const seen = new Map<string, { id: string; name: string }>();
            for (const f of managingTemplate.customField ?? []) {
              const s = f?.recapSection;
              if (s && !seen.has(String(s.id)))
                seen.set(String(s.id), { id: String(s.id), name: s.name });
            }
            return seen.size > 0 ? Array.from(seen.values()) : allSections;
          })()}
          fieldTypes={fieldTypes}
          onChanged={() => setFieldsFetchKey((k) => k + 1)}
          onClose={() => setManagingTemplateId(null)}
        />
      )}
    </div>
  );
};

const ManageFieldsModal: React.FC<{
  templateId: string;
  templateName: string;
  eventTypeId: string;
  productSamples: boolean;
  fields: {
    id: string;
    name: string;
    required: boolean;
    typeName: string | null;
    sectionId: string;
  }[];
  sections: { id: string; name: string }[];
  fieldTypes: { id: string; name: string }[];
  onChanged: () => void;
  onClose: () => void;
}> = ({
  templateId,
  templateName,
  eventTypeId,
  productSamples,
  fields,
  sections,
  fieldTypes,
  onChanged,
  onClose,
}) => {
  const showAlert = useAlertStore((s) => s.showAlert);
  const [commitRemove, isRemoving] =
    useMutation<RemoveCustomFieldMutationType>(RemoveCustomFieldMutation);
  const [commitCreate, isCreating] =
    useMutation<CreateCustomFieldMutationType>(CreateCustomFieldMutation);
  const [commitUpdateTemplate, isUpdatingTemplate] =
    useMutation<UpdateCustomRecapTemplateMutationType>(
      UpdateCustomRecapTemplateMutation,
    );
  const [commitMove, isMoving] =
    useMutation<MoveCustomFieldToSectionMutationType>(
      MoveCustomFieldToSectionMutation,
    );
  const [commitDeleteSection, isDeletingSection] =
    useMutation<DeleteRecapSectionMutationType>(DeleteRecapSectionMutation);

  // Local mirror of the template's productSamples flag so the checkbox
  // reflects intent immediately; reverted in onError if the mutation
  // fails. Seeded from the prop (the template's current value).
  const [sampledOn, setSampledOn] = useState(productSamples);

  const toggleProductSamples = (next: boolean) => {
    // Optimistic flip so the checkbox tracks the click; revert on error.
    setSampledOn(next);
    commitUpdateTemplate({
      variables: {
        input: {
          id: templateId,
          // Send the template's CURRENT name + eventTypeId unchanged
          // (both required, non-null) and ONLY change productSamples.
          // customFields is intentionally omitted — the backend
          // preserves existing fields when it's null/absent.
          name: templateName,
          eventTypeId,
          productSamples: next,
        },
      },
      onCompleted: (res) => {
        const payload = res.updateCustomRecapTemplate;
        if (payload?.success) {
          showAlert(
            next
              ? `Sampled-products tracking ON for "${templateName}".`
              : `Sampled-products tracking OFF for "${templateName}".`,
            "success",
          );
          // Refresh so the persisted value is reflected from the store.
          onChanged();
        } else {
          // Server rejected the change — revert the checkbox.
          setSampledOn(!next);
          showAlert(
            payload?.message ?? "Couldn't update template.",
            "error",
          );
        }
      },
      onError: (err) => {
        setSampledOn(!next);
        showAlert(`Update failed: ${err.message}`, "error");
      },
    });
  };
  // Tracks the field id mid-confirm so we can show inline "are you
  // sure" UX without a system dialog (system dialogs eat focus on
  // mobile and feel disconnected from the page state).
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  // Same inline-confirm pattern, but for deleting a whole section.
  const [confirmingSectionId, setConfirmingSectionId] = useState<
    string | null
  >(null);

  // How many of THIS template's fields currently live in each section.
  // Drives the delete-section guard: a section that still holds fields
  // here can't be deleted (the backend refuses it too), so we disable
  // the button and explain why.
  const fieldCountBySection = useMemo(() => {
    const counts = new Map<string, number>();
    for (const f of fields) {
      if (!f.sectionId) continue;
      counts.set(f.sectionId, (counts.get(f.sectionId) ?? 0) + 1);
    }
    return counts;
  }, [fields]);

  // Move a field to a different section. The destination must be one of
  // this template's own sections (the backend only allows moving into a
  // section that already holds a field from the same template); if it
  // refuses, we surface its message rather than crashing.
  const moveField = (fieldId: string, sectionId: string) => {
    commitMove({
      variables: { input: { fieldId, sectionId } },
      onCompleted: (res) => {
        const payload = res.moveCustomFieldToSection;
        if (payload?.success) {
          showAlert("Field moved.", "success");
          onChanged();
        } else {
          showAlert(payload?.message ?? "Couldn't move field.", "error");
        }
      },
      onError: (err) => showAlert(`Move failed: ${err.message}`, "error"),
    });
  };

  // Delete a section. Sections are tenant-global, so this removes the
  // section from EVERY template this client has — the confirm copy says
  // so. The backend independently refuses a non-empty section; if it
  // does, we show its message.
  const deleteSection = (sectionId: string, sectionName: string) => {
    commitDeleteSection({
      variables: { input: { sectionId } },
      onCompleted: (res) => {
        const payload = res.deleteRecapSection;
        if (payload?.success) {
          showAlert(`Deleted section "${sectionName}".`, "success");
          setConfirmingSectionId(null);
          onChanged();
        } else {
          showAlert(
            payload?.message ?? "Couldn't delete section.",
            "error",
          );
        }
      },
      onError: (err) =>
        showAlert(`Delete failed: ${err.message}`, "error"),
    });
  };

  // ---- "Add a field" form state ---------------------------------------
  // If the template only uses a single section we default to it and hide
  // the dropdown — there's nothing to choose.
  const soleSectionId = sections.length === 1 ? sections[0].id : "";
  const [newName, setNewName] = useState("");
  const [newSectionId, setNewSectionId] = useState(soleSectionId);
  const [newTypeId, setNewTypeId] = useState("");
  // For "select" / "multiselect" types: the admin's allowed options, one per
  // line.
  const [newOptions, setNewOptions] = useState("");
  // New fields default to Required ON, matching how existing template
  // fields are typically created.
  const [newRequired, setNewRequired] = useState(true);

  // Whether the chosen type is a choice field (dropdown / multi-select),
  // which needs an option list. Matched by the backend type name.
  const newTypeName = (
    fieldTypes.find((ft) => ft.id === newTypeId)?.name ?? ""
  ).toLowerCase();
  const isChoiceType =
    newTypeName === "select" || newTypeName === "multiselect";
  const newOptionList = newOptions
    .split("\n")
    .map((o) => o.trim())
    .filter(Boolean);

  const addDisabled =
    isCreating ||
    !newName.trim() ||
    !newSectionId ||
    !newTypeId ||
    (isChoiceType && newOptionList.length === 0);

  const addField = () => {
    if (addDisabled) return;
    const label = newName.trim();
    commitCreate({
      variables: {
        input: {
          name: label,
          customRecapTemplateId: templateId,
          recapSectionId: newSectionId,
          customFieldTypeId: newTypeId,
          required: newRequired,
          options: isChoiceType ? newOptionList : [],
        },
      },
      onCompleted: (res) => {
        const payload = res.createCustomField;
        if (payload?.success) {
          showAlert(`Added "${label}" to "${templateName}".`, "success");
          // Reset the form, but keep the section selection sticky so an
          // admin adding several fields to the same section doesn't have
          // to re-pick it each time.
          setNewName("");
          setNewTypeId("");
          setNewOptions("");
          setNewRequired(true);
          // Pull the fresh field list so the new row shows immediately.
          onChanged();
        } else {
          showAlert(payload?.message ?? "Couldn't add field.", "error");
        }
      },
      onError: (err) => showAlert(`Add failed: ${err.message}`, "error"),
    });
  };

  const remove = (fieldId: string, fieldName: string) => {
    commitRemove({
      variables: {
        input: {
          id: fieldId,
          // Force-cascade existing CustomFieldValue rows so a field
          // with submitted data can actually be removed. The backend
          // wraps both deletes in a single transaction.
          deleteValues: true,
        },
      },
      onCompleted: (res) => {
        const payload = res.removeCustomField;
        if (payload?.success) {
          showAlert(
            `Removed "${fieldName}" from "${templateName}".`,
            "success",
          );
          setConfirmingId(null);
          // Refresh the list so the removed row disappears in place.
          onChanged();
        } else {
          showAlert(payload?.message ?? "Remove failed.", "error");
        }
      },
      onError: (err) =>
        showAlert(`Remove failed: ${err.message}`, "error"),
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.65)" }}
      onClick={onClose}
    >
      <div
        className="spark-card max-w-lg w-full p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p
              className="mono text-[10px]"
              style={{
                letterSpacing: "0.18em",
                color: "var(--spark-text-meta)",
              }}
            >
              MANAGE FIELDS
            </p>
            <h2
              className="display text-xl font-bold mt-1"
              style={{ letterSpacing: "-0.02em" }}
            >
              {templateName}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-sm opacity-60 hover:opacity-100"
          >
            ✕
          </button>
        </div>

        {/* Per-template "Track sampled products" toggle. Flipping it sends
            a partial update (no customFields) so the template's fields are
            preserved — this is what turns on the per-SKU products-sampled
            section the recap forms render when productSamples === true. */}
        <div
          className="rounded-xl px-3 py-2.5 flex items-center justify-between gap-3"
          style={{
            background: "var(--spark-bg)",
            border: "1px solid var(--spark-border)",
          }}
        >
          <label
            className="flex items-center gap-2 text-sm cursor-pointer"
            title="When on, BAs see the per-SKU products-sampled section on this template's recap form."
          >
            <input
              type="checkbox"
              checked={sampledOn}
              disabled={isUpdatingTemplate}
              onChange={(e) => toggleProductSamples(e.target.checked)}
              className="accent-[var(--spark-lime)]"
            />
            Track sampled products
          </label>
          <span
            className="mono text-[10px]"
            style={{
              letterSpacing: "0.14em",
              color: isUpdatingTemplate
                ? "rgba(var(--spark-ink-rgb),0.45)"
                : sampledOn
                  ? "var(--spark-lime)"
                  : "rgba(var(--spark-ink-rgb),0.4)",
            }}
          >
            {isUpdatingTemplate ? "SAVING…" : sampledOn ? "● ON" : "○ OFF"}
          </span>
        </div>

        <p className="text-xs" style={{ color: "var(--spark-text-secondary)" }}>
          Removing a field also deletes any submitted values for it
          across every recap that used this template. Use this when a
          field was a mistake — don't use it as a value-correction tool.
        </p>

        <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
          {fields.length === 0 ? (
            <p
              className="text-sm py-6 text-center"
              style={{ color: "var(--spark-text-meta)" }}
            >
              No fields on this template.
            </p>
          ) : (
            fields.map((f) => (
              <div
                key={f.id}
                className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl"
                style={{
                  background: "var(--spark-bg)",
                  border: "1px solid var(--spark-border)",
                }}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{f.name}</p>
                  <p
                    className="mono text-[10px] uppercase"
                    style={{
                      letterSpacing: "0.12em",
                      color: "var(--spark-text-meta)",
                    }}
                  >
                    {f.required ? "Required · " : ""}
                    {f.typeName ? `${f.typeName} · ` : ""}id{" "}
                    {f.id.slice(-6)}
                  </p>
                </div>
                {/* Move this field to another section. Hidden when the
                    template has a single section — there's nowhere to
                    move it. Defaults to the field's current section; on
                    change we fire the move (no-op if it didn't change). */}
                {sections.length > 1 && (
                  <select
                    aria-label={`Move "${f.name}" to a different section`}
                    title="Move this field to another section"
                    value={f.sectionId}
                    disabled={isMoving}
                    onChange={(e) => {
                      const next = e.target.value;
                      if (next && next !== f.sectionId) moveField(f.id, next);
                    }}
                    className="shrink-0 disabled:opacity-50"
                    style={{ ...fieldInputStyle, width: "auto", maxWidth: 150 }}
                  >
                    {sections.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                )}
                {confirmingId === f.id ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setConfirmingId(null)}
                      disabled={isRemoving}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                      style={{
                        background: "transparent",
                        color: "var(--spark-text)",
                        border: "1px solid var(--spark-border)",
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => remove(f.id, f.name)}
                      disabled={isRemoving}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                      style={{
                        background: "var(--spark-orange, #ef5a2a)",
                        color: "var(--spark-on-accent)",
                      }}
                    >
                      {isRemoving ? "Removing…" : "Confirm remove"}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmingId(f.id)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0"
                    style={{
                      background: "transparent",
                      color: "rgba(239,90,42,0.9)",
                      border: "1px solid rgba(239,90,42,0.4)",
                    }}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        {/* Sections — delete a section. Sections are tenant-global
            (shared across all of this client's templates), so deleting
            one removes it everywhere for the client, not just here. A
            section that still holds fields in THIS template can't be
            deleted (button disabled + tooltip); the backend refuses
            non-empty sections too and we surface its message if so. */}
        {sections.length > 0 && (
          <div
            className="rounded-xl p-3 space-y-2"
            style={{
              background: "var(--spark-bg)",
              border: "1px solid var(--spark-border)",
            }}
          >
            <p
              className="mono text-[10px]"
              style={{
                letterSpacing: "0.18em",
                color: "var(--spark-lime)",
              }}
            >
              SECTIONS
            </p>
            <p
              className="text-[11px]"
              style={{ color: "var(--spark-text-meta)" }}
            >
              Sections are shared across this client's templates —
              deleting one removes it everywhere.
            </p>
            {sections.map((s) => {
              const count = fieldCountBySection.get(s.id) ?? 0;
              const hasFields = count > 0;
              return (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg"
                  style={{
                    background: "var(--spark-card-bg, rgba(var(--spark-ink-rgb),0.02))",
                    border: "1px solid var(--spark-border)",
                  }}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{s.name}</p>
                    <p
                      className="mono text-[10px] uppercase"
                      style={{
                        letterSpacing: "0.12em",
                        color: "var(--spark-text-meta)",
                      }}
                    >
                      {hasFields
                        ? `${count} field${count === 1 ? "" : "s"} here`
                        : "Empty in this template"}
                    </p>
                  </div>
                  {confirmingSectionId === s.id ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setConfirmingSectionId(null)}
                        disabled={isDeletingSection}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                        style={{
                          background: "transparent",
                          color: "var(--spark-text)",
                          border: "1px solid var(--spark-border)",
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => deleteSection(s.id, s.name)}
                        disabled={isDeletingSection}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                        style={{
                          background: "var(--spark-orange, #ef5a2a)",
                          color: "var(--spark-on-accent)",
                        }}
                      >
                        {isDeletingSection ? "Deleting…" : "Confirm delete"}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmingSectionId(s.id)}
                      disabled={hasFields}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0"
                      style={{
                        background: "transparent",
                        color: hasFields
                          ? "rgba(var(--spark-ink-rgb),0.35)"
                          : "rgba(239,90,42,0.9)",
                        border: hasFields
                          ? "1px solid var(--spark-border)"
                          : "1px solid rgba(239,90,42,0.4)",
                        cursor: hasFields ? "not-allowed" : "pointer",
                      }}
                      title={
                        hasFields
                          ? "Move or remove this section's fields first."
                          : `Delete section "${s.name}"`
                      }
                    >
                      Delete
                    </button>
                  )}
                </div>
              );
            })}
            {/* When confirming, spell out that the delete hits the whole
                client — sections aren't template-scoped. */}
            {confirmingSectionId && (
              <p
                className="text-[11px]"
                style={{ color: "rgba(239,90,42,0.9)" }}
              >
                Delete section &ldquo;
                {sections.find((s) => s.id === confirmingSectionId)?.name ??
                  "section"}
                &rdquo;? It&apos;ll be removed from this client&apos;s
                templates.
              </p>
            )}
          </div>
        )}

        {/* Add a field */}
        <div
          className="rounded-xl p-3 space-y-2.5"
          style={{
            background: "var(--spark-bg)",
            border: "1px solid var(--spark-border)",
          }}
        >
          <p
            className="mono text-[10px]"
            style={{
              letterSpacing: "0.18em",
              color: "var(--spark-lime)",
            }}
          >
            ADD A FIELD
          </p>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addField();
            }}
            placeholder="Field label (e.g. Products Sampled)"
            style={fieldInputStyle}
          />
          <div className="grid grid-cols-2 gap-2">
            {/* Hide the section picker when the template has exactly one
                section — it's auto-selected, nothing to choose. */}
            {sections.length > 1 && (
              <select
                value={newSectionId}
                onChange={(e) => setNewSectionId(e.target.value)}
                style={fieldInputStyle}
              >
                <option value="">Section…</option>
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            )}
            <select
              value={newTypeId}
              onChange={(e) => setNewTypeId(e.target.value)}
              style={fieldInputStyle}
            >
              <option value="">Field type…</option>
              {fieldTypes.map((ft) => {
                const n = (ft.name || "").toLowerCase();
                const label =
                  n === "select"
                    ? "Dropdown (choose one)"
                    : n === "multiselect"
                      ? "Multi-select (choose any)"
                      : ft.name;
                return (
                  <option key={ft.id} value={ft.id}>
                    {label}
                  </option>
                );
              })}
            </select>
          </div>
          {isChoiceType && (
            <div>
              <textarea
                value={newOptions}
                onChange={(e) => setNewOptions(e.target.value)}
                placeholder={"Options — one per line\nDetroit\nGrand Rapids\nLansing"}
                rows={4}
                style={fieldInputStyle}
              />
              <p
                className="text-[10px] mt-1"
                style={{ color: "var(--spark-text-meta)" }}
              >
                One option per line · BAs will{" "}
                {newTypeName === "multiselect"
                  ? "tick any that apply"
                  : "pick one"}
                .
              </p>
            </div>
          )}
          <div className="flex items-center justify-between gap-3">
            <label
              className="flex items-center gap-1.5 text-[11px] cursor-pointer"
              style={{ color: "var(--spark-text-secondary)" }}
              title="Required: BAs can't submit a recap if this is blank."
            >
              <input
                type="checkbox"
                checked={newRequired}
                onChange={(e) => setNewRequired(e.target.checked)}
                className="accent-[var(--spark-lime)]"
              />
              Required
            </label>
            <button
              onClick={addField}
              disabled={addDisabled}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40"
              style={{
                background: "var(--spark-lime)",
                color: "var(--spark-on-accent)",
                boxShadow: addDisabled
                  ? "none"
                  : "0 0 16px rgba(var(--spark-accent-rgb),0.30)",
              }}
            >
              {isCreating ? "Adding…" : "+ Add field"}
            </button>
          </div>
          {sections.length === 1 && (
            <p
              className="mono text-[10px]"
              style={{
                letterSpacing: "0.12em",
                color: "var(--spark-text-meta)",
              }}
            >
              SECTION · {sections[0].name.toUpperCase()}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default function SparkRecapTemplates() {
  return (
    <Layout>
      <Suspense
        fallback={
          <div
            className="spark-card p-8 text-center text-sm max-w-7xl"
            style={{ color: "var(--spark-text-meta)" }}
          >
            Loading templates…
          </div>
        }
      >
        <Inner />
      </Suspense>
    </Layout>
  );
}
