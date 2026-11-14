/**
 * Rows for the dashboard's "On the sheets today" panel: who the staffing
 * sheets have on each shift, and whether Spark's booking agrees.
 *
 * Spark only reads the sheets. A row that disagrees is information for a
 * person to act on — nothing here books or changes anyone.
 */

export type SheetShift = {
  uuid: string;
  startText: string;
  endText: string;
  storeName: string;
  baName: string;
  brandName: string;
  sourceLabel: string;
  sheetUrl: string;
  match: string;
  bookedNames: ReadonlyArray<string>;
  agrees: boolean | null | undefined;
};

export type SheetRow = {
  key: string;
  title: string;
  detail: string;
  verdict: string;
  flagged: boolean;
  href: string;
};

const hours = (s: SheetShift): string =>
  s.startText && s.endText
    ? `${s.startText}–${s.endText}`
    : s.startText || s.endText;

export function sheetVerdict(s: SheetShift): { text: string; flagged: boolean } {
  if (s.match === "ambiguous") {
    return { text: "Fits more than one Spark event", flagged: true };
  }
  if (s.match !== "matched" || s.agrees == null) {
    return { text: "No Spark event for this row", flagged: true };
  }
  if (s.agrees) return { text: "Booked in Spark", flagged: false };
  return s.bookedNames.length > 0
    ? { text: `Spark has ${s.bookedNames.join(", ")}`, flagged: true }
    : { text: "Nobody booked in Spark", flagged: true };
}

/** Disagreements first, then by store, so what needs a look is on top. */
export function sheetRows(
  shifts: ReadonlyArray<SheetShift>,
  opts: { showBrand: boolean },
): SheetRow[] {
  return shifts
    .map((s) => {
      const verdict = sheetVerdict(s);
      const parts = [s.baName, hours(s)];
      if (opts.showBrand && s.brandName) parts.push(s.brandName);
      return {
        key: s.uuid,
        title: s.storeName || s.sourceLabel || "Unnamed row",
        detail: parts.filter(Boolean).join(" · "),
        verdict: verdict.text,
        flagged: verdict.flagged,
        href: s.sheetUrl,
      };
    })
    .sort(
      (a, b) =>
        Number(b.flagged) - Number(a.flagged) || a.title.localeCompare(b.title),
    );
}
