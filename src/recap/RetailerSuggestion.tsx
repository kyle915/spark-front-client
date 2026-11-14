import { useState } from "react";
import { useMutation } from "react-relay/hooks";
import { DecideRetailerProposalMutation } from "@/api/mutations/DecideRetailerProposalMutation";
import type { DecideRetailerProposalMutation as DecideRetailerProposalMutationType } from "@/api/mutations/__generated__/DecideRetailerProposalMutation.graphql";
import { useAlertStore } from "@/store/alertStore";
import { suggestionSentence, tickedByDefault } from "./retailerSuggestionCopy";

export type RetailerProposal = {
  readonly id: string;
  readonly name: string;
  readonly confidence: string;
  readonly sourceLabel: string;
  readonly reason: string;
  readonly isNewRetailer: boolean;
};

/**
 * Spark's suggested retailer for a recap whose event has none (it would
 * report under "Unknown"). Staff only: the server sends no proposal to a
 * brand user.
 *
 * The default path is one click the reviewer was already making: leave the
 * box ticked and approving the recap sets the store. They can also set it
 * now, correct the name, or dismiss it.
 */
export function RetailerSuggestion({
  recapId,
  proposal,
  acceptOnApprove,
  onAcceptOnApproveChange,
  approved,
}: {
  recapId: string;
  proposal: RetailerProposal;
  acceptOnApprove: boolean;
  onAcceptOnApproveChange: (next: boolean) => void;
  approved: boolean;
}) {
  const { showAlert } = useAlertStore();
  const [commit, busy] = useMutation<DecideRetailerProposalMutationType>(
    DecideRetailerProposalMutation,
  );
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(proposal.name);

  const decide = (accept: boolean, retailerName?: string) => {
    commit({
      variables: {
        input: { proposalId: proposal.id, accept, retailerName: retailerName ?? null },
      },
      // The suggestion is settled either way; an accepted one names the store.
      updater: (store, data) => {
        const payload = data?.decideRetailerProposal;
        if (!payload?.success) return;
        const record = store.get(recapId);
        if (!record) return;
        record.setValue(null, "retailerProposal");
        if (payload.retailerName) record.setValue(payload.retailerName, "eventRetailer");
      },
      onCompleted: (res) => {
        const payload = res.decideRetailerProposal;
        showAlert(
          payload?.message ?? "Could not save that.",
          payload?.success ? "success" : "error",
        );
      },
      onError: (err) => showAlert(`Could not save that: ${err.message}`, "error"),
    });
  };

  const trimmed = name.trim();

  return (
    <section className="spark-card p-5 mb-6" aria-label="Suggested store">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h3 className="font-bold">No store on this recap</h3>
          <p className="text-sm mt-1" style={{ color: "var(--spark-text-secondary)" }}>
            {suggestionSentence(proposal)}
          </p>
          {proposal.reason ? (
            <p className="text-[13px] mt-1" style={{ color: "var(--spark-text-meta)" }}>
              {proposal.reason}
            </p>
          ) : null}
        </div>
        {!editing ? (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              disabled={busy}
              onClick={() => decide(true)}
              className="px-3 py-2 rounded-xl text-sm font-semibold"
              style={{
                background: "var(--spark-lime)",
                color: "var(--spark-on-accent)",
                opacity: busy ? 0.5 : 1,
              }}
            >
              Use {proposal.name}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setEditing(true)}
              className="px-3 py-2 rounded-xl text-sm"
              style={{ border: "1px solid var(--spark-border)" }}
            >
              Change
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => decide(false)}
              className="px-3 py-2 rounded-xl text-sm"
              style={{ color: "var(--spark-text-secondary)" }}
            >
              Dismiss
            </button>
          </div>
        ) : null}
      </div>

      {editing ? (
        <form
          className="flex items-center gap-2 flex-wrap mt-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (trimmed) decide(true, trimmed);
          }}
        >
          <label className="sr-only" htmlFor="retailer-suggestion-name">
            Store name
          </label>
          <input
            id="retailer-suggestion-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={255}
            autoFocus
            className="px-3 py-2 rounded-xl text-sm flex-1 min-w-[200px]"
            style={{
              border: "1px solid var(--spark-border)",
              background: "rgba(var(--spark-ink-rgb),0.04)",
              color: "var(--spark-text)",
            }}
          />
          <button
            type="submit"
            disabled={busy || !trimmed}
            className="px-3 py-2 rounded-xl text-sm font-semibold"
            style={{
              background: "var(--spark-lime)",
              color: "var(--spark-on-accent)",
              opacity: busy || !trimmed ? 0.5 : 1,
            }}
          >
            Set store
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setEditing(false);
              setName(proposal.name);
            }}
            className="px-3 py-2 rounded-xl text-sm"
            style={{ color: "var(--spark-text-secondary)" }}
          >
            Cancel
          </button>
        </form>
      ) : !approved ? (
        <label
          className="flex items-center gap-2 mt-4 text-sm cursor-pointer"
          style={{ color: "var(--spark-text-secondary)" }}
        >
          <input
            type="checkbox"
            checked={acceptOnApprove}
            onChange={(e) => onAcceptOnApproveChange(e.target.checked)}
          />
          Set the store to {proposal.name} when I approve this recap
        </label>
      ) : null}
    </section>
  );
}

export { tickedByDefault };
