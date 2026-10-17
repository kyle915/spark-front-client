/**
 * Voice-to-recap drafting for walk-up text fields.
 *
 * Notes, feedback, and competitor mentions only. Numeric fields are never
 * written. The browser speech API is optional; a typed transcript uses the
 * same structuring call.
 */

export const VOICE_DRAFT_UNAVAILABLE = "Voice draft unavailable";
export const TYPE_WHAT_HAPPENED = "Type or paste what happened";

export type DraftSlot = "notes" | "feedback" | "competitor";

export type DraftField = {
  id: string;
  name: string;
  type: string;
};

export type VoiceFill = {
  fieldId: string;
  text: string;
};

export type VoiceDraftResult = {
  available: boolean;
  reason: string;
  fills: VoiceFill[];
};

type SpeechResultEvent = {
  resultIndex: number;
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
};

export type SpeechSession = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

const NUMERIC_NAME =
  /how many|number of|\bcount\b|amount|spend|mileage|sample|engagement|\bcans?\b|pours?|quantity|percent|awareness|tables distributed|\bsku\b|store number/i;
const COMPETITOR_NAME =
  /competitor|competitive|why they like|consumers drink|\bwhich one\b|what .{0,40}drink/i;
const FEEDBACK_NAME = /\bfeedback\b|\bcomments?\b/i;
const NOTES_NAME = /\bnotes?\b/i;
const BARE_NUMBER = /^\d+(\.\d+)?$/;

function blockedType(kind: string): boolean {
  return (
    kind.includes("number") ||
    kind.includes("int") ||
    kind.includes("photo") ||
    kind.includes("image") ||
    kind.includes("select") ||
    kind.includes("date") ||
    kind.includes("bool") ||
    kind.includes("check") ||
    kind.includes("file")
  );
}

export function draftSlotForField(field: DraftField): DraftSlot | null {
  const kind = field.type.trim().toLowerCase();
  if (blockedType(kind)) return null;
  if (kind && !kind.includes("text") && !kind.includes("string") && !kind.includes("textarea")) {
    return null;
  }
  if (NUMERIC_NAME.test(field.name)) return null;
  if (COMPETITOR_NAME.test(field.name)) return "competitor";
  if (FEEDBACK_NAME.test(field.name)) return "feedback";
  if (NOTES_NAME.test(field.name)) return "notes";
  return null;
}

export function getSpeechRecognition(): (new () => SpeechSession) | null {
  if (typeof window === "undefined") return null;
  const host = window as Window & {
    SpeechRecognition?: new () => SpeechSession;
    webkitSpeechRecognition?: new () => SpeechSession;
  };
  return host.SpeechRecognition ?? host.webkitSpeechRecognition ?? null;
}

export function applyVoiceFills(
  values: Record<string, string | string[]>,
  fills: VoiceFill[],
  fields: DraftField[],
): Record<string, string | string[]> {
  const allowed = new Set(
    fields.filter((field) => draftSlotForField(field) !== null).map((field) => field.id),
  );
  const next = { ...values };
  for (const fill of fills) {
    const text = fill.text.trim();
    if (!allowed.has(fill.fieldId) || !text || BARE_NUMBER.test(text)) continue;
    const current = next[fill.fieldId];
    if (Array.isArray(current)) continue;
    next[fill.fieldId] = text;
  }
  return next;
}

/** When structuring is unavailable, keep the words in the first notes box only. */
export function notesFallbackFill(transcript: string, fields: DraftField[]): VoiceFill[] {
  const text = transcript.trim();
  if (!text) return [];
  const notes = fields.find((field) => draftSlotForField(field) === "notes");
  const target = notes ?? fields.find((field) => draftSlotForField(field) !== null);
  if (!target) return [];
  return [{ fieldId: target.id, text }];
}

export async function requestVoiceDraft(args: {
  origin: string;
  code: string;
  session: string;
  transcript: string;
  fetchImpl?: typeof fetch;
}): Promise<VoiceDraftResult> {
  const fetchImpl = args.fetchImpl ?? fetch;
  try {
    const res = await fetchImpl(
      `${args.origin}/api/public/checkin/${encodeURIComponent(args.code)}/voice-draft`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session: args.session, transcript: args.transcript }),
      },
    );
    if (!res.ok) {
      return { available: false, reason: VOICE_DRAFT_UNAVAILABLE, fills: [] };
    }
    const json = (await res.json()) as Partial<VoiceDraftResult>;
    const fills = Array.isArray(json.fills)
      ? json.fills.flatMap((item) => {
          if (!item || typeof item !== "object") return [];
          const fieldId = "fieldId" in item ? String(item.fieldId ?? "") : "";
          const text = "text" in item ? String(item.text ?? "") : "";
          return fieldId && text.trim() ? [{ fieldId, text: text.trim() }] : [];
        })
      : [];
    return {
      available: Boolean(json.available),
      reason: typeof json.reason === "string" ? json.reason : "",
      fills,
    };
  } catch {
    return { available: false, reason: VOICE_DRAFT_UNAVAILABLE, fills: [] };
  }
}
