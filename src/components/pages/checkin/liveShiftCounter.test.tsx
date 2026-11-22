import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import LiveShiftCounterCard from "./LiveShiftCounterCard";
import type { Template } from "./checkinTypes";
import {
  clearLiveShiftCounter,
  hasSavedLiveCounterActivity,
  liveCounterTotals,
  readLiveShiftCounter,
  resolveActiveCounterSkus,
  syncLiveCounterToRecapDraft,
  writeLiveShiftCounter,
} from "./liveShiftCounter";
import type { StorageLike } from "./offlineClock";
import { readDraft, writeDraft } from "./recapDraft";

function memStorage(): StorageLike {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => {
      m.set(k, v);
    },
    removeItem: (k) => {
      m.delete(k);
    },
  };
}

const CODE = "TH-2HRV3D";
const TOKEN = "session-token-1234567890abcdefghijklmnop";

const TORCH_TEMPLATE: Template = {
  id: "tpl-torch",
  name: "Torch Retail Sampling",
  productSamples: true,
  products: [
    {
      id: "prod-cherry",
      name: "Black Cherry 5mg 12oz",
      category: "Seltzer 5mg Lite",
      imageUrl: null,
    },
    {
      id: "prod-rasp",
      name: "Raspberry 10mg 12oz",
      category: "Iced Tea 10mg",
      imageUrl: null,
    },
  ],
  sections: [
    {
      id: "sec-1",
      name: "Sampling Metrics",
      fields: [
        {
          id: "f-products",
          name: "Products Sampled",
          type: "multiselect",
          required: true,
          options: [
            "Seltzer 5mg Lite — Black Cherry 5mg 12oz",
            "Iced Tea 10mg — Raspberry 10mg 12oz",
          ],
        },
        {
          id: "f-consumers",
          name: "Total number of consumers sampled",
          type: "number",
          required: true,
          options: [],
        },
        {
          id: "f-sold",
          name: "Total units sold",
          type: "number",
          required: false,
          options: [],
        },
        {
          id: "f-feedback",
          name: "Consumer feedback & quotes",
          type: "long_text",
          required: false,
          options: [],
        },
      ],
    },
  ],
};

