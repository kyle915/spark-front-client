import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LegalClickwrap, type LegalClickwrapProps } from "./LegalClickwrap";
import { CHECKBOX_LABEL, formatLegalVersion } from "./clickwrapCopy";

const DOCS = [
  { document: "privacy", title: "Privacy Policy", path: "/privacy-policy", version: "2026-11-17" },
  { document: "terms", title: "Terms of Service", path: "/terms-of-service", version: "2026-11-17" },
  { document: "aup", title: "Acceptable Use Policy", path: "/acceptable-use-policy", version: "2026-11-17" },
];

function view(over: Partial<LegalClickwrapProps> = {}) {
  return renderToStaticMarkup(
    <LegalClickwrap
      documents={DOCS}
      version="2026-11-17"
      isUpdate={false}
      changeSummary={null}
      agreed={false}
      submitting={false}
      error={null}
      onAgreeChange={() => {}}
      onContinue={() => {}}
      onSignOut={() => {}}
      {...over}
    />
  );
}

describe("LegalClickwrap", () => {
  it("starts unchecked with Continue disabled", () => {
    const html = view();
    expect(html).toMatch(/<input[^>]*type="checkbox"(?![^>]*checked)[^>]*>/);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Continue<\/button>/);
    expect(html).toContain(CHECKBOX_LABEL.replace("'", "&#x27;"));
  });

  it("enables Continue once the box is checked", () => {
    const html = view({ agreed: true });
    expect(html).not.toMatch(/<button[^>]*disabled=""[^>]*>Continue<\/button>/);
    expect(html).toMatch(/<input[^>]*checked=""/);
  });

  it("links each document in a new tab, Terms first", () => {
    const html = view();
    const links = [...html.matchAll(/<a href="([^"]+)" target="_blank" rel="noopener noreferrer">/g)].map((m) => m[1]);
    expect(links).toEqual(["/terms-of-service", "/acceptable-use-policy", "/privacy-policy"]);
    expect(html).toContain("opens in a new tab");
  });

  it("is a labelled modal dialog with a sign out option", () => {
    const html = view();
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain("Before you continue");
    expect(html).toContain(">Sign out</button>");
    // The checkbox label is tied to the checkbox.
    const id = /<input id="([^"]+)"/.exec(html)?.[1];
    expect(id).toBeTruthy();
    expect(html).toContain(`<label for="${id}">`);
  });

  it("says what changed on a re-prompt", () => {
    const html = view({ isUpdate: true, changeSummary: "We clarified AI features.", version: "2027-03-01" });
    expect(html).toContain("updated our terms");
    expect(html).toContain("What changed:");
    expect(html).toContain("We clarified AI features.");
    expect(html).toContain("March 1, 2027");
  });

  it("does not show What changed on first acceptance", () => {
    expect(view({ changeSummary: "ignored" })).not.toContain("What changed");
  });

  it("shows errors as an alert and a saving state", () => {
    const html = view({ agreed: true, submitting: true, error: "Try again." });
    expect(html).toContain('role="alert"');
    expect(html).toContain("Saving…");
  });

  it("formats versions as dates", () => {
    expect(formatLegalVersion("2026-11-17")).toBe("November 17, 2026");
    expect(formatLegalVersion("v2")).toBe("v2");
  });
});
