import useTenantPublic, { type TenantPublic } from "../hooks/useTenantPublic";
import useTenantThemePublic from "../hooks/useTenantThemePublic";
import type { TenantColorScheme } from "@/utils/tenantThemeConfig";
import { createContext, useEffect, useState } from "react";
import { Link } from "react-router";

export const PublicFormTenantContext = createContext<TenantPublic | null>(null);

const IGNITE_HOME = "https://www.igniteproductions.co/";

/**
 * Spark v2 — public form layout.
 *
 * Wraps the request form in the Spark brand chrome: italic "Spark BY IGNITE"
 * mark on the left, lime status pill in the middle, tenant logo + brand
 * tag on the right. Background is the spark-v2 near-black. The tenant
 * theme hook still runs for public pages — clients want their brand color
 * on their public request form, unlike the admin shell.
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

  const {
    tenant,
    hasImage,
    loading: loadingTenant,
  } = useTenantPublic({ slug });

  const { loading: loadingTheme } = useTenantThemePublic({
    slug,
    colorScheme,
  });

  const loading = loadingTenant || loadingTheme;
  const invalidLink = !loading && (!slug || !tenant);

  useEffect(() => {
    localStorage.setItem("@color-scheme", colorScheme);
  }, [colorScheme]);

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

        {/* Right: tenant logo, force-rendered white so it reads on the
            dark Spark v2 chrome regardless of source colour. */}
        <div className="flex items-center gap-3">
          {hasImage && tenant?.image ? (
            <img
              src={tenant.image}
              alt=""
              className="h-8 w-auto object-contain"
              style={{
                filter: "brightness(0) invert(1)",
              }}
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          ) : (
            <span className="chip chip-lime">
              ● {(tenant?.name ?? tenant?.requestUrlName ?? "PUBLIC").toUpperCase()}
            </span>
          )}
        </div>
      </header>

      {/* Body */}
      <div className="px-4 py-8 flex flex-col items-center flex-1 w-full">
        {invalidLink ? (
          <div
            className="w-full max-w-xl rounded-2xl p-8 text-center"
            style={{
              background:
                "linear-gradient(180deg, var(--spark-surface, #11140e), var(--spark-surface-2, #161a12))",
              border: "1px solid var(--spark-border, #1f2418)",
            }}
          >
            <p
              className="mono text-[10px] mb-2"
              style={{
                letterSpacing: "0.18em",
                color: "var(--spark-orange, #ef5a2a)",
              }}
            >
              INVALID LINK
            </p>
            <h2
              className="display text-2xl font-bold"
              style={{ letterSpacing: "-0.02em" }}
            >
              This request form isn't active.
            </h2>
            <p
              className="mt-3"
              style={{ color: "rgba(255,255,255,0.65)" }}
            >
              The tenant slug in the URL doesn't match an active brand.
              Double-check the link or reach out to your Spark contact.
            </p>
          </div>
        ) : (
          <PublicFormTenantContext.Provider value={tenant}>
            <div className="w-full">{children}</div>
          </PublicFormTenantContext.Provider>
        )}
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
