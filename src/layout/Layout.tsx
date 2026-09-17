import React, { type ReactNode } from "react";
import { useLocation } from "react-router";
import { PageTransition } from "./PageTransition";
import SparkSidebar from "./SparkSidebar";
import SparkTopbar from "./SparkTopbar";
import CommandPalette from "./CommandPalette";
import UpdateBanner from "@/components/UpdateBanner";
import ErrorBoundary from "@/components/ErrorBoundary";
import { useInLayoutShell } from "./LayoutShellContext";
import { MobileNavProvider, useMobileNav } from "./MobileNavContext";

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
  const { open, setOpen } = useMobileNav();

  return (
    <div className="flex min-h-[100dvh] bg-base-200 text-base-content spark-mesh">
      <UpdateBanner />
      <CommandPalette />
      {open ? (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setOpen(false)}
        />
      ) : null}
      <SparkSidebar />

      <div className="flex flex-col flex-1 min-w-0">
        <SparkTopbar />

        <main className="flex-1 bg-base-200 overflow-y-auto">
          <PageTransition>
            <div className="min-h-full p-6 lg:p-10">
              <ErrorBoundary key={location.pathname}>
                {children || (
                  <h1 className="text-lg font-semibold">Dashboard</h1>
                )}
              </ErrorBoundary>
            </div>
          </PageTransition>
        </main>
      </div>
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
