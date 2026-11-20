import { useState } from "react";

import { apiOrigin, fetchWithTimeout } from "./checkinHelpers";
import { card, errText, helperText, input, label, primaryBtn, secondaryBtn } from "./checkinStyles";
import type { Context } from "./checkinTypes";
import { programDescription, programLabel, type ProgramOption } from "./eventTypeDescriptor";
import { readDraftPhotos, writeDraftPhotos } from "./photoDraft";
import {
  buildChangeProgramBody,
  currentProgramLabel,
  otherPrograms,
  remapDraftPhotos,
  switchConfirmCopy,
  switchResultCopy,
} from "./programSwitchRules";
import { asRecapDraft, pickRestoredDraft, readDraft, writeDraft } from "./recapDraft";

const CHANGE_PROGRAM_TIMEOUT_MS = 20_000;

const linkBtn = {
  background: "none",
  border: "none",
  padding: "10px 0",
  minHeight: 44,
  color: "#1c1917",
  fontSize: 14,
  fontWeight: 700,
  textDecoration: "underline",
  cursor: "pointer",
} as const;

/**
 * "Program: Retail Sampling · Wrong program? Change it".
 *
 * Shown only on a link with more than one program, before the recap is
 * filed. Picking another program asks once, then the API switches this BA's
 * shift in place (clock-in, booking and GPS stay) and returns the draft
 * re-keyed for the new form. The parent closes the recap while the switch
 * runs and reopens it on the new form afterwards.
 */
export default function ProgramSwitch({
  code,
  token,
  ctx,
  accent,
  onSwitchStart,
  onSwitchEnd,
}: {
  code: string;
  token: string;
  ctx: Context;
  accent: string;
  /** Close the open recap so its autosave can't write old answers back. */
  onSwitchStart: () => void;
  /** `changed`: reload the context and reopen the recap on the new form. */
  onSwitchEnd: (changed: boolean) => Promise<void>;
}) {
  const programs = ctx.eventTypes ?? [];
  const current = ctx.event?.eventType ?? null;
  const state = ctx.session?.programChange;
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<ProgramOption | null>(null);
  const [storeName, setStoreName] = useState(ctx.storeIdentity?.name ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const label_ = currentProgramLabel(programs, current);
  const choices = otherPrograms(programs, current?.id);

  const reset = () => {
    setOpen(false);
    setTarget(null);
    setErr(null);
  };

  const confirm = async () => {
    if (!target) return;
    setBusy(true);
    setErr(null);
    onSwitchStart();
    // The newer of the phone's copy and the server's (another phone may have
    // saved last), same rule the recap form uses to restore.
    const local = pickRestoredDraft(
      readDraft(code, token, "shift"),
      asRecapDraft(ctx.session?.recapDraft),
    );
    const photos = readDraftPhotos(code, token);
    const draft = local
      ? { ...local, ...(local.photos ? {} : photos.length ? { photos } : {}) }
      : null;
    try {
      const res = await fetchWithTimeout(
        `${apiOrigin()}/api/public/checkin/${encodeURIComponent(code)}/change-program`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            buildChangeProgramBody({
              session: token,
              eventTypeId: target.id,
              storeName: target.storeNameRequired ? storeName : "",
              draft,
            }),
          ),
        },
        CHANGE_PROGRAM_TIMEOUT_MS,
      );
      const json = (await res.json().catch(() => ({}))) as Context & {
        error?: string;
        message?: string;
      };
      if (!res.ok || json.error) {
        setErr(json.message || "Couldn't change your program. Try again.");
        setBusy(false);
        await onSwitchEnd(false);
        return;
      }
      const carried = asRecapDraft(json.session?.recapDraft);
      if (carried) {
        writeDraft(
          code,
          token,
          {
            values: carried.values,
            samples: carried.samples,
            engagements: carried.engagements,
            usedCorpoCard: carried.usedCorpoCard ?? null,
            ...(carried.store ? { store: carried.store } : {}),
            ...(carried.photos ? { photos: carried.photos } : {}),
          },
          "shift",
        );
        writeDraftPhotos(code, token, remapDraftPhotos(photos, carried, json.photoBuckets));
      }
      const newLabel = target ? programLabel(target) : json.programChange?.to ?? "";
      setNote(json.programChange ? switchResultCopy(json.programChange, newLabel) : null);
      reset();
      setBusy(false);
      await onSwitchEnd(true);
    } catch {
      setErr("Couldn't change your program. Check your signal and try again.");
      setBusy(false);
      await onSwitchEnd(false);
    }
  };

  return (
    <div style={{ ...card, padding: "12px 18px" }} data-testid="program-switch">
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "2px 10px" }}>
        <div style={{ fontSize: 14 }}>
          <span style={{ color: "#44403c" }}>Program: </span>
          <strong>{label_}</strong>
        </div>
        {state?.allowed === false ? null : !open ? (
          <button type="button" style={linkBtn} onClick={() => setOpen(true)}>
            Wrong program? Change it
          </button>
        ) : null}
      </div>
      {state?.allowed === false ? (
        <p style={{ ...helperText, margin: "4px 0 0" }}>
          Wrong program? {state.message || "Message your lead and they'll switch it."}
        </p>
      ) : null}
      {note && !open ? (
        <p role="status" style={{ ...helperText, margin: "4px 0 0" }}>
          {note}
        </p>
      ) : null}

      {open && !target ? (
        <div style={{ marginTop: 8 }}>
          <div style={label}>Which program are you working?</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>
            {choices.map((p) => {
              const desc = programDescription(p);
              return (
                <button
                  key={p.id}
                  type="button"
                  style={{ ...secondaryBtn, textAlign: "left", flex: "none" }}
                  onClick={() => {
                    setTarget(p);
                    setErr(null);
                  }}
                >
                  <span style={{ display: "block", fontWeight: 700 }}>{programLabel(p)}</span>
                  {desc ? (
                    <span
                      style={{ ...helperText, display: "block", fontWeight: 400, marginTop: 2 }}
                    >
                      {desc}
                    </span>
                  ) : null}
                </button>
              );
            })}
            <button type="button" style={{ ...linkBtn, alignSelf: "flex-start" }} onClick={reset}>
              Keep {label_}
            </button>
          </div>
        </div>
      ) : null}

      {open && target ? (
        <div style={{ marginTop: 8 }}>
          <p style={{ fontSize: 15, fontWeight: 600, margin: "4px 0 8px", lineHeight: 1.4 }}>
            {switchConfirmCopy(target)}
          </p>
          {target.storeNameRequired ? (
            <div style={{ marginBottom: 10 }}>
              <label style={label} htmlFor="program-switch-store">
                Store name
              </label>
              <div style={helperText}>{programLabel(target)} needs the store you're in.</div>
              <input
                id="program-switch-store"
                style={input}
                value={storeName}
                autoComplete="off"
                placeholder="e.g. Kroger"
                onChange={(e) => setStoreName(e.target.value)}
              />
            </div>
          ) : null}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button
              type="button"
              style={{ ...primaryBtn(accent), flex: "none" }}
              disabled={busy}
              onClick={() => void confirm()}
            >
              {busy ? "Switching…" : `Switch to ${programLabel(target)}`}
            </button>
            <button
              type="button"
              style={{ ...secondaryBtn, flex: "none" }}
              disabled={busy}
              onClick={reset}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
      {err ? (
        <p role="alert" style={errText}>
          {err}
        </p>
      ) : null}
    </div>
  );
}
