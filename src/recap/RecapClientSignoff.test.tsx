import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RecapClientSignoff } from "./RecapClientSignoff";

const noop = () => {};

describe("RecapClientSignoff", () => {
  it("offers Looks good / Need more photos on an approved recap", () => {
    const html = renderToStaticMarkup(
      <RecapClientSignoff approved onSubmit={noop} />,
    );
    expect(html).toContain("Looks good");
    expect(html).toContain("Need more photos");
    expect(html).not.toContain("AWAITING IGNITE APPROVAL");
  });

  it("never offers sign-off on an unapproved recap — shows the real approve", () => {
    const html = renderToStaticMarkup(
      <RecapClientSignoff
        approved={false}
        existingStatus="looks_good"
        onSubmit={noop}
        onApprove={noop}
      />,
    );
    expect(html).toContain("AWAITING IGNITE APPROVAL");
    expect(html).toContain("Approve recap");
    expect(html).not.toContain("Looks good");
    expect(html).not.toContain("Need more photos");
  });

  it("omits the approve button when no handler is wired", () => {
    const html = renderToStaticMarkup(
      <RecapClientSignoff approved={false} onSubmit={noop} />,
    );
    expect(html).toContain("AWAITING IGNITE APPROVAL");
    expect(html).not.toContain("Approve recap");
  });
});
