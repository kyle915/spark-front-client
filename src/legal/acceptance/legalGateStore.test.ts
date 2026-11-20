import { afterEach, describe, expect, it } from "vitest";
import {
  LEGAL_ACCEPTANCE_REQUIRED,
  legalGateVersion,
  noteLegalGate,
  useLegalGateStore,
} from "./legalGateStore";

const gated = (version?: unknown) => ({
  data: null,
  errors: [
    {
      message: "Please review and accept the Spark Terms of Service to continue.",
      extensions: { code: LEGAL_ACCEPTANCE_REQUIRED, ...(version === undefined ? {} : { version }) },
    },
  ],
});

afterEach(() => useLegalGateStore.getState().clear());

describe("legalGateVersion", () => {
  it("reads the required version from the server's gate error", () => {
    expect(legalGateVersion(gated("2026-11-17"))).toBe("2026-11-17");
    expect(legalGateVersion(gated())).toBeNull();
  });

  it("ignores ordinary responses and other errors", () => {
    expect(legalGateVersion({ data: { me: { id: "1" } } })).toBeUndefined();
    expect(legalGateVersion({ errors: [{ message: "Signature has expired" }] })).toBeUndefined();
    expect(legalGateVersion({ errors: [{ message: "x", extensions: { code: "RATE_LIMITED" } }] })).toBeUndefined();
    expect(legalGateVersion(null)).toBeUndefined();
  });
});

describe("noteLegalGate (any query can open the gate)", () => {
  it("flags the gate when any response carries the code", () => {
    noteLegalGate({ data: { ok: true } });
    expect(useLegalGateStore.getState().required).toBe(false);

    noteLegalGate(gated("2026-11-17"));
    expect(useLegalGateStore.getState()).toMatchObject({ required: true, version: "2026-11-17" });
  });

  it("re-flags with the newer version when the terms are bumped", () => {
    noteLegalGate(gated("2026-11-17"));
    noteLegalGate(gated("2027-03-01"));
    expect(useLegalGateStore.getState().version).toBe("2027-03-01");
  });
});
