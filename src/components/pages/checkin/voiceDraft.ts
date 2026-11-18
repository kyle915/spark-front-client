/**
 * Voice recap: the BA talks about the shift and the normal recap fields get
 * pre-filled. Counts, dropdowns, multi-selects (products too), yes/no and
 * text boxes can all be filled.
 *
 * The server proposes answers and checks each one against the template
 * (`voice-draft` for a transcript, `voice-transcribe` for a recording). This
 * file decides what lands in the form:
 *
 * - an empty box takes the proposal;
 * - a box the BA already answered is NEVER changed here. It becomes a
 *   conflict the BA can resolve with "Replace";
 * - photo and mileage fields are never touched;
 * - nothing is submitted. Every box stays editable and Submit keeps all of
 *   its rules (receipt gate, photo floor, and so on).
 */
import {
  isProductsSampledMultiselect,
  matchProductForSampleOption,
} from "../../../recap/productsSampledQty";
import { isMileageCustomFieldName } from "./payableMileage";
import { withTimeout, type FetchLike } from "./timedFetch";

export const VOICE_DRAFT_UNAVAILABLE = "Voice draft unavailable";
export const TYPE_WHAT_HAPPENED = "Type or paste what happened";
export const VOICE_TRANSCRIBE_FAILED =
  "Couldn't hear that recording. Type what happened instead.";

/** The page stops recording here; the server refuses longer. */
export const MAX_RECORDING_MS = 180_000;
/** The server refuses bigger uploads. ~3 minutes at 32 kbps is under 1 MB. */
export const MAX_RECORDING_BYTES = 10 * 1024 * 1024;
export const RECORDING_BITS_PER_SECOND = 32_000;
/** Transcribing + filling a 3-minute note can take a while. */
export const VOICE_TRANSCRIBE_TIMEOUT_MS = 90_000;
export const VOICE_DRAFT_TIMEOUT_MS = 60_000;

export type Answer = string | string[];
export type Confidence = "high" | "medium";

export type DraftField = {
  id: string;
  name: string;
  type: string;
  options?: string[];
};

export type VoiceValue = { fieldId: string; value: Answer; confidence: Confidence };
export type VoiceProductCount = { productId: string; value: string; confidence: Confidence };

export type VoiceDraftResult = {
  available: boolean;
  reason: string;
  values: VoiceValue[];
  productSamples: VoiceProductCount[];
};

export type VoiceTranscribeResult = {
  transcribed: boolean;
  transcript: string;
  message: string;
  draft: VoiceDraftResult | null;
};

export type VoiceConflict = {
  kind: "field" | "product";
  id: string;
  current: Answer;
  proposed: Answer;
};

export type VoiceMerge = {
  values: Record<string, Answer>;
  samples: Record<string, string>;
  /** field id → the answer voice put there */
  filledFields: Record<string, Answer>;
  /** product id → the count voice put there */
  filledProducts: Record<string, string>;
  /** boxes the BA had already answered differently; left as they were */
  conflicts: VoiceConflict[];
  /** field ids voice answered with medium confidence: worth a second look */
  checkFields: string[];
};

// ------------------------------------------------------------ browser support

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

export function getSpeechRecognition(): (new () => SpeechSession) | null {
  if (typeof window === "undefined") return null;
  const host = window as Window & {
    SpeechRecognition?: new () => SpeechSession;
    webkitSpeechRecognition?: new () => SpeechSession;
  };
  return host.SpeechRecognition ?? host.webkitSpeechRecognition ?? null;
}

/** Recording formats the server reads, best first. iOS Safari records mp4. */
const RECORDING_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
] as const;

export function pickRecordingType(isTypeSupported: (type: string) => boolean): string {
  for (const type of RECORDING_TYPES) {
    try {
      if (isTypeSupported(type)) return type;
    } catch {
      /* some browsers throw for unknown types */
    }
  }
  return "";
}