describe("liveShiftCounter offline persistence & recap pre-population", () => {
  it("persists per-SKU samples, sold, consumers sampled, and quotes offline", () => {
    const storage = memStorage();
    expect(hasSavedLiveCounterActivity(CODE, TOKEN, storage)).toBe(false);

    writeLiveShiftCounter(
      CODE,
      TOKEN,
      {
        consumersSampled: 27,
        skus: {
          "prod-cherry": { samples: 18, sold: 4 },
          "prod-rasp": { samples: 14, sold: 2 },
        },
        quotes: [
          { id: "q1", text: "Way smoother than seltzers I usually buy!", savedAt: 1700000000000 },
          { id: "q2", text: "Grabbing a 4-pack of Black Cherry right now", savedAt: 1700000060000 },
        ],
      },
      storage,
    );

    expect(hasSavedLiveCounterActivity(CODE, TOKEN, storage)).toBe(true);
    const restored = readLiveShiftCounter(CODE, TOKEN, storage);
    expect(liveCounterTotals(restored)).toEqual({
      totalSamples: 32,
      totalSold: 6,
      consumersSampled: 27,
      quoteCount: 2,
    });
  });

  it("pre-populates RecapDraft with SKU samples, multiselect pills, units sold, consumers sampled, and quotes", () => {
    const storage = memStorage();
    writeLiveShiftCounter(
      CODE,
      TOKEN,
      {
        consumersSampled: 24,
        skus: {
          "prod-cherry": { samples: 15, sold: 5 },
          "prod-rasp": { samples: 11, sold: 3 },
        },
        quotes: [
          { id: "q1", text: "Zero cannabis aftertaste!", savedAt: 1700000000000 },
          { id: "q2", text: '"Love the 5mg low dose"', savedAt: 1700000050000 },
        ],
      },
      storage,
    );

    const synced = syncLiveCounterToRecapDraft({
      code: CODE,
      token: TOKEN,
      template: TORCH_TEMPLATE,
      storage,
    });
    expect(synced).toBe(true);

    const draft = readDraft(CODE, TOKEN, "shift", storage);
    expect(draft).not.toBeNull();
    // Samples are distinct from consumers sampled (26 total samples vs 24 consumers)
    expect(draft?.samples).toEqual({
      "prod-cherry": "15",
      "prod-rasp": "11",
    });
    expect(draft?.values["f-products"]).toEqual([
      "Iced Tea 10mg — Raspberry 10mg 12oz",
      "Seltzer 5mg Lite — Black Cherry 5mg 12oz",
    ]);
    expect(draft?.values["f-consumers"]).toBe("24");
    expect(draft?.values["f-sold"]).toBe("8");
    expect(draft?.values["f-feedback"]).toBe(
      '"Zero cannabis aftertaste!"\n"Love the 5mg low dose"',
    );
  });

  it("populates native engagements when template has no custom consumers-sampled field", () => {
    const storage = memStorage();
    const simpleTemplate: Template = {
      id: "tpl-simple",
      name: "Event Activation",
      productSamples: true,
      products: [{ id: "p1", name: "Original", imageUrl: null }],
      sections: [
        {
          id: "s1",
          name: "Highlights",
          fields: [
            { id: "f-notes", name: "Activation highlights", type: "long_text", required: false, options: [] },
          ],
        },
      ],
    };

    writeLiveShiftCounter(
      CODE,
      TOKEN,
      {
        consumersSampled: 42,
        skus: { p1: { samples: 50, sold: 0 } },
        quotes: [{ id: "q1", text: "Best sample at the festival", savedAt: 1700000000000 }],
      },
      storage,
    );

    syncLiveCounterToRecapDraft({
      code: CODE,
      token: TOKEN,
      template: simpleTemplate,
      storage,
    });

    const draft = readDraft(CODE, TOKEN, "shift", storage);
    expect(draft?.engagements).toBe("42");
    expect(draft?.samples).toEqual({ p1: "50" });
    expect(draft?.values["f-notes"]).toBe('"Best sample at the festival"');
  });

  it("preserves manual BA edits in RecapForm while appending newly jotted quotes", () => {
    const storage = memStorage();
    writeLiveShiftCounter(
      CODE,
      TOKEN,
      {
        consumersSampled: 10,
        skus: { "prod-cherry": { samples: 12, sold: 2 } },
        quotes: [{ id: "q1", text: "First quote", savedAt: 1 }],
      },
      storage,
    );
    syncLiveCounterToRecapDraft({
      code: CODE,
      token: TOKEN,
      template: TORCH_TEMPLATE,
      storage,
    });

    // Simulate BA opening RecapForm and manually overriding consumers count + adding prose
    const existing = readDraft(CODE, TOKEN, "shift", storage)!;
    writeDraft(
      CODE,
      TOKEN,
      {
        ...existing,
        values: {
          ...existing.values,
          "f-consumers": "14",
          "f-feedback": 'Steady crowd at 4pm.\n"First quote"',
        },
      },
      "shift",
      storage,
    );

    // BA goes back to live shift counter, taps +3 samples and adds a second quote
    const counter = readLiveShiftCounter(CODE, TOKEN, storage);
    writeLiveShiftCounter(
      CODE,
      TOKEN,
      {
        ...counter,
        consumersSampled: 11,
        skus: { "prod-cherry": { samples: 15, sold: 2 } },
        quotes: [
          ...counter.quotes,
          { id: "q2", text: "Second quote at checkout", savedAt: 2 },
        ],
      },
      storage,
    );

    syncLiveCounterToRecapDraft({
      code: CODE,
      token: TOKEN,
      template: TORCH_TEMPLATE,
      storage,
    });

    const updated = readDraft(CODE, TOKEN, "shift", storage)!;
    // Manual override ("14") respected; untouched SKU sample ("12" -> "15") updated; new quote appended!
    expect(updated.values["f-consumers"]).toBe("14");
    expect(updated.samples["prod-cherry"]).toBe("15");
    expect(updated.values["f-feedback"]).toBe(
      'Steady crowd at 4pm.\n"First quote"\n"Second quote at checkout"',
    );

    // Manually override SKU sample in draft ("15" -> "99") and verify MULTIPLE subsequent
    // counter syncs never mistake the manual override for an auto-synced baseline.
    writeDraft(
      CODE,
      TOKEN,
      {
        ...updated,
        samples: { ...updated.samples, "prod-cherry": "99" },
      },
      "shift",
      storage,
    );
    syncLiveCounterToRecapDraft({ code: CODE, token: TOKEN, template: TORCH_TEMPLATE, storage });
    writeLiveShiftCounter(
      CODE,
      TOKEN,
      {
        ...readLiveShiftCounter(CODE, TOKEN, storage),
        skus: { "prod-cherry": { samples: 20, sold: 2 } },
      },
      storage,
    );
    syncLiveCounterToRecapDraft({ code: CODE, token: TOKEN, template: TORCH_TEMPLATE, storage });
    const afterRepeatedSyncs = readDraft(CODE, TOKEN, "shift", storage)!;
    expect(afterRepeatedSyncs.samples["prod-cherry"]).toBe("99");
    expect(afterRepeatedSyncs.values["f-consumers"]).toBe("14");

    clearLiveShiftCounter(CODE, TOKEN, storage);
    expect(hasSavedLiveCounterActivity(CODE, TOKEN, storage)).toBe(false);
  });

  it("falls back to Products Sampled multiselect options when catalog products list is empty", () => {
    const skus = resolveActiveCounterSkus({
      ...TORCH_TEMPLATE,
      products: [],
    });
    expect(skus).toHaveLength(2);
    expect(skus[0]?.name).toBe("Black Cherry 5mg 12oz");
    expect(skus[0]?.category).toBe("Seltzer 5mg Lite");
  });
});

describe("LiveShiftCounterCard SSR markup", () => {
  it("renders SKU tappers, consumers sampled stepper, and quote scratchpad", () => {
    const storage = memStorage();
    writeLiveShiftCounter(
      CODE,
      TOKEN,
      {
        consumersSampled: 9,
        skus: { "prod-cherry": { samples: 7, sold: 2 } },
        quotes: [{ id: "q1", text: "Super refreshing!", savedAt: 1700000000000 }],
      },
      storage,
    );

    const html = renderToStaticMarkup(
      <LiveShiftCounterCard
        code={CODE}
        token={TOKEN}
        template={TORCH_TEMPLATE}
        accent="#c5f546"
        storage={storage}
      />,
    );

    expect(html).toContain("Tap counts &amp; quotes as you go");
    expect(html).toContain("7 sampled · 2 sold · 9 consumers · 1 quote");
    expect(html).toContain("Black Cherry 5mg 12oz");
    expect(html).toContain("Raspberry 10mg 12oz");
    expect(html).toContain("Total consumers sampled");
    expect(html).toContain("Consumer quote scratchpad");
    expect(html).toContain("Super refreshing!");
  });
});
