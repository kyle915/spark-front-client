import { useEffect, useRef, useState, type CSSProperties } from "react";
import { h2, helperText } from "./checkinStyles";
import {
  MAX_RECORDING_MS,
  RECORDING_BITS_PER_SECOND,
  TYPE_WHAT_HAPPENED,
  VOICE_DRAFT_UNAVAILABLE,
  answerText,
  canRecordAudio,
  formatClock,
  getSpeechRecognition,
  pickRecordingType,
  requestVoiceDraft,
  requestVoiceTranscribe,
  voiceSummaryLine,
  type Answer,
  type SpeechSession,
  type VoiceDraftResult,
} from "./voiceDraft";

type Phase = "idle" | "recording" | "working";

/**
 * "Say what happened": the BA talks through the shift and the recap form
 * below gets filled in. Recording goes to the server for speech-to-text, so
 * it works on iPhone Safari too. Where the browser can't record, browser
 * dictation is used; where neither works, the BA types.
 *
 * This card never writes into the form itself: it hands the draft to the
 * form (`onDraft`), which fills empty boxes only and reports back how many it
 * filled and how many it left alone.
 */
export function VoiceRecapCard({
  origin,
  code,
  session,
  accent,
  onDraft,
  onTextOnly,
}: {
  origin: string;
  code: string;
  session: string;
  accent: string;
  /** Fill the form. Returns what happened, for the summary line. */
  onDraft: (draft: VoiceDraftResult) => { filled: number; conflicts: number };
  /** Structuring is unavailable: keep the words in the notes box if there is one. */
  onTextOnly: (transcript: string) => boolean;
}) {
  const [recordable] = useState(() => canRecordAudio());
  const speech = getSpeechRecognition();
  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [note, setNote] = useState("");
  const [summary, setSummary] = useState("");
  const transcriptRef = useRef("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAt = useRef(0);
  const discardRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const dictationRef = useRef<SpeechSession | null>(null);

  const remember = (text: string) => {
    transcriptRef.current = text;
    setTranscript(text);
  };

  const stopTimer = () => {
    if (timerRef.current != null) window.clearInterval(timerRef.current);
    timerRef.current = null;
  };
  const releaseMic = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  useEffect(
    () => () => {
      discardRef.current = true;
      stopTimer();
      try {
        recorderRef.current?.stop();
      } catch {
        /* already stopped */
      }
      releaseMic();
      dictationRef.current?.stop();
    },
    [],
  );

  const applyDraft = (draft: VoiceDraftResult | null, words: string) => {
    if (!draft || !draft.available) {
      const placed = onTextOnly(words);
      setSummary("");
      setNote(
        placed
          ? `${VOICE_DRAFT_UNAVAILABLE}. Your words were put in the notes box. Fill in the rest below.`
          : `${VOICE_DRAFT_UNAVAILABLE}. Your words are kept above. Fill in the form below.`,
      );
      return;
    }
    const { filled, conflicts } = onDraft(draft);
    setNote("");
    setSummary(voiceSummaryLine(filled, conflicts));
  };

  const fillFromText = async () => {
    const words = transcriptRef.current.trim();
    if (!words || phase !== "idle") return;
    setPhase("working");
    setNote("");
    setSummary("");
    const draft = await requestVoiceDraft({ origin, code, session, transcript: words });
    applyDraft(draft, words);
    setPhase("idle");
  };

  const upload = async (blob: Blob, type: string, durationMs: number) => {
    setPhase("working");
    const result = await requestVoiceTranscribe({
      origin,
      code,
      session,
      audio: blob,
      type,
      durationMs,
    });
    if (!result.transcribed || !result.transcript.trim()) {
      setNote(result.message || "Didn't catch any words. Try again, or type what happened.");
      setPhase("idle");
      return;
    }
    remember(result.transcript);
    applyDraft(result.draft, result.transcript);
    setPhase("idle");
  };

  const stopRecording = () => {
    const recorder = recorderRef.current;
    stopTimer();
    if (recorder && recorder.state !== "inactive") recorder.stop();
  };

  const startRecording = async () => {
    if (phase !== "idle") return;
    setNote("");
    setSummary("");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setNote(
        "The microphone is blocked. Allow it in your browser settings, or type what happened.",
      );
      return;
    }
    const type = pickRecordingType((t) => MediaRecorder.isTypeSupported(t));
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, {
        ...(type ? { mimeType: type } : {}),
        audioBitsPerSecond: RECORDING_BITS_PER_SECOND,
      });
    } catch {
      stream.getTracks().forEach((track) => track.stop());
      setNote("This phone can't record here. Type what happened instead.");
      return;
    }
    streamRef.current = stream;
    recorderRef.current = recorder;
    chunksRef.current = [];
    discardRef.current = false;
    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      const durationMs = Date.now() - startedAt.current;
      releaseMic();
      recorderRef.current = null;
      const blobType = recorder.mimeType || type || "audio/webm";
      const blob = new Blob(chunksRef.current, { type: blobType });
      chunksRef.current = [];
      if (discardRef.current) {
        setPhase("idle");
        return;
      }
      void upload(blob, blobType, Math.min(durationMs, MAX_RECORDING_MS));
    };
    startedAt.current = Date.now();
    setElapsed(0);
    recorder.start(1000);
    setPhase("recording");
    timerRef.current = window.setInterval(() => {
      const ms = Date.now() - startedAt.current;
      setElapsed(ms);
      if (ms >= MAX_RECORDING_MS) stopRecording();
    }, 250);
  };

  const discardRecording = () => {
    discardRef.current = true;
    stopRecording();
    setNote("Recording discarded.");
  };

  const startDictation = () => {
    if (!speech || phase !== "idle") return;
    setNote("");
    setSummary("");
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
    rec.onerror = () => setPhase("idle");
    rec.onend = () => setPhase((p) => (p === "recording" ? "idle" : p));
    dictationRef.current = rec;
    setPhase("recording");
    rec.start();
  };

  const stopDictation = () => {
    dictationRef.current?.stop();
    dictationRef.current = null;
    setPhase("idle");
    void (async () => {
      // Give the last words a moment to land.
      await new Promise((resolve) => setTimeout(resolve, 300));
      const words = transcriptRef.current.trim();
      if (!words) return;
      setPhase("working");
      const draft = await requestVoiceDraft({ origin, code, session, transcript: words });
      applyDraft(draft, words);
      setPhase("idle");
    })();
  };

  const mode: "record" | "dictate" | "type" = recordable ? "record" : speech ? "dictate" : "type";
  const recording = phase === "recording";
  const working = phase === "working";

  const primary: CSSProperties = {
    width: "100%",
    minHeight: 56,
    borderRadius: 12,
    border: `2px solid ${accent}`,
    background: recording ? "#1c1917" : "#fff",
    color: recording ? "#fff" : "#1c1917",
    fontSize: 16,
    fontWeight: 700,
    padding: "0 14px",
    cursor: working ? "default" : "pointer",
    opacity: working ? 0.7 : 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  };
  const secondary: CSSProperties = {
    minHeight: 48,
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.25)",
    background: "#fff",
    color: "#1c1917",
    fontSize: 15,
    fontWeight: 700,
    padding: "0 14px",
    cursor: "pointer",
  };
  const dot: CSSProperties = {
    width: 12,
    height: 12,
    borderRadius: 999,
    background: recording ? "#ef4444" : accent,
    flex: "none",
  };

  return (
    <div>
      <h2 style={h2}>Say what happened</h2>
      <p style={{ ...helperText, margin: "6px 0 12px" }}>
        {mode === "type"
          ? "Type or paste a few lines about your shift and we'll fill in the form below. Check every answer before you submit."
          : "Talk through your shift: how many people you sampled, what sold, which products, what people said. We fill in the form below. Check every answer before you submit."}
      </p>

      {mode === "record" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button
            type="button"
            style={primary}
            disabled={working}
            onClick={recording ? stopRecording : () => void startRecording()}
            aria-label={recording ? "Stop recording and fill the form" : undefined}
          >
            <span aria-hidden style={dot} />
            {working ? "Filling in the form…" : recording ? "Stop and fill the form" : "Record"}
          </button>
          {recording ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ ...helperText, fontVariantNumeric: "tabular-nums" }}>
                Recording {formatClock(elapsed)} of {formatClock(MAX_RECORDING_MS)}
              </span>
              <button type="button" style={secondary} onClick={discardRecording}>
                Discard
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {mode === "dictate" ? (
        <button
          type="button"
          style={primary}
          disabled={working}
          onClick={recording ? stopDictation : startDictation}
        >
          <span aria-hidden style={dot} />
          {working ? "Filling in the form…" : recording ? "Stop and fill the form" : "Record"}
        </button>
      ) : null}

      <details
        open={mode === "type" || transcript.trim().length > 0}
        style={{ marginTop: mode === "type" ? 0 : 12 }}
      >
        {mode === "type" ? null : (
          <summary style={{ ...helperText, cursor: "pointer", minHeight: 32 }}>
            {transcript.trim() ? "What we heard (you can edit it)" : "Or type it instead"}
          </summary>
        )}
        <textarea
          value={transcript}
          onChange={(event) => remember(event.target.value)}
          placeholder={TYPE_WHAT_HAPPENED}
          aria-label="What happened on your shift"
          style={{
            width: "100%",
            minHeight: 96,
            marginTop: 8,
            borderRadius: 12,
            border: "1px solid rgba(0,0,0,0.15)",
            padding: 12,
            font: "inherit",
            fontSize: 16,
            resize: "vertical",
            boxSizing: "border-box",
          }}
        />
        <button
          type="button"
          style={{ ...secondary, width: "100%", marginTop: 8 }}
          disabled={working || recording || !transcript.trim()}
          onClick={() => void fillFromText()}
        >
          {working ? "Filling in the form…" : "Fill the form from this"}
        </button>
      </details>

      {summary ? (
        <p
          role="status"
          style={{
            margin: "12px 0 0",
            padding: "10px 12px",
            borderRadius: 12,
            background: `${accent}14`,
            border: `1px solid ${accent}55`,
            fontSize: 14,
            color: "#1c1917",
          }}
        >
          {summary}
        </p>
      ) : null}
      {note ? (
        <p role="status" style={{ ...helperText, margin: "10px 0 0" }}>
          {note}
        </p>
      ) : null}
    </div>
  );
}