/** True when this browser can record audio to send to the server. */
export function canRecordAudio(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  return (
    typeof (window as Window & { MediaRecorder?: unknown }).MediaRecorder === "function" &&
    Boolean(navigator.mediaDevices?.getUserMedia)
  );
}

export function recordingFileName(type: string): string {
  const base = type.split(";")[0].trim().toLowerCase();
  if (base.includes("mp4") || base.includes("m4a")) return "voice.m4a";
  if (base.includes("ogg")) return "voice.ogg";
  if (base.includes("mpeg")) return "voice.mp3";
  if (base.includes("wav")) return "voice.wav";
  return "voice.webm";
}

/** "1:05" */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

// ------------------------------------------------------------ merge rules

const isPhoto = (type: string) => /photo|image|file|signature|video/i.test(type || "");
const isMulti = (type: string) => /multi/i.test(type || "");

export function isEmptyAnswer(value: Answer | undefined | null): boolean {
  if (value == null) return true;
  if (Array.isArray(value)) return value.length === 0;
  return value.trim() === "";
}

export function sameAnswer(a: Answer | undefined, b: Answer | undefined): boolean {
  if (Array.isArray(a) || Array.isArray(b)) {
    const x = Array.isArray(a) ? a : [];
    const y = Array.isArray(b) ? b : [];
    return x.length === y.length && x.every((item) => y.includes(item));
  }
  return (a ?? "").trim() === (b ?? "").trim();
}

/** True when this field can take a voice answer at all. */
export function voiceFillable(field: DraftField): boolean {
  return !isPhoto(field.type) && !isMileageCustomFieldName(field.name);
}

/** The key a product conflict uses in `replaceIds`. */
export const productReplaceKey = (productId: string) => `product:${productId}`;

/**
 * Put a voice draft into the form without changing anything the BA typed.
 *
 * `replaceIds` lists boxes the BA chose to overwrite (the Replace button):
 * field ids, or `productReplaceKey(id)` for a product count.
 */
export function mergeVoiceDraft(args: {
  values: Record<string, Answer>;
  samples: Record<string, string>;
  draft: Pick<VoiceDraftResult, "values" | "productSamples">;
  fields: DraftField[];
  products?: { id: string; name: string; category?: string | null }[];
  replaceIds?: ReadonlySet<string>;
}): VoiceMerge {
  const byId = new Map(args.fields.map((field) => [field.id, field]));
  const values = { ...args.values };
  const samples = { ...args.samples };
  const filledFields: Record<string, Answer> = {};
  const filledProducts: Record<string, string> = {};
  const conflicts: VoiceConflict[] = [];
  const checkFields: string[] = [];
  const replace = args.replaceIds ?? new Set<string>();

  for (const proposal of args.draft.values) {
    const field = byId.get(proposal.fieldId);
    if (!field || !voiceFillable(field)) continue;
    const multi = isMulti(field.type);
    if (multi !== Array.isArray(proposal.value)) continue;
    const options = field.options ?? [];
    if (multi && options.length > 0) {
      if (!(proposal.value as string[]).every((item) => options.includes(item))) continue;
    }
    if (isEmptyAnswer(proposal.value)) continue;
    const current = values[field.id];
    if (sameAnswer(current, proposal.value)) continue;
    if (!isEmptyAnswer(current) && !replace.has(field.id)) {
      conflicts.push({ kind: "field", id: field.id, current: current!, proposed: proposal.value });
      continue;
    }
    values[field.id] = proposal.value;
    filledFields[field.id] = proposal.value;
    if (proposal.confidence === "medium") checkFields.push(field.id);
  }

  const products = args.products ?? [];
  const known = new Set(products.map((product) => product.id));
  for (const proposal of args.draft.productSamples) {
    if (!known.has(proposal.productId) || !/^\d{1,6}$/.test(proposal.value)) continue;
    const current = samples[proposal.productId];
    if (sameAnswer(current, proposal.value)) continue;
    if (!isEmptyAnswer(current) && !replace.has(productReplaceKey(proposal.productId))) {
      conflicts.push({
        kind: "product",
        id: proposal.productId,
        current: current!,
        proposed: proposal.value,
      });
      continue;
    }
    samples[proposal.productId] = proposal.value;
    filledProducts[proposal.productId] = proposal.value;
  }

  // A count on the Products sampled list only shows when the product is
  // ticked. Tick it, but only on a list voice filled or that was empty.
  if (Object.keys(filledProducts).length > 0) {
    for (const field of args.fields) {
      if (!isProductsSampledMultiselect(field)) continue;
      const current = values[field.id];
      const voiceOwned = field.id in filledFields;
      if (!isEmptyAnswer(current) && !voiceOwned) continue;
      const picked = Array.isArray(current) ? [...current] : [];
      for (const option of field.options ?? []) {
        const product = matchProductForSampleOption(option, products);
        if (product && product.id in filledProducts && !picked.includes(option)) {
          picked.push(option);
        }
      }
      if (picked.length > 0 && !sameAnswer(current, picked)) {
        values[field.id] = picked;
        filledFields[field.id] = picked;
      }
    }
  }

  return { values, samples, filledFields, filledProducts, conflicts, checkFields };
}

