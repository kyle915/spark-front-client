import { describe, expect, it, vi } from "vitest";

vi.mock("react-relay", () => ({
  fetchQuery: vi.fn(),
  useLazyLoadQuery: vi.fn(),
  useRelayEnvironment: vi.fn(),
}));
vi.mock("@/api/queries/EventsQuery", () => ({ EventsQuery: {} }));

import { mergeEventPages, nodesOf, type EventNode } from "./useAllEventPages";

const ev = (uuid: string) => ({ id: `id-${uuid}`, uuid }) as unknown as EventNode;

describe("event pages", () => {
  it("keeps every page, not just the first 100", () => {
    const page = (from: number) =>
      Array.from({ length: 100 }, (_, i) => ev(String(from + i)));
    const all = mergeEventPages([page(0), page(100), page(200).slice(0, 37)]);
    expect(all).toHaveLength(237);
  });

  it("lists an event once when pages overlap", () => {
    expect(mergeEventPages([[ev("a"), ev("b")], [ev("b"), ev("c")]]).map((n) => n.uuid)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("reads nodes off a connection and skips empty edges", () => {
    const connection = {
      edges: [{ node: ev("a") }, null, { node: null }, { node: ev("b") }],
    } as unknown as Parameters<typeof nodesOf>[0];
    expect(nodesOf(connection).map((n) => n.uuid)).toEqual(["a", "b"]);
    expect(nodesOf(null)).toEqual([]);
  });
});
