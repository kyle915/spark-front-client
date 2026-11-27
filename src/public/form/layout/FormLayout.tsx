import useTenantPublic from "../hooks/useTenantPublic";
import useTenantThemePublic from "../hooks/useTenantThemePublic";
import type { TenantColorScheme } from "@/utils/tenantThemeConfig";
import PublicDeadLink from "@/public/PublicDeadLink";
import { TenantLogo } from "@/layout/TenantLogo.tsx";
import { useEffect } from "react";
import { PublicFormTenantContext } from "./publicFormTenantContext";

const IGNITE_HOME = "https://www.igniteproductions.co/";

/**
 * Spark v2 — public form layout (light studio paper).
 *
 * Wraps the external request form in crisp white header chrome on warm-stone
 * paper (`#f6f6f2`), with the Spark mark on the left and the full-color tenant
 * mark on the right.
 */
export default function SparkFormLayout({
  children,
  slug,
}: {
  children: React.ReactNode;
  slug: string;
}) {
  const colorScheme: TenantColorScheme = "light";

  const { tenant, loading: loadingTenant } = useTenantPublic({ slug });

  const { loading: loadingTheme } = useTenantThemePublic({
    slug,
    colorScheme,
  });

  const loading = loadingTenant || loadingTheme;
  const invalidLink = !loading && (!slug || !tenant);

  useEffect(() => {
    const root = document.documentElement;
    const prevTheme = root.getAttribute("data-theme");
    const prevMode = root.getAttribute("data-spark-mode");
    root.setAttribute("data-theme", "spark-v2");
    root.setAttribute("data-spark-mode", "light");
    try {
      localStorage.setItem("@color-scheme", "light");
    } catch {
      /* ignore private-mode storage restrictions */
    }
    return () => {
      if (prevTheme) root.setAttribute("data-theme", prevTheme);
      else root.removeAttribute("data-theme");
      if (prevMode) root.setAttribute("data-spark-mode", prevMode);
      else root.removeAttribute("data-spark-mode");
    };
  }, []);

  if (invalidLink) {
    return (
      <PublicDeadLink
        eyebrow="Request form"
        title="This request form isn't active."
        message="The link doesn't match an active brand. Double-check the URL you were sent."
        nextStep="Ask your Ignite contact for the current form link, or email staffing. This page will not sign you into Spark."
      />
    );
  }

  return (
    <div
      data-theme="spark-v2"
      data-spark-mode="light"
      className="min-h-screen flex flex-col"
      style={{
        background: "var(--spark-bg, #f6f6f2)",
        color: "var(--spark-text, #14160f)",
        colorScheme: "light",
      }}
    >
      {loading && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(246, 246, 242, 0.72)" }}
        >
          <span className="loading loading-spinner loading-lg" />
        </div>
      )}

      {/* Brand header */}
      <header
        className="sticky top-0 z-20 px-6 py-3.5 flex items-center justify-between gap-3 flex-wrap"
        style={{
          background: "rgba(255, 255, 255, 0.92)",
          borderBottom: "1px solid var(--spark-border, #dcddd5)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
        }}
      >
        {/* Left: Spark logo in crisp dark ink */}
        <a
          href={IGNITE_HOME}
          style={{ display: "flex", alignItems: "center" }}
        >
          <img
            src="/legal/spark-logo.png"
            alt="Spark by Ignite"
            style={{
              height: 26,
              width: "auto",
            }}
          />
          <span
            className="hidden sm:inline mono text-[10px] ml-3"
            style={{
              letterSpacing: "0.18em",
              color: "var(--spark-text-meta, rgba(20, 22, 15, 0.45))",
            }}
          >
            /
          </span>
          <span
            className="hidden sm:inline mono text-[10px] font-semibold ml-2"
            style={{
              letterSpacing: "0.18em",
              color: "var(--spark-text-secondary, rgba(20, 22, 15, 0.78))",
            }}
          >
            REQUEST FORM
          </span>
        </a>

        {/* Right: full-color tenant mark */}
        <div className="flex items-center justify-end shrink-0">
          <TenantLogo
            variant="header"
            tone="light"
            name={tenant?.name}
            requestUrlName={tenant?.requestUrlName ?? slug}
            image={tenant?.image}
          />
        </div>
      </header>

      {/* Body */}
      <div className="px-4 py-8 flex flex-col items-center flex-1 w-full">
        <PublicFormTenantContext.Provider value={tenant}>
          <div className="w-full">{children}</div>
        </PublicFormTenantContext.Provider>
      </div>

      {/* Footer */}
      <footer
        className="px-6 py-5 mt-auto"
        style={{
          borderTop: "1px solid var(--spark-border, #dcddd5)",
          background: "#ffffff",
        }}
      >
        <div className="max-w-5xl mx-auto flex items-center justify-between flex-wrap gap-2 text-xs">
          <span
            className="mono"
            style={{
              letterSpacing: "0.16em",
              color: "var(--spark-text-meta, rgba(20, 22, 15, 0.56))",
            }}
          >
            © {new Date().getFullYear()} IGNITE PRODUCTIONS
          </span>
          <div className="flex items-center gap-4">
            <a
              href="/privacy-policy"
              target="_blank"
              rel="noreferrer"
              style={{ color: "var(--spark-text-secondary, rgba(20, 22, 15, 0.75))" }}
            >
              Privacy
            </a>
            <a
              href="/terms-of-service"
              target="_blank"
              rel="noreferrer"
              style={{ color: "var(--spark-text-secondary, rgba(20, 22, 15, 0.75))" }}
            >
              Terms
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
