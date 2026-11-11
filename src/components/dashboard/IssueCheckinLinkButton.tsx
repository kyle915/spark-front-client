import { useMutation } from "react-relay/hooks";
import { graphql } from "react-relay";
import type { IssueCheckinLinkButtonMutation as MutationType } from "./__generated__/IssueCheckinLinkButtonMutation.graphql";
import { useAlertStore } from "@/store/alertStore";

const Mutation = graphql`
  mutation IssueCheckinLinkButtonMutation($input: IssueCheckinCodeInput!) {
    issueCheckinCode(input: $input) {
      success
      message
      code
      url
      created
    }
  }
`;

/**
 * Issues the brand's standing ambassador check-in link from the setup
 * checklist. Staff only (the server enforces it). A brand that already has
 * a link keeps it — the link is never rotated.
 */
const IssueCheckinLinkButton: React.FC<{ tenantId: string; onIssued: () => void }> = ({
  tenantId,
  onIssued,
}) => {
  const showAlert = useAlertStore((s) => s.showAlert);
  const [commit, busy] = useMutation<MutationType>(Mutation);

  const issue = () => {
    if (busy) return;
    commit({
      variables: { input: { tenantId } },
      onCompleted: (res) => {
        const r = res.issueCheckinCode;
        if (!r?.success || !r.url) {
          showAlert(r?.message || "Couldn't issue a check-in link.", "error");
          return;
        }
        const url = r.url;
        const message = r.message;
        void navigator.clipboard
          .writeText(url)
          .then(
            () => showAlert(`${message} Copied to your clipboard.`, "success"),
            // Clipboard blocked: the link is still shown on Walk-ups.
            () => showAlert(`${message} Find it on Walk-ups.`, "success"),
          );
        onIssued();
      },
      onError: () => showAlert("Couldn't issue a check-in link.", "error"),
    });
  };

  return (
    <button
      type="button"
      onClick={issue}
      disabled={busy}
      className="text-sm underline shrink-0 disabled:opacity-50"
    >
      {busy ? "Issuing…" : "Issue link"}
    </button>
  );
};

export default IssueCheckinLinkButton;
