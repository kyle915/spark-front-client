import { describe, expect, it } from "vitest";
import { escapeHtml, formatNoteBodyHtml } from "./formatNoteBodyHtml";

describe("escapeHtml", () => {
  it("escapes &, <, >, \", and '", () => {
    expect(escapeHtml(`<a href="x" onclick='y'>&`)).toBe(
      "&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;",
    );
  });
});

describe("formatNoteBodyHtml", () => {
  it("escapes <img onerror> and <script> so they cannot execute", () => {
    const html = formatNoteBodyHtml(
      `<img onerror="alert(1)" src=x><script>alert(1)</script>`,
    );

    expect(html).not.toMatch(/<img\b/i);
    expect(html).not.toMatch(/<script\b/i);
    expect(html).not.toMatch(/onerror="/i);
    expect(html).toContain("&lt;img onerror=&quot;alert(1)&quot; src=x&gt;");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("still wraps @mentions in lime after escaping neighboring markup", () => {
    const html = formatNoteBodyHtml(
      `Hey @kyle.christiansen see <img onerror="alert(1)" src=x> @ops`,
    );

    expect(html).toContain(
      '<span style="color: var(--spark-lime); font-weight: 600;">@kyle.christiansen</span>',
    );
    expect(html).toContain(
      '<span style="color: var(--spark-lime); font-weight: 600;">@ops</span>',
    );
    expect(html).not.toMatch(/<img\b/i);
    expect(html).toContain("&lt;img onerror=&quot;alert(1)&quot; src=x&gt;");
  });
});
