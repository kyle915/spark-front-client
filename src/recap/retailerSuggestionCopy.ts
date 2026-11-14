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
  const unsure = p.confidence === "low" ? " This one is a guess; check it first." : "";
  return `Spark suggests ${p.name}${from}.${fresh}${unsure}`;
};

/** A guess is never applied unless the reviewer ticks it themselves. */
export const tickedByDefault = (p: Pick<Proposal, "confidence"> | null | undefined): boolean =>
  Boolean(p) && p?.confidence !== "low";
