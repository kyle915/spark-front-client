export type ProgramSharePayload = {
  brand: string;
  generatedAt: string;
  totals: {
    activations: number;
    events: number;
    consumersReached: number;
    samplesDistributed: number;
    productsSold: number;
    states: number;
  };
  markets: { state: string; activations: number }[];
  photos: { url: string; caption: string }[];
};

export type ProgramStat = { label: string; value: string };

const fmt = (n: number) => n.toLocaleString("en-US");

/** Headline tiles. A figure the program never recorded is left out rather
 *  than shown as 0. */
export const programStats = (t: ProgramSharePayload["totals"]): ProgramStat[] => {
  const out: ProgramStat[] = [];
  const add = (label: string, n: number) => {
    if (Number.isFinite(n) && n > 0) out.push({ label, value: fmt(n) });
  };
  add("Activations", t.activations);
  add("Consumers reached", t.consumersReached);
  add("Samples handed out", t.samplesDistributed);
  add("Products sold", t.productsSold);
  add(t.states === 1 ? "State" : "States", t.states);
  return out;
};

export const programLinkUrl = (origin: string, token: string): string =>
  `${origin.replace(/\/$/, "")}/program/${encodeURIComponent(token)}`;
