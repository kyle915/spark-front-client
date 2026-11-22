import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ReceiptAdvisoryBanners, ReceiptSpendProposal } from "./ReceiptReadFeedback";
import { TallyPhotoCard, TallyProposal } from "./TallyPhotoCard";
import {
  RECEIPT_READ_TIMEOUT_MS,
  advisoryKindTitle,
  collectReceiptAdvisories,
  combineReceiptProposals,
  formatReceiptProposalDetail,
  parseReceiptRead,
  requestReceiptRead,
  shownReceiptProposal,
  unavailableReceiptRead,
} from "./receiptRead";

const base = {
  origin: "https://api.example.test",
  code: "BD-AQRACD",
  session: "tok-123",
  file: new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" }),
  contentType: "image/jpeg",
};

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("requestReceiptRead", () => {
  it("posts the receipt image, sha256, and shift store context to receipt-read", async () => {
    const fetchImpl = vi.fn(async () =>
      reply({
        available: true,
        proposedSpend: "42.80",
        receiptTotal: "46.29",
        brandProductSubtotal: "39.96",
        excludedNonBrandTotal: "3.49",
        excludedNonBrandCount: 1,
        merchant: "Sprouts Farmers Market",
        storeNumber: "412",
        receiptDate: "2026-10-16",
        dedupeKey: "sprouts|412|2026-10-16|46.29",
        advisories: [],
        message: "",
      }),
    );

    const result = await requestReceiptRead({
      ...base,
      sha256: "a".repeat(64),
      storeName: " Sprouts Farmers Market ",
      storeNumber: " 412 ",
      fetchImpl,
    });

    expect(result).toEqual({
      available: true,
      proposedSpend: "42.80",
      receiptTotal: "46.29",
      brandProductSubtotal: "39.96",
      excludedNonBrandTotal: "3.49",
      excludedNonBrandCount: 1,
      merchant: "Sprouts Farmers Market",
      storeNumber: "412",
      receiptDate: "2026-10-16",
      dedupeKey: "sprouts|412|2026-10-16|46.29",
      advisories: [],
      message: "",
    });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.example.test/api/public/checkin/BD-AQRACD/receipt-read");
    expect(JSON.parse(String(init.body))).toEqual({
      session: "tok-123",
      imageBase64: "AQID",
      contentType: "image/jpeg",
      sha256: "a".repeat(64),
      storeName: "Sprouts Farmers Market",
      storeNumber: "412",
    });
  });

  it("degrades cleanly on HTTP errors, offline network failures, and timeouts", async () => {
    for (const status of [400, 401, 404, 429, 500, 503]) {
      const fetchImpl = async () => reply({ error: "boom" }, status);
      expect(await requestReceiptRead({ ...base, fetchImpl })).toEqual(
        unavailableReceiptRead(),
      );
    }
    const offline = async () => {
      throw new TypeError("Failed to fetch");
    };
    expect(await requestReceiptRead({ ...base, fetchImpl: offline })).toEqual(
      unavailableReceiptRead(),
    );

    const stalled = (_input: string, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new DOMException("aborted", "AbortError")),
        );
      });
    const started = Date.now();
    expect(
      await requestReceiptRead({ ...base, fetchImpl: stalled, timeoutMs: 25 }),
    ).toEqual(unavailableReceiptRead());
    expect(Date.now() - started).toBeLessThan(1000);
    expect(RECEIPT_READ_TIMEOUT_MS).toBe(12_000);
  });

  it("skips network requests for non-images, empty blobs, or missing sessions", async () => {
    const fetchImpl = vi.fn(async () => reply({}));
    await requestReceiptRead({ ...base, contentType: "application/pdf", fetchImpl });
    await requestReceiptRead({ ...base, file: new Blob([]), fetchImpl });
    await requestReceiptRead({ ...base, session: "", fetchImpl });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("preserves SHA-256 duplicate advisories even when OCR credentials are unavailable", () => {
    const parsed = parseReceiptRead({
      available: false,
      proposedSpend: null,
      advisories: [
        {
          kind: "duplicate_receipt",
          message: "This receipt photo matches one already submitted on an earlier recap.",
        },
      ],
      message: "Could not read that receipt.",
    });
    expect(parsed.available).toBe(false);
    expect(parsed.proposedSpend).toBeNull();
    expect(parsed.advisories).toEqual([
      {
        kind: "duplicate_receipt",
        message: "This receipt photo matches one already submitted on an earlier recap.",
      },
    ]);
  });
});

