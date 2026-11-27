import { useState } from "react";
import { usePublicProducts } from "../hooks";
import type { BrandGroupBrand } from "../hooks/useTenantPublic";
import type { CoBrandSelection } from "./coBrandPayload";

const pill = (active: boolean) => ({
  letterSpacing: "0.16em",
  background: active
    ? "var(--spark-lime, #14160f)"
    : "var(--spark-surface-2, #f1f1ec)",
  color: active
    ? "var(--spark-on-accent, #ffffff)"
    : "var(--spark-text-secondary, rgba(20, 22, 15, 0.78))",
  border: active
    ? "1px solid var(--spark-lime, #14160f)"
    : "1px solid var(--spark-border, #dcddd5)",
});

export default function CoBrandPicker({
  hostName,
  siblings,
  enabled,
  onEnabledChange,
  selection,
  onSelectionChange,
}: {
  hostName: string;
  siblings: BrandGroupBrand[];
  enabled: boolean | null;
  onEnabledChange: (next: boolean) => void;
  selection: CoBrandSelection;
  onSelectionChange: (next: CoBrandSelection) => void;
}) {
  const toggleBrand = (pk: string) => {
    const next = { ...selection };
    if (pk in next) delete next[pk];
    else next[pk] = [];
    onSelectionChange(next);
  };

  return (
    <div className="space-y-3">
      <p
        className="text-[13px]"
        style={{ color: "var(--spark-text-secondary, rgba(20, 22, 15, 0.74))" }}
      >
        Sampling another brand at the same table? Pick it here — each brand
        gets its own SKUs and its own recap numbers.
      </p>
      <div className="flex gap-2 flex-wrap">
        {[
          { value: false, label: "NO · ONLY " + hostName.toUpperCase() },
          { value: true, label: "YES · MULTI-BRAND" },
        ].map((opt) => (
          <button
            key={String(opt.value)}
            type="button"
            onClick={() => onEnabledChange(opt.value)}
            className="mono text-[10px] font-semibold px-3 py-2 rounded-md transition"
            style={pill(enabled === opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {enabled && (
        <>
          <div className="flex gap-2 flex-wrap">
            {siblings.map((brand) => {
              const key = String(brand.pk);
              const active = key in selection;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleBrand(key)}
                  className="mono text-[10px] font-semibold px-3 py-2 rounded-md transition"
                  style={pill(active)}
                >
                  {active ? "✓ " : "+ "}
                  {brand.name.toUpperCase()}
                </button>
              );
            })}
          </div>
          {siblings
            .filter((brand) => String(brand.pk) in selection)
            .map((brand) => (
              <CoBrandSkus
                key={brand.pk}
                brand={brand}
                selected={selection[String(brand.pk)] ?? []}
                onChange={(ids) =>
                  onSelectionChange({ ...selection, [String(brand.pk)]: ids })
                }
              />
            ))}
        </>
      )}
    </div>
  );
}

function CoBrandSkus({
  brand,
  selected,
  onChange,
}: {
  brand: BrandGroupBrand;
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const { products, loading, hasMore, loadMore } = usePublicProducts(
    brand.requestUrlName ?? "",
  );
  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  const [broken, setBroken] = useState<string[]>([]);

  return (
    <div
      className="rounded-xl p-3"
      style={{
        border: "1px solid var(--spark-border, #dcddd5)",
        background: "var(--spark-surface, #ffffff)",
      }}
    >
      <p
        className="mono text-[10px] font-semibold mb-2"
        style={{
          letterSpacing: "0.18em",
          color: "var(--spark-text-meta, rgba(20, 22, 15, 0.62))",
        }}
      >
        {brand.name.toUpperCase()} SKUS *
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {products.map((p) => {
          const active = selected.includes(p.id);
          return (
            <button
              type="button"
              key={p.id}
              onClick={() => toggle(p.id)}
              className="rounded-xl overflow-hidden text-left transition"
              style={{
                background: "var(--spark-surface, #ffffff)",
                border: active
                  ? "2px solid var(--spark-lime, #14160f)"
                  : "1px solid var(--spark-border, #dcddd5)",
              }}
            >
              <div
                className="relative w-full aspect-square"
                style={{ background: "var(--spark-surface-2, #f1f1ec)" }}
              >
                {p.image && !broken.includes(p.id) ? (
                  <img
                    src={p.image}
                    alt={p.name}
                    className="absolute inset-0 w-full h-full object-contain p-2"
                    onError={() => setBroken((cur) => [...cur, p.id])}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span
                      className="mono text-[10px]"
                      style={{ color: "var(--spark-text-meta, rgba(20, 22, 15, 0.52))" }}
                    >
                      NO IMAGE
                    </span>
                  </div>
                )}
              </div>
              <div className="p-2.5">
                <p
                  className="text-xs font-semibold leading-tight"
                  style={{ color: "var(--spark-text, #14160f)" }}
                >
                  {p.name}
                </p>
              </div>
            </button>
          );
        })}
      </div>
      {loading && (
        <p
          className="mono text-[10px] mt-2"
          style={{
            letterSpacing: "0.18em",
            color: "var(--spark-text-meta, rgba(20, 22, 15, 0.56))",
          }}
        >
          LOADING…
        </p>
      )}
      {hasMore && !loading && (
        <button
          type="button"
          onClick={loadMore}
          className="mono text-[10px] font-semibold px-3 py-2 rounded-lg mt-2"
          style={{
            letterSpacing: "0.16em",
            background: "var(--spark-surface-2, #f1f1ec)",
            color: "var(--spark-text, #14160f)",
            border: "1px solid var(--spark-border, #dcddd5)",
          }}
        >
          LOAD MORE
        </button>
      )}
    </div>
  );
}
