import { Suspense, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { ClockLinksQuery } from "@/api/queries/ClockLinksQuery";
import { ClockSessionsQuery } from "@/api/queries/ClockSessionsQuery";
import type { ClockLinksQuery as ClockLinksQueryType } from "@api/queries/__generated__/ClockLinksQuery.graphql";
import type { ClockSessionsQuery as ClockSessionsQueryType } from "@api/queries/__generated__/ClockSessionsQuery.graphql";
import { TenantsQuery } from "@api/queries/TenantsQuery";
import type { TenantsQuery as TenantsQueryType } from "@api/queries/__generated__/TenantsQuery.graphql";
import {
  CreateClockLinkMutation,
  DeleteClockSessionMutation,
  SyncClockSheetMutation,
  UpdateClockLinkMutation,
} from "@/api/mutations/ClockLinkMutations";
import type { ClockLinkMutationsCreateMutation as CreateType } from "@api/mutations/__generated__/ClockLinkMutationsCreateMutation.graphql";
import type { ClockLinkMutationsUpdateMutation as UpdateType } from "@api/mutations/__generated__/ClockLinkMutationsUpdateMutation.graphql";
import type { ClockLinkMutationsSyncMutation as SyncType } from "@api/mutations/__generated__/ClockLinkMutationsSyncMutation.graphql";
import type { ClockLinkMutationsDeleteSessionMutation as DeleteType } from "@api/mutations/__generated__/ClockLinkMutationsDeleteSessionMutation.graphql";
import { useAlertStore } from "@/store/alertStore";
import SparkConfirm from "@/shared/SparkConfirm";

/**
 * Clock links — generic public clock in/out pages (`/clock/<token>` on
 * client.) for a client's own staff. Each punch is name, email, market,
 * address + one GPS fix, stored in Spark and mirrored to a Google Sheet.
 */
type Link = ClockLinksQueryType["response"]["clockLinks"]["links"][number];
type Session = ClockSessionsQueryType["response"]["clockSessions"][number];
type SheetMode = "create" | "paste";

const DEFAULT_SHARE = "kyle@igniteproductions.co";

const muted = "rgba(255,255,255,0.5)";
const fieldStyle: CSSProperties = {
  background: "var(--spark-bg, #0d0f10)",
  border: "1px solid var(--spark-border)",
  color: "var(--spark-text)",
  borderRadius: 10,
  padding: "8px 10px",
  fontSize: 14,
  width: "100%",
};
const ghostBtn: CSSProperties = {
  background: "transparent",
  color: "var(--spark-text)",
  border: "1px solid var(--spark-border)",
};
const limeBtn: CSSProperties = { background: "var(--spark-lime)", color: "#0a0d09" };

const fmt = (iso: string | null | undefined, timeZone?: string): string => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  try {
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone,
      timeZoneName: timeZone ? "short" : undefined,
    });
  } catch {
    return d.toLocaleString();
  }
};

