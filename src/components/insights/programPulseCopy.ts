/**
 * Slack / Ask-AI Program pulse copy helpers.
 *
 * Pure string builders — no React or Relay imports — so unit tests can
 * run in CI before `relay-compiler` generates GraphQL artifacts.
 */

const fmt = (n: number) => n.toLocaleString();

/** Compact Program-pulse badge labels (distinct from the big activation card). */
export const ACTIVATION_BADGE_LABEL: Record<string, string> = {
  retail: "Retail demos",
  onprem: "On-prem samplings",
  event: "Events",
};

export type MixBucket = { key: string; label: string; count: number };
export type SkuRow = { product: string; samples: number };

/** One-liner from real page aggregates only — no invented rates. */
export function buildProgramPulseOneLiner(opts: {
  rangeLabel: string;
  convPct: number | null;
  sold: number;
  sampled: number;
  mix: MixBucket[];
  topSkus: SkuRow[];
  totalSamples: number;
}): string {
  const parts: string[] = [];
  if (opts.convPct != null && opts.sold > 0 && opts.sampled > 0) {
    parts.push(
      `${Math.round(opts.convPct)}% conversion (${fmt(opts.sold)} sold ÷ ${fmt(opts.sampled)} sampled, Retail + On-Prem)`,
    );
  } else if (opts.sold > 0 || opts.sampled > 0) {
    parts.push(
      `${fmt(opts.sold)} sold and ${fmt(opts.sampled)} sampled on Retail + On-Prem`,
    );
  }

  const mixBits = opts.mix
    .filter((b) => b.count > 0)
    .map((b) => `${fmt(b.count)} ${b.label}`);
  if (mixBits.length > 0) {
    parts.push(`activation mix ${mixBits.join(", ")}`);
  }

  if (opts.topSkus.length > 0 && opts.totalSamples > 0) {
    const lead = opts.topSkus[0];
    parts.push(
      `top SKU ${lead.product} with ${fmt(lead.samples)} samples handed out (${fmt(opts.totalSamples)} structured total)`,
    );
  }

  if (parts.length === 0) {
    return `No conversion, activation, or SKU sample totals in ${opts.rangeLabel} yet.`;
  }
  return `In ${opts.rangeLabel}: ${parts.join("; ")}.`;
}

export function buildProgramPulseCopy(opts: {
  rangeLabel: string;
  startDate: string;
  endDate: string;
  convPct: number | null;
  sold: number;
  sampled: number;
  mix: MixBucket[];
  topSkus: SkuRow[];
  totalSamples: number;
  oneLiner: string;
}): string {
  const lines: string[] = [
    `*Program pulse — ${opts.rangeLabel.toUpperCase()} (${opts.startDate} → ${opts.endDate})*`,
    "",
    opts.oneLiner,
    "",
  ];

  if (opts.convPct != null && opts.sold > 0 && opts.sampled > 0) {
    lines.push(
      `• Conversion (Retail + On-Prem): ${Math.round(opts.convPct)}% · ${fmt(opts.sold)} sold ÷ ${fmt(opts.sampled)} sampled`,
    );
  } else {
    lines.push(
      `• Conversion (Retail + On-Prem): — · ${fmt(opts.sold)} sold ÷ ${fmt(opts.sampled)} sampled`,
    );
  }

  const mixLine = opts.mix
    .filter((b) => ACTIVATION_BADGE_LABEL[b.key])
    .map((b) => `${ACTIVATION_BADGE_LABEL[b.key]} ${fmt(b.count)}`)
    .join(" · ");
  if (mixLine) {
    lines.push(`• Activation mix: ${mixLine}`);
  }

  if (opts.topSkus.length > 0) {
    lines.push(
      `• Top SKUs sampled (structured): ${opts.topSkus
        .slice(0, 5)
        .map((s) => `${s.product} ${fmt(s.samples)}`)
        .join(" · ")}`,
    );
    if (opts.sold > 0) {
      lines.push(
        `• Products purchased (Retail + On-Prem aggregate, not per SKU): ${fmt(opts.sold)}`,
      );
    }
  }

  lines.push("", "From Spark Dashboard · Program pulse");
  return lines.join("\n");
}
