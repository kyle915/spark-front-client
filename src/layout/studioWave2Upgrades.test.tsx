import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  ASK_SPARK_EVENT,
  dispatchOpenAskSpark,
  type OpenAskSparkDetail,
} from "@/lib/askSparkEvent";
import { briefFooter } from "@/lib/programBrief";
import { writtenLine } from "@/lib/weeklySummary";
import {
  buildPublicRecapShareUrl,
  resolveRecapQuickPeekKey,
} from "@/recap/recapQuickPeek";
import { RecapDocument } from "@/recap/RecapDocument";
import { RecapKpiStrip } from "@/recap/RecapDetailShell";

const here = dirname(fileURLToPath(import.meta.url));
const readRel = (rel: string) => readFileSync(join(here, rel), "utf8");

describe("Studio Wave 2 UI/UX upgrades", () => {
  it("dispatches Ask Spark global drawer event with question payload", () => {
    const prevWindow = (globalThis as { window?: unknown }).window;
    const target = new EventTarget();
    (globalThis as { window?: unknown }).window = target;
    const listener = vi.fn();
    try {
      target.addEventListener(ASK_SPARK_EVENT, listener);
      dispatchOpenAskSpark({ question: "Top converting stores in Texas" });
      target.removeEventListener(ASK_SPARK_EVENT, listener);

      expect(listener).toHaveBeenCalledTimes(1);
      const ev = listener.mock.calls[0]?.[0] as CustomEvent<OpenAskSparkDetail>;
      expect(ev.detail.question).toBe("Top converting stores in Texas");
    } finally {
      if (prevWindow === undefined) {
        delete (globalThis as { window?: unknown }).window;
      } else {
        (globalThis as { window?: unknown }).window = prevWindow;
      }
    }
  });

  it("removes 'Written by AI' attribution from brief and weekly summary helpers", () => {
    expect(
      briefFooter({
        status: "reviewed",
        isDraft: false,
        stale: false,
        autoReviewed: true,
      }),
    ).toBe(
      "Compiled from approved recaps. Every number was checked against this report.",
    );
    expect(
      writtenLine({
        generatedAt: "2026-11-16T15:00:00+00:00",
        editedBody: "",
      }),
    ).toBe("Compiled from approved recaps on Nov 16.");
  });

  it("maps RecapQuickPeek keyboard triage keys and ignores typing inputs", () => {
    expect(
      resolveRecapQuickPeekKey({
        key: "j",
        canApprove: true,
        canShare: true,
      }),
    ).toBe("next");
    expect(
      resolveRecapQuickPeekKey({
        key: "k",
        canApprove: true,
        canShare: true,
      }),
    ).toBe("prev");
    expect(
      resolveRecapQuickPeekKey({
        key: "a",
        canApprove: true,
        canShare: false,
      }),
    ).toBe("approve");
    expect(
      resolveRecapQuickPeekKey({
        key: "a",
        canApprove: false,
        canShare: true,
      }),
    ).toBeNull();
    expect(
      resolveRecapQuickPeekKey({
        key: "s",
        canApprove: false,
        canShare: true,
      }),
    ).toBe("share");
    expect(
      resolveRecapQuickPeekKey({
        key: "j",
        isTypingTarget: true,
        canApprove: true,
        canShare: true,
      }),
    ).toBeNull();

    expect(
      buildPublicRecapShareUrl("https://client.igniteproductions.co/", "tok_99"),
    ).toBe("https://client.igniteproductions.co/r/tok_99");
    expect(
      buildPublicRecapShareUrl("https://client.igniteproductions.co", "  "),
    ).toBeNull();
  });

  it("renders editorial co-branded RecapDocument header and icon-free KPI strip", () => {
    const html = renderToStaticMarkup(
      <RecapDocument status="APPROVED" brandName="Feel Free">
        <RecapKpiStrip
          items={[
            { label: "Engagements", value: "248", icon: <span>★</span>, glow: true },
            { label: "Sold", value: "84" },
            { label: "Conv", value: "33.9%" },
          ]}
        />
      </RecapDocument>,
    );

    expect(html).toContain("Feel Free");
    expect(html).toContain("Approved");
    expect(html).toContain("248");
    expect(html).not.toContain("recap-kpi-icon");
    expect(html).toContain("recap-doc-badge-dot");
  });

  it("wires Jump smart handoffs, studio drawer inset CSS, and Create Request live summary rail", () => {
    const palette = readRel("./CommandPalette.tsx");
    expect(palette).not.toContain("padIndex(");
    expect(palette).toContain("dispatchOpenAskSpark");
    expect(palette).toContain("/requests/create?mode=wave&prompt=");

    const css = readRel("../index.css");
    expect(css).toContain("height: calc(100dvh - 12px);");
    expect(css).toContain(".recap-doc-badge-dot");

    const createReq = readRel("../requests/SparkRequestCreate.tsx");
    expect(createReq).toContain("Live activation summary");
    expect(createReq).toContain("Plain-English wave");
  });
});
