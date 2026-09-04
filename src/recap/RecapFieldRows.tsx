import type { ReactNode } from "react";
import {
  formatRecapFieldLabel,
  formatRecapProductName,
  recapLabelsMatch,
} from "./recapFieldLabel";
import { DropOffLocationsReadout } from "./DropOffLocationsField";
import { isDropOffLocationsField } from "./dropOffLocations";

const rowBorder = "1px solid var(--recap-border, var(--spark-border, #e2e4d8))";
const labelInk = "var(--recap-muted, #5c6154)";

/** Grouped inset stack — Apple-settings rows on dark recap chrome. */
export function RecapFieldStack({ children }: { children: ReactNode }) {
  return (
    <div
      className="rounded-xl overflow-hidden divide-y"
      style={{
        border: rowBorder,
        background: "rgba(20, 22, 15, 0.03)",
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
        style={{ color: "var(--recap-text, #14160f)" }}
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

/** Product / SKU chip — dark type on white, lime as a hairline accent only. */
export function RecapChoiceChip({ label }: { label: string }) {
  return <span className="recap-choice-chip">{formatRecapProductName(label)}</span>;
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
        const dropOffs = withValue.filter((f) => isDropOffLocationsField(f));
        const rows = withValue.filter(
          (f) =>
            !f.imageUrl &&
            (f.value ?? "").length <= 50 &&
            !isDropOffLocationsField(f),
        );
        const images = withValue.filter((f) => f.imageUrl);
        const notes = withValue.filter(
          (f) =>
            !f.imageUrl &&
            (f.value ?? "").length > 50 &&
            !isDropOffLocationsField(f),
        );
        if (
          rows.length === 0 &&
          images.length === 0 &&
          notes.length === 0 &&
          dropOffs.length === 0
        ) {
          return null;
        }
        return (
          <div key={section.name} className="spark-card p-6">
            <p
              className="text-sm font-semibold mb-4"
              style={{ color: "var(--recap-heading, #3f5c12)" }}
            >
              {formatRecapFieldLabel(section.name)}
            </p>
            {dropOffs.map((f) => (
              <div key={f.name} className={rows.length > 0 ? "mb-4" : undefined}>
                {!recapLabelsMatch(f.name, section.name) && (
                  <RecapFieldBlockLabel label={f.name} />
                )}
                <DropOffLocationsReadout value={f.value} />
              </div>
            ))}
            {rows.length > 0 && (
              <RecapFieldStack>
                {rows.map((f) => {
                  const choices = parseChoiceValue(f.value);
                  const hideLabel = recapLabelsMatch(f.name, section.name);
                  if (choices) {
                    return (
                      <div
                        key={f.name}
                        className="flex flex-wrap gap-2 px-4 py-3"
                      >
                        {!hideLabel && (
                          <span
                            className="w-full text-sm"
                            style={{ color: labelInk }}
                          >
                            {formatRecapFieldLabel(f.name)}
                          </span>
                        )}
                        {choices.map((choice) => (
                          <RecapChoiceChip key={choice} label={choice} />
                        ))}
                      </div>
                    );
                  }
                  return (
                    <RecapFieldRow key={f.name} label={f.name}>
                      {formatRecapProductName(f.value || "—")}
                    </RecapFieldRow>
                  );
                })}
              </RecapFieldStack>
            )}
            {notes.map((f) => (
              <div key={f.name} className={rows.length > 0 ? "mt-4" : undefined}>
                {!recapLabelsMatch(f.name, section.name) && (
                  <RecapFieldBlockLabel label={f.name} />
                )}
                <p
                  className="text-sm leading-relaxed whitespace-pre-wrap"
                  style={{ color: "var(--recap-text, #14160f)" }}
                >
                  {f.value}
                </p>
              </div>
            ))}
            {images.map((f) => (
              <div key={f.name} className="mt-4">
                {!recapLabelsMatch(f.name, section.name) && (
                  <RecapFieldBlockLabel label={f.name} />
                )}
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

function parseChoiceValue(value: string | null | undefined): string[] | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed) && parsed.every((v) => typeof v === "string")) {
      return parsed.map((v) => String(v));
    }
  } catch {
    /* not a choice list */
  }
  return null;
}
