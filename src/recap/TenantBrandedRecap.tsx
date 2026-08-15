import type { CSSProperties, ReactNode } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import { TenantThemeQuery } from "@/api/queries/TenantThemeQuery";
import type { TenantThemeQuery as TenantThemeQueryType } from "@api/queries/__generated__/TenantThemeQuery.graphql";
import { useAuthStore } from "@/store/authStore";
import type { CssVariablesMap } from "@/utils/tenantThemeConfig";

/**
 * Scoped tenant brand for public + client recaps.
 * Applies DaisyUI tokens on a wrapper only — never documentElement —
 * so admin chrome stays Spark lime.
 */
export function TenantBrandedRecap({
  cssVariables,
  primary,
  children,
  className,
}: {
  cssVariables?: CssVariablesMap | null;
  primary?: string | null;
  children: ReactNode;
  className?: string;
}) {
  const style: CSSProperties = {
    ...(cssVariables ?? {}),
    ["--recap-brand" as string]:
      primary || cssVariables?.["--color-primary"] || "var(--spark-lime, #c5f546)",
    ["--recap-brand-ink" as string]:
      cssVariables?.["--color-primary-content"] || "#0a0d09",
    ["--recap-bg" as string]:
      cssVariables?.["--color-base-200"] || "var(--spark-bg, #0a0d09)",
    ["--recap-surface" as string]:
      cssVariables?.["--color-base-100"] || "var(--spark-card, #11140e)",
    ["--recap-text" as string]:
      cssVariables?.["--color-base-content"] || "var(--spark-text, #f2f3ee)",
  };
  return (
    <div className={className} style={style} data-recap-brand="tenant">
      {children}
    </div>
  );
}

export function ClientTenantRecapBrand({ children }: { children: ReactNode }) {
  const tenantId = useAuthStore((s) => s.tenantId);
  const data = useLazyLoadQuery<TenantThemeQueryType>(
    TenantThemeQuery,
    { tenantId: tenantId ?? "", scheme: "DARK" },
    { fetchPolicy: "store-or-network" },
  );
  const vars = (data.tenantTheme?.cssVariables ?? null) as CssVariablesMap | null;
  return (
    <TenantBrandedRecap
      cssVariables={vars}
      primary={vars?.["--color-primary"]}
    >
      {children}
    </TenantBrandedRecap>
  );
}

export function recapBrandBtn(): CSSProperties {
  return {
    background: "var(--recap-brand, var(--spark-lime))",
    color: "var(--recap-brand-ink, #0a0d09)",
    boxShadow: "0 0 24px color-mix(in srgb, var(--recap-brand, #c5f546) 35%, transparent)",
  };
}
