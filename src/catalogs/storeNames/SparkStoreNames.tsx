import { useCallback, useEffect, useRef, useState } from "react";
import Layout from "@/layout/Layout";
import SparkPageHeader from "@/shared/SparkPageHeader";
import { useAuthStore } from "@/store/authStore";
import { useAlertStore } from "@/store/alertStore";
import {
  acceptBlocker,
  acceptSummary,
  chosenAliases,
  kindLabel,
  plural,
  sourceLabel,
  type StoreNameAccepted,
  type StoreNameGroup,
} from "./storeNames";
import {
  checkStoreNames,
  decideStoreNameGroup,
  fetchStoreNameSuggestions,
  undoStoreNameAlias,
  type StoreNameSuggestions,
} from "./storeNamesApi";

/**
 * Store names — staff only (route is wrapped in AdminOnly, and the server
 * refuses brand users).
 *
 * The same store gets typed several ways ("HEB", "H-E-B"), and the store
 * charts count each spelling separately. This page lists names that look
 * like the same store; accepting a group makes reports show them under one
 * name. Nothing else changes: no retailer, request or event is edited, and
 * an accepted name can be shown on its own again.
 */

const meta = { color: "var(--spark-text-meta)" } as const;
const secondary = { color: "var(--spark-text-secondary)" } as const;

