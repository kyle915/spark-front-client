import { useMemo, useState } from "react";
import {
  isProductsSampledMultiselect,
  productSamplesFromSelections,
} from "@/recap/productsSampledQty";
import {
  clerkFirstNameError,
  clerkFirstNameValue,
  isLetterType,
  isSignatureType,
  letterValue,
  signatureError,
} from "@/recap/retailerSignoff";

export type CoBrandField = {
  id: string;
  name: string;
  required: boolean;
  type: string;
  options: string[];
  placeholder?: string;
};
export type CoBrandSection = { id: string; name: string; fields: CoBrandField[] };
export type CoBrandProduct = {
  id: string;
  name: string;
  imageUrl: string | null;
  category?: string | null;
};
export type CoBrand = {
  tenantId: string;
  name: string;
  primaryColor: string | null;
  templateId: string;
  sections: CoBrandSection[];
  products: CoBrandProduct[];
  requestedProductIds: string[];
};
export type CoBrandOptions = {
  groupName: string;
  brands: CoBrand[];
  requestedTenantIds: string[];
};

export type CoBrandSubmit = {
  tenantId: string;
  fieldValues: { customFieldId: string; value: string }[];
  productSamples: { productId: string; quantity: number }[];
};

type Values = Record<string, string | string[]>;

export type CoBrandDraftState = {
  enabled: boolean | null;
  selected: string[];
  values: Record<string, Values>;
  samples: Record<string, Record<string, string>>;
};

export const isPhoto = (type: string) => type.includes("photo") || type.includes("image");

const isEmpty = (v: string | string[] | undefined) =>
  v == null || (Array.isArray(v) ? v.length === 0 : String(v).trim() === "");

/**
 * State for the "other brands at this activation" part of the walk-up recap.
 * Each picked brand gets its own answers + per-SKU sample counts, submitted
 * as a separate slice so that brand's numbers land on its own dashboard.
 */
export function useCoBrandRecap(
  options: CoBrandOptions | null | undefined,
  initial?: CoBrandDraftState | null,
) {
  const brands = useMemo(() => options?.brands ?? [], [options]);
  const requested = options?.requestedTenantIds ?? [];
  const [enabled, setEnabled] = useState<boolean | null>(
    initial ? initial.enabled : requested.length > 0 ? true : null,
  );
  const [selected, setSelected] = useState<string[]>(initial?.selected ?? requested);
  const [values, setValues] = useState<Record<string, Values>>(initial?.values ?? {});
  const [samples, setSamples] = useState<Record<string, Record<string, string>>>(
    initial?.samples ?? {},
  );

  const active = enabled ? brands.filter((b) => selected.includes(b.tenantId)) : [];

  const toggle = (tenantId: string) =>
    setSelected((cur) =>
      cur.includes(tenantId) ? cur.filter((id) => id !== tenantId) : [...cur, tenantId],
    );
  const setValue = (tenantId: string, fieldId: string, v: string | string[]) =>
    setValues((cur) => ({ ...cur, [tenantId]: { ...cur[tenantId], [fieldId]: v } }));
  const setSample = (tenantId: string, productId: string, qty: string) =>
    setSamples((cur) => ({ ...cur, [tenantId]: { ...cur[tenantId], [productId]: qty } }));

  const validate = (): string | null => {
    if (brands.length === 0) return null;
    if (enabled == null) return "Please say whether other brands were sampled at this activation.";
    if (!enabled) return null;
    if (active.length === 0) return "Pick the other brand(s) you sampled, or choose No.";
    for (const brand of active) {
      for (const s of brand.sections) {
        const signoff = s.fields.some((f) => isSignatureType(f.type));
        for (const f of s.fields) {
          if (!f.required || isPhoto(f.type)) continue;
          const raw = values[brand.tenantId]?.[f.id];
          const text = Array.isArray(raw) ? "" : String(raw ?? "");
          if (isSignatureType(f.type)) {
            const err = signatureError(text);
            if (err) return `${brand.name}: ${err}`;
            continue;
          }
          if (isLetterType(f.type)) {
            if (!letterValue(text)) return `${brand.name}: Last initial is one letter.`;
            continue;
          }
          if (signoff && f.name.trim().toLowerCase() === "first name") {
            const err = clerkFirstNameError(text);
            if (err) return `${brand.name}: ${err}`;
            continue;
          }
          if (isEmpty(raw)) {
            return `${brand.name}: please fill in "${f.name}".`;
          }
        }
      }
    }
    return null;
  };

  /** `undefined` = this walk-up has no sibling brands; `[]` = single brand. */
  const payload = (): CoBrandSubmit[] | undefined => {
    if (brands.length === 0) return undefined;
    return active.map((brand) => {
      const brandValues = values[brand.tenantId] ?? {};
      const brandSamples = samples[brand.tenantId] ?? {};
      const fields = brand.sections.flatMap((s) => s.fields);
      const picked = fields
        .filter((f) => isProductsSampledMultiselect(f))
        .flatMap((f) => {
          const raw = brandValues[f.id];
          return Array.isArray(raw) ? raw.map(String) : [];
        });
      return {
        tenantId: brand.tenantId,
        fieldValues: Object.entries(brandValues)
          .map(([id, v]) => {
            const field = fields.find((f) => f.id === id);
            let value = Array.isArray(v) ? JSON.stringify(v) : String(v);
            if (field && isLetterType(field.type)) value = letterValue(value);
            if (
              field &&
              field.name.trim().toLowerCase() === "first name" &&
              fields.some((f) => isSignatureType(f.type))
            ) {
              value = clerkFirstNameValue(value);
            }
            return { customFieldId: id, value };
          })
          .filter((fv) => fv.value !== "" && fv.value !== "[]"),
        productSamples: productSamplesFromSelections(
          picked,
          brandSamples,
          brand.products,
          (raw) => {
            const n = Number(raw);
            return Number.isFinite(n) ? n : null;
          },
        ),
      };
    });
  };

  return {
    brands,
    groupName: options?.groupName ?? "",
    enabled,
    setEnabled,
    selected,
    toggle,
    active,
    values,
    setValue,
    samples,
    setSample,
    validate,
    payload,
  };
}

export type CoBrandRecapState = ReturnType<typeof useCoBrandRecap>;
