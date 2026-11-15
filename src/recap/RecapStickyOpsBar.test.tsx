import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RecapStickyOpsBar } from "./RecapStickyOpsBar";
import {
  orderInlineActions,
  orderMenuActions,
  type RecapStickyAction,
} from "./recapStickyActions";

const noop = () => {};

const actions: RecapStickyAction[] = [
  { key: "approve-next", label: "Approve & next →", onClick: noop, phoneOnly: true },
  { key: "share", label: "↗ Share", onClick: noop },
  { key: "edit", label: "✎ Edit recap", onClick: noop },
  { key: "archive", label: "Archive", onClick: noop },
  { key: "delete", label: "Delete", onClick: noop, tone: "danger" },
];

describe("RecapStickyOpsBar action order", () => {
  it("keeps Delete away from Approve on wide screens", () => {
    // Approve is rendered after the inline group, so Delete must lead it.
    expect(orderInlineActions(actions).map((a) => a.key)).toEqual([
      "delete",
      "share",
      "edit",
      "archive",
    ]);
  });

  it("puts Delete last in the More menu, far from the approve item", () => {
    expect(orderMenuActions(actions).map((a) => a.key)).toEqual([
      "approve-next",
      "share",
      "edit",
      "archive",
      "delete",
    ]);
  });
});

describe("RecapStickyOpsBar markup", () => {
  const html = renderToStaticMarkup(
    <RecapStickyOpsBar
      actions={actions}
      queueNav={{
        index: 1,
        total: 6,
        prevHref: null,
        nextHref: "/recap/view-custom/next",
        onNavigate: noop,
      }}
    >
      <button type="button">Approve recap</button>
    </RecapStickyOpsBar>,
  );

  it("keeps Prev, Next, the count and Approve in the bar", () => {
    expect(html).toContain('aria-label="Previous recap in queue"');
    expect(html).toContain('aria-label="Next recap in queue"');
    expect(html).toContain("1 of 6");
    expect(html).toContain("Approve recap");
    expect(html).toContain('aria-label="Recap actions"');
  });

  it("offers one More menu button, closed until pressed", () => {
    expect(html.match(/aria-haspopup="menu"/g)).toHaveLength(1);
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('role="menu"');
  });

  it("never renders the phone-only action inline", () => {
    expect(html).not.toContain("Approve &amp; next");
  });

  it("has no More button when there is nothing to put in it", () => {
    const bare = renderToStaticMarkup(
      <RecapStickyOpsBar>
        <button type="button">Approve recap</button>
      </RecapStickyOpsBar>,
    );
    expect(bare).not.toContain('aria-haspopup="menu"');
  });
});
