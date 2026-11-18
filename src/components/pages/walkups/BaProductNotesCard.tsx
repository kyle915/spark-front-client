import { Component, Suspense, useState, type ReactNode } from "react";
import { graphql } from "react-relay";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import type { BaProductNotesCardQuery as QueryType } from "./__generated__/BaProductNotesCardQuery.graphql";
import type { BaProductNotesCardSaveMutation as SaveType } from "./__generated__/BaProductNotesCardSaveMutation.graphql";
import { useAuthStore } from "@/store/authStore";
import { useAlertStore } from "@/store/alertStore";
import useSparkRole from "@/hooks/useSparkRole";
import { askedWhen, outcomeLabel } from "./baProductNotes";

const Query = graphql`
  query BaProductNotesCardQuery($tenantId: ID!) {
    baProductQa(tenantId: $tenantId) {
      notes
      hasMaterial
      aiAvailable
      questions {
        question
        answer
        outcome
        askedAt
        eventName
      }
    }
  }
`;

const SaveMutation = graphql`
  mutation BaProductNotesCardSaveMutation($tenantId: ID!, $notes: String!) {
    setBaProductNotes(tenantId: $tenantId, notes: $notes) {
      notes
      hasMaterial
      aiAvailable
      questions {
        question
        answer
        outcome
        askedAt
        eventName
      }
    }
  }
`;

const NOTES_MAX = 8000;
const meta = { color: "var(--spark-text-meta)" } as const;

const Body: React.FC<{ tenantId: string }> = ({ tenantId }) => {
  const [fetchKey, setFetchKey] = useState(0);
  const data = useLazyLoadQuery<QueryType>(
    Query,
    { tenantId },
    { fetchPolicy: "store-and-network", fetchKey },
  );
  const qa = data.baProductQa;
  const showAlert = useAlertStore((s) => s.showAlert);
  const [draft, setDraft] = useState<string | null>(null);
  const [commit, saving] = useMutation<SaveType>(SaveMutation);
  if (!qa) return null;
  const value = draft ?? qa.notes;
  const dirty = draft !== null && draft.trim() !== qa.notes.trim();

  const save = () => {
    commit({
      variables: { tenantId, notes: value },
      onCompleted: (_resp, errors) => {
        if (errors?.length) {
          showAlert(errors[0].message, "error");
          return;
        }
        setDraft(null);
        setFetchKey((k) => k + 1);
        showAlert("Product notes saved.", "success");
      },
      onError: (e) => showAlert(e.message, "error"),
    });
  };

  return (
    <section className="spark-card p-4 mb-5" aria-label="BA product notes">
      <h3 className="font-semibold text-sm">BA product notes</h3>
      <p className="text-xs mt-1 mb-3" style={{ ...meta, lineHeight: 1.5 }}>
        Ambassadors can ask product questions on the check-in page. Answers come only from these
        notes, this brand's product list and its training hub. Write the facts a BA gets asked at
        the table: ingredients, caffeine, ABV or THC per serving, sizes, what not to say.
      </p>
      <textarea
        value={value}
        disabled={saving}
        maxLength={NOTES_MAX}
        onChange={(e) => setDraft(e.target.value)}
        rows={8}
        placeholder={"OG Luxe: 100mg caffeine per 12oz can, 10 calories.\nDon't describe health benefits — say \"check the can\"."}
        className="rounded-xl text-sm w-full"
        style={{
          padding: "0.55rem 0.9rem",
          background: "var(--spark-bg)",
          border: "1px solid var(--spark-border)",
          color: "var(--spark-text)",
          outline: "none",
          resize: "vertical",
          minHeight: 140,
          opacity: saving ? 0.6 : 1,
        }}
      />
      <div className="flex flex-wrap items-center gap-3 mt-3">
        <button
          type="button"
          onClick={save}
          disabled={saving || !dirty}
          className="px-4 py-2.5 rounded-xl text-sm font-semibold"
          style={{
            background: "var(--spark-lime)",
            color: "var(--spark-on-accent)",
            opacity: saving || !dirty ? 0.5 : 1,
          }}
        >
          {saving ? "Saving…" : "Save notes"}
        </button>
        <span className="text-xs" style={meta}>
          {value.length.toLocaleString()} / {NOTES_MAX.toLocaleString()}
          {qa.aiAvailable ? "" : " · AI is not configured, so BAs see “not available right now”"}
        </span>
      </div>

      <h4 className="font-semibold text-sm mt-5">Recent questions from BAs</h4>
      {qa.questions.length === 0 ? (
        <p className="text-xs mt-1" style={meta}>
          No questions yet.
        </p>
      ) : (
        <ul className="list-none p-0 m-0 mt-1">
          {qa.questions.map((q, i) => (
            <li
              key={`${q.askedAt}-${i}`}
              className="py-2 text-sm"
              style={{ borderTop: "1px solid var(--spark-hairline)" }}
            >
              <span className="block">{q.question}</span>
              <span className="block text-xs mt-0.5" style={meta}>
                {[outcomeLabel(q.outcome), askedWhen(q.askedAt), q.eventName]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
              {q.outcome === "answered" ? (
                <span className="block text-xs mt-0.5" style={meta}>
                  {q.answer}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

/** Staff tooling must never take the Walk-ups page down with it. */
class Quiet extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * Staff-only: the facts BAs' product questions are answered from, and what
 * BAs have been asking (spark-api `baProductQa` / `setBaProductNotes`).
 */
const BaProductNotesCard: React.FC = () => {
  const { tenantId } = useAuthStore();
  const { isAdmin } = useSparkRole();
  if (!isAdmin || !tenantId) return null;
  return (
    <Quiet>
      <Suspense fallback={null}>
        <Body tenantId={String(tenantId)} />
      </Suspense>
    </Quiet>
  );
};

export default BaProductNotesCard;