const duration = (minutes: number | null | undefined): string =>
  minutes == null ? "—" : `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;

function Kicker({ children }: { children: ReactNode }) {
  return (
    <p className="mono text-[10px] mb-1" style={{ letterSpacing: "0.18em", color: "rgba(255,255,255,0.45)" }}>
      {children}
    </p>
  );
}

function Pill({ tone, children }: { tone: "lime" | "orange" | "muted"; children: ReactNode }) {
  const colors = {
    lime: ["var(--spark-lime)", "rgba(242,243,238,0.1)", "rgba(242,243,238,0.3)"],
    orange: ["var(--spark-orange)", "rgba(239,90,42,0.12)", "rgba(239,90,42,0.35)"],
    muted: ["rgba(255,255,255,0.6)", "rgba(255,255,255,0.05)", "rgba(255,255,255,0.15)"],
  }[tone];
  return (
    <span
      className="mono text-[9px]"
      style={{
        letterSpacing: "0.14em",
        color: colors[0],
        background: colors[1],
        border: `1px solid ${colors[2]}`,
        padding: "1px 6px",
        borderRadius: 999,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function CreateClockLink({ serviceAccountEmail, onCreated }: { serviceAccountEmail: string; onCreated: () => void }) {
  const showAlert = useAlertStore((s) => s.showAlert);
  const tenants = useLazyLoadQuery<TenantsQueryType>(TenantsQuery, { first: 500 }, { fetchPolicy: "store-or-network" });
  const options = useMemo(
    () =>
      tenants.tenants.edges
        .map((e) => ({ value: e.node.id, label: e.node.name }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [tenants],
  );
  const [label, setLabel] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [mode, setMode] = useState<SheetMode>("paste");
  const [sheetUrl, setSheetUrl] = useState("");
  const [shareWith, setShareWith] = useState(DEFAULT_SHARE);
  const [commit, creating] = useMutation<CreateType>(CreateClockLinkMutation);

  const submit = () => {
    if (!label.trim()) {
      showAlert("Give the link a name.", "error");
      return;
    }
    commit({
      variables: {
        input: {
          label: label.trim(),
          tenantId: tenantId || null,
          sheetMode: mode,
          sheetUrl: mode === "paste" ? sheetUrl.trim() : null,
          shareWith:
            mode === "create"
              ? shareWith
                  .split(",")
                  .map((e) => e.trim())
                  .filter(Boolean)
              : null,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      },
      onCompleted: (resp, errors) => {
        if (errors?.length) {
          showAlert(errors[0].message, "error");
          return;
        }
        const r = resp.createClockLink;
        showAlert(r.message, r.message.includes("no Sheet") || r.message.includes("failed") ? "error" : "success");
        setLabel("");
        setSheetUrl("");
        onCreated();
      },
      onError: (e) => showAlert(e.message, "error"),
    });
  };

  return (
    <div className="spark-card p-4 mb-5" style={{ borderRadius: 16 }}>
      <Kicker>NEW CLOCK LINK</Kicker>
      <p className="text-xs mb-3" style={{ color: muted }}>
        A public clock in/out page for any crew — workers enter name, email, market, and work address; each punch saves
        one GPS fix and lands in a Google Sheet.
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-[11px]" style={{ color: muted }}>
          NAME
          <input
            style={fieldStyle}
            value={label}
            maxLength={120}
            placeholder="e.g. Acme — Phoenix crew"
            onChange={(e) => setLabel(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-[11px]" style={{ color: muted }}>
          CLIENT (OPTIONAL — BRANDS THE PAGE)
          <select style={fieldStyle} value={tenantId} onChange={(e) => setTenantId(e.target.value)}>
            <option value="">No client · Spark branding</option>
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex items-center gap-4 mt-3 text-sm flex-wrap">
        {(
          [
            ["paste", "Use my own Sheet"],
            ["create", "Have Spark create one (Google often blocks this)"],
          ] as const
        ).map(([id, text]) => (
          <label key={id} className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="clock-sheet-mode"
              checked={mode === id}
              onChange={() => setMode(id)}
              style={{ accentColor: "var(--spark-lime)" }}
            />
            {text}
          </label>
        ))}
      </div>
      {mode === "create" ? (
        <label className="flex flex-col gap-1 text-[11px] mt-3" style={{ color: muted }}>
          SHARE THE NEW SHEET WITH (EDITOR, COMMA-SEPARATED)
          <input style={fieldStyle} value={shareWith} onChange={(e) => setShareWith(e.target.value)} />
        </label>
      ) : (
        <label className="flex flex-col gap-1 text-[11px] mt-3" style={{ color: muted }}>
          GOOGLE SHEET LINK — MAKE A BLANK SHEET, SHARE IT WITH{" "}
          <span className="mono" style={{ color: "var(--spark-lime)", textTransform: "none" }}>
            {serviceAccountEmail}
          </span>{" "}
          AS EDITOR, PASTE ITS LINK
          <input
            style={fieldStyle}
            value={sheetUrl}
            placeholder="https://docs.google.com/spreadsheets/d/…"
            onChange={(e) => setSheetUrl(e.target.value)}
          />
        </label>
      )}
      <div className="flex justify-end mt-4">
        <button
          type="button"
          onClick={submit}
          disabled={creating}
          className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
          style={limeBtn}
        >
          {creating ? "Creating…" : "Create clock link"}
        </button>
      </div>
    </div>
  );
}

function SessionsTable({ linkId, refreshKey, onChanged }: { linkId: string; refreshKey: number; onChanged: () => void }) {
  const showAlert = useAlertStore((s) => s.showAlert);
  const data = useLazyLoadQuery<ClockSessionsQueryType>(
    ClockSessionsQuery,
    { linkId, limit: 100 },
    { fetchKey: refreshKey, fetchPolicy: "store-and-network" },
  );
  const [commitDelete, deleting] = useMutation<DeleteType>(DeleteClockSessionMutation);
  const [pending, setPending] = useState<Session | null>(null);
  const rows = data.clockSessions;

  if (rows.length === 0) {
    return (
      <p className="text-sm py-4 text-center" style={{ color: muted }}>
        No punches yet.
      </p>
    );
  }

  const gpsCell = (url: string | null | undefined, status: string | null | undefined, accuracy: number | null | undefined) =>
    url ? (
      <a href={url} target="_blank" rel="noreferrer" style={{ color: "var(--spark-lime)" }}>
        Map{accuracy != null ? ` ±${Math.round(accuracy)}m` : ""}
      </a>
    ) : status ? (
      <span style={{ color: "var(--spark-orange)" }}>GPS {status}</span>
    ) : (
      "—"
    );

  return (
    <div className="overflow-x-auto mt-3">
      <table className="w-full text-[12px]" style={{ borderCollapse: "collapse", minWidth: 900 }}>
        <thead>
          <tr className="mono text-[9px]" style={{ color: "rgba(255,255,255,0.45)", letterSpacing: "0.12em" }}>
            {["NAME", "MARKET · ADDRESS", "IN", "OUT", "HRS", "GPS IN", "GPS OUT", "SHEET", ""].map((h) => (
              <th key={h} className="text-left font-normal py-2 pr-3">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.id} style={{ borderTop: "1px solid var(--spark-border)" }}>
              <td className="py-2 pr-3 align-top">
                <div className="font-semibold">
                  {s.firstName} {s.lastName}
                </div>
                <div style={{ color: muted }}>{s.email}</div>
              </td>
              <td className="py-2 pr-3 align-top" style={{ minWidth: 190, maxWidth: 260 }}>
                <div>{s.market}</div>
                <div style={{ color: muted }}>{s.address}</div>
              </td>
              <td className="py-2 pr-3 align-top whitespace-nowrap">{fmt(s.clockInAt, s.timezone)}</td>
              <td className="py-2 pr-3 align-top whitespace-nowrap">
                {s.clockOutAt ? fmt(s.clockOutAt, s.timezone) : <Pill tone="lime">ON THE CLOCK</Pill>}
              </td>
              <td className="py-2 pr-3 align-top mono">{duration(s.durationMinutes)}</td>
              <td className="py-2 pr-3 align-top whitespace-nowrap">
                {gpsCell(s.clockInMapUrl, s.clockInGps, s.clockInAccuracyM)}
              </td>
              <td className="py-2 pr-3 align-top whitespace-nowrap">
                {s.clockOutAt ? gpsCell(s.clockOutMapUrl, s.clockOutGps, s.clockOutAccuracyM) : "—"}
              </td>
              <td className="py-2 pr-3 align-top" title={s.sheetError ?? undefined}>
                {s.sheetSynced ? (
                  <span style={{ color: "var(--spark-lime)" }}>✓</span>
                ) : (
                  <span style={{ color: "var(--spark-orange)" }}>{s.sheetError ? "error" : "pending"}</span>
                )}
              </td>
              <td className="py-2 align-top text-right whitespace-nowrap">
                <button
                  type="button"
                  className="text-[11px] underline"
                  style={{ color: muted }}
                  onClick={() => setPending(s)}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {pending ? (
        <SparkConfirm
          tone="danger"
          kicker="Delete punch"
          title={`Delete ${pending.firstName} ${pending.lastName}'s punch`}
          body="Removes it from Spark and deletes its row from the Google Sheet. Use this for test or mistaken punches."
          confirmLabel="Delete"
          busy={deleting}
          onCancel={() => {
            if (!deleting) setPending(null);
          }}
          onConfirm={() =>
            commitDelete({
              variables: { input: { sessionId: pending.id } },
              onCompleted: (resp, errors) => {
                setPending(null);
                if (errors?.length) {
                  showAlert(errors[0].message, "error");
                  return;
                }
                showAlert(resp.deleteClockSession.message, "success");
                onChanged();
              },
              onError: (e) => {
                setPending(null);
                showAlert(e.message, "error");
              },
            })
          }
        />
      ) : null}
    </div>
  );
}

