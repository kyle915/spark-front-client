import React, { type ReactNode, useEffect, useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { PageTransition } from "./PageTransition";
import useTenantTheme from "@/hooks/useTenantTheme";
import { type TenantColorScheme } from "@utils/tenantThemeConfig";
import SparkSidebar from "./SparkSidebar";
import SparkTopbar from "./SparkTopbar";

/**
 * Spark v2 layout shell. Combines the new SparkSidebar + SparkTopbar so the
 * whole app renders inside the wireframe chrome. The legacy sidebar/topbar
 * code lives in git history (commit 4ccb5cc).
 */

interface LayoutProps {
  children?: ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [colorScheme, setColorScheme] = useState<TenantColorScheme>(
    (localStorage.getItem("@color-scheme") as TenantColorScheme) || "dark",
  );
  const { tenantId } = useAuthStore();

  useTenantTheme({
    tenantId,
    colorScheme,
    enabled: Boolean(tenantId),
  });

  useEffect(() => {
    const saved = localStorage.getItem(
      "@color-scheme",
    ) as TenantColorScheme | null;
    if (saved) setColorScheme(saved);
  }, []);

  useEffect(() => {
    localStorage.setItem("@color-scheme", colorScheme);
  }, [colorScheme]);

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
