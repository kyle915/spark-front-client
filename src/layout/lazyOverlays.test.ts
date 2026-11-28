import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Root shell bundle discipline (lazy overlays)", () => {
  it("lazy-loads CommandPalette and StoreSheet in Layout.tsx instead of bundling them into App", () => {
    const layoutSrc = readFileSync(resolve(__dirname, "./Layout.tsx"), "utf8");
    expect(layoutSrc).not.toMatch(/^import\s+CommandPalette\s+from/m);
    expect(layoutSrc).not.toMatch(/^import\s+StoreSheet\s+from/m);
    expect(layoutSrc).toContain('lazy(() => import("./CommandPalette"))');
    expect(layoutSrc).toContain('lazy(() => import("@/components/store/StoreSheet"))');
    expect(layoutSrc).toContain("spark:open-jump");
    expect(layoutSrc).toContain("useStoreSheetStore");
  });

  it("lazy-loads BrandChatPanel and AskAiModal in AskSparkHost.tsx with hover/open preloading", () => {
    const hostSrc = readFileSync(
      resolve(__dirname, "../components/ai/AskSparkHost.tsx"),
      "utf8",
    );
    expect(hostSrc).not.toMatch(/^import\s+BrandChatPanel\s+from/m);
    expect(hostSrc).not.toMatch(/^import\s+\{\s*AskAiModal\s*\}\s+from/m);
    expect(hostSrc).toContain('import("./BrandChatPanel")');
    expect(hostSrc).toContain('import("./AskAiButton")');
    expect(hostSrc).toContain("onMouseEnter={warmPopup}");
    expect(hostSrc).toContain("onFocus={warmPopup}");
  });
});
