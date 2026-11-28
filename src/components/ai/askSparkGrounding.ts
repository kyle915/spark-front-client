export function askSparkPendingStage(elapsedMs: number, isClient = false): string {
  const noun = isClient ? "your program data" : "program data";
  if (elapsedMs < 1800) {
    return `Checking ${noun}…`;
  }
  if (elapsedMs < 4000) {
    return "Cross-checking approved recaps & KPIs…";
  }
  return "Drafting grounded answer…";
}

export function formatGroundingSummary(opts: {
  sourceCount?: number;
  scopeLabel?: string;
  thoughtSeconds?: number | null;
  hasChart?: boolean;
}): string {
  const parts: string[] = [];
  if (opts.sourceCount && opts.sourceCount > 0) {
    parts.push(
      `Grounded in ${opts.sourceCount} ${opts.sourceCount === 1 ? "source" : "sources"}`,
    );
  } else if (opts.scopeLabel) {
    parts.push(`Grounded in ${opts.scopeLabel}`);
  } else {
    parts.push("Grounded in approved program data");
  }
  if (opts.hasChart) {
    parts.push("chart verified");
  }
  if (opts.thoughtSeconds != null && opts.thoughtSeconds > 0) {
    parts.push(`${opts.thoughtSeconds}s`);
  }
  return parts.join(" · ");
}
