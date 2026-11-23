import {
  Fragment,
  Suspense,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import { graphql } from "react-relay";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { TenantCheckinCodeQuery } from "@/api/queries/TenantCheckinCodeQuery";
import type { TenantCheckinCodeQuery as TenantCheckinCodeQueryType } from "@api/queries/__generated__/TenantCheckinCodeQuery.graphql";
import type { StandingCheckinStudioSaveMutation as SaveType } from "./__generated__/StandingCheckinStudioSaveMutation.graphql";
import type { StandingCheckinStudioEventTypesQuery as EventTypesQueryType } from "./__generated__/StandingCheckinStudioEventTypesQuery.graphql";
import { useAuthStore } from "@/store/authStore";
import { useAlertStore } from "@/store/alertStore";
import { checkinUrl } from "@/utils/publicHosts";
import IssueCheckinLinkButton from "@/components/dashboard/IssueCheckinLinkButton";
import CheckinQr from "./CheckinQr";
import {
  bucketsToPayload,
  emptyBucket,
  emptyResource,
  normalizeBucketsFromConfig,
  programIdsForSave,
  resourcesFromApi,
  resourcesToInput,
  type BucketMode,
  type StudioBucket,
  type StudioResource,
} from "./standingCheckinStudio";

const SaveMutation = graphql`
  mutation StandingCheckinStudioSaveMutation($input: UpdateStandingCheckinConfigInput!) {
    updateStandingCheckinConfig(input: $input) {
      success
      message
      checkinCode
      locationMode
      photoBuckets
      changedFields
      resources {
        label
        kind
        url
        note
      }
      programs {
        id
        name
        isDefault
      }
    }
  }
`;

const EventTypesQuery = graphql`
  query StandingCheckinStudioEventTypesQuery($tenantId: ID!) {
    eventTypes(first: 200, filters: { tenantId: $tenantId }) {
      edges {
        node {
          id
          name
        }
      }
    }
  }
`;

type TenantNode = NonNullable<
  NonNullable<
    NonNullable<TenantCheckinCodeQueryType["response"]["tenants"]>["edges"]
  >[number]
>["node"];

const fieldStyle: CSSProperties = {
  width: "100%",
  background: "var(--spark-surface)",
  color: "var(--spark-text)",
  border: "1px solid var(--spark-border)",
  borderRadius: 10,
  padding: "8px 10px",
  fontSize: 13,
};

const labelMeta: CSSProperties = {
  letterSpacing: "0.14em",
  color: "var(--spark-text-meta)",
  fontSize: 10,
  marginBottom: 6,
};

function BucketEditor({
  rows,
  onChange,
}: {
  rows: StudioBucket[];
  onChange: (next: StudioBucket[]) => void;
}) {
  return (
    <div className="space-y-2">
      {rows.map((row, idx) => (
        <div key={idx} className="grid gap-2 md:grid-cols-[1.4fr_1.2fr_0.5fr_auto]">
          <input
            value={row.name}
            placeholder="Bucket name"
            style={fieldStyle}
            onChange={(e) => {
              const next = rows.slice();
              next[idx] = { ...row, name: e.target.value };
              onChange(next);
            }}
          />
          <input
            value={row.helper}
            placeholder="Helper (optional)"
            style={fieldStyle}
            onChange={(e) => {
              const next = rows.slice();
              next[idx] = { ...row, helper: e.target.value };
              onChange(next);
            }}
          />
          <input
            value={row.min}
            placeholder="Min"
            inputMode="numeric"
            style={fieldStyle}
            onChange={(e) => {
              const next = rows.slice();
              next[idx] = { ...row, min: e.target.value };
              onChange(next);
            }}
          />
          <button
            type="button"
            className="text-xs px-2"
            style={{ color: "var(--spark-text-meta)", background: "transparent", border: "none" }}
            onClick={() => onChange(rows.filter((_, i) => i !== idx))}
            disabled={rows.length <= 1}
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        className="text-xs font-semibold"
        style={{ color: "var(--spark-text)", background: "transparent", border: "none" }}
        onClick={() => onChange([...rows, emptyBucket()])}
      >
        + Add bucket
      </button>
    </div>
  );
}

function StudioEditor({
  tenant,
  onSaved,
}: {
  tenant: NonNullable<TenantNode>;
  onSaved: () => void;
}) {
  const showAlert = useAlertStore((s) => s.showAlert);
  const [commit, busy] = useMutation<SaveType>(SaveMutation);
  const eventData = useLazyLoadQuery<EventTypesQueryType>(
    EventTypesQuery,
    { tenantId: tenant.id },
    { fetchPolicy: "store-or-network" },
  );
  const allPrograms = (eventData.eventTypes?.edges ?? [])
    .map((e) => e?.node)
    .filter((n): n is NonNullable<typeof n> => Boolean(n));

  const initialBuckets = useMemo(
    () => normalizeBucketsFromConfig(tenant.checkinPhotoBucketsConfig),
    [tenant.checkinPhotoBucketsConfig],
  );
  const [locationMode, setLocationMode] = useState(
    (tenant.checkinLocationMode || "address") as "address" | "market",
  );
  const [bucketMode, setBucketMode] = useState<BucketMode>(initialBuckets.mode);
  const [flatBuckets, setFlatBuckets] = useState<StudioBucket[]>(initialBuckets.flat);
  const [byProgram, setByProgram] = useState(initialBuckets.byProgram);
  const [resources, setResources] = useState<StudioResource[]>(
    resourcesFromApi(tenant.checkinResources),
  );
  const pinnedPrograms = tenant.checkinPrograms ?? [];
  const [selectedProgramIds, setSelectedProgramIds] = useState<string[]>(
    pinnedPrograms.map((p) => p.id),
  );
  const [defaultProgramId, setDefaultProgramId] = useState<string | null>(
    pinnedPrograms.find((p) => p.isDefault)?.id ?? pinnedPrograms[0]?.id ?? null,
  );

  useEffect(() => {
    const next = normalizeBucketsFromConfig(tenant.checkinPhotoBucketsConfig);
    setLocationMode((tenant.checkinLocationMode || "address") as "address" | "market");
    setBucketMode(next.mode);
    setFlatBuckets(next.flat);
    setByProgram(next.byProgram);
    setResources(resourcesFromApi(tenant.checkinResources));
    const programs = tenant.checkinPrograms ?? [];
    setSelectedProgramIds(programs.map((p) => p.id));
    setDefaultProgramId(programs.find((p) => p.isDefault)?.id ?? programs[0]?.id ?? null);
  }, [tenant]);

  // Ensure by-program keys exist for selected program names.
  useEffect(() => {
    if (bucketMode !== "byProgram") return;
    setByProgram((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const id of selectedProgramIds) {
        const name = allPrograms.find((p) => p.id === id)?.name;
        if (!name) continue;
        if (!next[name]) {
          next[name] = [emptyBucket()];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [bucketMode, selectedProgramIds, allPrograms]);

  const code = (tenant.checkinCode ?? "").trim();
  const url = code ? checkinUrl(code) : "";

  const save = () => {
    if (busy) return;
    const eventTypeIds = programIdsForSave(selectedProgramIds, defaultProgramId);
    const photoBuckets = bucketsToPayload(bucketMode, flatBuckets, byProgram);
    const resourceRows = resourcesToInput(resources);
    commit({
      variables: {
        input: {
          tenantId: tenant.id,
          locationMode,
          photoBuckets,
          resources: resourceRows,
          clearResources: resourceRows.length === 0,
          eventTypeIds: eventTypeIds.length ? eventTypeIds : null,
        },
      },
      onCompleted: (res) => {
        const r = res.updateStandingCheckinConfig;
        if (!r?.success) {
          showAlert(r?.message || "Couldn't save standing check-in.", "error");
          return;
        }
        showAlert(r.message || "Standing check-in updated.", "success");
        onSaved();
      },
      onError: () => showAlert("Couldn't save standing check-in.", "error"),
    });
  };

  return (
    <div className="spark-card p-4 space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="mono" style={labelMeta}>
            STANDING CHECK-IN STUDIO
          </p>
          <p className="text-sm font-semibold mb-1">
            {tenant.name} · configure once, share forever
          </p>
          <p className="text-xs" style={{ color: "var(--spark-text-meta)" }}>
            Edit programs, photo buckets, BA PDFs, and location mode. The live
            check-in code never changes once issued.
          </p>
        </div>
        {code ? (
          <div className="text-right">
            <p className="mono text-xs" style={{ color: "var(--spark-text-secondary)" }}>
              {code}
            </p>
            <p className="text-[11px] mt-1" style={{ color: "var(--spark-text-meta)" }}>
              Immutable · do not remint
            </p>
          </div>
        ) : (
          <IssueCheckinLinkButton tenantId={tenant.id} onIssued={onSaved} />
        )}
      </div>

      {code ? (
        <div
          className="pt-3"
          style={{ borderTop: "1px solid var(--spark-border)" }}
        >
          <CheckinQr url={url} downloadName={`${code}-checkin-qr.png`} />
          <p className="mono text-xs mt-3 break-all" style={{ color: "var(--spark-text-secondary)" }}>
            {url}
          </p>
        </div>
      ) : null}

      <section>
        <p className="mono" style={labelMeta}>
          LOCATION MODE
        </p>
        <div className="flex gap-2">
          {(
            [
              ["address", "Store address"],
              ["market", "Market picker"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setLocationMode(value)}
              className="px-3 py-2 rounded-xl text-xs font-semibold"
              style={{
                background:
                  locationMode === value ? "var(--spark-selected-bg)" : "transparent",
                color:
                  locationMode === value
                    ? "var(--spark-selected-ink)"
                    : "var(--spark-text)",
                border:
                  locationMode === value ? "none" : "1px solid var(--spark-border)",
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <section>
        <p className="mono" style={labelMeta}>
          PROGRAMS
        </p>
        {allPrograms.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--spark-text-meta)" }}>
            No event types on this brand yet. Add programs under Clients / Forms
            first.
          </p>
        ) : (
          <ul className="space-y-2">
            {allPrograms.map((p) => {
              const checked = selectedProgramIds.includes(p.id);
              return (
                <li key={p.id} className="flex items-center gap-3 flex-wrap">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        setSelectedProgramIds((prev) => {
                          const next = checked
                            ? prev.filter((id) => id !== p.id)
                            : [...prev, p.id];
                          if (defaultProgramId === p.id && checked) {
                            setDefaultProgramId(next[0] ?? null);
                          } else if (!defaultProgramId && !checked) {
                            setDefaultProgramId(p.id);
                          }
                          return next;
                        });
                      }}
                    />
                    {p.name}
                  </label>
                  {checked ? (
                    <button
                      type="button"
                      className="text-[11px] mono"
                      style={{
                        color:
                          defaultProgramId === p.id
                            ? "var(--spark-lime)"
                            : "var(--spark-text-meta)",
                        background: "transparent",
                        border: "none",
                      }}
                      onClick={() => setDefaultProgramId(p.id)}
                    >
                      {defaultProgramId === p.id ? "DEFAULT" : "Make default"}
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
        <p className="text-[11px] mt-2" style={{ color: "var(--spark-text-meta)" }}>
          First / default program pins the recap form when the BA does not pick.
          Two or more programs show a picker on the link.
        </p>
      </section>

      <section>
        <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
          <p className="mono mb-0" style={labelMeta}>
            PHOTO BUCKETS
          </p>
          <div className="flex gap-2">
            {(
              [
                ["flat", "One list"],
                ["byProgram", "Per program"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setBucketMode(value)}
                className="px-3 py-1.5 rounded-xl text-[11px] font-semibold"
                style={{
                  background:
                    bucketMode === value ? "var(--spark-selected-bg)" : "transparent",
                  color:
                    bucketMode === value
                      ? "var(--spark-selected-ink)"
                      : "var(--spark-text)",
                  border:
                    bucketMode === value ? "none" : "1px solid var(--spark-border)",
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {bucketMode === "flat" ? (
          <BucketEditor rows={flatBuckets} onChange={setFlatBuckets} />
        ) : (
          <div className="space-y-4">
            {selectedProgramIds.map((id) => {
              const name = allPrograms.find((p) => p.id === id)?.name;
              if (!name) return null;
              return (
                <div key={id}>
                  <p className="text-xs font-semibold mb-2">{name}</p>
                  <BucketEditor
                    rows={byProgram[name] ?? [emptyBucket()]}
                    onChange={(rows) =>
                      setByProgram((prev) => ({ ...prev, [name]: rows }))
                    }
                  />
                </div>
              );
            })}
            {selectedProgramIds.length === 0 ? (
              <p className="text-xs" style={{ color: "var(--spark-text-meta)" }}>
                Select at least one program to attach per-program buckets.
              </p>
            ) : null}
          </div>
        )}
      </section>

      <section>
        <p className="mono" style={labelMeta}>
          BA MATERIALS (PDF / LINK / IMAGE)
        </p>
        <div className="space-y-2">
          {resources.map((row, idx) => (
            <div key={idx} className="grid gap-2 md:grid-cols-[1fr_0.7fr_1.4fr_1fr_auto]">
              <input
                value={row.label}
                placeholder="Label"
                style={fieldStyle}
                onChange={(e) => {
                  const next = resources.slice();
                  next[idx] = { ...row, label: e.target.value };
                  setResources(next);
                }}
              />
              <select
                value={row.kind}
                style={fieldStyle}
                onChange={(e) => {
                  const next = resources.slice();
                  next[idx] = {
                    ...row,
                    kind: e.target.value as StudioResource["kind"],
                  };
                  setResources(next);
                }}
              >
                <option value="pdf">PDF</option>
                <option value="link">Link</option>
                <option value="image">Image / QR</option>
              </select>
              <input
                value={row.url}
                placeholder="/training/… or https://…"
                style={fieldStyle}
                onChange={(e) => {
                  const next = resources.slice();
                  next[idx] = { ...row, url: e.target.value };
                  setResources(next);
                }}
              />
              <input
                value={row.note}
                placeholder="Note (optional)"
                style={fieldStyle}
                onChange={(e) => {
                  const next = resources.slice();
                  next[idx] = { ...row, note: e.target.value };
                  setResources(next);
                }}
              />
              <button
                type="button"
                className="text-xs px-2"
                style={{ color: "var(--spark-text-meta)", background: "transparent", border: "none" }}
                onClick={() => setResources(resources.filter((_, i) => i !== idx))}
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            className="text-xs font-semibold"
            style={{ color: "var(--spark-text)", background: "transparent", border: "none" }}
            onClick={() => setResources([...resources, emptyResource()])}
          >
            + Add material
          </button>
        </div>
      </section>

      <div className="flex items-center gap-3 flex-wrap pt-1">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
          style={{ background: "var(--spark-lime)", color: "var(--spark-on-accent)" }}
        >
          {busy ? "Saving…" : "Save standing check-in"}
        </button>
        <p className="text-[11px]" style={{ color: "var(--spark-text-meta)" }}>
          Saving never remints or rotates the live code.
        </p>
      </div>
    </div>
  );
}

/**
 * Standing Check-In Studio — replace the read-only StandingCheckinLink banner.
 * Staff configure programs, photo buckets, BA PDFs, and locationMode; the
 * standing code is view/copy only once issued.
 */
const StandingCheckinStudio: React.FC = () => {
  const { tenantId, user } = useAuthStore();
  const showAlert = useAlertStore((s) => s.showAlert);
  const [refreshKey, setRefreshKey] = useState(0);

  const data = useLazyLoadQuery<TenantCheckinCodeQueryType>(
    TenantCheckinCodeQuery,
    { userUuid: user?.uuid ?? null },
    { fetchKey: refreshKey, fetchPolicy: "store-and-network" },
  );

  const nodes = (data?.tenants?.edges ?? [])
    .map((e) => e?.node)
    .filter((n): n is NonNullable<typeof n> => Boolean(n));
  const active =
    nodes.find(
      (n) =>
        String(n.id) === String(tenantId) || String(n.uuid) === String(tenantId),
    ) ??
    nodes[0] ??
    null;

  const coded = nodes.filter((n) => (n.checkinCode ?? "").trim());

  const copy = async (url: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(url);
      showAlert("Check-in link copied.", "success");
    } catch {
      showAlert("Couldn't copy — select the link and copy it.", "error");
    }
  };

  return (
    <div className="mb-5 space-y-3">
      {active ? (
        <Suspense
          fallback={
            <div className="spark-card p-4 text-sm" style={{ color: "var(--spark-text-meta)" }}>
              Loading studio…
            </div>
          }
        >
          <StudioEditor
            key={`${active.id}-${refreshKey}`}
            tenant={active}
            onSaved={() => setRefreshKey((k) => k + 1)}
          />
        </Suspense>
      ) : null}

      <div className="spark-card p-4">
        <p className="mono mb-3" style={labelMeta}>
          ALL STANDING CODES
        </p>
        {coded.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--spark-text-meta)" }}>
            No standing codes yet. Issue one from the studio above for the active
            brand.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {coded.map((tenant) => {
              const code = (tenant.checkinCode ?? "").trim();
              const url = checkinUrl(code);
              const isActive =
                String(tenant.id) === String(active?.id) ||
                String(tenant.uuid) === String(active?.uuid);
              const programs =
                (tenant.checkinPrograms ?? []).map((p) => p.name).filter(Boolean)
                  .length > 0
                  ? (tenant.checkinPrograms ?? []).map((p) => p.name)
                  : (tenant.checkinEventTypeNames ?? []);
              const buckets = tenant.checkinPhotoBuckets ?? [];
              const teamCode = (tenant.checkinTeamCode ?? "").trim();
              const teamUrl = teamCode ? checkinUrl(teamCode) : "";
              return (
                <Fragment key={tenant.id}>
                  <li
                    className="rounded-xl p-3"
                    style={{
                      border: isActive
                        ? "1px solid rgba(var(--spark-accent-rgb),0.55)"
                        : "1px solid var(--spark-border)",
                      background: isActive
                        ? "rgba(var(--spark-accent-rgb),0.06)"
                        : "transparent",
                    }}
                  >
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">
                          {tenant.name}
                          {isActive ? (
                            <span
                              className="mono text-[10px] ml-2"
                              style={{
                                color: "var(--spark-lime)",
                                letterSpacing: "0.12em",
                              }}
                            >
                              ACTIVE
                            </span>
                          ) : null}
                        </p>
                        <p
                          className="mono text-xs mt-1"
                          style={{ color: "var(--spark-text-secondary)" }}
                        >
                          {code}
                        </p>
                        <p
                          className="text-xs mt-1 break-all"
                          style={{ color: "var(--spark-text-meta)" }}
                        >
                          {url}
                        </p>
                        <p
                          className="text-xs mt-2"
                          style={{ color: "var(--spark-text-secondary)" }}
                        >
                          {programs.length
                            ? programs.join(" · ")
                            : "No programs listed"}
                        </p>
                        <p
                          className="text-xs mt-1"
                          style={{ color: "var(--spark-text-meta)" }}
                        >
                          {(tenant.checkinLocationMode || "address") === "market"
                            ? "Market picker"
                            : "Store address"}
                          {" · "}
                          {buckets.length
                            ? buckets.join(" · ")
                            : "No photo buckets"}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          void copy(url);
                        }}
                        className="px-3 py-2 rounded-xl text-xs font-semibold shrink-0"
                        style={{
                          background: "transparent",
                          color: "var(--spark-text)",
                          border: "1px solid var(--spark-border)",
                        }}
                      >
                        Copy
                      </button>
                    </div>
                  </li>
                  {teamCode ? (
                    <li
                      className="rounded-xl p-3"
                      style={{ border: "1px solid var(--spark-border)" }}
                    >
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold">
                            {tenant.checkinTeamTitle?.trim() ||
                              `${tenant.name} · Client team recaps (no clock)`}
                          </p>
                          <p
                            className="mono text-xs mt-1"
                            style={{ color: "var(--spark-text-secondary)" }}
                          >
                            {teamCode}
                          </p>
                          <p
                            className="text-xs mt-1 break-all"
                            style={{ color: "var(--spark-text-meta)" }}
                          >
                            {teamUrl}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            void copy(teamUrl);
                          }}
                          className="px-3 py-2 rounded-xl text-xs font-semibold shrink-0"
                          style={{
                            background: "transparent",
                            color: "var(--spark-text)",
                            border: "1px solid var(--spark-border)",
                          }}
                        >
                          Copy
                        </button>
                      </div>
                    </li>
                  ) : null}
                </Fragment>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default StandingCheckinStudio;
