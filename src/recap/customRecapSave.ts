/**
 * Pure helper for the custom recap inline-edit save path.
 *
 * Extracted from RecapCustomView so the payload-building rules can be
 * unit-tested directly (they're the core of the "image-field upload
 * dropped on Save" bug fix).
 *
 * The rule: build one CustomFieldValue entry for EVERY template field the
 * editor renders — not just the fields that already had a stored value —
 * so a value newly set on a previously-blank field (image / text / number
 * / longtext) is included in the mutation and the backend persists it.
 *
 *   - customFieldId:      the template field id (always sent).
 *   - customFieldValueId: the existing CustomFieldValue row id when the
 *                         field already has one (update in place), else
 *                         null so update_custom_recap upserts/creates one.
 *   - value:             the working-copy (edited) value if present, else
 *                         the stored value, else "".
 */

export type EditableCustomField = {
  id: string;
  value?: string | null;
  customFieldValueId?: string | null;
};

export type CustomFieldValuePayload = {
  customFieldId: string;
  customFieldValueId: string | null;
  value: string;
};

/**
 * @param fields       The COMPLETE list of template fields the editor
 *                     renders (every field, not only the ones with a
 *                     stored value).
 * @param editedValues Working-copy values keyed by String(field.id).
 */
const NUMBER_FIELD_TYPES = new Set(["number", "integer", "int", "numeric"]);
const NON_NEGATIVE_NUMBER = /^\d+(\.\d+)?$/;

type ValidatableCustomField = EditableCustomField & {
  name?: string | null;
  customFieldType?: { name?: string | null } | null;
};

/**
 * First number-type field whose edited value isn't a number ≥ 0, else null.
 * Only edited values are checked so legacy BA free text in untouched fields
 * never blocks a save. Mirrors the API's validate_number_field.
 */
export function invalidNumberFieldEdit(
  fields: ReadonlyArray<ValidatableCustomField | null | undefined>,
  editedValues: Record<string, string>,
): { name: string; value: string } | null {
  for (const field of fields) {
    if (!field) continue;
    const type = (field.customFieldType?.name ?? "").trim().toLowerCase();
    if (!NUMBER_FIELD_TYPES.has(type)) continue;
    const edited = editedValues[String(field.id)];
    if (edited === undefined) continue;
    const next = edited.trim();
    if (next === (field.value ?? "").trim() || next === "") continue;
    if (!NON_NEGATIVE_NUMBER.test(next.replace(/,/g, ""))) {
      return { name: field.name ?? "Number field", value: next };
    }
  }
  return null;
}

/**
 * totalEngagements for the update payload. When the stored total simply
 * mirrors the consumers-sampled field and the admin left the total alone,
 * send null so the API re-derives it from the (possibly corrected) field.
 * Otherwise send the typed number so an explicit total is never clobbered.
 */
export function totalEngagementsToSend({
  edited,
  touched,
  storedTotal,
  storedConsumersSampled,
}: {
  edited: string;
  touched: boolean;
  storedTotal: number | null | undefined;
  storedConsumersSampled: number | null | undefined;
}): number | null {
  if (
    !touched &&
    storedTotal != null &&
    storedConsumersSampled != null &&
    storedTotal === storedConsumersSampled
  ) {
    return null;
  }
  const trimmed = edited.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? Math.round(n) : null;
}

export function buildCustomFieldValuesPayload(
  fields: ReadonlyArray<EditableCustomField | null | undefined>,
  editedValues: Record<string, string>,
): CustomFieldValuePayload[] {
  return fields
    .filter((f): f is EditableCustomField => Boolean(f))
    .map((field) => ({
      customFieldId: field.id,
      customFieldValueId: field.customFieldValueId ?? null,
      value: editedValues[String(field.id)] ?? field.value ?? "",
    }));
}
