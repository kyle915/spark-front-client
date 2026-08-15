import React, { type ReactNode } from "react";
import { useLocation } from "react-router";
import { PageTransition } from "./PageTransition";
import SparkSidebar from "./SparkSidebar";
import SparkTopbar from "./SparkTopbar";
import CommandPalette from "./CommandPalette";
import UpdateBanner from "@/components/UpdateBanner";
import ErrorBoundary from "@/components/ErrorBoundary";
import useSparkPlatform from "@/hooks/useSparkPlatform";

/**
 * Spark v2 layout shell. SparkSidebar + SparkTopbar render the wireframe
 * chrome. The legacy sidebar/topbar code is preserved in git history.
 *
 * Note: useTenantTheme is intentionally NOT called here. It was overriding
 * the spark-v2 theme tokens (e.g. lime primary) with per-tenant brand colors
 * (Liquid Death's blue). The admin shell should always be Spark v2 lime —
 * tenant-brand theming is for client-facing content panels, not the chrome.
 */

interface LayoutProps {
  children?: ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  // Key the boundary by route so navigating to a working page clears a
  // stuck error automatically (a remount resets its caught-error state).
  const location = useLocation();
  const { isMobile } = useSparkPlatform();
  return (
    <div
      className="flex min-h-[100dvh] bg-base-200 text-base-content spark-mesh"
      data-spark-platform={isMobile ? "mobile" : "desktop"}
    >
      <UpdateBanner />
      <CommandPalette />
      {!isMobile && <SparkSidebar />}

      <div
        className={`flex flex-col flex-1 min-w-0 ${
          isMobile ? "max-w-[430px] mx-auto w-full border-x border-base-300" : ""
        }`}
      >
        <SparkTopbar />

        <main className="flex-1 bg-base-200 overflow-y-auto">
          <PageTransition>
            <div className={`min-h-full ${isMobile ? "p-4" : "p-6 lg:p-10"}`}>
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
};

export default Layout;
