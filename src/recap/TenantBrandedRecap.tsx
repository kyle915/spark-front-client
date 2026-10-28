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
      primary || cssVariables?.["--color-primary"] || "#3f5c12",
    ["--recap-brand-ink" as string]:
      cssVariables?.["--color-primary-content"] || "#f6f6f2",
    ["--recap-heading" as string]: "#3f5c12",
    ["--recap-bg" as string]: "#f6f6f2",
    ["--recap-surface" as string]: "#ffffff",
    ["--recap-text" as string]: "#14160f",
    ["--recap-muted" as string]: "#5c6154",
    ["--recap-faint" as string]: "#7a7f70",
    ["--recap-border" as string]: "#e2e4d8",
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
    { tenantId: tenantId ?? "", scheme: "LIGHT" },
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
    boxShadow: "0 0 24px color-mix(in srgb, var(--recap-brand, #f2f3ee) 35%, transparent)",
  };
}
