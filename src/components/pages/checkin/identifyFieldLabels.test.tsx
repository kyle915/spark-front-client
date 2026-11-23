import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { label } from "./checkinStyles";
import IdentifyStep from "./IdentifyStep";
import TimesheetIdentify from "./TimesheetIdentify";

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** WCAG contrast ratio of a #rrggbb ink on a background (default white). */
function contrast(hex: string, bg = "#ffffff"): number {
  const lum = (h: string) => {
    const n = Number.parseInt(h.slice(1), 16);
    return (
      0.2126 * channel((n >> 16) & 255) +
      0.7152 * channel((n >> 8) & 255) +
      0.0722 * channel(n & 255)
    );
  };
  const lighter = Math.max(lum(hex), lum(bg));
  const darker = Math.min(lum(hex), lum(bg));
  return (lighter + 0.05) / (darker + 0.05);
}

function assertNamedControls(html: string): void {
  const controls = [...html.matchAll(/<(input|textarea|select)\b([^>]*)>/g)];
  expect(controls.length).toBeGreaterThan(0);
  for (const match of controls) {
    const id = /id="([^"]+)"/.exec(match[2])?.[1];
    expect(id, match[0]).toBeTruthy();
    const labelTag = new RegExp(`<label\\b[^>]*\\bfor="${id}"[^>]*>[\\s\\S]*?</label>`).exec(html);
    expect(labelTag, `missing visible label for #${id}`).toBeTruthy();
    const text = labelTag![0].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    expect(text.length, id).toBeGreaterThan(0);
    expect(labelTag![0]).not.toMatch(/left:\s*-9999/);
    expect(labelTag![0].toLowerCase()).not.toMatch(/#c5f546|#c4d82e/);
  }
}

const base = {
  code: "EV-BSC984",
  accent: "#1c1917",
  storeKey: "test-key",
  onDone: () => {},
};

describe("walk-up identify field names", () => {
  it("names every box on the store check-in (EV.Energy shape)", () => {
    const html = renderToStaticMarkup(
      <IdentifyStep {...base} needsEventDetails />,
    );
    assertNamedControls(html);
    expect(html).toContain(">First name</label>");
    expect(html).toContain(">Last name</label>");
    expect(html).toContain(">Mobile phone (10 digits)</label>");
    expect(html).toContain(">Email (optional)</label>");
    expect(html).toContain(">Store name or address</label>");
    expect(html).toContain(">Store name (optional)</label>");
    expect(html).toContain(">Date you&#x27;re working</label>");
    expect(html).toContain('for="checkin-first-name"');
    expect(html).toContain('id="checkin-first-name"');
  });

  it("names the typed store and optional phone on a recap-only link", () => {
    const html = renderToStaticMarkup(
      <IdentifyStep {...base} needsEventDetails recapOnly />,
    );
    assertNamedControls(html);
    expect(html).toContain(">Mobile phone (optional)</label>");
    expect(html).toContain(">Store name</label>");
    expect(html).toContain(">Store address</label>");
    expect(html).toContain(">Date of this recap</label>");
  });

  it("names the market picker on a roaming link", () => {
    const html = renderToStaticMarkup(
      <IdentifyStep
        {...base}
        needsEventDetails
        locationMode="market"
        markets={["Austin", "Dallas"]}
      />,
    );
    assertNamedControls(html);
    expect(html).toContain('for="checkin-market"');
    expect(html).toContain(">Market</label>");
    expect(html).not.toContain(">Store name or address</label>");
  });

  it("names the program dropdown when the link has more than one program", () => {
    const html = renderToStaticMarkup(
      <IdentifyStep
        {...base}
        needsEventDetails
        eventTypes={[
          { id: "a", name: "Costco Roadshow" },
          { id: "b", name: "Other shift" },
        ]}
      />,
    );
    assertNamedControls(html);
    expect(html).toContain('for="checkin-program"');
    expect(html).toContain(">Event type</label>");
  });

  it("names the same boxes on a time-sheet link", () => {
    const html = renderToStaticMarkup(<TimesheetIdentify {...base} />);
    assertNamedControls(html);
    expect(html).toContain(">First name</label>");
    expect(html).toContain(">Last name</label>");
    expect(html).toContain(">Mobile phone</label>");
    expect(html).toContain(">Location</label>");
  });

  it("keeps field names dark on white, never lime", () => {
    expect(label.color).toBe("#1c1917");
    expect(contrast("#1c1917")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#44403c")).toBeGreaterThanOrEqual(4.5);
    const css = readFileSync(new URL("../../../index.css", import.meta.url), "utf8");
    const block = css.match(
      /\.spark-checkin input::placeholder,\s*\.spark-checkin textarea::placeholder\s*\{[^}]+\}/,
    );
    expect(block?.[0]).toContain("color: #44403c");
    expect(block?.[0].toLowerCase()).not.toMatch(/#c5f546|#c4d82e|lime/);
  });
});
