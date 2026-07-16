import { useState } from "react";
import { useMutation } from "react-relay/hooks";
import {
  GenerateWalkupCodeMutation,
  RevokeWalkupCodeMutation,
} from "@/api/mutations/WalkupMutations";
import type { WalkupMutationsGenerateMutation as GenType } from "@api/mutations/__generated__/WalkupMutationsGenerateMutation.graphql";
import type { WalkupMutationsRevokeMutation as RevokeType } from "@api/mutations/__generated__/WalkupMutationsRevokeMutation.graphql";
import { useAlertStore } from "@/store/alertStore";

/**
 * Walk-up access control for an event. An admin generates a short code (shown
 * with a scannable QR) that a BA enters in the app to clock in + file a recap
 * WITHOUT being pre-assigned. Generating enables walk-ups for the event;
 * "Turn off" revokes the code. Walk-ups then land in the Walk-ups queue for
 * review. The code is generated on demand (regenerating replaces it).
 */
export default function WalkupCodePanel({ eventUuid }: { eventUuid: string }) {
  const showAlert = useAlertStore((s) => s.showAlert);
  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [off, setOff] = useState(false);

  const [commitGen, generating] = useMutation<GenType>(
    GenerateWalkupCodeMutation,
  );
  const [commitRevoke, revoking] = useMutation<RevokeType>(
    RevokeWalkupCodeMutation,
  );

  const generate = () => {
    commitGen({
      variables: { input: { eventUuid } },
      onCompleted: (resp) => {
        const r = resp.generateWalkupCode;
        if (r?.success && r.code) {
          setCode(r.code);
          setExpiresAt(r.expiresAt ?? null);
          setOff(false);
        } else {
          showAlert(r?.message || "Couldn't generate a code.", "error");
        }
      },
      onError: (e) => showAlert(e.message, "error"),
    });
  };

  const revoke = () => {
    commitRevoke({
      variables: { input: { eventUuid } },
      onCompleted: (resp) => {
        const r = resp.revokeWalkupCode;
        if (r?.success) {
          setCode(null);
          setExpiresAt(null);
          setOff(true);
          showAlert("Walk-ups turned off for this event.", "success");
        } else {
          showAlert(r?.message || "Couldn't turn off walk-ups.", "error");
        }
      },
      onError: (e) => showAlert(e.message, "error"),
    });
  };

  const copy = () => {
    if (code) {
      navigator.clipboard?.writeText(code).then(
        () => showAlert("Code copied.", "success"),
        () => {},
      );
    }
  };

  // A self-contained QR of the code (no external lib) via a public QR image
  // service would violate CSP; instead we show the big code + let the BA type
  // it. (QR image generation is a Phase-4 nicety.)
  return (
    <div
      className="spark-card p-5"
      style={{ borderRadius: 16, marginTop: 16 }}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <p
          className="mono text-[10px]"
          style={{ letterSpacing: "0.18em", color: "var(--spark-lime)" }}
        >
          WALK-UP ACCESS
        </p>
      </div>
      <p className="text-sm mb-3" style={{ color: "rgba(255,255,255,0.55)" }}>
        Give this code to anyone working the event so they can clock in + file a
        recap without being assigned. They enter it in the app under “Clock in
        with a code.” You review each walk-up in Walk-ups.
      </p>

      {code ? (
        <>
          <div
            className="flex items-center justify-center rounded-xl mb-2"
            style={{
              background: "var(--spark-bg)",
              border: "1px solid var(--spark-border)",
              padding: "1rem",
            }}
          >
            <span
              className="mono font-bold"
              style={{ fontSize: 34, letterSpacing: 8, color: "var(--spark-text)" }}
            >
              {code}
            </span>
          </div>
          {expiresAt ? (
            <p
              className="mono text-[10px] mb-3 text-center"
              style={{ color: "rgba(255,255,255,0.4)", letterSpacing: "0.08em" }}
            >
              Valid through {new Date(expiresAt).toLocaleDateString()}
            </p>
          ) : null}
          <div className="flex items-center gap-2">
            <button
              onClick={copy}
              className="px-4 py-2 rounded-xl text-sm font-semibold flex-1"
              style={{ background: "var(--spark-lime)", color: "#0a0d09" }}
            >
              Copy code
            </button>
            <button
              onClick={generate}
              disabled={generating}
              className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
              style={{
                background: "transparent",
                color: "var(--spark-text)",
                border: "1px solid var(--spark-border)",
              }}
            >
              New code
            </button>
            <button
              onClick={revoke}
              disabled={revoking}
              className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
              style={{
                background: "transparent",
                color: "var(--spark-orange)",
                border: "1px solid rgba(239,90,42,0.35)",
              }}
            >
              Turn off
            </button>
          </div>
        </>
      ) : (
        <button
          onClick={generate}
          disabled={generating}
          className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
          style={{ background: "var(--spark-lime)", color: "#0a0d09" }}
        >
          {generating
            ? "Generating…"
            : off
              ? "Walk-ups off — generate a new code"
              : "Generate walk-up code"}
        </button>
      )}
    </div>
  );
}
