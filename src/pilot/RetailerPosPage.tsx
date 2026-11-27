import React, { Suspense, useState } from "react";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { formatCoveragePercent, formatHonestMoney } from "./pilotHelpers";
import { PlanGateCallout } from "./PlanGateCallout";
import SparkPageHeader from "@/shared/SparkPageHeader";
import SparkHubTabs from "@/shared/SparkHubTabs";
import { REPORTS_HUB_TABS, STORE_BUYER_SUBTABS } from "@/shared/sparkHubNav";
import { PilotQueriesRetailerPosPageQuery } from "@/api/queries/PilotQueries";
import {
  PilotMutationsImportPosMutation,
  PilotMutationsLinkCrewPurchaseMutation,
  PilotMutationsResolvePosRowMutation,
  PilotMutationsSetContributionMutation,
  PilotMutationsUpsertPosFeedMutation,
} from "@/api/mutations/PilotMutations";
import type { PilotQueriesRetailerPosPageQuery as PosQueryType } from "@/api/queries/__generated__/PilotQueriesRetailerPosPageQuery.graphql";
import type { PilotMutationsImportPosMutation as ImportPosType } from "@/api/mutations/__generated__/PilotMutationsImportPosMutation.graphql";
import type { PilotMutationsResolvePosRowMutation as ResolvePosType } from "@/api/mutations/__generated__/PilotMutationsResolvePosRowMutation.graphql";
import type { PilotMutationsLinkCrewPurchaseMutation as CrewPurchaseType } from "@/api/mutations/__generated__/PilotMutationsLinkCrewPurchaseMutation.graphql";
import type { PilotMutationsSetContributionMutation as SetContribType } from "@/api/mutations/__generated__/PilotMutationsSetContributionMutation.graphql";
import type { PilotMutationsUpsertPosFeedMutation as UpsertFeedType } from "@/api/mutations/__generated__/PilotMutationsUpsertPosFeedMutation.graphql";

const META = { color: "var(--spark-text-meta)" } as const;
const BORDER = { border: "1px solid var(--spark-border)" } as const;
const FIELD_STYLE = {
  border: "1px solid var(--spark-border)",
  background: "var(--spark-field-bg, var(--spark-surface))",
  color: "var(--spark-text)",
} as const;
const PRIMARY_BTN_STYLE = {
  background: "var(--spark-lime)",
  color: "var(--spark-on-accent)",
  border: "1px solid var(--spark-lime)",
} as const;
const OK_BANNER_STYLE = {
  background: "var(--spark-ok-bg)",
  color: "var(--spark-ok-ink)",
  border: "1px solid var(--spark-ok-border)",
} as const;

