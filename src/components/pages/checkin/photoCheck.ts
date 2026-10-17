/**
 * Advisory photo check for a walk-up capture.
 *
 * Runs when a photo is added, never when the page loads. A warning can be
 * kept or retaken. The upload is never rejected.
 */

export const PHOTO_CHECK_UNAVAILABLE = "Photo check unavailable";

export type PhotoBucketKind = "shelf" | "table_setup" | "sampling" | "receipt" | "other";

export type PhotoCheckResult = {
  available: boolean;
  reason: string;
  bucket: PhotoBucketKind | null;
  suggestedBucketName: string | null;
  productVisible: boolean | null;
  emptyShelf: boolean;
  message: string;
};

export type PhotoAdvisory =
  | { kind: "unavailable"; message: string }
  | { kind: "warn"; message: string }
  | { kind: "ok"; message: string };

const KINDS: readonly PhotoBucketKind[] = [
  "shelf",
  "table_setup",
  "sampling",
  "receipt",
  "other",
];

function isKind(value: unknown): value is PhotoBucketKind {
  return typeof value === "string" && (KINDS as readonly string[]).includes(value);
}

export function kindLabel(kind: PhotoBucketKind): string {
  switch (kind) {
    case "shelf":
      return "shelf";
    case "table_setup":
      return "table setup";
    case "sampling":
      return "sampling";
    case "receipt":
      return "receipt";
    case "other":
      return "other";
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
}

export async function sha256Hex(file: Blob): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return "";
  const digest = await subtle.digest("SHA-256", await file.arrayBuffer());
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function advisoryFromPhotoCheck(
  result: PhotoCheckResult,
  chosenBucketName: string | null,
): PhotoAdvisory {
  if (!result.available) {
    return {
      kind: "unavailable",
      message: result.reason || result.message || PHOTO_CHECK_UNAVAILABLE,
    };
  }
  const chosen = (chosenBucketName || "").trim().toLowerCase();
  const suggested = (result.suggestedBucketName || "").trim().toLowerCase();
  const mismatch = Boolean(chosen && suggested && chosen !== suggested);
  if (result.emptyShelf || mismatch) {
    return { kind: "warn", message: result.message || "Take another look at this photo." };
  }
  const label = result.suggestedBucketName || (result.bucket ? kindLabel(result.bucket) : "");
  return {
    kind: "ok",
    message: result.message || (label ? `Looks like ${label}.` : ""),
  };
}

function unavailableResult(): PhotoCheckResult {
  return {
    available: false,
    reason: PHOTO_CHECK_UNAVAILABLE,
    bucket: null,
    suggestedBucketName: null,
    productVisible: null,
    emptyShelf: false,
    message: PHOTO_CHECK_UNAVAILABLE,
  };
}

export async function requestPhotoCheck(args: {
  origin: string;
  code: string;
  session: string;
  file: Blob;
  contentType: string;
  category: string | null;
  fetchImpl?: typeof fetch;
}): Promise<PhotoCheckResult> {
  if (!args.contentType.startsWith("image/") || args.file.size === 0 || args.file.size > 4_000_000) {
    return unavailableResult();
  }
  const fetchImpl = args.fetchImpl ?? fetch;
  try {
    const bytes = new Uint8Array(await args.file.arrayBuffer());
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    const imageBase64 = btoa(binary);
    const res = await fetchImpl(
      `${args.origin}/api/public/checkin/${encodeURIComponent(args.code)}/photo-check`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session: args.session,
          imageBase64,
          contentType: args.contentType,
          category: args.category,
        }),
      },
    );
    if (!res.ok) return unavailableResult();
    const json = (await res.json()) as Partial<PhotoCheckResult>;
    return {
      available: Boolean(json.available),
      reason: typeof json.reason === "string" ? json.reason : "",
      bucket: isKind(json.bucket) ? json.bucket : null,
      suggestedBucketName:
        typeof json.suggestedBucketName === "string" ? json.suggestedBucketName : null,
      productVisible: typeof json.productVisible === "boolean" ? json.productVisible : null,
      emptyShelf: Boolean(json.emptyShelf),
      message: typeof json.message === "string" ? json.message : "",
    };
  } catch {
    return unavailableResult();
  }
}
