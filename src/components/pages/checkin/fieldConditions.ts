/**
 * Show-when rules from the recap template (API `showWhen`): a field shows only
 * while another choice field has `includes` picked, e.g. "4oz pours served"
 * while Sample format includes "4oz pour". A hidden field is never required
 * and never submitted.
 */

export type ShowWhen = { fieldId: string; includes: string };

type ConditionalField = { id: string; showWhen?: ShowWhen | null };

type FieldValues = Record<string, string | string[] | undefined>;

function picked(raw: string | string[] | undefined): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  const text = String(raw ?? "").trim();
  if (!text) return [];
  if (text.startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      // Not JSON — fall through to a comma list.
    }
  }
  return text.split(",");
}

export function isFieldShown(field: ConditionalField, values: FieldValues): boolean {
  const rule = field.showWhen;
  if (!rule) return true;
  const want = rule.includes.trim().toLowerCase();
  return picked(values[rule.fieldId]).some((v) => v.trim().toLowerCase() === want);
}

/** Drop answers to fields that are hidden right now. */
export function withoutHiddenValues<V extends FieldValues>(
  fields: ConditionalField[],
  values: V,
): V {
  const out = { ...values };
  for (const f of fields) {
    if (!isFieldShown(f, values)) delete out[f.id];
  }
  return out;
}
