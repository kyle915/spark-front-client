import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));

function readQuerySource(fileName: string): string {
  return readFileSync(join(here, fileName), "utf8");
}

/** Extract the graphql`…` body so comments outside the op are ignored. */
function graphqlBody(src: string): string {
  const match = src.match(/graphql`([\s\S]*?)`/);
  expect(match, "expected a graphql tagged template").toBeTruthy();
  return match![1];
}

/**
 * Fat nested selections that made /recaps/list hang on large tenants.
 * Matched as whole GraphQL field lines (indent + name) so aggregate
 * scalars like customRecapFilesCount / recapFilesCount do not false-positive.
 */
const FORBIDDEN_FIELD_LINES = [
  /^\s+productSamples\s*$/m,
  /^\s+salesPerformance\s*$/m,
  /^\s+consumerEngagements\s*$/m,
  /^\s+recapFiles\s*\{/m,
  /^\s+customRecapFiles\s*\{/m,
  /^\s+customRecapProductSample\s*\{/m,
  /^\s+customRecapSalePerformance\s*\{/m,
  /^\s+customField\s*\{/m,
  /^\s+event\s*\{/m,
  /^\s+job\s*\{/m,
  /^\s+retailer\s*\{/m,
  /^\s+location\s*\{/m,
];

describe("Recaps list GraphQL stays slim", () => {
  it("RecapsListQuery omits per-row file/field/sample arrays", () => {
    const body = graphqlBody(readQuerySource("RecapsListQuery.ts"));
    expect(body).toContain("query RecapsListQuery");
    expect(body).toContain("heroFile");
    expect(body).toContain("recapFilesCount");
    expect(body).toContain("eventDate");
    for (const pattern of FORBIDDEN_FIELD_LINES) {
      expect(body, `must not match ${pattern}`).not.toMatch(pattern);
    }
  });

  it("CustomRecapsListQuery uses server aggregates instead of nested arrays", () => {
    const body = graphqlBody(readQuerySource("CustomRecapsListQuery.ts"));
    expect(body).toContain("query CustomRecapsListQuery");
    expect(body).toContain("soldUnits");
    expect(body).toContain("consumersSampled");
    expect(body).toContain("heroImageUrl");
    expect(body).toContain("customRecapFilesCount");
    expect(body).toContain("eventDate");
    for (const pattern of FORBIDDEN_FIELD_LINES) {
      expect(body, `must not match ${pattern}`).not.toMatch(pattern);
    }
  });

  it("detail queries still fetch full custom recap payloads", () => {
    const body = graphqlBody(readQuerySource("CustomRecapsQuery.ts"));
    // CustomRecapsQuery.ts has multiple operations; assert the detail one
    // is present in the file source (first graphql body is the list op).
    const src = readQuerySource("CustomRecapsQuery.ts");
    expect(src).toContain("query CustomRecapsQueryDetailsQuery");
    expect(src).toMatch(/^\s+customRecapFiles\s*\{/m);
    expect(src).toMatch(/^\s+customField\s*\{/m);
    expect(src).toMatch(/^\s+customRecapProductSample\s*\{/m);
    expect(body).toContain("query CustomRecapsQuery");
  });
});
