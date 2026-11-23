import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SignaturePad } from "./SignaturePad";

describe("SignaturePad", () => {
  it("asks for a drawn signature in dark text on a white pad", () => {
    const html = renderToStaticMarkup(
      <SignaturePad value="" onChange={() => {}} />,
    );
    expect(html).toContain("Sign with a finger or a mouse.");
    expect(html).toContain("aria-label=\"Signature. Draw with a finger or a mouse.\"");
    expect(html).toContain("Clear");
    expect(html).toContain("#1c1917");
    expect(html).toContain("#ffffff");
    expect(html).not.toContain("#c5f546");
  });

  it("shows a saved signature instead of an empty pad", () => {
    const src = "data:image/png;base64,abc";
    const html = renderToStaticMarkup(
      <SignaturePad value={src} onChange={() => {}} />,
    );
    expect(html).toContain(`src="${src}"`);
    expect(html).toContain("Store clerk signature");
    expect(html).toContain("Sign again");
  });
});
