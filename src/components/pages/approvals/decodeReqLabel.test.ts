import { describe, expect, it } from "vitest";
import { decodeReqLabel } from "./decodeReqLabel";

describe("decodeReqLabel", () => {
  it("decodes Relay base64 global IDs without leaking padding", () => {
    expect(decodeReqLabel(btoa("Request:12"))).toBe("REQ-12");
    expect(decodeReqLabel(btoa("Request:1481"))).toBe("REQ-1481");
  });

  it("strips trailing = padding on non-Relay fallback IDs", () => {
    expect(decodeReqLabel("abcMTI=")).toBe("REQ-CMTI");
  });
});
