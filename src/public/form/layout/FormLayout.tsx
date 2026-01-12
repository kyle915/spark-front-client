import ThemeToggle from "@/shared/ThemeToggle";
import useTenantThemePublic from "../hooks/useTenantThemePublic";
import type { TenantColorScheme } from "@/utils/tenantThemeConfig";
import { useEffect, useState } from "react";

export default function SparkFormLayout({
  children,
  slug,
}: {
  children: React.ReactNode;
  slug: string;
}) {
  const [colorScheme, setColorScheme] = useState<TenantColorScheme>(
    (localStorage.getItem("@color-scheme") as TenantColorScheme) || "dark"
  );

  const { loading } = useTenantThemePublic({
    slug,
    colorScheme,
  });

  /* =====================================================
   * Load persisted scheme (client-only)
   * ===================================================== */
  useEffect(() => {
    const saved = localStorage.getItem(
      "@color-scheme"
    ) as TenantColorScheme | null;

    if (saved) setColorScheme(saved);
  }, []);

  useEffect(() => {
    localStorage.setItem("@color-scheme", colorScheme);
  }, [colorScheme]);

  return (
    <div className="min-h-screen bg-base-200 flex flex-col">
      {loading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-base-200/60">
          <span className="loading loading-spinner loading-lg" />
        </div>
      )}
      <div className="navbar bg-base-100 shadow-sm sticky top-0 z-20">
        <div className="flex-1">
          <h1 className="font-bold text-lg">Spark Request Form</h1>
        </div>

        <div className="flex-none">
          <ThemeToggle value={colorScheme} onChange={setColorScheme} />
          <ThemeToggle value={colorScheme} onChange={setColorScheme} />
        </div>
      </div>

      <div className="p-6 flex flex-col items-center flex-1 w-full">
        {children}
      </div>
    </div>
  );
}
