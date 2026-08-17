import useTenantPublic, { type TenantPublic } from "../hooks/useTenantPublic";
import useTenantThemePublic from "../hooks/useTenantThemePublic";
import type { TenantColorScheme } from "@/utils/tenantThemeConfig";
import PublicDeadLink from "@/public/PublicDeadLink";
import { TenantLogo } from "@/layout/TenantLogo";
import { createContext, useEffect, useState } from "react";
import { Link } from "react-router";

export const PublicFormTenantContext = createContext<TenantPublic | null>(null);

const IGNITE_HOME = "https://www.igniteproductions.co/";

/**
 * Spark v2 — public form layout.
 *
 * Wraps the request form in the Spark brand chrome: Spark mark on the
 * left, tenant logo (API image / logoUrl, then official fallback) on the
 * right. No marketing copy or shouting tenant name in the header. The
 * tenant theme hook still runs for public pages — clients want their
 * brand color on their public request form, unlike the admin shell.
 */

export default function SparkFormLayout({
  children,
  slug,
}: {
  children: React.ReactNode;
  slug: string;
}) {
  const [colorScheme] = useState<TenantColorScheme>(
    (localStorage.getItem("@color-scheme") as TenantColorScheme) || "dark",
  );

  const { tenant, loading: loadingTenant } = useTenantPublic({ slug });

  const { loading: loadingTheme } = useTenantThemePublic({
    slug,
    colorScheme,
  });

  const loading = loadingTenant || loadingTheme;
  const invalidLink = !loading && (!slug || !tenant);

  useEffect(() => {
    localStorage.setItem("@color-scheme", colorScheme);
  }, [colorScheme]);

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
      className="min-h-screen flex flex-col spark-mesh"
      style={{ background: "var(--spark-bg, #0a0d09)" }}
    >
      {loading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <span className="loading loading-spinner loading-lg" />
        </div>
      )}

      {/* Brand header */}
      <header
        className="sticky top-0 z-20 px-6 py-4 flex items-center justify-between gap-3 flex-wrap"
        style={{
          background: "rgba(10,13,9,0.85)",
          borderBottom: "1px solid var(--spark-border, #1f2418)",
          backdropFilter: "blur(12px)",
        }}
      >
        {/* Left: real Spark logo, inverted to white for the dark band */}
        <a
          href={IGNITE_HOME}
          style={{ display: "flex", alignItems: "center" }}
        >
          <img
            src="/legal/spark-logo.png"
            alt="Spark by Ignite"
            style={{
              height: 28,
              width: "auto",
              filter: "invert(1) hue-rotate(180deg)",
            }}
          />
          <span
            className="hidden sm:inline mono text-[10px] ml-3"
            style={{
              letterSpacing: "0.18em",
              color: "rgba(255,255,255,0.4)",
            }}
          >
            /
          </span>
          <span
            className="hidden sm:inline mono text-[10px] ml-2"
            style={{
              letterSpacing: "0.18em",
              color: "var(--spark-lime, #c5f546)",
            }}
          >
            REQUEST FORM
          </span>
        </a>

        {/* Right: full-color tenant mark. API image / logoUrl first,
            official fallback second, short name if nothing loads. */}
        <div className="flex items-center justify-end shrink-0">
          <TenantLogo
            variant="header"
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
          borderTop: "1px solid var(--spark-border, #1f2418)",
          background: "rgba(10,13,9,0.6)",
        }}
      >
        <div className="max-w-6xl mx-auto flex items-center justify-between flex-wrap gap-2 text-xs">
          <span
            className="mono"
            style={{
              letterSpacing: "0.16em",
              color: "rgba(255,255,255,0.4)",
            }}
          >
            © {new Date().getFullYear()} IGNITE PRODUCTIONS
          </span>
          <div className="flex items-center gap-4">
            <Link
              to="/privacy-policy"
              style={{ color: "rgba(255,255,255,0.55)" }}
            >
              Privacy
            </Link>
            <Link
              to="/terms-of-service"
              style={{ color: "rgba(255,255,255,0.55)" }}
            >
              Terms
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
