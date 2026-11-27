export interface CampaignFunnelInput {
  events: number;
  recaps: number;
  consumersReached: number;
  samplesDistributed: number;
  productsSold: number;
  cansSold: number;
  packsSold: number;
  totalEngagements: number;
  firstTimeConsumers: number;
  brandAwareConsumers: number;
  willingToPurchase: number;
}

export interface CampaignFunnelStage {
  key: string;
  label: string;
  value: number;
  barPct: number;
  rateNote: string | null;
}

export function computeCampaignConversionPct(
  kpis: Pick<CampaignFunnelInput, "productsSold" | "samplesDistributed" | "consumersReached">,
): string | null {
  const sold = kpis.productsSold;
  const base =
    kpis.samplesDistributed > 0
      ? kpis.samplesDistributed
      : kpis.consumersReached;
  if (!(sold > 0) || !(base > 0)) return null;
  const pct = (sold / base) * 100;
  if (pct > 100) return null;
  return `${pct.toFixed(1)}%`;
}

export function buildCampaignFunnel(
  kpis: CampaignFunnelInput,
): CampaignFunnelStage[] {
  const reachBase = Math.max(
    kpis.consumersReached,
    kpis.totalEngagements,
    kpis.samplesDistributed,
  );
  const sampleBase =
    kpis.samplesDistributed > 0 ? kpis.samplesDistributed : reachBase;

  const pctOf = (num: number, denom: number, suffix: string): string | null => {
    if (!(num > 0) || !(denom > 0) || num > denom) return null;
    return `${Math.round((num / denom) * 100)}% ${suffix}`;
  };

  const candidates: Array<{
    key: string;
    label: string;
    value: number;
    rateNote: string | null;
  }> = [
    {
      key: "reached",
      label: "Consumers reached",
      value: kpis.consumersReached,
      rateNote:
        kpis.events > 0
          ? `${Math.round(kpis.consumersReached / kpis.events).toLocaleString("en-US")} avg / event`
          : null,
    },
    {
      key: "sampled",
      label: "Samples distributed",
      value: kpis.samplesDistributed,
      rateNote: pctOf(kpis.samplesDistributed, kpis.consumersReached, "of reached"),
    },
    {
      key: "first_time",
      label: "First-time trial",
      value: kpis.firstTimeConsumers,
      rateNote: pctOf(kpis.firstTimeConsumers, sampleBase, "new to brand"),
    },
    {
      key: "willing",
      label: "Willing to purchase",
      value: kpis.willingToPurchase,
      rateNote: pctOf(kpis.willingToPurchase, sampleBase, "purchase intent"),
    },
    {
      key: "sold",
      label: "Units sold",
      value: kpis.productsSold,
      rateNote: (() => {
        const conv = computeCampaignConversionPct(kpis);
        return conv ? `${conv} conversion` : null;
      })(),
    },
  ];

  const active = candidates.filter((c) => c.value > 0);
  if (active.length === 0) return [];
  const maxVal = Math.max(1, ...active.map((c) => c.value));

  return active.map((c) => ({
    ...c,
    barPct: Math.min(100, Math.max(4, Math.round((c.value / maxVal) * 100))),
  }));
}
