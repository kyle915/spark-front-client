import { useRef, useState, type CSSProperties } from "react";
import {
  TYPE_WHAT_HAPPENED,
  VOICE_DRAFT_UNAVAILABLE,
  getSpeechRecognition,
  notesFallbackFill,
  requestVoiceDraft,
  type DraftField,
  type SpeechSession,
  type VoiceFill,
} from "./voiceDraft";

/**
 * Dictate or type what happened. On stop (or Draft), the transcript becomes
 * a structured draft of notes, feedback, and competitor text. It does not file.
 */
export function VoiceRecapCard({
  origin,
  code,
  session,
  fields,
  accent,
  onApply,
}: {
  origin: string;
  code: string;
  session: string;
  fields: DraftField[];
  accent: string;
  onApply: (fills: VoiceFill[]) => void;
}) {
  const speech = getSpeechRecognition();
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const transcriptRef = useRef("");
  const sessionRef = useRef<SpeechSession | null>(null);
  const structuring = useRef(false);

  const remember = (text: string) => {
    transcriptRef.current = text;
    setTranscript(text);
  };

  const structure = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || structuring.current) return;
    structuring.current = true;
    setBusy(true);
    const result = await requestVoiceDraft({
      origin,
      code,
      session,
      transcript: trimmed,
    });
    if (!result.available) {
      onApply(notesFallbackFill(trimmed, fields));
      setNote(
        result.reason ||
          `${VOICE_DRAFT_UNAVAILABLE}. Your words were placed in notes when that box exists. Edit them before you file.`,
      );
    } else {
      onApply(result.fills);
      setNote(
        result.fills.length
          ? "Draft added. Edit it before you file."
          : "Nothing in that note matched a text box.",
      );
    }
    setBusy(false);
    structuring.current = false;
  };

  const stop = () => {
    const text = transcriptRef.current;
    sessionRef.current?.stop();
    sessionRef.current = null;
    setRecording(false);
    void structure(text);
  };

  const start = () => {
    if (!speech || recording) return;
    const rec = new speech();
    rec.lang = "en-US";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (event) => {
      let text = "";
      for (let i = 0; i < event.results.length; i += 1) {
        text += event.results[i][0]?.transcript ?? "";
      }
      remember(text);
    };
    rec.onerror = () => {
      setRecording(false);
    };
    rec.onend = () => {
      setRecording(false);
    };
    sessionRef.current = rec;
    setRecording(true);
    rec.start();
  };

  const button: CSSProperties = {
    minHeight: 44,
    borderRadius: 12,
    border: `2px solid ${accent}`,
    background: recording ? accent : "#fff",
    color: "#1c1917",
    fontWeight: 700,
    padding: "0 14px",
  };

  return (
    <div>
      <h2 style={{ fontSize: 18, margin: "0 0 6px" }}>What happened</h2>
      <p style={{ color: "#44403c", fontSize: 13, opacity: 1, margin: "0 0 10px" }}>
        {speech
          ? "Record a note. When you stop, it drafts the text boxes. Counts stay blank for you to type."
          : "This browser can't dictate. Type or paste what happened, then draft the text boxes. Counts stay blank."}
      </p>
      <textarea
        value={transcript}
        onChange={(event) => remember(event.target.value)}
        placeholder={TYPE_WHAT_HAPPENED}
        style={{
          width: "100%",
          minHeight: 96,
          borderRadius: 12,
          border: "1px solid rgba(0,0,0,0.15)",
          padding: 12,
          font: "inherit",
          resize: "vertical",
        }}
      />
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        {speech ? (
          <button type="button" style={button} onClick={recording ? stop : start} disabled={busy}>
            {recording ? "Stop" : "Record"}
          </button>
        ) : null}
        <button
          type="button"
          style={{ ...button, borderStyle: "solid" }}
          disabled={busy || recording || !transcript.trim()}
          onClick={() => void structure(transcriptRef.current)}
        >
          {busy ? "Drafting…" : "Draft recap"}
        </button>
      </div>
      {note ? (
        <p style={{ fontSize: 13, margin: "10px 0 0" }}>{note}</p>
      ) : null}
    </div>
  );
}
