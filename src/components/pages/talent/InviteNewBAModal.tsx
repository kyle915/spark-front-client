import { useState } from "react";
import { useMutation } from "react-relay/hooks";
import { CreateAmbassadorInvitationMutation } from "@/api/mutations/CreateAmbassadorInvitationMutation";
import type { CreateAmbassadorInvitationMutation as CreateAmbassadorInvitationMutationType } from "@api/mutations/__generated__/CreateAmbassadorInvitationMutation.graphql";
import { useAuthStore } from "@/store/authStore";
import { useAlertStore } from "@/store/alertStore";
import SparkOverlay from "@/shared/SparkOverlay";

/**
 * Email-invite a new Brand Ambassador to the current tenant.
 *
 * This is the "+ Invite BA" modal triggered from the Talent page
 * header (the one Nevena flagged after Yvette went missing — there
 * was no UI path to add a new BA to the roster). Backend sends a
 * magic-link activation email; once the BA accepts, they show up
 * as an active row on /talent.
 *
 * Why a separate component from the existing InviteBAModal:
 *   - That one invites an EXISTING BA to a specific shift (creates
 *     an AmbassadorEvent row).
 *   - This one creates a FRESH ambassador invitation (creates an
 *     AmbassadorInvitation row + sends email).
 * Same words, very different mutations — easier to keep distinct.
 */

type Props = {
  onClose: () => void;
  onInvited?: (email: string) => void;
};

export default function InviteNewBAModal({ onClose, onInvited }: Props) {
  const { tenantId } = useAuthStore();
  const showAlert = useAlertStore((s) => s.showAlert);
  const [email, setEmail] = useState("");
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const [commit, isInviting] =
    useMutation<CreateAmbassadorInvitationMutationType>(
      CreateAmbassadorInvitationMutation,
    );

  // Cheap RFC-ish email check — the backend re-validates so we just
  // want to spare a round-trip on obvious typos.
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const submit = () => {
    setSubmitAttempted(true);
    const trimmed = email.trim();
    if (!emailValid) return;
    commit({
      variables: {
        input: {
          email: trimmed,
          tenantId: tenantId ?? null,
        },
      },
      onCompleted: (resp) => {
        const r = resp.createAmbassadorInvitation;
        if (r?.success) {
          showAlert(
            r.message || `Invitation emailed to ${trimmed}.`,
            "success",
          );
          onInvited?.(trimmed);
          onClose();
        } else {
          showAlert(
            r?.message || "Couldn't send invitation.",
            "error",
          );
        }
      },
      onError: (err) => {
        showAlert(err.message || "Couldn't send invitation.", "error");
      },
    });
  };

  return (
    <SparkOverlay onClose={onClose} size="md" label="Invite a Brand Ambassador">
      <div className="overflow-hidden">
        <div
          className="p-5"
          style={{ borderBottom: "1px solid var(--spark-border)" }}
        >
          <p
            className="mono text-[10px] mb-1"
            style={{
              letterSpacing: "0.18em",
              color: "rgba(255,255,255,0.45)",
            }}
          >
            INVITE A BRAND AMBASSADOR
          </p>
          <h2 className="display text-xl font-bold">
            Add a new BA to the roster.
          </h2>
          <p
            className="text-[12px] mt-1.5"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            We&rsquo;ll email a magic-link sign-up. They finish account
            setup themselves (name, password, address).
          </p>
        </div>

        <div className="p-5 space-y-3">
          <div>
            <label
              className="label-mini block mb-1.5"
              style={{ color: "rgba(255,255,255,0.55)" }}
            >
              Email
            </label>
            <input
              autoFocus
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && emailValid && !isInviting) submit();
              }}
              placeholder="ba@example.com"
              className="w-full rounded-xl text-sm"
              style={{
                padding: "0.65rem 0.9rem",
                background: "var(--spark-bg)",
                border: `1px solid ${
                  submitAttempted && !emailValid
                    ? "var(--spark-orange, #ef5a2a)"
                    : "var(--spark-border)"
                }`,
                color: "var(--spark-text)",
                outline: "none",
              }}
            />
            {submitAttempted && !emailValid && (
              <p
                className="text-[11px] mt-1.5"
                style={{ color: "var(--spark-orange, #ef5a2a)" }}
              >
                Enter a valid email address.
              </p>
            )}
          </div>
        </div>

        <div
          className="p-4 flex items-center justify-end gap-2"
          style={{ borderTop: "1px solid var(--spark-border)" }}
        >
          <button
            onClick={onClose}
            disabled={isInviting}
            className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
            style={{
              background: "transparent",
              color: "var(--spark-text)",
              border: "1px solid var(--spark-border)",
            }}
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={isInviting || !emailValid}
            className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40"
            style={{
              background: "var(--spark-lime)",
              color: "#0a0d09",
              boxShadow:
                emailValid && !isInviting
                  ? "0 0 16px rgba(197,245,70,0.35)"
                  : "none",
            }}
          >
            {isInviting ? "Sending…" : "Send invite"}
          </button>
        </div>
      </div>
    </SparkOverlay>
  );
}
