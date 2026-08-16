import type { ReactNode } from "react";
import { formatRecapFieldLabel } from "./recapFieldLabel";

const rowBorder = "1px solid var(--spark-border, #1f2418)";
const labelInk = "rgba(242, 243, 238, 0.82)";

/** Grouped inset stack — Apple-settings rows on dark recap chrome. */
export function RecapFieldStack({ children }: { children: ReactNode }) {
  return (
    <div
      className="rounded-xl overflow-hidden divide-y"
      style={{
        border: rowBorder,
        background: "rgba(255,255,255,0.03)",
        borderColor: "var(--spark-border, #1f2418)",
      }}
    >
      {children}
    </div>
  );
}

export function RecapFieldRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div
      className="flex items-start justify-between gap-4 px-4 py-3"
      style={{ borderColor: "var(--spark-border, #1f2418)" }}
    >
      <span className="text-sm leading-snug min-w-0" style={{ color: labelInk }}>
        {formatRecapFieldLabel(label)}
      </span>
      <div
        className="shrink-0 text-right tabular-nums font-semibold text-base leading-snug"
        style={{ color: "var(--spark-text, #f2f3ee)" }}
      >
        {children}
      </div>
    </div>
  );
}

export function RecapFieldBlockLabel({ label }: { label: string }) {
  return (
    <p className="text-sm leading-snug mb-2" style={{ color: labelInk }}>
      {formatRecapFieldLabel(label)}
    </p>
  );
}

export type RecapShareField = {
  name: string;
  value?: string | null;
  imageUrl?: string | null;
};

/** Public / client recap: lime section + grouped metric rows. */
export function RecapShareFieldSections({
  sections,
}: {
  sections: { name: string; fields: RecapShareField[] }[];
}) {
  return (
    <>
      {sections.map((section) => {
        const withValue = section.fields.filter(
          (f) => f.imageUrl || Boolean((f.value ?? "").trim()),
        );
        const rows = withValue.filter(
          (f) => !f.imageUrl && (f.value ?? "").length <= 50,
        );
        const images = withValue.filter((f) => f.imageUrl);
        const notes = withValue.filter(
          (f) => !f.imageUrl && (f.value ?? "").length > 50,
        );
        if (rows.length === 0 && images.length === 0 && notes.length === 0) {
          return null;
        }
        return (
          <div key={section.name} className="spark-card p-6">
            <p
              className="mono text-[10px] mb-4"
              style={{
                letterSpacing: "0.18em",
                color: "var(--recap-brand, var(--spark-lime, #c5f546))",
              }}
            >
              {section.name.toUpperCase()}
            </p>
            {rows.length > 0 && (
              <RecapFieldStack>
                {rows.map((f) => (
                  <RecapFieldRow key={f.name} label={f.name}>
                    {f.value || "—"}
                  </RecapFieldRow>
                ))}
              </RecapFieldStack>
            )}
            {notes.map((f) => (
              <div key={f.name} className={rows.length > 0 ? "mt-4" : undefined}>
                <RecapFieldBlockLabel label={f.name} />
                <p
                  className="text-sm leading-relaxed whitespace-pre-wrap"
                  style={{ color: "rgba(242,243,238,0.88)" }}
                >
                  {f.value}
                </p>
              </div>
            ))}
            {images.map((f) => (
              <div key={f.name} className="mt-4">
                <RecapFieldBlockLabel label={f.name} />
                <img
                  src={f.imageUrl ?? ""}
                  alt={formatRecapFieldLabel(f.name)}
                  className="max-h-64 w-auto rounded-lg object-contain"
                />
              </div>
            ))}
          </div>
        );
      })}
    </>
  );
}
