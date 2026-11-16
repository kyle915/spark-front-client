/**
 * Wording for one shelf photo's reading on the recap review page. Pure
 * functions, unit-tested without a component or a generated Relay file.
 */

export type ShelfAnswer = "yes" | "no" | "unclear";

export type ShelfAnswers = {
  readonly productOnShelf: string;
  readonly facings: number | null | undefined;
  readonly priceTagVisible: string;
  readonly price: string | null | undefined;
  readonly outOfStockGap: string;
};

export type ShelfPhoto = {
  readonly fileId: string;
  readonly fileUrl: string;
  readonly bucketName: string;
  /** "pending" | "read" | "unreadable" */
  readonly status: string;
  readonly reading: ShelfAnswers | null | undefined;
  readonly correction:
    | {
        readonly answers: ShelfAnswers;
        readonly note: string;
        readonly correctedByName: string;
        readonly correctedAt: string;
      }
    | null
    | undefined;
};

export const SHELF_ANSWERS: readonly ShelfAnswer[] = ["yes", "no", "unclear"];

export function asShelfAnswer(value: string | null | undefined): ShelfAnswer {
  return value === "yes" || value === "no" ? value : "unclear";
}

export function answerWord(value: string | null | undefined): string {
  const answer = asShelfAnswer(value);
  switch (answer) {
    case "yes":
      return "Yes";
    case "no":
      return "No";
    case "unclear":
      return "Unclear";
    default: {
      const exhaustive: never = answer;
      return exhaustive;
    }
  }
}

/** The answer in force: the staff correction when there is one. */
export function effectiveAnswers(photo: ShelfPhoto): ShelfAnswers | null {
  return photo.correction?.answers ?? photo.reading ?? null;
}

/** One line per question, in a fixed order. */
export function readingLines(a: ShelfAnswers): { label: string; value: string }[] {
  const product = asShelfAnswer(a.productOnShelf);
  const tag = asShelfAnswer(a.priceTagVisible);
  const facings =
    product === "yes" && typeof a.facings === "number" && a.facings > 0
      ? `, about ${a.facings} ${a.facings === 1 ? "facing" : "facings"}`
      : "";
  const price = tag === "yes" && a.price ? `, $${a.price}` : "";
  return [
    { label: "Product on shelf", value: `${answerWord(product)}${facings}` },
    { label: "Price tag visible", value: `${answerWord(tag)}${price}` },
    { label: "Out-of-stock gap", value: answerWord(a.outOfStockGap) },
  ];
}

/** What to say for a photo with no answer in force. */
export function statusLine(photo: ShelfPhoto): string {
  if (effectiveAnswers(photo)) return "";
  if (photo.status === "unreadable") return "This does not look like a shelf photo.";
  return "Not read yet.";
}

/** A facings box value → a whole number, or null when blank or not one. */
export function parseFacings(raw: string): number | null {
  const text = raw.trim();
  if (!/^\d{1,3}$/.test(text)) return null;
  return Number(text);
}

/** A price box value → "3.49", "" when blank, or null when not an amount. */
export function parsePrice(raw: string): string | null {
  const text = raw.trim().replace(/^\$/, "");
  if (text === "") return "";
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(text)) return null;
  return text;
}
