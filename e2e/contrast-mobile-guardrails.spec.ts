import { expect, test, type Page } from "@playwright/test";
import {
  TENANT_B,
  installMockGraphql,
  seedSparkSession,
  type MockPersona,
} from "./fixtures/mockGraphql";
import { auditPage, formatViolationsReport } from "./helpers/auditPage";

const MODES = ["light", "dark"] as const;
const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
] as const;

interface AuthenticatedRouteCase {
  path: string;
  readyText: string;
  /** Optional interaction before auditing (e.g. open drawer / expand row). */
  afterReady?: (page: Page) => Promise<void>;
}

const AUTHENTICATED_ROUTES: readonly AuthenticatedRouteCase[] = [
  {
    path: "/",
    readyText: "Where to go next",
    afterReady: async (page) => {
      // Verify the Rebook / Hold / Restock check buttons are rendered, then
      // also open the Rebook action drawer so its form controls & toggle pills
      // are audited for WCAG AA contrast and mobile fit.
      const rebookBtn = page
        .getByRole("button", { name: "Rebook", exact: true })
        .first();
      await expect(rebookBtn).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Hold", exact: true }).first(),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Restock check", exact: true }).first(),
      ).toBeVisible();
      await rebookBtn.click();
      await expect(
        page.getByRole("button", { name: /Confirm Rebook visit/i }),
      ).toBeVisible();
    },
  },
  {
    path: "/workspace",
    readyText: "Workspace & Agencies",
  },
  {
    path: "/imports",
    readyText: "Provider CSV Imports",
  },
  {
    path: "/demo-costs",
    readyText: "Actual Cost per Demo",
  },
  {
    path: "/finance-queue",
    readyText: "Finance Exception & Proof Review Queue",
    afterReady: async (page) => {
      const reviewBtn = page
        .getByRole("button", { name: "Review / Resolve" })
        .first();
      await expect(reviewBtn).toBeVisible();
      await reviewBtn.click();
      await expect(
        page.getByRole("button", { name: "Grant Exception" }),
      ).toBeVisible();
    },
  },
  {
    path: "/retailer-pos",
    readyText: "Retailer POS Sales, Lift & ROI",
  },
  {
    path: "/buyer-report",
    readyText: "Store Performance, Recommendations & Actions",
  },
];

/** Console noise that is expected under offline GraphQL/CDN stubbing. */
function isIgnorableConsoleError(text: string): boolean {
  return (
    /net::ERR_/i.test(text) ||
    /Failed to load resource/i.test(text) ||
    /cdn\.|googleapis\.com|gstatic\.com|maps\.google/i.test(text) ||
    /ResizeObserver loop/i.test(text) ||
    /Download the React DevTools/i.test(text)
  );
}

function attachCrashGuards(page: Page): {
  pageErrors: string[];
  consoleErrors: string[];
} {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on("pageerror", (err) => {
    pageErrors.push(err.message);
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      if (!isIgnorableConsoleError(text)) {
        consoleErrors.push(text);
      }
    }
  });
  return { pageErrors, consoleErrors };
}

async function openSparkRoute(
  page: Page,
  opts: {
    path: string;
    mode: "light" | "dark";
    width: number;
    height: number;
    authenticated: boolean;
    persona?: MockPersona;
    readyText: string;
  },
) {
  await page.setViewportSize({ width: opts.width, height: opts.height });
  await seedSparkSession(page, {
    appearance: opts.mode,
    authenticated: opts.authenticated,
    persona: opts.persona,
  });
  await installMockGraphql(page, { persona: opts.persona });

  await page.goto(opts.path, { waitUntil: "domcontentloaded" });
  await expect(page.getByText(opts.readyText).first()).toBeVisible({
    timeout: 20_000,
  });

  // Verify the expected light/dark attribute is actually applied on <html>
  if (opts.authenticated) {
    if (opts.mode === "light") {
      await expect(page.locator("html")).toHaveAttribute(
        "data-spark-mode",
        "light",
      );
    } else {
      await expect(page.locator("html")).not.toHaveAttribute(
        "data-spark-mode",
        "light",
      );
    }
  }

  // Wait for CSS custom properties + opacity to settle. Light mode briefly
  // paints with dark-ops lime / reduced opacity during shell mount, which
  // falsely fails AA on the Create Request / Jump chrome.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  if (opts.authenticated && opts.mode === "light") {
    await expect
      .poll(
        async () =>
          page.evaluate(() => {
            const root = document.documentElement;
            const lime = getComputedStyle(root)
              .getPropertyValue("--spark-lime")
              .trim()
              .toLowerCase();
            const create = document.querySelector<HTMLElement>(
              'button[aria-label="Create Request"]',
            );
            if (!create) return "missing-create";
            const cs = getComputedStyle(create);
            const opacity = Number.parseFloat(cs.opacity);
            return `${lime}|${opacity}|${cs.color}|${cs.backgroundColor}`;
          }),
        { timeout: 8_000 },
      )
      .toMatch(/#14160f\|1\|rgb\(255,\s*255,\s*255\)\|rgb\(20,\s*22,\s*15\)/);
  } else {
    await page.waitForTimeout(150);
  }
}