/** "Filled 9 fields. Check them before you submit." */
export function voiceSummaryLine(filled: number, conflicts: number): string {
  const parts: string[] = [];
  if (filled > 0) {
    parts.push(
      filled === 1
        ? "Filled 1 field. Check it before you submit."
        : `Filled ${filled} fields. Check them before you submit.`,
    );
  } else if (conflicts === 0) {
    parts.push("Nothing you said matched a question on this form. Type the answers in below.");
  }
  if (conflicts > 0) {
    parts.push(
      conflicts === 1
        ? "1 field already had an answer, so it was kept. Tap Replace under it to use what you said."
        : `${conflicts} fields already had answers, so they were kept. Tap Replace under any of them to use what you said.`,
    );
  }
  return parts.join(" ");
}

/** "Mango, Lime" for a list, the text otherwise. */
export function answerText(value: Answer): string {
  return Array.isArray(value) ? value.join(", ") : value;
}

/** When the server can't structure, keep the words in the first notes box. */
export function notesFallback(transcript: string, fields: DraftField[]): VoiceValue[] {
  const text = transcript.trim();
  if (!text) return [];
  const textBoxes = fields.filter(
    (field) =>
      voiceFillable(field) &&
      /text|area|long|string/i.test(field.type) &&
      !/number|int|select|multi/i.test(field.type),
  );
  const notes =
    textBoxes.find((field) => /\bnotes?\b/i.test(field.name)) ??
    textBoxes.find((field) => /feedback|comments?/i.test(field.name));
  return notes ? [{ fieldId: notes.id, value: text, confidence: "medium" }] : [];
}

// ------------------------------------------------------------ server replies

const unavailable = (): VoiceDraftResult => ({
  available: false,
  reason: VOICE_DRAFT_UNAVAILABLE,
  values: [],
  productSamples: [],
});

const confidenceOf = (raw: unknown): Confidence => (raw === "high" ? "high" : "medium");

