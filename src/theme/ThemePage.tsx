import { Suspense, useEffect, useMemo, useState } from "react";
import Layout from "@/layout/Layout";
import Loading from "@shared/Loading";
import { useAuthStore } from "@/store/authStore";
import { useMutation } from "react-relay";
import useTenantTheme from "@/hooks/useTenantTheme";
import {
  TENANT_THEME_VARIABLES,
  buildThemeDefaults,
  type CssVariablesMap,
} from "@utils/tenantThemeConfig";
import { useColorScheme } from "./hook/useColorScheme";
import { ThemeVariableRow } from "./ThemeVariableRow";
import { ThemeLivePreview } from "./ThemeLivePreview";
import type { UpsertTenantThemeMutation as UpsertTenantThemeMutationType } from "@api/mutations/__generated__/UpsertTenantThemeMutation.graphql";
import { UpsertTenantThemeMutation } from "@/api/mutations/UpsertTenantThemeMutation";
import { Palette } from "lucide-react";
import { useAlertStore } from "@/store/alertStore";

function diffCssVariables(
  base: CssVariablesMap,
  current: CssVariablesMap
): CssVariablesMap {
  const diff: CssVariablesMap = {};
  Object.keys(current).forEach((key) => {
    const baseValue = (base[key] ?? "").trim();
    const currentValue = (current[key] ?? "").trim();
    if (baseValue !== currentValue) {
      diff[key] = current[key] ?? "";
    }
  });
  return diff;
}

function applyCssVariablesToRoot(vars: CssVariablesMap) {
  const root = document.documentElement;
  Object.entries(vars).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
}

type ThemeEditorContentProps = {
  tenantId?: string;
};

function ThemeEditorContent({ tenantId }: ThemeEditorContentProps) {
  const { colorScheme, setColorScheme } = useColorScheme("light");
  const { showAlert } = useAlertStore();
  const [commit, isInFlight] = useMutation<UpsertTenantThemeMutationType>(
    UpsertTenantThemeMutation
  );

  // Load theme from DB
  const { theme } = useTenantTheme({
    tenantId,
    colorScheme,
    enabled: true,
  });

  // Resolve base theme (defaults + DB overrides)
  const baseResolved = useMemo(() => {
    return buildThemeDefaults(colorScheme, theme);
  }, [colorScheme, theme]);

  // Editable draft (local state)
  const [draft, setDraft] = useState<CssVariablesMap>(() => baseResolved);

  // Reset draft if tenant, scheme, or remote theme changes
  useEffect(() => {
    setDraft(baseResolved);
  }, [baseResolved]);

  // Apply draft live to the document root
  useEffect(() => {
    applyCssVariablesToRoot(draft);
  }, [draft]);

  const onChangeVar = (key: string, value: string) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const onResetVar = (key: string) => {
    setDraft((prev) => ({ ...prev, [key]: baseResolved[key] ?? "" }));
  };

  const onResetAll = () => {
    setDraft(baseResolved);
  };

  const overridesDraft = diffCssVariables(baseResolved, draft);
  const hasChanges = Object.keys(overridesDraft).length > 0;

  const onSubmit = () => {
    commit({
      variables: {
        input: {
          tenantId: tenantId ?? "",
          colorScheme: colorScheme.toUpperCase() as "LIGHT" | "DARK",
          name: theme?.name ?? null,
          cssVariables: draft,
        },
      },
      onCompleted: (response) => {
        const result = response?.upsertTenantTheme;

        if (!result) {
          showAlert(
            "Unexpected response from server (empty payload).",
            "error"
          );
          return;
        }

        if (result.success) {
          showAlert(result.message ?? "Theme updated successfully", "success");
          return;
        }

        showAlert(result.message ?? "Error updating tenant theme", "error");
      },
      onError: (error) => {
        showAlert(
          error?.message
            ? `Error updating tenant theme: ${error.message}`
            : "Error updating tenant theme",
          "error"
        );
      },
    });
  };

  return (
    <div className="p-4 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-3xl font-bold text-primary text-shadow-2xs text-shadow-primary-100">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Palette className="w-8 h-8" />
            </div>
            <h1>Theme Customization</h1>
          </div>
          <p className="text-base-content/70">
            Customize your tenant&apos;s theme
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="join">
            <button
              type="button"
              className={`btn btn-sm join-item ${
                colorScheme === "light"
                  ? "btn-primary"
                  : "btn-ghost border border-base-300"
              }`}
              onClick={() => setColorScheme("light")}
              disabled={isInFlight}
            >
              Light
            </button>
            <button
              type="button"
              className={`btn btn-sm join-item ${
                colorScheme === "dark"
                  ? "btn-primary"
                  : "btn-ghost border border-base-300"
              }`}
              onClick={() => setColorScheme("dark")}
              disabled={isInFlight}
            >
              Dark
            </button>
          </div>

          <button
            type="button"
            className="btn btn-sm btn-ghost border border-base-300"
            onClick={onResetAll}
            disabled={!hasChanges || isInFlight}
          >
            Reset all
          </button>

          <button
            type="button"
            className="btn btn-sm btn-primary"
            disabled={!hasChanges || isInFlight}
            onClick={onSubmit}
          >
            {isInFlight ? "Saving..." : "Save changes"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.5fr_0.5fr] gap-6 items-start">
        {/* Editor */}
        <div className="space-y-4">
          <div className="rounded-xl border border-base-300 bg-base-100 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-semibold text-base-content">
                  Theme Variables
                </div>
                <div className="text-xs opacity-70">
                  Accepted values include <code>oklch()</code>,{" "}
                  <code>hsl()</code>, <code>#hex</code>, etc.
                </div>
              </div>
              <span className="text-sm">
                Changes:{" "}
                <span className="font-semibold">
                  {Object.keys(overridesDraft).length}
                </span>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {TENANT_THEME_VARIABLES.map((key) => (
              <ThemeVariableRow
                key={key}
                variableKey={key}
                value={draft[key] ?? ""}
                defaultValue={baseResolved[key] ?? ""}
                onChange={(k, v) => onChangeVar(k, v)}
                onReset={(k) => onResetVar(k)}
              />
            ))}
          </div>
        </div>

        {/* Preview */}

        <div className="space-y-4">
          <ThemeLivePreview />
        </div>
      </div>
    </div>
  );
}

const CustomThemeContent = () => {
  const { tenantId } = useAuthStore();
  if (!tenantId) {
    return (
      <div className="p-6">
        <div className="alert alert-error">
          <span>Tenant identifier is not defined.</span>
        </div>
      </div>
    );
  }
  return (
    <>
      <Suspense fallback={<Loading />}>
        <ThemeEditorContent tenantId={tenantId ?? ""} />
      </Suspense>
    </>
  );
};

export default function ThemeEditorPage() {
  return (
    <Layout>
      <Suspense fallback={<Loading />}>
        <CustomThemeContent />
      </Suspense>
    </Layout>
  );
}
