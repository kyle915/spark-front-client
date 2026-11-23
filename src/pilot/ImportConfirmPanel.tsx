import {
  duplicateColumnFields,
  type ColumnGuess,
  type FieldChoice,
  type StoreMatch,
} from "./importConfirm";

const META = { color: "var(--spark-text-meta)" } as const;
const FIELD_STYLE = {
  border: "1px solid var(--spark-border)",
  background: "var(--spark-field-bg, var(--spark-surface))",
  color: "var(--spark-text)",
} as const;

/**
 * Column guesses for an agency CSV. Checking a row is the confirm step.
 * Unchecked rows, including model suggestions, are not sent on commit.
 */
export function ColumnConfirmPanel({
  guesses,
  fields,
  onToggle,
  onField,
}: {
  guesses: readonly ColumnGuess[];
  fields: readonly FieldChoice[];
  onToggle: (header: string, included: boolean) => void;
  onField: (header: string, field: string) => void;
}) {
  if (guesses.length === 0) return null;
  const clashes = duplicateColumnFields(guesses);
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">Confirm columns</h3>
      <p className="text-xs" style={META}>
        Known headers start on. A suggested header stays off until you check it.
        Nothing is imported until you commit.
      </p>
      {clashes.length > 0 ? (
        <p className="text-xs" style={{ color: "var(--spark-text)" }}>
          More than one header is checked for the same Spark field. Uncheck one
          before you update the preview or commit. Neither header is used until you do.
        </p>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr style={META}>
              <th className="py-1.5 pr-3">Use</th>
              <th className="py-1.5 pr-3">CSV header</th>
              <th className="py-1.5 pr-3">Spark field</th>
              <th className="py-1.5">Why</th>
            </tr>
          </thead>
          <tbody>
            {guesses.map((guess) => (
              <tr
                key={guess.header}
                style={{ borderTop: "1px solid var(--spark-border)" }}
              >
                <td className="py-1.5 pr-3">
                  <input
                    type="checkbox"
                    checked={guess.applied}
                    aria-label={`Use ${guess.header}`}
                    onChange={(event) => onToggle(guess.header, event.target.checked)}
                  />
                </td>
                <td className="py-1.5 pr-3 font-medium">{guess.header}</td>
                <td className="py-1.5 pr-3">
                  <select
                    value={guess.field}
                    aria-label={`Field for ${guess.header}`}
                    onChange={(event) => onField(guess.header, event.target.value)}
                    className="px-2 py-1 rounded-lg"
                    style={FIELD_STYLE}
                  >
                    <option value="">Don’t use</option>
                    {fields.map((field) => (
                      <option key={field.key} value={field.key}>
                        {field.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-1.5" style={{ color: "var(--spark-text-secondary)" }}>
                  {guess.source === "model" && !guess.applied
                    ? `Suggestion only. ${guess.reason}`
                    : guess.reason}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Ambiguous store candidates. Picking one only fills the review dropdown. */
export function StoreMatchNote({
  match,
  onPick,
}: {
  match: StoreMatch | null;
  onPick?: (retailerId: string) => void;
}) {
  if (!match) return null;
  return (
    <div className="mt-1 space-y-1" style={{ color: "var(--spark-text-secondary)" }}>
      {match.aiReason ? <p>In plain English: {match.aiReason}</p> : null}
      {match.candidates.length > 0 ? (
        <ul className="space-y-0.5">
          {match.candidates.map((candidate) => (
            <li key={candidate.id}>
              {onPick ? (
                <button
                  type="button"
                  className="underline underline-offset-2"
                  style={{
                    color: "var(--spark-text)",
                    background: "none",
                    border: 0,
                    padding: 0,
                    cursor: "pointer",
                  }}
                  onClick={() => onPick(String(candidate.id))}
                >
                  {candidate.reason || candidate.name}
                </button>
              ) : (
                <span>{candidate.reason || candidate.name}</span>
              )}
            </li>
          ))}
        </ul>
      ) : null}
      <p>Nothing is matched until you pick a store.</p>
    </div>
  );
}