describe("combineReceiptProposals & shownReceiptProposal", () => {
  const receiptA = parseReceiptRead({
    available: true,
    proposedSpend: "42.80",
    receiptTotal: "46.29",
    brandProductSubtotal: "39.96",
    excludedNonBrandTotal: "3.49",
    excludedNonBrandCount: 1,
    dedupeKey: "sprouts|412|2026-10-16|46.29",
    advisories: [],
  });
  const receiptB = parseReceiptRead({
    available: true,
    proposedSpend: "10.20",
    receiptTotal: "10.20",
    brandProductSubtotal: "10.20",
    excludedNonBrandTotal: null,
    excludedNonBrandCount: 0,
    dedupeKey: "sprouts|412|2026-10-16|10.20",
    advisories: [],
  });

  it("deduplicates two photos of the same receipt and sums distinct receipts", () => {
    const sameTwice = combineReceiptProposals([
      { photoId: "p1", result: receiptA },
      { photoId: "p2", result: receiptA },
    ]);
    expect(sameTwice).toEqual({
      proposedSpend: "42.80",
      excludedNonBrandTotal: "3.49",
      excludedNonBrandCount: 1,
      receiptCount: 1,
      detail: "(excludes $3.49 non-brand item)",
      signature: "sprouts|412|2026-10-16|46.29:42.80",
    });

    const twoReceipts = combineReceiptProposals([
      { photoId: "p1", result: receiptA },
      { photoId: "p2", result: receiptB },
    ]);
    expect(twoReceipts).toEqual({
      proposedSpend: "53.00",
      excludedNonBrandTotal: "3.49",
      excludedNonBrandCount: 1,
      receiptCount: 2,
      detail: "(across 2 receipts · excludes $3.49 non-brand item)",
      signature:
        "sprouts|412|2026-10-16|46.29:42.80|sprouts|412|2026-10-16|10.20:10.20",
    });
  });

  it("excludes duplicate_receipt results from the spend proposal while keeping their advisory", () => {
    const duplicateReceipt = parseReceiptRead({
      available: true,
      proposedSpend: "42.80",
      receiptTotal: "46.29",
      dedupeKey: "dup-key-1",
      advisories: [
        {
          kind: "duplicate_receipt",
          message: "This receipt was already submitted on an earlier recap.",
        },
      ],
    });
    expect(combineReceiptProposals([{ photoId: "p1", result: duplicateReceipt }])).toBeNull();
    expect(
      combineReceiptProposals([
        { photoId: "p1", result: duplicateReceipt },
        { photoId: "p2", result: receiptB },
      ]),
    ).toEqual({
      proposedSpend: "10.20",
      excludedNonBrandTotal: null,
      excludedNonBrandCount: 0,
      receiptCount: 1,
      detail: null,
      signature: "sprouts|412|2026-10-16|10.20:10.20",
    });
    expect(collectReceiptAdvisories([duplicateReceipt, receiptB], new Set())).toHaveLength(1);
  });

  it("hides the proposal once SpendAmountInput matches or the signature is dismissed", () => {
    const proposal = combineReceiptProposals([{ photoId: "p1", result: receiptA }]);
    expect(
      shownReceiptProposal({
        proposal,
        currentValue: "",
        dismissedSignature: null,
      })?.proposedSpend,
    ).toBe("42.80");

    // Matching dollar amount ("42.80" or "42.8") hides the chip automatically.
    expect(
      shownReceiptProposal({
        proposal,
        currentValue: "42.8",
        dismissedSignature: null,
      }),
    ).toBeNull();

    // Dismissing hides that signature, but adding a second receipt surfaces the new total.
    expect(
      shownReceiptProposal({
        proposal,
        currentValue: "",
        dismissedSignature: proposal!.signature,
      }),
    ).toBeNull();
    const updated = combineReceiptProposals([
      { photoId: "p1", result: receiptA },
      { photoId: "p2", result: receiptB },
    ]);
    expect(
      shownReceiptProposal({
        proposal: updated,
        currentValue: "",
        dismissedSignature: proposal!.signature,
      })?.proposedSpend,
    ).toBe("53.00");
  });

  it("pluralizes excluded non-brand item detail cleanly", () => {
    expect(
      formatReceiptProposalDetail({
        receiptCount: 1,
        excludedNonBrandTotal: null,
        excludedNonBrandCount: 0,
      }),
    ).toBeNull();
    expect(
      formatReceiptProposalDetail({
        receiptCount: 1,
        excludedNonBrandTotal: "7.98",
        excludedNonBrandCount: 2,
      }),
    ).toBe("(excludes $7.98 non-brand items)");
  });
});