test.describe("Login page WCAG AA contrast & mobile viewport guardrails", () => {
  for (const viewport of VIEWPORTS) {
    test(`/login (${viewport.name} ${viewport.width}x${viewport.height})`, async ({
      page,
    }) => {
      const crashes = attachCrashGuards(page);

      await openSparkRoute(page, {
        path: "/login",
        mode: "light",
        width: viewport.width,
        height: viewport.height,
        authenticated: false,
        readyText: "Sign in",
      });

      const report = await auditPage(page, {
        route: "/login",
        mode: "light",
        viewport: viewport.name,
      });

      expect(crashes.pageErrors, "Uncaught pageerrors").toEqual([]);
      expect(crashes.consoleErrors, "Console errors").toEqual([]);
      expect(report.checkedElements).toBeGreaterThan(3);
      expect(
        report.horizontalOverflowPx,
        formatViolationsReport(report),
      ).toBeLessThanOrEqual(1);
      expect(
        report.contrastViolations,
        formatViolationsReport(report),
      ).toEqual([]);
    });
  }
});

test.describe("Authenticated routes WCAG AA contrast & mobile overflow guardrails", () => {
  for (const mode of MODES) {
    for (const viewport of VIEWPORTS) {
      for (const routeCase of AUTHENTICATED_ROUTES) {
        test(`${routeCase.path} [${mode} · ${viewport.name}]`, async ({
          page,
        }) => {
          const crashes = attachCrashGuards(page);

          await openSparkRoute(page, {
            path: routeCase.path,
            mode,
            width: viewport.width,
            height: viewport.height,
            authenticated: true,
            persona: "admin-multi",
            readyText: routeCase.readyText,
          });

          if (routeCase.afterReady) {
            await routeCase.afterReady(page);
          }

          const report = await auditPage(page, {
            route: routeCase.path,
            mode,
            viewport: viewport.name,
          });

          expect(crashes.pageErrors, "Uncaught pageerrors").toEqual([]);
          expect(crashes.consoleErrors, "Console errors").toEqual([]);
          // Mobile chrome collapses the sidebar drawer, so a short pilot
          // page can legitimately expose only a handful of labeled controls.
          const minChecked = viewport.name === "mobile" ? 3 : 5;
          expect(report.checkedElements).toBeGreaterThanOrEqual(minChecked);
          expect(
            report.horizontalOverflowPx,
            formatViolationsReport(report),
          ).toBeLessThanOrEqual(1);
          expect(
            report.contrastViolations,
            formatViolationsReport(report),
          ).toEqual([]);
        });
      }
    }
  }
});

test.describe("Workspace switcher states (multi-brand & single-brand) contrast guardrails", () => {
  for (const mode of MODES) {
    test(`multi-brand switcher filters [ARCHIVED] & switches cleanly [${mode}]`, async ({
      page,
    }) => {
      const crashes = attachCrashGuards(page);

      await openSparkRoute(page, {
        path: "/",
        mode,
        width: 1440,
        height: 900,
        authenticated: true,
        persona: "admin-multi",
        readyText: "Where to go next",
      });

      const switcher = page.getByTestId("workspace-switcher-trigger");
      await expect(switcher).toBeVisible();
      await switcher.click();

      const listbox = page.getByRole("listbox", { name: "Available workspaces" });
      await expect(listbox).toBeVisible();

      const optionTexts = await listbox.locator("[role='option']").allTextContents();
      const joined = optionTexts.join("\n");
      expect(joined).toContain("Spark Demo Beverage");
      expect(joined).toContain("Summit Cold Brew");
      expect(joined).not.toContain("[ARCHIVED]");

      await listbox.getByRole("option", { name: /Summit Cold Brew/i }).click();
      await expect
        .poll(() => page.evaluate(() => localStorage.getItem("@tenantUuid")))
        .toBe(TENANT_B.uuid);

      const report = await auditPage(page, {
        route: "/ (after workspace switch)",
        mode,
        viewport: "desktop",
      });

      expect(crashes.pageErrors).toEqual([]);
      expect(crashes.consoleErrors).toEqual([]);
      expect(
        report.contrastViolations,
        formatViolationsReport(report),
      ).toEqual([]);
    });

    test(`single-brand client renders non-interactive pill without dropdown [${mode}]`, async ({
      page,
    }) => {
      const crashes = attachCrashGuards(page);

      await openSparkRoute(page, {
        path: "/workspace",
        mode,
        width: 1440,
        height: 900,
        authenticated: true,
        persona: "client-single",
        readyText: "Workspace & Agencies",
      });

      const pill = page.getByTestId("workspace-single-pill");
      await expect(pill).toBeVisible();
      await expect(pill).toHaveText(/Spark Demo Beverage/);
      await expect(page.getByTestId("workspace-switcher-trigger")).toHaveCount(0);

      const report = await auditPage(page, {
        route: "/workspace (single-brand pill)",
        mode,
        viewport: "desktop",
      });

      expect(crashes.pageErrors).toEqual([]);
      expect(crashes.consoleErrors).toEqual([]);
      expect(
        report.contrastViolations,
        formatViolationsReport(report),
      ).toEqual([]);
    });
  }
});
