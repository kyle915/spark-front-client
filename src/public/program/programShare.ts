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


const shortDate = (iso: string): string => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

/** "Opened 12 times, last Nov 9, 2026 · Works until Dec 10, 2026" */
export const shareStatusLine = (s: {
  views: number;
  lastViewedAt: string | null;
  expiresAt: string | null;
}): string => {
  const parts: string[] = [];
  if (s.views > 0) {
    const last = s.lastViewedAt ? shortDate(s.lastViewedAt) : "";
    parts.push(
      `Opened ${s.views.toLocaleString("en-US")} time${s.views === 1 ? "" : "s"}` +
        (last ? `, last ${last}` : ""),
    );
  } else {
    parts.push("Not opened yet");
  }
  const until = s.expiresAt ? shortDate(s.expiresAt) : "";
  parts.push(until ? `Works until ${until}` : "No end date");
  return parts.join(" · ");
};
