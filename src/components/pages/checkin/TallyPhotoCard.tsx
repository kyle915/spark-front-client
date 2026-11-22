import { useRef, useState, type CSSProperties } from "react";
import { prepareImageForUpload } from "@/utils/compressImageForUpload";
import { PhotoFileInputs } from "./RecapPhotoStep";
import { h2, helperText } from "./checkinStyles";
import {
  TALLY_PHOTO_PREP,
  requestTallyRead,
  tallyFoundLine,
  unreadableTally,
  type TallyProposals,
} from "./tallyRead";

const libraryButton = (accent: string, busy: boolean): CSSProperties => ({
  flex: "1 1 160px",
  minHeight: 52,
  borderRadius: 12,
  border: `2px solid ${accent}`,
  background: "#fff",
  color: "#1c1917",
  fontSize: 15,
  fontWeight: 700,
  padding: "0 14px",
  cursor: busy ? "default" : "pointer",
  opacity: busy ? 0.7 : 1,
});

const cameraButton = (busy: boolean): CSSProperties => ({
  flex: "1 1 140px",
  minHeight: 52,
  borderRadius: 12,
  border: "1px solid rgba(0,0,0,0.28)",
  background: "#faf7f1",
  color: "#1c1917",
  fontSize: 15,
  fontWeight: 700,
  padding: "0 14px",
  cursor: busy ? "default" : "pointer",
  opacity: busy ? 0.7 : 1,
});

/**
 * Choose or take a photo of a tally sheet and have the counts read off it.
 *
 * Uses `PhotoFileInputs` (separate library + camera inputs) so iOS offers
 * Camera Roll when the BA photographed their sheet inside the store before
 * walking out to the parking lot, while still offering live camera capture.
 *
 * The numbers come back as proposals shown next to each box (see
 * TallyProposal); this card only starts the read and says what happened.
 * The rest of the form stays usable while the photo is read, and the photo
 * is not added to the recap.
 */
export function TallyPhotoCard({
  origin,
  code,
  session,
  accent,
  includeProducts,
  pendingCount,
  onProposals,
  onUseAll,
}: {
  origin: string;
  code: string;
  session: string;
  accent: string;
  includeProducts: boolean;
  /** Proposals still waiting next to a box. */
  pendingCount: number;
  onProposals: (proposals: TallyProposals) => void;
  onUseAll: () => void;
}) {
  const libraryRef = useRef<HTMLInputElement | null>(null);
  const cameraRef = useRef<HTMLInputElement | null>(null);
  const reading = useRef(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  const read = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file || reading.current) return;
    reading.current = true;
    setBusy(true);
    setNote("");
    let result = unreadableTally();
    try {
      const prepared = await prepareImageForUpload(file, TALLY_PHOTO_PREP);
      result = await requestTallyRead({
        origin,
        code,
        session,
        file: prepared,
        contentType: prepared.type || "image/jpeg",
        includeProducts,
      });
    } catch {
      result = unreadableTally();
    }
    onProposals(result);
    setNote(result.ok ? "" : result.message);
    setBusy(false);
    reading.current = false;
  };

  return (
    <div>
      <h2 style={h2}>Fill from photo</h2>
      <p style={{ ...helperText, margin: "6px 0 10px" }}>
        Kept a tally sheet? Choose a photo from your library or take one now and the counts are
        read for you. Each number shows next to its box so you can check it first. The photo is not
        added to the recap.
      </p>
      <PhotoFileInputs
        libraryRef={libraryRef}
        cameraRef={cameraRef}
        onFiles={(files) => {
          void read(files);
        }}
      />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <button
          type="button"
          style={libraryButton(accent, busy)}
          disabled={busy}
          onClick={() => libraryRef.current?.click()}
        >
          Choose from library
        </button>
        <button
          type="button"
          style={cameraButton(busy)}
          disabled={busy}
          onClick={() => cameraRef.current?.click()}
        >
          Take photo
        </button>
      </div>
      {/* One line of room is always held, so a result never moves the form. */}
      <div
        role="status"
        aria-live="polite"
        style={{
          minHeight: 48,
          marginTop: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        {busy ? (
          <p style={{ ...helperText, margin: 0, fontSize: 14, color: "#1c1917" }}>
            Reading the photo. Keep going below.
          </p>
        ) : pendingCount > 0 ? (
          <>
            <p style={{ ...helperText, margin: 0, fontSize: 14, color: "#1c1917" }}>
              {tallyFoundLine(pendingCount)}
            </p>
            <button
              type="button"
              onClick={onUseAll}
              style={{
                minHeight: 48,
                flexShrink: 0,
                borderRadius: 12,
                border: "1px solid rgba(0,0,0,0.25)",
                background: "#faf7f1",
                color: "#1c1917",
                fontSize: 15,
                fontWeight: 700,
                padding: "0 16px",
                cursor: "pointer",
              }}
            >
              Use all
            </button>
          </>
        ) : note ? (
          <p style={{ ...helperText, margin: 0, fontSize: 14, color: "#1c1917" }}>{note}</p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * One number read from a tally or receipt photo, shown under the box it
 * belongs to. It is not in the box until the ambassador taps Use.
 */
export function TallyProposal({
  value,
  onUse,
  onDismiss,
  heading = "Read from your photo",
  detail = null,
  ariaLabel = "Number read from your photo",
  dismissAriaLabel = "Ignore this number",
}: {
  value: string;
  onUse: () => void;
  onDismiss: () => void;
  heading?: string;
  detail?: string | null;
  ariaLabel?: string;
  dismissAriaLabel?: string;
}) {
  const button: CSSProperties = {
    minHeight: 48,
    minWidth: 64,
    borderRadius: 10,
    fontSize: 15,
    fontWeight: 700,
    padding: "0 14px",
    cursor: "pointer",
    color: "#1c1917",
  };
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      style={{
        marginTop: 8,
        padding: "8px 8px 8px 12px",
        borderRadius: 12,
        border: "1px dashed rgba(0,0,0,0.35)",
        background: "#faf7f1",
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <p style={{ margin: 0, flex: 1, minWidth: 0, fontSize: 14, color: "#1c1917" }}>
        <span style={{ display: "block", fontSize: 13, color: "#44403c" }}>{heading}</span>
        <span style={{ fontSize: 18, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
          {value}
        </span>
        {detail ? (
          <span style={{ display: "block", fontSize: 12, color: "#44403c", marginTop: 2 }}>
            {detail}
          </span>
        ) : null}
      </p>
      <button
        type="button"
        onClick={onUse}
        style={{ ...button, border: "1px solid rgba(0,0,0,0.3)", background: "#fff" }}
      >
        Use
      </button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={dismissAriaLabel}
        style={{ ...button, border: "1px solid transparent", background: "transparent", fontWeight: 600 }}
      >
        Ignore
      </button>
    </div>
  );
}
