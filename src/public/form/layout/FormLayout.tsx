import ThemeToggle from "@/shared/ThemeToggle";
import useTenantPublic from "../hooks/useTenantPublic";
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
    (localStorage.getItem("@color-scheme") as TenantColorScheme) || "dark",
  );

  const {
    tenant,
    hasImage,
    loading: loadingTenant,
  } = useTenantPublic({
    slug,
  });

  const { loading: loadingTheme } = useTenantThemePublic({
    slug,
    colorScheme,
  });

  const loading = loadingTenant || loadingTheme;

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
    <div className="min-h-screen bg-base-200 flex flex-col">
      {loading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-base-200/60">
          <span className="loading loading-spinner loading-lg" />
        </div>
      )}

      <div className="navbar bg-base-100 shadow-sm sticky top-0 z-20">
        <div className="grid grid-cols-1 sm:grid-cols-[auto,1fr,auto] items-center w-full px-3 sm:px-4 gap-2">
          {/* LEFT: Logo */}
          <div className="flex items-center gap-3 justify-center sm:justify-start">
            <img
              src={hasImage ? tenant!.image! : "/logo.svg"}
              alt="Tenant logo"
              className="h-8 w-auto object-contain app-logo-public"
              onError={(e) => {
                const img = e.currentTarget;
                if (!img.src.endsWith("/logo.svg")) {
                  img.src = "/logo.svg";
                }
              }}
            />
          </div>

          {/* CENTER: Title */}
          <div className="hidden sm:flex justify-center">
            <h1 className="font-semibold text-base sm:text-lg tracking-tight text-center leading-tight">
              Spark Request Form
            </h1>
          </div>

          {/* RIGHT: Actions */}
          <div className="hidden sm:flex justify-end">
            <ThemeToggle value={colorScheme} onChange={setColorScheme} />
          </div>
        </div>
      </div>

      <div className="px-4 py-6 sm:px-6 flex flex-col items-center flex-1 w-full">
        {children}
      </div>
      {/*
      <footer className="footer footer-center p-4 bg-base-100 text-base-content/70">
        <aside className="flex items-center gap-2 text-sm">
          <span>© {currentYear} Spark</span>
          <span aria-hidden="true">•</span>
          <Link to="/privacy-policy" className="link link-primary">
            Privacy Policy
          </Link>
          <span aria-hidden="true">•</span>
          <Link to="/terms-of-service" className="link link-primary">
            Terms of Service
          </Link>
        </aside>
      </footer>
      */}
    </div>
  );
}
