type Proposal = {
  readonly name: string;
  readonly confidence: string;
  readonly sourceLabel: string;
  readonly isNewRetailer: boolean;
};

/** "Spark suggests Kroger, from the staffing sheet." */
export const suggestionSentence = (p: Proposal): string => {
  const from = p.sourceLabel ? `, from ${p.sourceLabel}` : "";
  const fresh = p.isNewRetailer ? " It would be added as a new retailer for this brand." : "";
  const unsure =
    p.confidence === "low"
      ? " This one is a guess; check it first."
      : p.confidence === "medium"
        ? " Check it before using it."
        : "";
  return `Spark suggests ${p.name}${from}.${fresh}${unsure}`;
};

/** The box is ticked for the reviewer only when the suggestion names a
 *  retailer already in Spark from a written source (high confidence). The
 *  first run on live data showed that a store name read off a sheet or a
 *  recap answer is sometimes a town or a stray sentence, so anything less
 *  sure is offered but left for the reviewer to tick. */
export const tickedByDefault = (p: Pick<Proposal, "confidence"> | null | undefined): boolean =>
  p?.confidence === "high";
