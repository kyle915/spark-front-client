/**
 * Real-time aisle shelf coach for walk-up shelf-bucket photos.
 *
 * Runs after upload (sibling of photo-check). Never blocks submit.
 * Optional fileId persists a ShelfReading when the photo is already filed.
 */

export const SHELF_COACH_UNAVAILABLE = "Shelf coach unavailable";

export type ShelfCoachNudge = {
  code: string;
  severity: "warn" | "info";
  message: string;
};

export type ShelfCoachAnswers = {
  productOnShelf: string;
  facings: number | null;
  priceTagVisible: string;
  price: string | null;
  outOfStockGap: string;
};

export type ShelfCoachResult = {
  available: boolean;
  reason: string;
  status: string | null;
  answers: ShelfCoachAnswers | null;
  nudges: ShelfCoachNudge[];
  message: string;
  persisted: boolean;
};

export type ShelfCoachAdvisory =
  | { kind: "unavailable"; message: string }
  | { kind: "warn"; message: string }
  | { kind: "ok"; message: string };

function unavailableResult(): ShelfCoachResult {
  return {
    available: false,
    reason: SHELF_COACH_UNAVAILABLE,
    status: null,
    answers: null,
    nudges: [],
    message: SHELF_COACH_UNAVAILABLE,
    persisted: false,
  };
}

function parseAnswers(raw: unknown): ShelfCoachAnswers | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  return {
    productOnShelf: typeof row.productOnShelf === "string" ? row.productOnShelf : "unclear",
    facings: typeof row.facings === "number" ? row.facings : null,
    priceTagVisible: typeof row.priceTagVisible === "string" ? row.priceTagVisible : "unclear",
    price: typeof row.price === "string" ? row.price : null,
    outOfStockGap: typeof row.outOfStockGap === "string" ? row.outOfStockGap : "unclear",
  };
}

function parseNudges(raw: unknown): ShelfCoachNudge[] {
  if (!Array.isArray(raw)) return [];
  const out: ShelfCoachNudge[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const code = typeof row.code === "string" ? row.code : "";
    const message = typeof row.message === "string" ? row.message : "";
    if (!code || !message) continue;
    const severity = row.severity === "info" ? "info" : "warn";
    out.push({ code, severity, message });
  }
  return out;
}

export function advisoryFromShelfCoach(result: ShelfCoachResult): ShelfCoachAdvisory {
  if (!result.available) {
    return {
      kind: "unavailable",
      message: result.reason || result.message || SHELF_COACH_UNAVAILABLE,
    };
  }
  const warn = result.nudges.find((n) => n.severity === "warn");
  if (warn) {
    return { kind: "warn", message: warn.message };
  }
  if (result.nudges.length > 0) {
    return { kind: "warn", message: result.nudges[0].message };
  }
  return {
    kind: "ok",
    message: result.message || "Shelf photo checked.",
  };
}

/** Prefer the stronger shelf-coach warn over a softer photo-check ok. */
export function mergePhotoAdvisories(
  photoCheck: { kind: "pending" | "unavailable" | "warn" | "ok"; message: string } | null | undefined,
  shelf: ShelfCoachAdvisory | null | undefined,
): { kind: "pending" | "unavailable" | "warn" | "ok"; message: string } | null {
  if (shelf?.kind === "warn") {
    return { kind: "warn", message: shelf.message };
  }
  if (photoCheck?.kind === "warn") {
    return { kind: "warn", message: photoCheck.message };
  }
  if (shelf?.kind === "ok") {
    return { kind: "ok", message: shelf.message };
  }
  if (photoCheck) {
    return { kind: photoCheck.kind, message: photoCheck.message };
  }
  if (shelf?.kind === "unavailable") {
    return null;
  }
  return null;
}

export async function requestShelfCoach(args: {
  origin: string;
  code: string;
  session: string;
  file: Blob;
  contentType: string;
  mode?: "shelf" | "setup";
  bucketName?: string | null;
  fileId?: string | number | null;
  fetchImpl?: typeof fetch;
}): Promise<ShelfCoachResult> {
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
    const body: Record<string, unknown> = {
      session: args.session,
      imageBase64,
      contentType: args.contentType,
    };
    if (args.mode) {
      body.mode = args.mode;
    }
    if (args.bucketName && args.bucketName.trim()) {
      body.bucketName = args.bucketName.trim();
    }
    if (args.fileId != null && String(args.fileId).trim()) {
      body.fileId = String(args.fileId).trim();
    }
    const res = await fetchImpl(
      `${args.origin}/api/public/checkin/${encodeURIComponent(args.code)}/shelf-coach`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    if (!res.ok) return unavailableResult();
    const json = (await res.json()) as Record<string, unknown>;
    return {
      available: Boolean(json.available),
      reason: typeof json.reason === "string" ? json.reason : "",
      status: typeof json.status === "string" ? json.status : null,
      answers: parseAnswers(json.answers),
      nudges: parseNudges(json.nudges),
      message: typeof json.message === "string" ? json.message : "",
      persisted: Boolean(json.persisted),
    };
  } catch {
    return unavailableResult();
  }
}
