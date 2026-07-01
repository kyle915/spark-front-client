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

// GraphQL calls below use raw fetch(), not Relay: updateTenant/getUploadUrl
// already work server-side but aren't in the local hand-patched
// schema_clients.graphql, and this app never does a full schema re-export
// (see spark-front-client conventions) — Relay codegen would fail on them.
function LogoUploadIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="w-4 h-4"
    >
      <path
        d="M4 16.5V18a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1.5M7 9l5-5 5 5M12 4v12"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TenantLogoCard({ tenantId }: { tenantId?: string }) {
  const { showAlert } = useAlertStore();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!tenantId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(import.meta.env.VITE_GRAPHQL_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `JWT ${localStorage.getItem("@token") ?? ""}`,
          },
          body: JSON.stringify({
            query: `query TenantLogo($id: ID!) { tenant(id: $id) { id image } }`,
            variables: { id: tenantId },
          }),
        });
        const json = await res.json();
        if (!cancelled) setImageUrl(json?.data?.tenant?.image ?? null);
      } catch {
        // Leave imageUrl null — the card just shows the empty state.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  const onPickFile = async (file: File | null) => {
    if (!file || !tenantId) return;
    setUploading(true);
    try {
      const filePath = `tenant-logos/${tenantId}/${Date.now()}_${file.name}`;
      const uploadRes = await fetch(import.meta.env.VITE_GRAPHQL_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `query GetUploadUrl($filePath: String!, $contentType: String!) {
            getUploadUrl(filePath: $filePath, contentType: $contentType) { uploadUrl blobName }
          }`,
          variables: { filePath, contentType: file.type },
        }),
      });
      const uploadJson = await uploadRes.json();
      const uploadUrl = uploadJson?.data?.getUploadUrl?.uploadUrl;
      const blobName = uploadJson?.data?.getUploadUrl?.blobName;
      if (!uploadUrl || !blobName) {
        throw new Error(
          uploadJson?.errors?.[0]?.message ?? "Unable to get an upload URL."
        );
      }

      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!putRes.ok) throw new Error("Failed to upload the logo to storage.");

      const updateRes = await fetch(import.meta.env.VITE_GRAPHQL_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `JWT ${localStorage.getItem("@token") ?? ""}`,
        },
        body: JSON.stringify({
          query: `mutation UpdateTenantLogo($input: UpdateTenantInput!) {
            updateTenant(input: $input) { success message tenant { id image } }
          }`,
          variables: { input: { id: tenantId, image: blobName } },
        }),
      });
      const updateJson = await updateRes.json();
      const result = updateJson?.data?.updateTenant;
      if (updateJson.errors?.length || !result?.success) {
        throw new Error(
          result?.message ?? updateJson.errors?.[0]?.message ?? "Unknown error"
        );
      }
      setImageUrl(result.tenant?.image ?? null);
      showAlert("Logo updated.", "success");
    } catch (e) {
      showAlert(`Logo upload failed: ${(e as Error).message}`, "error");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="rounded-xl border border-base-300 bg-base-100 p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="font-semibold text-base-content">Brand Logo</div>
          <div className="text-xs opacity-70">
            Shown on your public receipt/rebate pages and request forms.
          </div>
        </div>
        <div className="flex items-center gap-3">
          {loading ? (
            <span className="text-xs opacity-60">Loading…</span>
          ) : imageUrl ? (
            <img
              src={imageUrl}
              alt="Current logo"
              className="h-10 w-auto max-w-[160px] object-contain rounded border border-base-300 bg-white p-1"
            />
          ) : (
            <span className="text-xs opacity-60">No logo uploaded yet</span>
          )}
          <label className="btn btn-sm btn-ghost border border-base-300 gap-2">
            <LogoUploadIcon />
            {uploading
              ? "Uploading…"
              : imageUrl
                ? "Replace logo"
                : "Upload logo"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                e.target.value = "";
                void onPickFile(file);
              }}
            />
          </label>
        </div>
      </div>
    </div>
  );
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

      <TenantLogoCard tenantId={tenantId} />

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