function LinkCard({ link, serviceAccountEmail, bump, refreshKey }: { link: Link; serviceAccountEmail: string; bump: () => void; refreshKey: number }) {
  const showAlert = useAlertStore((s) => s.showAlert);
  const [open, setOpen] = useState(false);
  const [pasteUrl, setPasteUrl] = useState("");
  const [commitUpdate, updating] = useMutation<UpdateType>(UpdateClockLinkMutation);
  const [commitSync, syncing] = useMutation<SyncType>(SyncClockSheetMutation);

  const update = (input: { isActive?: boolean; sheetUrl?: string }) =>
    commitUpdate({
      variables: { input: { linkId: link.id, ...input } },
      onCompleted: (resp, errors) => {
        if (errors?.length) {
          showAlert(errors[0].message, "error");
          return;
        }
        showAlert(resp.updateClockLink.message, "success");
        setPasteUrl("");
        bump();
      },
      onError: (e) => showAlert(e.message, "error"),
    });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link.url);
      showAlert("Clock link copied.", "success");
    } catch {
      showAlert("Couldn't copy — select the link and copy it.", "error");
    }
  };

  return (
    <div className="spark-card p-4" style={{ borderRadius: 16, opacity: link.isActive ? 1 : 0.7 }}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-base font-semibold">{link.label}</span>
            {link.tenantName ? <Pill tone="muted">{link.tenantName.toUpperCase()}</Pill> : null}
            {link.isActive ? <Pill tone="lime">ACTIVE</Pill> : <Pill tone="orange">OFF</Pill>}
            {link.openCount > 0 ? <Pill tone="lime">{link.openCount} ON THE CLOCK</Pill> : null}
          </div>
          <p className="mono text-[11px] mt-1 break-all" style={{ color: "rgba(255,255,255,0.6)" }}>
            {link.url}
          </p>
          <p className="mono text-[10px] mt-1" style={{ color: "rgba(255,255,255,0.45)", letterSpacing: "0.06em" }}>
            {link.sessionCount} punch{link.sessionCount === 1 ? "" : "es"} · last {fmt(link.lastClockAt)}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button type="button" onClick={copy} className="px-3 py-2 rounded-xl text-sm font-semibold" style={limeBtn}>
            Copy link
          </button>
          <a href={link.url} target="_blank" rel="noreferrer" className="px-3 py-2 rounded-xl text-sm font-semibold" style={ghostBtn}>
            Open page
          </a>
          {link.sheetUrl ? (
            <a href={link.sheetUrl} target="_blank" rel="noreferrer" className="px-3 py-2 rounded-xl text-sm font-semibold" style={ghostBtn}>
              Open sheet
            </a>
          ) : null}
          <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: muted }}>
            <input
              type="checkbox"
              checked={link.isActive}
              disabled={updating}
              onChange={(e) => update({ isActive: e.target.checked })}
              style={{ width: 16, height: 16, accentColor: "var(--spark-lime)" }}
            />
            Active
          </label>
        </div>
      </div>

      {link.sheetUrl && link.syncPending > 0 ? (
        <div className="flex items-center justify-between gap-3 mt-3 text-[12px] flex-wrap" style={{ color: "var(--spark-orange)" }}>
          <span>
            {link.syncPending} punch{link.syncPending === 1 ? "" : "es"} not in the Sheet yet
            {link.syncError ? ` — ${link.syncError}` : " (retrying automatically)"}
          </span>
          <button
            type="button"
            disabled={syncing}
            className="px-3 py-1.5 rounded-xl text-[12px] font-semibold disabled:opacity-50"
            style={ghostBtn}
            onClick={() =>
              commitSync({
                variables: { input: { linkId: link.id } },
                onCompleted: (resp, errors) => {
                  if (errors?.length) {
                    showAlert(errors[0].message, "error");
                    return;
                  }
                  showAlert(resp.syncClockSheet.message, resp.syncClockSheet.success ? "success" : "error");
                  bump();
                },
                onError: (e) => showAlert(e.message, "error"),
              })
            }
          >
            {syncing ? "Syncing…" : "Sync now"}
          </button>
        </div>
      ) : null}

      {!link.sheetUrl ? (
        <div className="mt-3">
          <p className="text-[12px] mb-2" style={{ color: "var(--spark-orange)" }}>
            No Google Sheet yet — punches are saved in Spark. Share a Sheet with{" "}
            <span className="mono">{serviceAccountEmail}</span> (Editor) and paste it here.
          </p>
          <div className="flex gap-2">
            <input
              style={fieldStyle}
              value={pasteUrl}
              placeholder="https://docs.google.com/spreadsheets/d/…"
              onChange={(e) => setPasteUrl(e.target.value)}
            />
            <button
              type="button"
              disabled={updating || !pasteUrl.trim()}
              className="px-3 py-2 rounded-xl text-sm font-semibold disabled:opacity-50 whitespace-nowrap"
              style={limeBtn}
              onClick={() => update({ sheetUrl: pasteUrl.trim() })}
            >
              Connect
            </button>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mt-3 text-[12px] font-semibold"
        style={{ color: "var(--spark-text)" }}
      >
        {open ? "▾ Hide punches" : `▸ Recent punches (${link.sessionCount})`}
      </button>
      {open ? (
        <Suspense fallback={<p className="text-sm py-3" style={{ color: muted }}>Loading punches…</p>}>
          <SessionsTable linkId={link.id} refreshKey={refreshKey} onChanged={bump} />
        </Suspense>
      ) : null}
    </div>
  );
}

