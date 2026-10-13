import type { CSSProperties, ReactNode } from "react";
import { isPhoto, type CoBrand, type CoBrandField, type CoBrandRecapState } from "./coBrandRecap";

const pill = (on: boolean, accent: string): CSSProperties => ({
  padding: "10px 16px",
  borderRadius: 999,
  border: `1.5px solid ${on ? accent : "rgba(0,0,0,0.15)"}`,
  background: on ? accent : "transparent",
  color: on ? "#fff" : "inherit",
  fontWeight: 600,
  fontSize: 14,
  cursor: "pointer",
});

export function CoBrandToggleCard({
  state,
  hostName,
  accent,
  cardStyle,
  headingStyle,
}: {
  state: CoBrandRecapState;
  hostName: string;
  accent: string;
  cardStyle: CSSProperties;
  headingStyle: CSSProperties;
}) {
  if (state.brands.length === 0) return null;
  return (
    <div style={cardStyle}>
      <h2 style={headingStyle}>Multi-brand activation?</h2>
      <p style={{ fontSize: 13, opacity: 0.7, margin: "4px 0 10px" }}>
        {`Did you also sample another brand alongside ${hostName}? Each brand gets its own results so their numbers stay separate.`}
      </p>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" style={pill(state.enabled === false, accent)} onClick={() => state.setEnabled(false)}>
          No, just {hostName}
        </button>
        <button type="button" style={pill(state.enabled === true, accent)} onClick={() => state.setEnabled(true)}>
          Yes
        </button>
      </div>
      {state.enabled ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
          {state.brands.map((b) => {
            const on = state.selected.includes(b.tenantId);
            return (
              <button
                key={b.tenantId}
                type="button"
                aria-pressed={on}
                style={pill(on, b.primaryColor || accent)}
                onClick={() => state.toggle(b.tenantId)}
              >
                {b.name}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

/** One card per per-brand section of each picked co-brand. */
export function CoBrandSections({
  state,
  cardStyle,
  headingStyle,
  renderField,
}: {
  state: CoBrandRecapState;
  cardStyle: CSSProperties;
  headingStyle: CSSProperties;
  renderField: (args: {
    brand: CoBrand;
    field: CoBrandField;
    value: string | string[] | undefined;
    onChange: (v: string | string[]) => void;
    sampleQtys: Record<string, string>;
    onSampleQtyChange: (productId: string, qty: string) => void;
  }) => ReactNode;
}) {
  return (
    <>
      {state.active.flatMap((brand) =>
        brand.sections.map((section) => (
          <div
            key={`${brand.tenantId}-${section.id}`}
            style={{ ...cardStyle, borderTop: `4px solid ${brand.primaryColor || "#999"}` }}
          >
            <h2 style={headingStyle}>
              {brand.name} · {section.name}
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 4 }}>
              {section.fields
                .filter((f) => !isPhoto(f.type))
                .map((f) => (
                  <div key={f.id}>
                    {renderField({
                      brand,
                      field: f,
                      value: state.values[brand.tenantId]?.[f.id],
                      onChange: (v) => state.setValue(brand.tenantId, f.id, v),
                      sampleQtys: state.samples[brand.tenantId] ?? {},
                      onSampleQtyChange: (productId, qty) =>
                        state.setSample(brand.tenantId, productId, qty),
                    })}
                  </div>
                ))}
            </div>
          </div>
        )),
      )}
    </>
  );
}
