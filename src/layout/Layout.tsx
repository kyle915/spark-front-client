import React, { type ReactNode } from "react";
import { PageTransition } from "./PageTransition";
import SparkSidebar from "./SparkSidebar";
import SparkTopbar from "./SparkTopbar";

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
  return (
    <div className="flex h-screen bg-base-200 text-base-content">
      <SparkSidebar />

      <div className="flex flex-col flex-1 min-w-0">
        <SparkTopbar />

        <main className="flex-1 bg-base-200 overflow-y-auto">
          <PageTransition>
            <div className="p-6 lg:p-10 min-h-full">
              {children || (
                <h1 className="text-lg font-semibold">Dashboard</h1>
              )}
            </div>
          </PageTransition>
        </main>
      </div>
    </div>
  );
};

export default Layout;
