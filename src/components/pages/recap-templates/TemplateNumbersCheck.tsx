import { previewLines, type TemplatePreview } from "@/lib/kpiExplain";

/**
 * The warning shown before a recap template goes live when the draft leaves
 * a standard number without a field, or a count-like field uncounted. See
 * useTemplateNumbersCheck. Saving needs an explicit choice here; it is never
 * blocked.
 */

const quiet: React.CSSProperties = {
  background: "transparent",
  color: "var(--spark-text)",
  border: "1px solid var(--spark-border)",
};

export const TemplateNumbersCheckPanel: React.FC<{
  preview: TemplatePreview;
  busy: boolean;
  saveLabel: string;
  onKeepEditing: () => void;
  onSaveAndReview: () => void;
  onSaveAnyway: () => void;
}> = ({ preview, busy, saveLabel, onKeepEditing, onSaveAndReview, onSaveAnyway }) => (
  <div role="alert" className="spark-card p-5" style={{ borderRadius: 16 }}>
    <p className="text-sm font-semibold" style={{ color: "var(--spark-text)" }}>
      Check the numbers before this goes live
    </p>
    <ul className="mt-2 flex flex-col gap-1.5 list-disc pl-5">
      {previewLines(preview).map((line) => (
        <li key={line} className="text-[13px]" style={{ color: "var(--spark-text-secondary)" }}>
          {line}
        </li>
      ))}
    </ul>
    <div className="flex flex-wrap items-center justify-end gap-2 mt-4">
      <button
        type="button"
        onClick={onKeepEditing}
        disabled={busy}
        className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
        style={quiet}
      >
        Keep editing
      </button>
      <button
        type="button"
        onClick={onSaveAndReview}
        disabled={busy}
        className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
        style={quiet}
      >
        Save and review mapping
      </button>
      <button
        type="button"
        onClick={onSaveAnyway}
        disabled={busy}
        className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
        style={{ background: "var(--spark-lime)", color: "var(--spark-on-accent)" }}
      >
        {busy ? "Saving…" : saveLabel}
      </button>
    </div>
  </div>
);