function GroupCard({
  group,
  maxGroupSize,
  busy,
  onAccept,
  onDismiss,
}: {
  group: StoreNameGroup;
  maxGroupSize: number;
  busy: boolean;
  onAccept: (keepName: string, aliasUuids: string[]) => void;
  onDismiss: () => void;
}) {
  const [keepName, setKeepName] = useState(group.canonicalName);
  const [unticked, setUnticked] = useState<Set<string>>(new Set());
  const blocker = acceptBlocker(group, unticked, keepName, maxGroupSize);
  const inputId = `keep-${group.groupKey}`;

  const toggle = (uuid: string) =>
    setUnticked((prev) => {
      const next = new Set(prev);
      if (next.has(uuid)) next.delete(uuid);
      else next.add(uuid);
      return next;
    });

  return (
    <li className="spark-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="chip chip-muted">{kindLabel(group.kind)}</span>
        <p className="text-xs" style={meta}>
          {group.source === "ai" && group.reason ? group.reason : sourceLabel(group.source)}
        </p>
      </div>

      <div className="mt-3 grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <p className="text-xs mb-1.5" style={meta}>
            Written as
          </p>
          <ul className="space-y-1.5">
            {group.names.map((alias) => (
              <li key={alias.uuid}>
                <label className="flex items-start gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={!unticked.has(alias.uuid)}
                    onChange={() => toggle(alias.uuid)}
                    disabled={busy}
                  />
                  <span className="min-w-0">
                    <span className="font-medium break-words">{alias.name}</span>
                    <span className="block text-xs" style={meta}>
                      {plural(alias.records, "record")}
                      {alias.places ? ` · ${alias.places}` : ""}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <label htmlFor={inputId} className="text-xs block mb-1.5" style={meta}>
            Show them all as
          </label>
          <input
            id={inputId}
            className="spark-input w-full rounded-lg px-3 py-2 text-sm"
            value={keepName}
            onChange={(e) => setKeepName(e.target.value)}
            disabled={busy}
            maxLength={255}
          />
          <p className="text-xs mt-1.5" style={meta}>
            {plural(group.canonicalRecords, "record")} already use “{group.canonicalName}”.
          </p>
        </div>
      </div>

      <p className="text-sm mt-4" style={secondary}>
        {blocker ?? acceptSummary(group, unticked, keepName)}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="spark-btn-primary"
          disabled={busy || blocker !== null}
          onClick={() =>
            onAccept(
              keepName.trim(),
              chosenAliases(group, unticked).map((n) => n.uuid),
            )
          }
        >
          Accept
        </button>
        <button
          type="button"
          className="spark-btn-ghost"
          disabled={busy}
          onClick={onDismiss}
        >
          Not the same store
        </button>
      </div>
    </li>
  );
}

function AcceptedList({
  rows,
  busy,
  onUndo,
}: {
  rows: StoreNameAccepted[];
  busy: boolean;
  onUndo: (row: StoreNameAccepted) => void;
}) {
  if (rows.length === 0) return null;
  return (
    <section className="spark-card overflow-hidden">
      <div className="px-4 sm:px-5 py-3" style={{ borderBottom: "1px solid var(--spark-border)" }}>
        <h2 className="font-semibold text-sm">Combined names</h2>
        <p className="text-xs mt-0.5" style={meta}>
          Reports show the name on the left under the name on the right.
        </p>
      </div>
      <ul>
        {rows.map((row) => (
          <li
            key={row.uuid}
            className="px-4 sm:px-5 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm"
            style={{ borderBottom: "1px solid var(--spark-border)" }}
          >
            <span className="min-w-0 flex-1 break-words">
              <span className="font-medium">{row.name}</span>
              <span style={meta}> shown as </span>
              <span className="font-medium">{row.canonicalName}</span>
              <span className="text-xs" style={meta}>
                {" "}
                · {plural(row.records, "record")}
              </span>
            </span>
            <button
              type="button"
              className="spark-btn-ghost !px-2 !py-1 text-xs"
              disabled={busy}
              onClick={() => onUndo(row)}
            >
              Show separately
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function SparkStoreNamesContent() {
  const { tenantId } = useAuthStore();
  const showAlert = useAlertStore((s) => s.showAlert);
  const [data, setData] = useState<StoreNameSuggestions | null>(null);
  const [status, setStatus] = useState<"off" | "loading" | "ready" | "error">("off");
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [note, setNote] = useState("");
  // Bumped when the client changes, so a slow answer for the previous
  // client never lands on the new one's page.
  const run = useRef(0);

  const load = useCallback(async (tid: string) => {
    const mine = run.current;
    try {
      const next = await fetchStoreNameSuggestions(tid);
      if (run.current !== mine) return;
      setData(next);
      setStatus("ready");
    } catch {
      if (run.current === mine) setStatus("error");
    }
  }, []);

  useEffect(() => {
    run.current += 1;
    setData(null);
    setNote("");
    if (!tenantId) {
      setStatus("off");
      return;
    }
    setStatus("loading");
    void load(tenantId);
  }, [tenantId, load]);

  const check = async () => {
    if (!tenantId) return;
    setChecking(true);
    setNote("");
    try {
      const result = await checkStoreNames(tenantId);
      if (!result.ok) {
        showAlert(result.message || "Could not check store names.", "error");
      } else {
        setNote(
          result.groupsFound > 0
            ? `Checked ${plural(result.namesChecked, "store name")}.`
            : `Checked ${plural(result.namesChecked, "store name")}. ${result.message}`,
        );
        await load(tenantId);
      }
    } catch (e) {
      showAlert(`Could not check store names: ${(e as Error).message}`, "error");
    } finally {
      setChecking(false);
    }
  };

  const decide = async (
    group: StoreNameGroup,
    action: "accept" | "dismiss",
    keepName?: string,
    aliasUuids?: string[],
  ) => {
    if (!tenantId) return;
    setBusy(true);
    try {
      const result = await decideStoreNameGroup({
        tenantId,
        groupKey: group.groupKey,
        action,
        canonicalName: action === "accept" ? keepName : undefined,
        aliasUuids: action === "accept" ? aliasUuids : undefined,
      });
      if (!result.ok) {
        showAlert(result.message || "That could not be saved.", "warning");
      } else if (action === "accept") {
        showAlert(
          `${plural(result.affectedRecords, "record")} now shown as “${keepName || group.canonicalName}”.`,
          "success",
        );
      }
      await load(tenantId);
    } catch (e) {
      showAlert(`That could not be saved: ${(e as Error).message}`, "error");
    } finally {
      setBusy(false);
    }
  };

  const undo = async (row: StoreNameAccepted) => {
    if (!tenantId) return;
    setBusy(true);
    try {
      const result = await undoStoreNameAlias(tenantId, row.uuid);
      if (!result.ok) showAlert(result.message || "That could not be undone.", "warning");
      await load(tenantId);
    } catch (e) {
      showAlert(`That could not be undone: ${(e as Error).message}`, "error");
    } finally {
      setBusy(false);
    }
  };

  const groups = data?.groups ?? [];

  return (
    <div className="space-y-5 max-w-4xl spark-fade-in spark-scale">
      <SparkPageHeader
        title="Store names"
        support="The same store typed different ways is counted as different stores in reports. Combine the spellings here."
        action={
          tenantId ? (
            <button
              type="button"
              className="spark-btn-ghost"
              onClick={check}
              disabled={checking || busy}
            >
              {checking ? "Checking…" : "Check store names"}
            </button>
          ) : null
        }
      />

      {status === "off" && (
        <p className="spark-card p-6 text-sm" style={meta}>
          Choose a client to see its store names.
        </p>
      )}
      {status === "loading" && (
        <p className="spark-card p-6 text-sm" style={meta}>
          Loading store names…
        </p>
      )}
      {status === "error" && (
        <div className="spark-card p-6 flex flex-wrap items-center gap-3">
          <p className="text-sm" style={secondary}>
            Store names could not be loaded.
          </p>
          <button
            type="button"
            className="spark-btn-ghost"
            onClick={() => {
              if (!tenantId) return;
              setStatus("loading");
              void load(tenantId);
            }}
          >
            Try again
          </button>
        </div>
      )}

      {note && (
        <p role="status" className="text-sm" style={secondary}>
          {note}
        </p>
      )}

      {status === "ready" && (
        <>
          <section className="space-y-3">
            <div>
              <h2 className="font-semibold">These look like the same store</h2>
              <p className="text-sm mt-0.5" style={meta}>
                {groups.length > 0
                  ? "Accepting changes the name shown in reports only. Requests, events and retailers stay as they were typed, and you can separate names again below."
                  : "Nothing is waiting. Use Check store names after new requests or recaps come in."}
              </p>
            </div>
            {groups.length > 0 && (
              <ul className="space-y-3">
                {groups.map((group) => (
                  <GroupCard
                    key={group.groupKey}
                    group={group}
                    maxGroupSize={data?.maxGroupSize ?? 8}
                    busy={busy}
                    onAccept={(keepName, aliasUuids) =>
                      void decide(group, "accept", keepName, aliasUuids)
                    }
                    onDismiss={() => void decide(group, "dismiss")}
                  />
                ))}
              </ul>
            )}
          </section>

          <AcceptedList rows={data?.accepted ?? []} busy={busy} onUndo={(row) => void undo(row)} />
        </>
      )}
    </div>
  );
}

export default function SparkStoreNames() {
  return (
    <Layout>
      <SparkStoreNamesContent />
    </Layout>
  );
}