/** Under a box voice filled: a quiet marker so the BA knows to check it. */
export function VoiceFilledMark({ check }: { check: boolean }) {
  return (
    <p
      style={{
        margin: "6px 0 0",
        fontSize: 12,
        color: "#44403c",
        display: "flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        aria-hidden
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
      >
        <rect x="9" y="3" width="6" height="11" rx="3" />
        <path d="M5 11a7 7 0 0 0 14 0M12 18v3" strokeLinecap="round" />
      </svg>
      {check ? "Filled by voice. Check this one." : "Filled by voice"}
    </p>
  );
}

/** Under a box the BA had already answered: what voice heard, and Replace. */
export function VoiceConflictRow({
  proposed,
  onReplace,
  onKeep,
}: {
  proposed: Answer;
  onReplace: () => void;
  onKeep: () => void;
}) {
  const button: CSSProperties = {
    minHeight: 44,
    borderRadius: 10,
    fontSize: 15,
    fontWeight: 700,
    padding: "0 12px",
    cursor: "pointer",
    color: "#1c1917",
  };
  return (
    <div
      role="group"
      aria-label="What you said for this question"
      style={{
        marginTop: 8,
        padding: "8px 8px 8px 12px",
        borderRadius: 12,
        border: "1px dashed rgba(0,0,0,0.35)",
        background: "#faf7f1",
        display: "flex",
        alignItems: "center",
        gap: 8,
        flexWrap: "wrap",
      }}
    >
      <p style={{ margin: 0, flex: "1 1 160px", minWidth: 0, fontSize: 14, color: "#1c1917" }}>
        <span style={{ display: "block", fontSize: 13, color: "#44403c" }}>You said</span>
        <span style={{ fontWeight: 700, overflowWrap: "anywhere" }}>{answerText(proposed)}</span>
      </p>
      <button
        type="button"
        onClick={onReplace}
        style={{ ...button, border: "1px solid rgba(0,0,0,0.3)", background: "#fff" }}
      >
        Replace
      </button>
      <button
        type="button"
        onClick={onKeep}
        style={{
          ...button,
          border: "1px solid transparent",
          background: "transparent",
          fontWeight: 600,
        }}
      >
        Keep mine
      </button>
    </div>
  );
}
