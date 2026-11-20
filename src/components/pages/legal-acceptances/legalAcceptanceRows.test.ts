import { describe, expect, it } from "vitest";
import { acceptanceRowsToCsv, sortAcceptanceRows, type AcceptanceRow } from "./legalAcceptanceRows";

const row = (over: Partial<AcceptanceRow>): AcceptanceRow => ({
  userUuid: "u", email: "a@x.test", name: "", role: "client", status: "accepted",
  acceptedVersion: "2026-11-17", acceptedAt: "2026-11-18T10:00:00Z", ipAddress: "203.0.113.9",
  userAgent: "Mozilla", ...over,
});

describe("legal acceptance rows", () => {
  it("puts people who haven't accepted first", () => {
    const sorted = sortAcceptanceRows([
      row({ email: "b@x.test" }),
      row({ email: "c@x.test", status: "outdated" }),
      row({ email: "d@x.test", status: "never", acceptedAt: null, acceptedVersion: null }),
      row({ email: "a@x.test" }),
    ]);
    expect(sorted.map((r) => r.email)).toEqual(["d@x.test", "c@x.test", "a@x.test", "b@x.test"]);
  });

  it("exports a CSV with readable labels and quoting", () => {
    const csv = acceptanceRowsToCsv([row({ name: "Smith, Jo", role: "spark-admin" })]);
    const [head, line] = csv.trim().split("\n");
    expect(head).toBe("Email,Name,Role,Status,Accepted version,Accepted at (UTC),IP address,User agent");
    expect(line).toBe('a@x.test,"Smith, Jo",Admin,Accepted,2026-11-17,2026-11-18T10:00:00Z,203.0.113.9,Mozilla');
  });
});