const PosBody: React.FC<{ fetchKey: number; bump: () => void }> = ({
  fetchKey,
  bump,
}) => {
  const data = useLazyLoadQuery<PosQueryType>(
    PilotQueriesRetailerPosPageQuery,
    {
      periodStart: null,
      periodEnd: null,
      contributionPerUnit: null,
    },
    { fetchPolicy: "network-only", fetchKey },
  );
  const ws = data.workspaceOverview;
  const pos = data.retailerPosDashboard;
  const automation = data.posAutomationWorkspace ?? {
    presets: [],
    feeds: [],
    recentDrops: [],
  };
  const visits = data.canonicalVisits;

  const [commitImport, importing] = useMutation<ImportPosType>(
    PilotMutationsImportPosMutation,
  );
  const [commitResolve] = useMutation<ResolvePosType>(
    PilotMutationsResolvePosRowMutation,
  );
  const [commitCrew, linkingCrew] = useMutation<CrewPurchaseType>(
    PilotMutationsLinkCrewPurchaseMutation,
  );
  const [commitContrib] = useMutation<SetContribType>(
    PilotMutationsSetContributionMutation,
  );
  const [commitFeed, savingFeed] = useMutation<UpsertFeedType>(
    PilotMutationsUpsertPosFeedMutation,
  );

  // POS upload state
  // Empty until the user types a banner or picks a portal preset
  // (preset defaultBanner only applies when the field is still blank).
  const [bannerName, setBannerName] = useState("");
  const [presetKey, setPresetKey] = useState("");
  const [feedCompleteness, setFeedCompleteness] = useState("complete");
  const [filename, setFilename] = useState("pos_weekly.csv");
  const [csvText, setCsvText] = useState("");
  const [feedNotes, setFeedNotes] = useState("");
  const [contribInput, setContribInput] = useState(
    ws.defaultContributionPerUnit ?? "",
  );

  // Crew purchase linker state
  const [crewVisitUuid, setCrewVisitUuid] = useState(visits[0]?.uuid ?? "");
  const [crewProductId, setCrewProductId] = useState(
    ws.products[0]?.id ? String(ws.products[0].id) : "",
  );
  const [crewUnits, setCrewUnits] = useState("");
  const [crewRef, setCrewRef] = useState("");

  // Unmatched row picker state
  const [rowStoreMap, setRowStoreMap] = useState<Record<string, string>>({});
  const [rowProdMap, setRowProdMap] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleFile = async (f: File | null) => {
    if (!f) return;
    setFilename(f.name);
    setCsvText(await f.text());
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <SparkPageHeader
        eyebrow={`Permissioned store × SKU × week sales · ${ws.tenantName}`}
        title="Retailer POS sales, lift & ROI"
        support="Deduplicates multiple demos in the same store-week, subtracts linked crew product purchases in adjusted views, and withholds lift/ROI until baseline and cost coverage hold."
      />

      {pos.planGated ? (
        <PlanGateCallout
          title="Retailer POS Sales Lift & ROI Measurement"
          message={pos.planUpgradeMessage}
          requiredPlan={pos.requiredPlan}
        />
      ) : null}

      {feedback && (
        <div
          className="p-3 rounded-xl text-xs font-medium"
          style={OK_BANNER_STYLE}
        >
          {feedback}
        </div>
      )}

      {/* Honest Empty State when no POS feed exists */}
      {!pos.available ? (
        <section
          className="spark-card p-6 space-y-2"
          style={{ border: "1px solid var(--spark-border)" }}
        >
          <p
            className="text-xs uppercase mono font-semibold"
            style={{ color: "var(--spark-warn-badge-ink)" }}
          >
            Retailer sales unavailable
          </p>
          <h2 className="display text-lg font-bold">
            {pos.unavailableMessage ?? "Retailer sales unavailable"}
          </h2>
          <p className="text-xs" style={META}>
            Upload a permissioned retailer POS CSV below (Store × SKU × Week) to unlock register sales coverage, crew-purchase adjusted velocity, and baseline-gated ROI.
          </p>
        </section>
      ) : (
        <section className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="spark-card p-4">
            <p className="text-xs" style={META}>
              Feed Coverage
            </p>
            <p
              className="text-xl font-bold mono mt-1"
              style={{ color: "var(--spark-ok-ink)" }}
            >
              {pos.matchedStoreSkuWeeks}/{pos.eligibleStoreSkuWeeks} (
              {formatCoveragePercent(pos.coverageRatio)})
            </p>
            <p className="text-[11px] mt-1" style={META}>
              Store × SKU × week cells
            </p>
          </div>

          <div className="spark-card p-4">
            <p className="text-xs" style={META}>
              Rep-Observed vs Raw POS
            </p>
            <p className="text-xl font-bold mono mt-1">
              {pos.repObservedUnits} vs {pos.registerUnits ?? "—"}
            </p>
            <p className="text-[11px] mt-1" style={META}>
              Crew bought: -{pos.crewPurchasedUnits} units
            </p>
          </div>

          <div className="spark-card p-4">
            <p className="text-xs" style={META}>
              Adjusted POS Units
            </p>
            <p className="text-xl font-bold mono mt-1">
              {pos.adjustedRegisterUnits ?? "—"}
            </p>
            <p className="text-[11px] mt-1" style={META}>
              Raw register preserved intact
            </p>
          </div>

          <div className="spark-card p-4">
            <p className="text-xs" style={META}>
              Incremental Lift
            </p>
            <p className="text-xl font-bold mono mt-1">
              {pos.incrementalLiftUnits
                ? `${pos.incrementalLiftUnits} units`
                : "Withheld"}
            </p>
            <p className="text-[11px] mt-1" style={META}>
              {pos.liftWithheldReason ??
                `Observed diff: ${pos.observedVsBaselineDiff ?? "—"}`}
            </p>
          </div>

          <div className="spark-card p-4">
            <p className="text-xs" style={META}>
              Contribution & ROI
            </p>
            <p
              className="text-xl font-bold mono mt-1"
              style={{ color: "var(--spark-ok-ink)" }}
            >
              {pos.roi != null ? `${pos.roi}x` : "Withheld"}
            </p>
            <p className="text-[11px] mt-1" style={META}>
              {pos.roiWithheldReason ??
                `Contribution: ${formatHonestMoney(pos.incrementalContribution)}`}
            </p>
          </div>
        </section>
      )}

      {/* Upload POS CSV + Crew Purchase Adjustment + Contribution Margin */}
      {ws.canManagePos && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <form
            className="spark-card p-5 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!csvText.trim()) return;
              commitImport({
                variables: {
                  retailerBanner: bannerName.trim(),
                  csvText,
                  filename,
                  feedCompleteness,
                  columnMapJson: null,
                  presetKey: presetKey || null,
                },
                onCompleted: (r) => {
                  if (r.importRetailerPosSales.ok) {
                    setFeedback(
                      "Imported permissioned POS feed (prior overlapping feed superseded cleanly).",
                    );
                    setCsvText("");
                    bump();
                  } else {
                    setFeedback(
                      r.importRetailerPosSales.error ?? "POS import failed.",
                    );
                  }
                },
              });
            }}
          >
            <h2 className="display text-base font-bold">
              Upload Permissioned Retailer POS CSV
            </h2>
            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <input
                required
                value={bannerName}
                onChange={(e) => setBannerName(e.target.value)}
                placeholder="Retailer banner (e.g. FreshMart)"
                className="px-3 py-2 rounded-xl"
                style={FIELD_STYLE}
              />
              <select
                value={feedCompleteness}
                onChange={(e) => setFeedCompleteness(e.target.value)}
                className="px-3 py-2 rounded-xl"
                style={FIELD_STYLE}
              >
                <option value="complete">Complete weekly feed</option>
                <option value="partial">Partial feed</option>
                <option value="delayed">Delayed feed</option>
              </select>
              <label className="col-span-2 text-xs space-y-1">
                <span style={META}>Portal preset (optional)</span>
                <select
                  value={presetKey}
                  onChange={(e) => {
                    const next = e.target.value;
                    setPresetKey(next);
                    const preset = automation.presets.find((p) => p.key === next);
                    if (preset?.defaultBanner && !bannerName.trim()) {
                      setBannerName(preset.defaultBanner);
                    }
                  }}
                  className="w-full px-3 py-2 rounded-xl"
                  style={FIELD_STYLE}
                >
                  <option value="">Auto-detect headers</option>
                  {automation.presets.map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
              className="block w-full text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-base-300 file:text-xs file:font-semibold file:bg-base-200"
              style={{ color: "var(--spark-text)" }}
            />
            <textarea
              rows={4}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder="retailer,store_id,store_name,city,state,sku,week_start,units_sold,baseline_units"
              className="w-full p-2.5 rounded-xl text-xs mono"
              style={FIELD_STYLE}
            />
            <button
              type="submit"
              disabled={importing || !csvText.trim()}
              className="px-4 py-2 rounded-xl text-xs font-bold"
              style={PRIMARY_BTN_STYLE}
            >
              {importing ? "Importing POS…" : "Import Retailer POS"}
            </button>
          </form>

          <div className="space-y-4">
            <form
              className="spark-card p-5 space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (!crewVisitUuid || !crewProductId || !crewUnits) return;
                commitCrew({
                  variables: {
                    visitUuid: crewVisitUuid,
                    productId: Number(crewProductId),
                    unitsPurchased: Number(crewUnits),
                    purchaseDate: null,
                    retailerBanner: bannerName,
                    transactionRef: crewRef.trim(),
                  },
                  onCompleted: (r) => {
                    if (r.linkCrewPurchaseAdjustment.ok) {
                      setCrewUnits("");
                      setCrewRef("");
                      setFeedback(
                        "Linked crew purchase adjustment (subtracted from adjusted POS without mutating raw register units).",
                      );
                      bump();
                    } else {
                      setFeedback(
                        r.linkCrewPurchaseAdjustment.error ?? "Failed to link crew purchase.",
                      );
                    }
                  },
                });
              }}
            >
              <h2 className="display text-base font-bold">
                Link Demo Crew Product Purchase Adjustment
              </h2>
              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <select
                  value={crewVisitUuid}
                  onChange={(e) => setCrewVisitUuid(e.target.value)}
                  className="col-span-2 px-3 py-2 rounded-xl"
                  style={FIELD_STYLE}
                >
                  <option value="">Select visit…</option>
                  {visits.map((v) => (
                    <option key={v.uuid} value={v.uuid}>
                      {v.storeLabel} · {v.visitDate}
                    </option>
                  ))}
                </select>
                <select
                  value={crewProductId}
                  onChange={(e) => setCrewProductId(e.target.value)}
                  className="px-3 py-2 rounded-xl"
                  style={FIELD_STYLE}
                >
                  <option value="">Select SKU…</option>
                  {ws.products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  value={crewUnits}
                  onChange={(e) => setCrewUnits(e.target.value)}
                  placeholder="Units bought at register"
                  className="px-3 py-2 rounded-xl mono"
                  style={FIELD_STYLE}
                />
              </div>
              <button
                type="submit"
                disabled={linkingCrew}
                className="px-3 py-1.5 rounded-xl text-xs font-bold"
                style={PRIMARY_BTN_STYLE}
              >
                Link Crew Purchase
              </button>
            </form>

            <form
              className="spark-card p-4 flex flex-wrap items-center gap-2 text-xs"
              onSubmit={(e) => {
                e.preventDefault();
                if (!contribInput.trim()) return;
                commitContrib({
                  variables: { contributionPerUnit: contribInput.trim() },
                  onCompleted: (r) => {
                    if (r.setWorkspaceDefaultContribution.ok) {
                      setFeedback("Updated contribution margin per unit.");
                      bump();
                    }
                  },
                });
              }}
            >
              <span style={META}>Contribution Margin / Unit ($):</span>
              <input
                type="number"
                step="0.01"
                value={contribInput}
                onChange={(e) => setContribInput(e.target.value)}
                placeholder="2.40"
                className="w-28 px-3 py-1.5 rounded-xl mono"
                style={FIELD_STYLE}
              />
              <button
                type="submit"
                className="px-3 py-1.5 rounded-xl font-semibold"
                style={FIELD_STYLE}
              >
                Save Margin
              </button>
            </form>
          </div>
        </div>
      )}

      {ws.canManagePos && (
        <section className="spark-card p-5 space-y-4">
          <div>
            <h2 className="display text-base font-bold">
              Automated POS feed (email / webhook drop)
            </h2>
            <p className="text-xs mt-1" style={META}>
              Mint a token, POST weekly portal CSVs to the drop URL (or forward
              them via sync), and Spark imports through the same versioned
              matcher as manual upload. Hourly cron drains pending drops.
            </p>
          </div>
          <form
            className="grid grid-cols-1 md:grid-cols-4 gap-2.5 text-xs items-end"
            onSubmit={(e) => {
              e.preventDefault();
              if (!bannerName.trim()) return;
              commitFeed({
                variables: {
                  retailerBanner: bannerName.trim(),
                  presetKey: presetKey || "",
                  sourceKind: "email_drop",
                  enabled: true,
                  defaultFeedCompleteness: feedCompleteness,
                  notes: feedNotes.trim(),
                  remintToken: false,
                  feedUuid: null,
                },
                onCompleted: (r) => {
                  if (r.upsertPosFeedConfig.ok) {
                    setFeedback(
                      "Saved automated POS feed. Copy the drop URL below.",
                    );
                    bump();
                  } else {
                    setFeedback(
                      r.upsertPosFeedConfig.error ?? "Could not save feed.",
                    );
                  }
                },
              });
            }}
          >
            <label className="md:col-span-2 space-y-1">
              <span style={META}>Notes (optional)</span>
              <input
                value={feedNotes}
                onChange={(e) => setFeedNotes(e.target.value)}
                placeholder="e.g. UNFI Clearview Monday export"
                className="w-full px-3 py-2 rounded-xl"
                style={FIELD_STYLE}
              />
            </label>
            <button
              type="submit"
              disabled={savingFeed || !bannerName.trim()}
              className="px-4 py-2 rounded-xl text-xs font-bold"
              style={PRIMARY_BTN_STYLE}
            >
              {savingFeed ? "Saving…" : "Enable automated feed"}
            </button>
          </form>

          {automation.feeds.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr style={META}>
                    <th className="text-left py-2 pr-3 font-semibold">Banner</th>
                    <th className="text-left py-2 pr-3 font-semibold">Preset</th>
                    <th className="text-left py-2 pr-3 font-semibold">Drop URL</th>
                    <th className="text-left py-2 pr-3 font-semibold">Last ingest</th>
                    <th className="text-left py-2 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {automation.feeds.map((f) => (
                    <tr key={f.uuid} style={BORDER}>
                      <td className="py-2 pr-3 font-medium">{f.retailerBanner}</td>
                      <td className="py-2 pr-3 mono">{f.presetKey || "auto"}</td>
                      <td className="py-2 pr-3 mono break-all">
                        {f.dropUrlPath || "—"}
                      </td>
                      <td className="py-2 pr-3 mono">
                        {f.lastIngestedAt?.slice(0, 16) ?? "—"}
                      </td>
                      <td className="py-2">
                        {f.enabled ? "Enabled" : "Paused"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {automation.recentDrops.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider" style={META}>
                Recent automated drops
              </h3>
              <ul className="mt-2 space-y-1.5 text-xs">
                {automation.recentDrops.slice(0, 8).map((d) => (
                  <li key={d.uuid} className="flex flex-wrap gap-x-3 gap-y-1">
                    <span className="mono">{d.receivedAt.slice(0, 16)}</span>
                    <span className="font-medium">{d.retailerBanner}</span>
                    <span>{d.filename}</span>
                    <span
                      style={{
                        color:
                          d.status === "processed"
                            ? "var(--spark-ok-ink)"
                            : d.status === "failed"
                              ? "var(--spark-warn-badge-ink)"
                              : "var(--spark-text-meta)",
                      }}
                    >
                      {d.status}
                      {d.matchedRows != null
                        ? ` · ${d.matchedRows} matched / ${d.unmatchedRows ?? 0} unmatched`
                        : ""}
                    </span>
                    {d.errorMessage ? (
                      <span style={META}>{d.errorMessage}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {pos.imports.length > 0 && (
        <section className="spark-card p-5 space-y-3">
          <h2 className="display text-base font-bold">Import history</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={META}>
                  <th className="text-left py-2 pr-3 font-semibold">When</th>
                  <th className="text-left py-2 pr-3 font-semibold">Banner</th>
                  <th className="text-left py-2 pr-3 font-semibold">Period</th>
                  <th className="text-left py-2 pr-3 font-semibold">File</th>
                  <th className="text-right py-2 pr-3 font-semibold">Matched</th>
                  <th className="text-right py-2 font-semibold">Unmatched</th>
                </tr>
              </thead>
              <tbody>
                {pos.imports.map((imp) => (
                  <tr key={imp.uuid} style={BORDER}>
                    <td className="py-2 pr-3 mono">
                      {imp.createdAt.slice(0, 16)}
                    </td>
                    <td className="py-2 pr-3">
                      {imp.retailerBanner}
                      {imp.isActiveVersion ? "" : " (superseded)"}
                    </td>
                    <td className="py-2 pr-3 mono">
                      {imp.periodStart} → {imp.periodEnd}
                    </td>
                    <td className="py-2 pr-3">
                      {imp.filename} · v{imp.version} · {imp.feedCompleteness}
                    </td>
                    <td className="py-2 pr-3 text-right mono">
                      {imp.matchedRows}/{imp.totalRows}
                    </td>
                    <td className="py-2 text-right mono">{imp.unmatchedRows}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Unmatched POS Rows */}
      {pos.unmatchedRows.length > 0 && (
        <section className="spark-card p-5 space-y-3">
          <h2
            className="display text-base font-bold"
            style={{ color: "var(--spark-warn-badge-ink)" }}
          >
            Unmatched POS Store / SKU Rows ({pos.unmatchedRows.length})
          </h2>
          <div className="space-y-2 text-xs">
            {pos.unmatchedRows.map((ur) => (
              <div
                key={ur.uuid}
                className="p-3 rounded-xl flex flex-wrap items-center justify-between gap-2"
                style={BORDER}
              >
                <div>
                  <span className="font-semibold">
                    Row #{ur.rowNumber}: {ur.rawStoreName || ur.rawStoreId} ·{" "}
                    {ur.rawSku} ({ur.rawWeekStart})
                  </span>
                  <div style={META}>{ur.matchNote}</div>
                </div>
                {ws.canManagePos && (
                  <div className="flex flex-wrap gap-2">
                    <select
                      value={rowStoreMap[ur.uuid] ?? ""}
                      onChange={(e) =>
                        setRowStoreMap((p) => ({
                          ...p,
                          [ur.uuid]: e.target.value,
                        }))
                      }
                      className="px-2.5 py-1.5 rounded-lg"
                      style={FIELD_STYLE}
                    >
                      <option value="">Store…</option>
                      {ws.stores.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                    <select
                      value={rowProdMap[ur.uuid] ?? ""}
                      onChange={(e) =>
                        setRowProdMap((p) => ({
                          ...p,
                          [ur.uuid]: e.target.value,
                        }))
                      }
                      className="px-2.5 py-1.5 rounded-lg"
                      style={FIELD_STYLE}
                    >
                      <option value="">Product…</option>
                      {ws.products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        const sId = rowStoreMap[ur.uuid];
                        const pId = rowProdMap[ur.uuid];
                        commitResolve({
                          variables: {
                            rowUuid: ur.uuid,
                            retailerId: sId ? Number(sId) : null,
                            storeKey: null,
                            storeLabel: null,
                            productId: pId ? Number(pId) : null,
                            saveProductAlias: Boolean(pId),
                          },
                          onCompleted: () => bump(),
                        });
                      }}
                      className="px-3 py-1.5 rounded-lg font-bold"
                      style={PRIMARY_BTN_STYLE}
                    >
                      Resolve
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Store-Week Comparison Table */}
      {pos.storeWeeks.length > 0 && (
        <section className="spark-card p-5 space-y-3">
          <h2 className="display text-lg font-bold">
            Store-Week POS vs Rep-Observed Velocity (Deduplicated)
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr style={META}>
                  <th className="py-2 pr-3">Store</th>
                  <th className="py-2 pr-3">Week</th>
                  <th className="py-2 pr-3">Demos</th>
                  <th className="py-2 pr-3">Rep Observed</th>
                  <th className="py-2 pr-3">Raw POS</th>
                  <th className="py-2 pr-3">Adjusted POS</th>
                  <th className="py-2 pr-3">Lift Units</th>
                  <th className="py-2 text-right">ROI</th>
                </tr>
              </thead>
              <tbody>
                {pos.storeWeeks.map((sw) => (
                  <tr
                    key={`${sw.storeKey}:${sw.weekStart}`}
                    style={{ borderTop: "1px solid var(--spark-border)" }}
                  >
                    <td className="py-2.5 pr-3 font-semibold">{sw.storeLabel}</td>
                    <td className="py-2.5 pr-3 mono">{sw.weekStart}</td>
                    <td className="py-2.5 pr-3 mono">
                      {sw.demoCount}
                      {sw.sharedStoreWeek ? " (deduped)" : ""}
                    </td>
                    <td className="py-2.5 pr-3 mono">{sw.repObservedUnits}</td>
                    <td className="py-2.5 pr-3 mono">
                      {sw.registerUnits != null ? sw.registerUnits : "Missing"}
                    </td>
                    <td className="py-2.5 pr-3 mono font-semibold">
                      {sw.adjustedRegisterUnits != null
                        ? sw.adjustedRegisterUnits
                        : "Missing"}
                    </td>
                    <td className="py-2.5 pr-3 mono">
                      {sw.incrementalLiftUnits ?? "Withheld"}
                    </td>
                    <td className="py-2.5 text-right mono">
                      {sw.roi != null ? `${sw.roi}x` : "Withheld"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
};

export const RetailerPosPage: React.FC = () => {
  const [fetchKey, setFetchKey] = useState(0);
  return (
    <div className="space-y-5 max-w-7xl spark-scale">
      <div className="flex flex-wrap items-center gap-2">
        <SparkHubTabs tabs={REPORTS_HUB_TABS} ariaLabel="Analytics views" />
        <SparkHubTabs tabs={STORE_BUYER_SUBTABS} ariaLabel="Store & buyer views" />
      </div>
      <Suspense fallback={<p className="text-sm mono">Loading POS analytics…</p>}>
        <PosBody
          fetchKey={fetchKey}
          bump={() => setFetchKey((k) => k + 1)}
        />
      </Suspense>
    </div>
  );
};

export default RetailerPosPage;
