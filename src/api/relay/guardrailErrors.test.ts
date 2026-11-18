import { describe, expect, it } from "vitest";
import {
  GUARDRAIL_FALLBACK,
  GuardrailError,
  createGuardrailNotifier,
  findGuardrailError,
  graphQLErrorMessage,
  guardrailFromStatus,
  isGuardrailError,
} from "./guardrailErrors";

const rateLimited = {
  message: "Too many requests — slow down and try again in a minute.",
  extensions: { code: "RATE_LIMITED", retryAfter: 42 },
};

describe("findGuardrailError", () => {
  it("reads the code, the server's sentence and retryAfter", () => {
    expect(findGuardrailError([rateLimited])).toEqual({
      code: "RATE_LIMITED",
      message: rateLimited.message,
      retryAfter: 42,
    });
  });

  it("covers export, bulk, complexity and login codes", () => {
    for (const code of [
      "EXPORT_LIMIT",
      "BULK_LIMIT",
      "QUERY_TOO_COMPLEX",
      "LOGIN_THROTTLED",
    ] as const) {
      expect(findGuardrailError([{ message: "x", extensions: { code } }])?.code).toBe(code);
    }
  });

  it("falls back to a plain sentence when the server sent none", () => {
    expect(
      findGuardrailError([{ message: "", extensions: { code: "EXPORT_LIMIT" } }])?.message,
    ).toBe(GUARDRAIL_FALLBACK.EXPORT_LIMIT);
  });

  it("ignores ordinary errors", () => {
    expect(findGuardrailError([{ message: "Permission denied" }])).toBeNull();
    expect(findGuardrailError(undefined)).toBeNull();
    expect(
      findGuardrailError([{ message: "x", extensions: { code: "SOMETHING_ELSE" } }]),
    ).toBeNull();
  });
});

describe("GuardrailError", () => {
  it("carries the server message so onError shows it as-is", () => {
    const err = new GuardrailError(findGuardrailError([rateLimited])!);
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe(rateLimited.message);
    expect(isGuardrailError(err)).toBe(true);
    expect(isGuardrailError(new Error("x"))).toBe(false);
  });
});

describe("guardrailFromStatus", () => {
  it("treats a bare 429 as a rate limit", () => {
    expect(guardrailFromStatus(429, "30")).toMatchObject({
      code: "RATE_LIMITED",
      retryAfter: 30,
    });
    expect(guardrailFromStatus(200, null)).toBeNull();
  });
});

describe("graphQLErrorMessage", () => {
  it("prefers the guardrail sentence, else joins messages", () => {
    expect(
      graphQLErrorMessage([{ message: "a" }, rateLimited], "fallback"),
    ).toBe(rateLimited.message);
    expect(graphQLErrorMessage([{ message: "a" }, { message: "b" }], "f")).toBe("a; b");
    expect(graphQLErrorMessage([], "fallback")).toBe("fallback");
  });
});

describe("createGuardrailNotifier", () => {
  it("shows one toast per code per window, then again after it", () => {
    let t = 0;
    const n = createGuardrailNotifier(10_000, () => t);
    const hit = { code: "RATE_LIMITED" as const, message: rateLimited.message };
    expect(n.shouldShow(hit)).toBe(true);
    t = 2_000;
    expect(n.shouldShow(hit)).toBe(false);
    expect(n.shouldShow({ code: "EXPORT_LIMIT", message: "Export limit" })).toBe(true);
    t = 12_000;
    expect(n.shouldShow(hit)).toBe(true);
  });

  it("recognises a caller repeating the toast it just showed", () => {
    let t = 0;
    const n = createGuardrailNotifier(10_000, () => t);
    n.shouldShow({ code: "RATE_LIMITED", message: rateLimited.message });
    expect(n.isEcho(`Save failed: ${rateLimited.message}`)).toBe(true);
    expect(n.isEcho("Save failed: network down")).toBe(false);
    t = 11_000;
    expect(n.isEcho(`Save failed: ${rateLimited.message}`)).toBe(false);
  });
});