/** The server reply → a draft. Anything malformed is dropped. */
export function parseVoiceDraft(json: unknown): VoiceDraftResult {
  if (!json || typeof json !== "object") return unavailable();
  const body = json as Record<string, unknown>;
  const values: VoiceValue[] = [];
  if (Array.isArray(body.values)) {
    for (const entry of body.values) {
      if (!entry || typeof entry !== "object") continue;
      const row = entry as Record<string, unknown>;
      const fieldId = typeof row.fieldId === "string" ? row.fieldId : "";
      const raw = row.value;
      let value: Answer | null = null;
      if (typeof raw === "string" && raw.trim()) value = raw.trim();
      if (Array.isArray(raw)) {
        const items = raw.filter((item): item is string => typeof item === "string" && !!item);
        value = items.length ? items : null;
      }
      if (fieldId && value !== null) {
        values.push({ fieldId, value, confidence: confidenceOf(row.confidence) });
      }
    }
  } else if (Array.isArray(body.fills)) {
    // An older server: text answers only.
    for (const entry of body.fills) {
      if (!entry || typeof entry !== "object") continue;
      const row = entry as Record<string, unknown>;
      const fieldId = typeof row.fieldId === "string" ? row.fieldId : "";
      const text = typeof row.text === "string" ? row.text.trim() : "";
      if (fieldId && text) values.push({ fieldId, value: text, confidence: "medium" });
    }
  }
  const productSamples: VoiceProductCount[] = [];
  if (Array.isArray(body.productSamples)) {
    for (const entry of body.productSamples) {
      if (!entry || typeof entry !== "object") continue;
      const row = entry as Record<string, unknown>;
      const productId = typeof row.productId === "string" ? row.productId : "";
      const value = typeof row.value === "string" ? row.value.trim() : "";
      if (productId && /^\d{1,6}$/.test(value)) {
        productSamples.push({ productId, value, confidence: confidenceOf(row.confidence) });
      }
    }
  }
  return {
    available: body.available === true,
    reason: typeof body.reason === "string" ? body.reason : "",
    values,
    productSamples,
  };
}

export async function requestVoiceDraft(args: {
  origin: string;
  code: string;
  session: string;
  transcript: string;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
}): Promise<VoiceDraftResult> {
  const doFetch = withTimeout(
    args.fetchImpl ?? ((input, init) => fetch(input, init)),
    args.timeoutMs ?? VOICE_DRAFT_TIMEOUT_MS,
  );
  try {
    const res = await doFetch(
      `${args.origin}/api/public/checkin/${encodeURIComponent(args.code)}/voice-draft`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session: args.session, transcript: args.transcript }),
      },
    );
    if (!res.ok) return unavailable();
    return parseVoiceDraft(await res.json());
  } catch {
    return unavailable();
  }
}

export async function requestVoiceTranscribe(args: {
  origin: string;
  code: string;
  session: string;
  audio: Blob;
  type: string;
  durationMs: number;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
}): Promise<VoiceTranscribeResult> {
  const failed: VoiceTranscribeResult = {
    transcribed: false,
    transcript: "",
    message: VOICE_TRANSCRIBE_FAILED,
    draft: null,
  };
  if (args.audio.size === 0) return failed;
  if (args.audio.size > MAX_RECORDING_BYTES) {
    return { ...failed, message: "That recording is too long. Keep it under 3 minutes." };
  }
  const doFetch = withTimeout(
    args.fetchImpl ?? ((input, init) => fetch(input, init)),
    args.timeoutMs ?? VOICE_TRANSCRIBE_TIMEOUT_MS,
  );
  try {
    const form = new FormData();
    form.append("session", args.session);
    form.append("durationMs", String(Math.round(args.durationMs)));
    const type = args.type.split(";")[0].trim() || "audio/webm";
    form.append("audio", new Blob([args.audio], { type }), recordingFileName(type));
    const res = await doFetch(
      `${args.origin}/api/public/checkin/${encodeURIComponent(args.code)}/voice-transcribe`,
      { method: "POST", body: form },
    );
    if (res.status === 429) {
      return {
        ...failed,
        message: "That's a lot of recordings this shift. Type what happened instead.",
      };
    }
    if (!res.ok) return failed;
    const body = (await res.json()) as Record<string, unknown>;
    return {
      transcribed: body.transcribed === true,
      transcript: typeof body.transcript === "string" ? body.transcript : "",
      message: typeof body.message === "string" ? body.message : "",
      draft: body.draft ? parseVoiceDraft(body.draft) : null,
    };
  } catch {
    return failed;
  }
}
