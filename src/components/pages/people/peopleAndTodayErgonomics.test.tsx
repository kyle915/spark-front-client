import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  DefaultRmmSelector,
  PeopleTabsSwitcher,
  filterRmmCandidates,
  parseRecapRecipientsList,
  resolvePeopleTab,
  type PersonRow,
} from "./peopleRoutingControls";

const SAMPLE_ROWS: PersonRow[] = [
  {
    id: "user-1",
    uuid: "uuid-1",
    name: "Maya Rivera",
    email: "maya@igniteproductions.co",
    role: "Spark Admin",
    roleSlug: "spark-admin",
    initials: "MR",
  },
  {
    id: "user-2",
    uuid: "uuid-2",
    name: "Ross Hudgens",
    email: "ross@liquid-death.com",
    role: "Client",
    roleSlug: "client",
    initials: "RH",
  },
];

describe("People & Today ergonomics", () => {
  it("verifies SparkToday.tsx does not contain 'mobile app'", () => {
    const todaySource = readFileSync(
      resolve(__dirname, "../today/SparkToday.tsx"),
      "utf8",
    );
    expect(todaySource.toLowerCase()).not.toContain("mobile app");
    expect(todaySource).not.toContain("BA · — · —");
  });

  it("renders People and Notifications & Routing tabs in SparkPeople", () => {
    const peopleSource = readFileSync(
      resolve(__dirname, "./SparkPeople.tsx"),
      "utf8",
    );
    expect(peopleSource).toContain("PeopleTabsSwitcher");
    expect(peopleSource).toContain("DefaultRmmSelector");
    expect(peopleSource).toContain("Load more");
    expect(peopleSource).toContain("peopleHasMore");
    expect(peopleSource).toContain("after: endCursor");

    const html = renderToStaticMarkup(
      <PeopleTabsSwitcher
        activeTab="people"
        onChangeTab={() => {}}
        peopleCount={42}
        summaryText="Default RMM: Maya Rivera · 2 recipients · 1 digest active"
      />,
    );
    expect(html).toContain("People");
    expect(html).toContain("Notifications &amp; Routing");
    expect(html).toContain("42");
    expect(html).toContain(
      "Default RMM: Maya Rivera · 2 recipients · 1 digest active",
    );
  });

  it("resolves URL query params ?tab=routing and ?tab=notifications to the routing tab", () => {
    expect(resolvePeopleTab("")).toBe("people");
    expect(resolvePeopleTab("?tab=people")).toBe("people");
    expect(resolvePeopleTab("?tab=routing")).toBe("routing");
    expect(resolvePeopleTab("?tab=notifications")).toBe("routing");
    expect(resolvePeopleTab(new URLSearchParams("tab=routing"))).toBe(
      "routing",
    );
    expect(resolvePeopleTab(new URLSearchParams("tab=notifications"))).toBe(
      "routing",
    );
  });

  it("renders searchable Default RMM selector and shows Clear default RMM when one is set", () => {
    const htmlWithSelection = renderToStaticMarkup(
      <DefaultRmmSelector
        rows={SAMPLE_ROWS}
        selectedId="user-1"
        onSelect={() => {}}
      />,
    );
    expect(htmlWithSelection).toContain("Search RMM by name or email");
    expect(htmlWithSelection).toContain("Clear default RMM");
    expect(htmlWithSelection).toContain("Maya Rivera");

    const htmlWithoutSelection = renderToStaticMarkup(
      <DefaultRmmSelector
        rows={SAMPLE_ROWS}
        selectedId=""
        onSelect={() => {}}
      />,
    );
    expect(htmlWithoutSelection).not.toContain("Clear default RMM");
    expect(htmlWithoutSelection).toContain("— None (territory routing) —");
  });

  it("filters RMM candidates by name or email and parses recap recipients", () => {
    expect(filterRmmCandidates(SAMPLE_ROWS, "maya")).toHaveLength(1);
    expect(filterRmmCandidates(SAMPLE_ROWS, "liquid-death")).toHaveLength(1);
    expect(filterRmmCandidates(SAMPLE_ROWS, "nonexistent")).toHaveLength(0);
    expect(
      parseRecapRecipientsList("ross@liquid-death.com, ops@liquid-death.com\n"),
    ).toEqual(["ross@liquid-death.com", "ops@liquid-death.com"]);
  });
});
