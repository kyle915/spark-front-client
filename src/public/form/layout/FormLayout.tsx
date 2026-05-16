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

  const [scrollProgress, setScrollProgress] = useState(0);
  const loading = loadingTenant || loadingTheme;

  useEffect(() => {
    const saved = localStorage.getItem(
      "@color-scheme",
    ) as TenantColorScheme | null;

    if (saved) setColorScheme(saved);

    const handleScroll = () => {
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = (window.scrollY / totalHeight) * 100;
      setScrollProgress(progress);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
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

      <div className="navbar bg-base-100 shadow-sm sticky top-0 z-20 flex-col p-0 overflow-hidden">
        <div className="grid grid-cols-2 sm:grid-cols-3 items-center w-full px-4 py-2">
          {/* LEFT: Logo */}
          <div className="flex items-center gap-3 justify-start">
            <div className="relative">
              <img
                src={hasImage ? tenant!.image! : "/logo.svg"}
                alt="Tenant logo"
                className={`relative h-8 sm:h-10 w-auto object-contain app-logo-public transition-all duration-300 ${colorScheme === "dark" ? "brightness-0 invert" : ""} ${hasImage ? "" : "app-logo-public-default"}`}
                onError={(e) => {
                  const img = e.currentTarget;
                  if (!img.src.endsWith("/logo.svg")) {
                    img.src = "/logo.svg";
                  }
                }}
              />
            </div>
          </div>

          {/* CENTER: Title */}
          <div className="hidden sm:flex flex-col items-center justify-center">
            <div className="relative">
              <h1 className="font-extrabold text-xl sm:text-2xl tracking-tight bg-linear-to-br from-primary via-primary/80 to-secondary bg-clip-text text-transparent drop-shadow-sm">
                Spark Request
              </h1>
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1/2 h-1 bg-linear-to-r from-primary to-secondary rounded-full opacity-80" />
            </div>
          </div>

          {/* RIGHT: Actions */}
          <div className="flex justify-end">
            <ThemeToggle value={colorScheme} onChange={setColorScheme} />
          </div>
        </div>

        {/* Scroll Progress Bar */}
        <div className="w-full h-[2px] bg-base-200 overflow-hidden mt-auto">
          <div 
            className="h-full bg-linear-to-r from-primary to-secondary transition-all duration-150 ease-out"
            style={{ width: `${scrollProgress}%` }}
          />
        </div>
      </div>

      <div className="p-6 flex flex-col items-center flex-1 w-full">
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
