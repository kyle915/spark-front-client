import { useState } from "react";
import { useMutation } from "react-relay/hooks";
import {
  GenerateWalkupCodeMutation,
  RevokeWalkupCodeMutation,
} from "@/api/mutations/WalkupMutations";
import type { WalkupMutationsGenerateMutation as GenType } from "@api/mutations/__generated__/WalkupMutationsGenerateMutation.graphql";
import type { WalkupMutationsRevokeMutation as RevokeType } from "@api/mutations/__generated__/WalkupMutationsRevokeMutation.graphql";
import { useAlertStore } from "@/store/alertStore";
import { checkinUrl } from "@/utils/publicHosts";
import CheckinQr from "@/components/pages/walkups/CheckinQr";
import {
  clearLiveWalkupCode,
  readLiveWalkupCode,
  writeLiveWalkupCode,
} from "@/components/pages/walkups/walkupLiveCode";
import { CopyMorphButton } from "@/motion/CopyMorphButton";

/**
 * Walk-up access control for an event. An admin generates a short code (shown
 * with a scannable QR) that a BA enters in the app to clock in + file a recap
 * WITHOUT being pre-assigned. Generating enables walk-ups for the event;
 * "Turn off" revokes the code. Walk-ups then land in the Walk-ups queue for
 * review. The code is generated on demand (regenerating replaces it).
 */
export default function WalkupCodePanel({ eventUuid }: { eventUuid: string }) {
  const showAlert = useAlertStore((s) => s.showAlert);
  const [code, setCode] = useState<string | null>(
    () => readLiveWalkupCode(eventUuid)?.code ?? null,
  );
  const [expiresAt, setExpiresAt] = useState<string | null>(
    () => readLiveWalkupCode(eventUuid)?.expiresAt ?? null,
  );
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
          writeLiveWalkupCode(eventUuid, {
            code: r.code,
            expiresAt: r.expiresAt ?? null,
          });
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
          clearLiveWalkupCode(eventUuid);
          showAlert("Walk-ups turned off for this event.", "success");
        } else {
          showAlert(r?.message || "Couldn't turn off walk-ups.", "error");
        }
      },
      onError: (e) => showAlert(e.message, "error"),
    });
  };

  const copy = async () => {
    if (!code) return;
    await navigator.clipboard?.writeText(code);
    showAlert("Code copied.", "success");
  };

  // Shareable no-login web link — the BA opens it, clocks in/out, and files the
  // full recap right in their browser (no app). Same code, web door.
  const checkinHref = code ? checkinUrl(code) : null;
  const copyLink = async () => {
    if (!checkinHref) return;
    await navigator.clipboard?.writeText(checkinHref);
    showAlert("Check-in link copied.", "success");
  };

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
      <p className="text-sm mb-3" style={{ color: "var(--spark-text-meta)" }}>
        Give this to anyone working the event so they can clock in + file a recap
        without being assigned. They can enter the code in the app under “Clock in
        with a code,” or open the check-in link below to do it all in a browser —
        no app needed. You review each walk-up in Walk-ups.
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
              style={{ color: "var(--spark-text-meta)", letterSpacing: "0.08em" }}
            >
              Valid through {new Date(expiresAt).toLocaleDateString()}
            </p>
          ) : null}
          {/* Shareable no-login web check-in link. Text it to whoever's working
              the event — they clock in/out and file the full recap in a browser,
              no app required. */}
          {checkinHref ? (
            <div
              className="rounded-xl mb-3"
              style={{
                background: "var(--spark-bg)",
                border: "1px solid var(--spark-border)",
                padding: "0.75rem",
              }}
            >
              <p
                className="mono text-[10px] mb-1"
                style={{ letterSpacing: "0.14em", color: "var(--spark-lime)" }}
              >
                CHECK-IN LINK (NO APP)
              </p>
              <p
                className="text-xs break-all"
                style={{ color: "var(--spark-text-secondary)" }}
              >
                {checkinHref}
              </p>
              <div className="mt-3">
                <CheckinQr url={checkinHref} downloadName={`${code}-checkin-qr.png`} />
              </div>
              <CopyMorphButton
                onCopy={copyLink}
                label="Copy link"
                copiedLabel="Copied"
                title="Copy check-in link"
                className="mt-2 px-3 py-1.5 rounded-lg text-xs font-semibold"
                style={{
                  background: "transparent",
                  color: "var(--spark-text)",
                  border: "1px solid var(--spark-border)",
                }}
              />
            </div>
          ) : null}
          <div className="flex items-center gap-2">
            <CopyMorphButton
              onCopy={copy}
              label="Copy code"
              copiedLabel="Copied"
              title="Copy walk-up code"
              className="px-4 py-2 rounded-xl text-sm font-semibold flex-1"
              style={{ background: "var(--spark-lime)", color: "var(--spark-on-accent)" }}
              iconSize={13}
            />
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
          style={{ background: "var(--spark-lime)", color: "var(--spark-on-accent)" }}
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