describe("ReceiptSpendProposal & ReceiptAdvisoryBanners", () => {
  it("renders TallyProposal-styled receipt spend chip with Use and Ignore controls", () => {
    const proposal = combineReceiptProposals([
      {
        photoId: "p1",
        result: parseReceiptRead({
          available: true,
          proposedSpend: "42.80",
          receiptTotal: "46.29",
          excludedNonBrandTotal: "3.49",
          excludedNonBrandCount: 1,
          dedupeKey: "k1",
          advisories: [],
        }),
      },
    ])!;
    const html = renderToStaticMarkup(
      <ReceiptSpendProposal proposal={proposal} onUse={() => {}} onDismiss={() => {}} />,
    );
    expect(html).toContain("Read from your receipt");
    expect(html).toContain("$42.80");
    expect(html).toContain("(excludes $3.49 non-brand item)");
    expect(html).toContain("Use");
    expect(html).toContain("Ignore");
    const sizes = [...html.matchAll(/font-size:(\d+)px/g)].map((m) => Number(m[1]));
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(12);
  });

  it("preserves default TallyProposal copy for tally sheet numbers", () => {
    const html = renderToStaticMarkup(
      <TallyProposal value="48" onUse={() => {}} onDismiss={() => {}} />,
    );
    expect(html).toContain("Read from your photo");
    expect(html).toContain("48");
  });

  it("renders store, date, and duplicate advisories with non-blocking dismiss", () => {
    const r1 = parseReceiptRead({
      available: true,
      proposedSpend: "24.89",
      advisories: [
        {
          kind: "store_mismatch",
          message: "This receipt says Target — make sure it matches Sprouts Farmers Market.",
        },
        {
          kind: "date_mismatch",
          message: "This receipt is dated Oct 12 — make sure it is from your Oct 16 shift.",
        },
      ],
    });
    const r2 = parseReceiptRead({
      available: false,
      advisories: [
        {
          kind: "duplicate_receipt",
          message: "This receipt was already submitted on an earlier recap.",
        },
      ],
    });
    const advisories = collectReceiptAdvisories([r1, r2], new Set());
    expect(advisories.map((a) => a.kind)).toEqual([
      "store_mismatch",
      "date_mismatch",
      "duplicate_receipt",
    ]);
    expect(advisoryKindTitle("store_mismatch")).toBe("Check receipt store");
    expect(advisoryKindTitle("date_mismatch")).toBe("Check receipt date");
    expect(advisoryKindTitle("duplicate_receipt")).toBe("Already submitted receipt");

    const html = renderToStaticMarkup(
      <ReceiptAdvisoryBanners
        readingCount={1}
        advisories={advisories}
        onDismiss={() => {}}
      />,
    );
    expect(html).toContain("Reading receipt total…");
    expect(html).toContain("Check receipt store");
    expect(html).toContain("Check receipt date");
    expect(html).toContain("Already submitted receipt");
    expect(html).toContain("Got it");
    const sizes = [...html.matchAll(/font-size:(\d+)px/g)].map((m) => Number(m[1]));
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(12);

    // Dismissing one advisory hides only that banner.
    const remaining = collectReceiptAdvisories([r1, r2], new Set([advisories[0].key]));
    expect(remaining.map((a) => a.kind)).toEqual(["date_mismatch", "duplicate_receipt"]);
  });
});

describe("TallyPhotoCard Camera Roll + Camera inputs", () => {
  it("renders separate library (no capture) and camera (capture=environment) inputs", () => {
    const html = renderToStaticMarkup(
      <TallyPhotoCard
        origin="https://api.example.test"
        code="BD-AQRACD"
        session="tok-123"
        accent="#c5f546"
        includeProducts={true}
        pendingCount={0}
        onProposals={() => {}}
        onUseAll={() => {}}
      />,
    );
    expect(html).toContain("Choose from library");
    expect(html).toContain("Take photo");

    const inputs = [...html.matchAll(/<input\b[^>]*>/g)].map((m) => m[0]);
    expect(inputs).toHaveLength(2);
    const libraryInput = inputs.find((tag) => !tag.includes("capture="));
    const cameraInput = inputs.find((tag) => tag.includes('capture="environment"'));
    expect(libraryInput).toBeDefined();
    expect(cameraInput).toBeDefined();
    expect(libraryInput).toContain('accept="image/*"');
    expect(cameraInput).toContain('accept="image/*"');
  });
});
