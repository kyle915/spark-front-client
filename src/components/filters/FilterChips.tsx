import type { CSSProperties } from "react";

export type FilterChip<K extends string = string> = { key: K; text: string };

const META: CSSProperties = { color: "var(--spark-text-meta)" };

/**
 * The filter a search ran on, as chips. Clicking a chip's text opens it for
 * editing; the × removes it. Used wherever a sentence is read into a
 * filter (Find ambassadors, the recaps and requests search), so a wrong
 * reading is always visible and fixable the same way.
 */
export default function FilterChips<K extends string>({
  chips,
  onEdit,
  onRemove,
  disabled = false,
  label = "Search filters",
}: {
  chips: ReadonlyArray<FilterChip<K>>;
  onEdit: (key: K) => void;
  onRemove: (key: K) => void;
  disabled?: boolean;
  label?: string;
}) {
  if (chips.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-2 mt-3" aria-label={label}>
      {chips.map((chip) => (
        <li
          key={chip.key}
          className="inline-flex items-center rounded-full text-[13px]"
          style={{ border: "1px solid var(--spark-border)" }}
        >
          <button
            type="button"
            onClick={() => onEdit(chip.key)}
            title="Change"
            className="pl-3 pr-1 py-1 rounded-l-full"
            style={{ color: "var(--spark-text)", background: "transparent" }}
          >
            {chip.text}
          </button>
          <button
            type="button"
            aria-label={`Remove ${chip.text}`}
            disabled={disabled}
            onClick={() => onRemove(chip.key)}
            className="pl-1 pr-3 py-1 rounded-r-full"
            style={{ ...META, background: "transparent" }}
          >
            <span aria-hidden>×</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
