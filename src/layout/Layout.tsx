import React, { useEffect, type ReactNode } from "react";
import { useLocation } from "react-router";
import { PageTransition } from "./PageTransition";
import SparkSidebar from "./SparkSidebar";
import SparkTopbar from "./SparkTopbar";
import SparkMobileDock from "./SparkMobileDock";
import CommandPalette from "./CommandPalette";
import StoreSheet from "@/components/store/StoreSheet";
import AskSparkHost from "@/components/ai/AskSparkHost";
import UpdateBanner from "@/components/UpdateBanner";
import ErrorBoundary from "@/components/ErrorBoundary";
import { useInLayoutShell } from "./LayoutShellContext";
import { MobileNavProvider, useMobileNav } from "./MobileNavContext";
import { useAuthStore } from "@/store/authStore";
import { applyAppearance, holdAppearance, readAppearance } from "@/theme/appearance";

/**
 * Spark v2 layout shell. SparkSidebar + SparkTopbar render the wireframe
 * chrome. The legacy sidebar/topbar code is preserved in git history.
 *
 * Note: useTenantTheme is intentionally NOT called here. It was overriding
 * the spark-v2 theme tokens (e.g. lime primary) with per-tenant brand colors
 * (Liquid Death's blue). The admin shell should always be Spark v2 lime —
 * tenant-brand theming is for client-facing content panels, not the chrome.
 *
 * When AuthenticatedShell already mounts chrome (LayoutShellContext=true),
 * page-level `<Layout>` is a passthrough so nav does not remount sidebar /
 * topbar or restart chat polling.
 */

interface LayoutProps {
  children?: ReactNode;
}

function LayoutChromeInner({ children }: LayoutProps) {
  const location = useLocation();
  const tenantId = useAuthStore((s) => s.tenantId);
  const { open, setOpen } = useMobileNav();

  // Light mode applies only while the signed-in shell is on screen; public
  // pages and the ambassador check-in keep their own styling.
  useEffect(() => holdAppearance(), []);
  // Belt and braces: if anything cleared it while this shell is up, the next
  // page change puts it back.
  useEffect(() => {
    applyAppearance(readAppearance());
  }, [location.pathname]);

  return (
    <div className="spark-app-shell flex min-h-[100dvh] md:h-[100dvh] md:overflow-hidden text-base-content spark-mesh">
      <UpdateBanner />
      <CommandPalette />
      <StoreSheet />
      <AskSparkHost />
      {open ? (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setOpen(false)}
        />
      ) : null}
      <SparkSidebar />

      <div className="spark-studio-frame flex flex-col flex-1 min-w-0">
        <SparkTopbar />

        <main className="flex-1 bg-base-200 overflow-y-auto">
          <PageTransition>
            <div className="min-h-full p-5 pb-24 sm:p-6 sm:pb-24 md:pb-6 lg:p-9">
              <ErrorBoundary key={`${location.pathname}:${tenantId ?? ""}`}>
                {children || (
                  <h1 className="text-lg font-semibold">Dashboard</h1>
                )}
              </ErrorBoundary>
            </div>
          </PageTransition>
        </main>
      </div>
      <SparkMobileDock />
    </div>
  );
}

/** Actual sidebar + topbar chrome. Used by AuthenticatedShell and by Layout
 *  when not already inside a shell. */
export const LayoutChrome: React.FC<LayoutProps> = ({ children }) => (
  <MobileNavProvider>
    <LayoutChromeInner>{children}</LayoutChromeInner>
  </MobileNavProvider>
);

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const inShell = useInLayoutShell();
  if (inShell) {
    return <>{children}</>;
  }
  return <LayoutChrome>{children}</LayoutChrome>;
};

export default Layout;
