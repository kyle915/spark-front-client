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
