import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProductQuestionsView } from "./ProductQuestionsBox";
import {
  AI_UNAVAILABLE,
  NO_NOTES_YET,
  TOO_MANY,
  askProductQuestion,
  productQaMode,
} from "./productQa";

const READY = { hasMaterial: true, hasNotes: true, aiAvailable: true };

function view(over: Partial<Parameters<typeof ProductQuestionsView>[0]> = {}) {
  return renderToStaticMarkup(
    <ProductQuestionsView
      brandName="Torch"
      state={READY}
      accent="#C4D82E"
      question=""
      busy={false}
      result={null}
      onQuestion={() => {}}
      onAsk={() => {}}
      {...over}
    />,
  );
}

function fakeFetch(status: number, body: unknown) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const impl = async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(body), { status });
  };
  return { impl, calls };
}

describe("productQaMode", () => {
  it("hides on older API builds and on recap-only links", () => {
    expect(productQaMode(undefined)).toBe("hidden");
    expect(productQaMode(READY, { recapOnly: true })).toBe("hidden");
  });
  it("says no notes before it says unavailable", () => {
    expect(productQaMode({ hasMaterial: false, hasNotes: false, aiAvailable: false })).toBe(
      "no_notes",
    );
    expect(productQaMode({ ...READY, aiAvailable: false })).toBe("unavailable");
    expect(productQaMode(READY)).toBe("ready");
  });
});

describe("ProductQuestionsView", () => {
  it("renders nothing when hidden", () => {
    expect(view({ state: undefined })).toBe("");
  });

  it("shows the no-notes line and no input", () => {
    const html = view({ state: { hasMaterial: false, hasNotes: false, aiAvailable: true } });
    expect(html).toContain("Product questions");
    expect(html).toContain("Your lead hasn&#x27;t added product notes yet.");
    expect(html).not.toContain("<input");
  });

  it("shows the unavailable line and no input", () => {
    const html = view({ state: { ...READY, aiAvailable: false } });
    expect(html).toContain("aren&#x27;t available right now");
    expect(html).not.toContain("<input");
  });

  it("is ready to ask, with Ask disabled until a question is typed", () => {
    const html = view();
    expect(html).toContain("<input");
    expect(html).toContain("Answers come only from Torch");
    expect(html).toMatch(/<button[^>]*disabled/);
    expect(view({ question: "What's in OG Luxe?" })).not.toMatch(/<button[^>]*disabled/);
  });

  it("shows a busy label while asking", () => {
    expect(view({ question: "What's in it?", busy: true })).toContain("Checking the notes…");
  });

  it("shows a grounded answer with its source line", () => {
    const html = view({
      result: { answer: "100mg of caffeine per can.", answered: true, source: "From Torch notes" },
    });
    expect(html).toContain("100mg of caffeine per can.");
    expect(html).toContain("From Torch notes");
  });

  it("shows a refusal without a source line", () => {
    const html = view({
      result: { answer: "I don't have that — check with your lead.", answered: false, source: "" },
    });
    expect(html).toContain("check with your lead");
    expect(html).not.toContain("From Torch notes");
  });

  it("never uses type under 12px", () => {
    const html = view({
      result: { answer: "Yes.", answered: true, source: "From Torch notes" },
    });
    const sizes = [...html.matchAll(/font-size:(\d+)px/g)].map((m) => Number(m[1]));
    expect(sizes.length).toBeGreaterThan(0);
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(12);
  });
});

describe("askProductQuestion", () => {
  const base = { origin: "https://api.test", code: "TO-AB12", session: "tok" };

  it("posts the session and question to the code's endpoint", async () => {
    const { impl, calls } = fakeFetch(200, {
      answer: "Lime.",
      answered: true,
      outcome: "answered",
      source: "From Torch notes",
    });
    const out = await askProductQuestion({ ...base, question: "Flavor?", fetchImpl: impl });
    expect(out).toEqual({ answer: "Lime.", answered: true, source: "From Torch notes" });
    expect(calls[0].url).toBe("https://api.test/api/public/checkin/TO-AB12/product-question");
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ session: "tok", question: "Flavor?" });
  });

  it("drops the source on a refusal", async () => {
    const { impl } = fakeFetch(200, { answer: "Nope.", answered: false, source: "From X notes" });
    const out = await askProductQuestion({ ...base, question: "Keto?", fetchImpl: impl });
    expect(out.source).toBe("");
    expect(out.answered).toBe(false);
  });

  it("maps a rate limit and a network failure to plain lines", async () => {
    const limited = fakeFetch(429, { error: "rate_limited", message: "Too many" });
    expect((await askProductQuestion({ ...base, question: "Hi?", fetchImpl: limited.impl })).answer).toBe(
      TOO_MANY,
    );
    const broken = async () => {
      throw new Error("offline");
    };
    expect((await askProductQuestion({ ...base, question: "Hi?", fetchImpl: broken })).answer).toBe(
      AI_UNAVAILABLE,
    );
  });

  it("keeps the no-notes copy in sync with the server", () => {
    expect(NO_NOTES_YET).toBe("Your lead hasn't added product notes yet.");
  });
});