function Inner({ refreshKey, bump }: { refreshKey: number; bump: () => void }) {
  const data = useLazyLoadQuery<ClockLinksQueryType>(
    ClockLinksQuery,
    {},
    { fetchKey: refreshKey, fetchPolicy: "store-and-network" },
  );
  const payload = data.clockLinks;
  if (!payload.available) {
    return (
      <p className="p-8 text-center text-sm" style={{ color: muted }}>
        Clock links are Ignite staff only.
      </p>
    );
  }
  const sa = payload.serviceAccountEmail ?? "the Spark service account";
  return (
    <>
      <CreateClockLink serviceAccountEmail={sa} onCreated={bump} />
      {payload.links.length === 0 ? (
        <p className="p-8 text-center text-sm" style={{ color: muted }}>
          No clock links yet.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {payload.links.map((link) => (
            <LinkCard key={link.id} link={link} serviceAccountEmail={sa} bump={bump} refreshKey={refreshKey} />
          ))}
        </div>
      )}
    </>
  );
}

export default function ClockLinks() {
  const [refreshKey, setRefreshKey] = useState(0);
  const bump = () => setRefreshKey((k) => k + 1);
  return (
    <Suspense
      fallback={
        <p className="p-8 text-center text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>
          Loading clock links…
        </p>
      }
    >
      <Inner refreshKey={refreshKey} bump={bump} />
    </Suspense>
  );
}
