import {
  Suspense,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { useNavigate } from "react-router";
import { RecapEventOptionsQuery } from "@/api/queries/RecapEventOptionsQuery";
import type { RecapEventOptionsQuery as RecapEventOptionsQueryType } from "@api/queries/__generated__/RecapEventOptionsQuery.graphql";
import { CustomRecapTemplatesQuery } from "@/api/queries/CustomRecapTemplatesQuery";
import type { CustomRecapTemplatesQuery as CustomRecapTemplatesQueryType } from "@api/queries/__generated__/CustomRecapTemplatesQuery.graphql";
import { fetchQuery } from "relay-runtime";
import environment from "@/api/relay/environment";
import { GetUploadUrlQuery } from "@/api/queries/GetUploadUrlQuery";
import type { GetUploadUrlQuery as GetUploadUrlQueryType } from "@api/queries/__generated__/GetUploadUrlQuery.graphql";
import { ConnecteamImportJobQuery } from "@/api/queries/ConnecteamImportJobQuery";
import type { ConnecteamImportJobQuery as ConnecteamImportJobQueryType } from "@api/queries/__generated__/ConnecteamImportJobQuery.graphql";
import { ImportConnecteamRecapPdfMutation } from "@/api/mutations/ImportConnecteamRecapPdfMutation";
import type { ImportConnecteamRecapPdfMutation as ImportConnecteamRecapPdfMutationType } from "@api/mutations/__generated__/ImportConnecteamRecapPdfMutation.graphql";
import { useAlertStore } from "@/store/alertStore";
import { useAuthStore } from "@/store/authStore";
import { CreateEventWithRequestMutation } from "@/api/mutations/CreateEventWithRequestMutation";
import type { CreateEventWithRequestMutation as CreateEventWithRequestMutationType } from "@api/mutations/__generated__/CreateEventWithRequestMutation.graphql";
import { EventTypeQuery } from "@/api/queries/EventTypeQuery";
import type { EventTypeQuery as EventTypeQueryType } from "@api/queries/__generated__/EventTypeQuery.graphql";
import { RequestTypesQuery } from "@/api/queries/RequestTypesQuery";
import type { RequestTypesQuery as RequestTypesQueryType } from "@api/queries/__generated__/RequestTypesQuery.graphql";
import { TimezonesQuery } from "@/api/queries/TimezonesQuery";
import type { TimezonesQuery as TimezonesQueryType } from "@api/queries/__generated__/TimezonesQuery.graphql";
import { buildDateTimeWithOffset } from "@/utils";

/**
 * Drop a Connecteam-exported recap PDF onto a Spark event and turn it
 * into a draft CustomRecap with every field pre-filled. Kyle's team
 * was retyping every field by hand; this collapses that to a 30-second
 * paste-and-pick.
 *
 * Flow:
 *   1. Pick the Event the recap is for (search by name)
 *   2. Pick a CustomRecapTemplate (auto-populates with the tenant's
 *      templates — usually there's just one)
 *   3. Drop in the PDF
 *   4. Submit → backend parses, fuzzy-matches labels to template
 *      fields, creates CustomRecap + values, returns a stats report
 *   5. Modal shows matched/unmatched counts and a "View recap" CTA
 *
 * Receipt photo is intentionally NOT handled here — the admin uploads
 * that on the recap edit page afterward.
 */

// The backend serializes event date/start/end with the VENUE's wall
// clock baked into the ISO string (DST-aware). Parse the clock straight
// out of the string instead of round-tripping through Date — which
// would re-shift into the browser's timezone (the exact bug class the
// venue-tz serializers exist to prevent).
const wallDate = (iso: string | null | undefined): string => {
  if (!iso || iso.length < 10) return "";
  const [y, m, d] = iso.slice(0, 10).split("-").map((n) => parseInt(n, 10));
  if (!y || !m || !d) return "";
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const wallTime = (iso: string | null | undefined): string => {
  if (!iso || iso.length < 16 || iso[10] !== "T") return "";
  const hh = parseInt(iso.slice(11, 13), 10);
  const mm = iso.slice(14, 16);
  if (Number.isNaN(hh)) return "";
  const h12 = ((hh + 11) % 12) + 1;
  const ampm = hh >= 12 ? "PM" : "AM";
  return mm === "00" ? `${h12} ${ampm}` : `${h12}:${mm} ${ampm}`;
};

type Props = {
  onClose: () => void;
  onImported?: (recapUuid: string) => void;
};

const Inner: React.FC<Props> = ({ onClose, onImported }) => {
  const navigate = useNavigate();
  const showAlert = useAlertStore((s) => s.showAlert);

  const [search, setSearch] = useState("");
  // useLazyLoadQuery SUSPENDS the component on every variable change — with
  // only one Suspense boundary around the whole modal, wiring `search`
  // straight into the query meant every keystroke blanked the entire modal
  // to the "Loading…" fallback (and dropped input focus with it). Debounce
  // what actually drives the query, then useDeferredValue it: React keeps
  // showing the last good result list instead of re-suspending while the
  // debounced value catches up.
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(t);
  }, [search]);
  const deferredSearch = useDeferredValue(debouncedSearch);
  const isSearchStale = deferredSearch !== search;
  const [eventId, setEventId] = useState<string | null>(null);
  const [eventLabel, setEventLabel] = useState<string>("");
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [pickedFile, setPickedFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [uploadPhase, setUploadPhase] = useState<
    "idle" | "uploading" | "importing"
  >("idle");
  // Optional recap title. Pre-filled from the picked event so imports
  // aren't all named the backend default ("Imported from Connecteam ·
  // <date>") — Kyle's report: a recap list of identical titles is messy.
  // Sent as `name`; left blank falls back to the backend's event-based
  // default. The admin can still rename later from the recap view.
  const [title, setTitle] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Connecteam import writes a CustomRecap tying an event to a template —
  // both pickers MUST be locked to the active tenant or an Ignite admin
  // could import a Girl Beer PDF against a Liquid Death event/template
  // (cross-tenant corruption + a read leak of other clients' event and
  // template names).
  const { tenantId } = useAuthStore();

  // Event picker uses the dedicated `recapEventOptions` query, NOT the
  // general `events` query. The backend hard-scopes this to the active
  // tenant and returns nothing when no tenant is in scope, so the picker
  // can't leak another client's events even if `tenantId` is somehow
  // empty (the general `events` query returns every tenant's events for
  // unrestricted roles).
  const eventsData = useLazyLoadQuery<RecapEventOptionsQueryType>(
    RecapEventOptionsQuery,
    {
      first: 200,
      q: deferredSearch || null,
      tenantId: tenantId || null,
    },
    { fetchPolicy: "store-or-network" },
  );

  // Templates are now hard-scoped to the active tenant on the SERVER too
  // (customRecapTemplates returns an empty page when no tenant is in
  // scope), so this picker can never offer another client's template.
  const templatesData = useLazyLoadQuery<CustomRecapTemplatesQueryType>(
    CustomRecapTemplatesQuery,
    { first: 50, filters: tenantId ? { tenantId } : null },
    { fetchPolicy: "store-or-network" },
  );

  const events = useMemo(
    () =>
      (eventsData?.recapEventOptions?.edges ?? [])
        .map((e) => e?.node)
        .filter((n): n is NonNullable<typeof n> => Boolean(n)),
    [eventsData],
  );

  const templates = useMemo(
    () =>
      (templatesData?.customRecapTemplates?.edges ?? [])
        .map((e) => e?.node)
        .filter((n): n is NonNullable<typeof n> => Boolean(n)),
    [templatesData],
  );

  // Inline "create event" support — event types + timezones are tiny
  // lookup tables; loading them up front keeps the create form instant.
  const eventTypesData = useLazyLoadQuery<EventTypeQueryType>(
    EventTypeQuery,
    { filters: { tenantId: tenantId ?? "" }, first: 25 },
    { fetchPolicy: "store-or-network" },
  );
  const timezonesData = useLazyLoadQuery<TimezonesQueryType>(
    TimezonesQuery,
    {},
    { fetchPolicy: "store-or-network" },
  );
  // Request types back the parent Request we now create alongside the
  // event — required by the backend (Request.request_type is NOT NULL).
  // Tenant-scoped, same shape as the event-type lookup above.
  const requestTypesData = useLazyLoadQuery<RequestTypesQueryType>(
    RequestTypesQuery,
    { filters: { tenantId: tenantId ?? "" }, first: 25 },
    { fetchPolicy: "store-or-network" },
  );
  const eventTypes = useMemo(
    () =>
      (eventTypesData?.eventTypes?.edges ?? [])
        .map((e) => e?.node)
        .filter((n): n is NonNullable<typeof n> => Boolean(n)),
    [eventTypesData],
  );
  const requestTypes = useMemo(
    () =>
      (requestTypesData?.requestTypes?.edges ?? [])
        .map((e) => e?.node)
        .filter((n): n is NonNullable<typeof n> => Boolean(n)),
    [requestTypesData],
  );
  const timezones = useMemo(
    () =>
      (timezonesData?.timezones?.edges ?? [])
        .map((e) => e?.node)
        .filter((n): n is NonNullable<typeof n> => Boolean(n)),
    [timezonesData],
  );

  // Inline create form state. Times default to the common 4-hour
  // sampling window; timezone defaults to Pacific (most GB/LD venues).
  const [showCreate, setShowCreate] = useState(false);
  const [cName, setCName] = useState("");
  const [cDate, setCDate] = useState("");
  const [cStart, setCStart] = useState("11:00");
  const [cEnd, setCEnd] = useState("15:00");
  const [cAddress, setCAddress] = useState("");
  const [cEventTypeId, setCEventTypeId] = useState<string | null>(null);
  const [cRequestTypeId, setCRequestTypeId] = useState<string | null>(null);
  const [cTimezoneId, setCTimezoneId] = useState<string | null>(null);

  useEffect(() => {
    if (!cEventTypeId && eventTypes.length > 0) {
      const def = eventTypes.find((t) => t.isDefault) ?? eventTypes[0];
      setCEventTypeId(String(def.id));
    }
  }, [eventTypes, cEventTypeId]);

  useEffect(() => {
    if (!cRequestTypeId && requestTypes.length > 0) {
      setCRequestTypeId(String(requestTypes[0].id));
    }
  }, [requestTypes, cRequestTypeId]);

  useEffect(() => {
    if (!cTimezoneId && timezones.length > 0) {
      const pacific =
        timezones.find((t) =>
          `${t.name} ${t.code ?? ""}`.toLowerCase().includes("pacific"),
        ) ??
        timezones.find((t) =>
          (t.name ?? "").toLowerCase().includes("los_angeles"),
        ) ??
        timezones[0];
      setCTimezoneId(String(pacific.id));
    }
  }, [timezones, cTimezoneId]);

  // Default + guard the template selection against the ACTIVE tenant's
  // templates. This is the structure the imported recap is built from, so
  // picking the wrong client's template is exactly how Girl Beer PDFs end
  // up matched against the wrong fields.
  //
  //   * Auto-pick when the tenant has exactly one template (one client =
  //     one recap shape — saves a click in the common case).
  //   * If the currently-selected templateId is NOT in the freshly loaded
  //     tenant list (e.g. the admin switched the dashboard tenant), clear
  //     it so a stale cross-tenant id can never be submitted — then
  //     re-auto-pick if the new tenant has a single template.
  //
  // Done in an effect (not useMemo) because it's a state side-effect —
  // useMemo isn't guaranteed to run for effects and React may discard it.
  useEffect(() => {
    const ids = templates.map((t) => String(t.id));
    if (templateId && !ids.includes(templateId)) {
      setTemplateId(ids.length === 1 ? ids[0] : null);
      return;
    }
    if (!templateId && templates.length === 1) {
      setTemplateId(ids[0]);
    }
  }, [templates, templateId]);

  // The client whose recap structure the import will use. Drawn from the
  // selected template (falls back to the sole tenant template) so the
  // admin always sees which client they're importing for.
  const selectedTemplate = useMemo(
    () => templates.find((t) => String(t.id) === templateId) ?? null,
    [templates, templateId],
  );
  const clientName = selectedTemplate?.tenant?.name ?? null;

  const [commit, isImporting] =
    useMutation<ImportConnecteamRecapPdfMutationType>(
      ImportConnecteamRecapPdfMutation,
    );

  const [commitCreateEvent, isCreatingEvent] =
    useMutation<CreateEventWithRequestMutationType>(
      CreateEventWithRequestMutation,
    );

  const onCreateEvent = () => {
    if (!tenantId) {
      showAlert("Pick a tenant first (top-left switcher).", "warning");
      return;
    }
    if (!cName.trim() || !cDate || !cStart || !cEnd || !cAddress.trim()) {
      showAlert("Name, date, times, and address are required.", "warning");
      return;
    }
    if (!cEventTypeId) {
      showAlert(
        "This tenant has no event types — create one in Catalogs first.",
        "warning",
      );
      return;
    }
    if (!cRequestTypeId) {
      showAlert(
        "This tenant has no request types — create one in Catalogs first.",
        "warning",
      );
      return;
    }
    if (!cTimezoneId) {
      showAlert("Pick a timezone.", "warning");
      return;
    }
    if (isCreatingEvent) return;
    const tz = timezones.find((t) => String(t.id) === cTimezoneId) ?? null;
    const offset = tz?.offset ?? null;
    const date = buildDateTimeWithOffset(cDate, "00:00", offset);
    const startTime = buildDateTimeWithOffset(cDate, cStart, offset);
    const endTime = buildDateTimeWithOffset(cDate, cEnd, offset);
    // Create the parent Request AND the Event in one call, both forced
    // to "approved" server-side with NO client notification. The Request
    // is what the Master Tracker lists — creating a bare event (old
    // behavior) left the imported recap invisible there.
    commitCreateEvent({
      variables: {
        input: {
          // Event tenant is inherited from the request on the server, so
          // it's intentionally omitted here (passing a mismatched tenant
          // is rejected by createEventWithRequest).
          event: {
            name: cName.trim(),
            eventTypeId: cEventTypeId,
            address: cAddress.trim(),
            notes: "Created during Connecteam PDF import",
            timezoneId: cTimezoneId,
            date,
            startTime,
            endTime,
          },
          request: {
            name: cName.trim(),
            tenantId,
            requestTypeId: cRequestTypeId,
            address: cAddress.trim(),
            notes: "Created during Connecteam PDF import",
            timezoneId: cTimezoneId,
            coordinates: [],
            date,
            startTime,
            endTime,
            details: [],
            products: [],
          },
        },
      },
      onCompleted: (res) => {
        const r = res.createEventWithRequest;
        if (!r?.success || !r.event?.id) {
          showAlert(r?.message ?? "Couldn't create the event.", "error");
          return;
        }
        // Select the fresh event for the import in one motion.
        const [y, m, d] = cDate.split("-").map((n) => parseInt(n, 10));
        const when = new Date(y, m - 1, d).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        });
        const label = `${cName.trim()} · ${when}`;
        setEventId(String(r.event.id));
        setEventLabel(label);
        setTitle((t) => (t.trim() ? t : label));
        setSearch(label);
        setShowCreate(false);
        showAlert("Event created and selected.", "success");
      },
      onError: (err) => showAlert(err.message, "error"),
    });
  };

  const onPickFile = (file: File) => {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      showAlert("File must be a PDF.", "warning");
      return;
    }
    setPickedFile(file);
    setFileName(file.name);
  };

  const finishImport = (
    uuid: string | null | undefined,
    matchedCount: number,
    unmatchedCount: number,
    imagesAttached: number,
  ) => {
    if (!uuid) {
      showAlert("Imported but recap UUID missing.", "warning");
      return;
    }
    showAlert(
      `Imported · ${matchedCount} mapped, ${unmatchedCount} unmatched` +
        (imagesAttached
          ? `, ${imagesAttached} photo(s)`
          : " · no photos found in PDF") +
        ".",
      "success",
    );
    const query = imagesAttached === 0 ? "?needPhotos=1" : "";
    navigate(`/recap/view-custom/${uuid}${query}`);
    onImported?.(String(uuid));
  };

  const pollImportJob = async (jobId: string) => {
    const deadline = Date.now() + 180_000;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 2000));
      const data = await fetchQuery<ConnecteamImportJobQueryType>(
        environment,
        ConnecteamImportJobQuery,
        { jobId },
      ).toPromise();
      const job = data?.connecteamImportJob;
      if (!job) continue;
      if (job.status === "done") {
        finishImport(
          job.customRecap?.uuid,
          job.matchedCount ?? 0,
          job.unmatchedCount ?? 0,
          job.imagesAttached ?? 0,
        );
        return;
      }
      if (job.status === "error") {
        showAlert(job.message ?? "Couldn't import PDF.", "error");
        return;
      }
    }
    showAlert("Import is still running — check Recaps in a minute.", "warning");
  };

  const onSubmit = async () => {
    if (!eventId || !templateId || !pickedFile) {
      showAlert("Pick an event, a template, and a PDF first.", "warning");
      return;
    }
    if (isImporting || uploadPhase !== "idle") return;

    try {
      setUploadPhase("uploading");
      const stamp = Date.now();
      const safe = pickedFile.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
      const filePath = `connecteam-imports/${stamp}-${safe}`;
      const uploadData = await fetchQuery<GetUploadUrlQueryType>(
        environment,
        GetUploadUrlQuery,
        { filePath, contentType: "application/pdf" },
      ).toPromise();
      const uploadUrl = uploadData?.getUploadUrl?.uploadUrl;
      const blobName = uploadData?.getUploadUrl?.blobName ?? filePath;
      if (!uploadUrl) throw new Error("No signed upload URL returned");
      const put = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/pdf" },
        body: pickedFile,
      });
      if (!put.ok) throw new Error(`Upload failed (${put.status})`);

      setUploadPhase("importing");
      commit({
        variables: {
          input: {
            eventId,
            customRecapTemplateId: templateId,
            pdfGcsPath: blobName,
            name: title.trim() || null,
          },
        },
        onCompleted: (res) => {
          const r = res.importConnecteamRecapPdf;
          if (!r?.success) {
            setUploadPhase("idle");
            showAlert(r?.message ?? "Couldn't import PDF.", "error");
            return;
          }
          if (r.queued && r.jobId) {
            void pollImportJob(r.jobId).finally(() => setUploadPhase("idle"));
            return;
          }
          setUploadPhase("idle");
          finishImport(
            r.customRecap?.uuid,
            r.matchedCount ?? 0,
            r.unmatchedCount ?? 0,
            r.imagesAttached ?? 0,
          );
        },
        onError: (err) => {
          setUploadPhase("idle");
          showAlert(err.message, "error");
        },
      });
    } catch (err) {
      setUploadPhase("idle");
      showAlert((err as Error).message || "Upload failed.", "error");
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[8vh]"
      style={{
        background: "rgba(10,11,13,0.7)",
        backdropFilter: "blur(8px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl spark-card overflow-hidden"
        style={{
          borderRadius: 20,
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          className="p-4 border-b"
          style={{ borderColor: "var(--spark-border, #1f2418)" }}
        >
          <h2 className="text-lg font-semibold">Import Connecteam PDF</h2>
          <p className="text-xs mt-1" style={{ color: "var(--spark-text-secondary)" }}>
            We'll parse the PDF, draft the recap, and open it so you can
            review, add any missing photos, and approve.
          </p>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto">
          {/* Event picker. Once an event is selected the input
                  reads back the picked name and the suggestions list
                  collapses (re-opens the moment the user starts to
                  edit the search again). Nevena's report: clicking
                  a row marked it selected but the input stayed at
                  her partial search "A" — felt like the click did
                  nothing. */}
              <div>
                <label className="label-mini block mb-1.5">
                  Event · search by name
                </label>
                <div className="flex gap-2 items-center">
                  <input
                    className="flex-1"
                    placeholder="Albertsons Laguna Niguel · 05/22…"
                    value={eventId ? eventLabel : search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      // Editing the field means the user is changing
                      // their mind — clear the previous selection.
                      if (eventId) {
                        setEventId(null);
                        setEventLabel("");
                      }
                    }}
                    style={{
                      padding: "8px 10px",
                      borderRadius: 8,
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.12)",
                      color: "#fff",
                    }}
                  />
                  {eventId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEventId(null);
                        setEventLabel("");
                        setSearch("");
                      }}
                      className="text-xs px-2 py-1 rounded"
                      style={{
                        background: "rgba(255,255,255,0.06)",
                        border: "1px solid rgba(255,255,255,0.18)",
                        color: "var(--spark-text-secondary)",
                      }}
                    >
                      Change
                    </button>
                  )}
                </div>
                {!eventId && (
                  <>
                  <div
                    className="mt-2 rounded-lg overflow-y-auto transition-opacity"
                    style={{
                      maxHeight: 220,
                      border: "1px solid rgba(255,255,255,0.08)",
                      opacity: isSearchStale ? 0.5 : 1,
                    }}
                  >
                    {events.length === 0 ? (
                      <div
                        className="text-xs px-3 py-2"
                        style={{ color: "var(--spark-text-meta)" }}
                      >
                        No matching events — create one below.
                      </div>
                    ) : (
                      events.map((ev) => {
                        const id = String(ev.id);
                        const label =
                          ev.request?.retailer?.name ??
                          ev.name ??
                          "Untitled event";
                        // Disambiguation line — five "Albertsons" rows are
                        // indistinguishable without the when + where.
                        const day = wallDate(ev.date ?? ev.startTime);
                        const start = wallTime(ev.startTime);
                        const end = wallTime(ev.endTime);
                        const when = [
                          day,
                          start && end
                            ? `${start}–${end}`
                            : start || null,
                        ]
                          .filter(Boolean)
                          .join(" · ");
                        const picked = day ? `${label} · ${day}` : label;
                        const filed = (ev.recapsFiledCount ?? 0) > 0;
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => {
                              setEventId(id);
                              setEventLabel(picked);
                              setTitle((t) => (t.trim() ? t : picked));
                              setSearch(picked);
                            }}
                            className="w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 transition hover:bg-white/5"
                            style={{
                              background: "transparent",
                              borderBottom: "1px solid rgba(255,255,255,0.04)",
                            }}
                          >
                            <span className="min-w-0">
                              <span className="block truncate">{label}</span>
                              {(when || ev.address) && (
                                <span
                                  className="block truncate mono text-[10px] mt-0.5"
                                  style={{
                                    color: "var(--spark-text-meta)",
                                    letterSpacing: "0.04em",
                                  }}
                                >
                                  {[when, ev.address]
                                    .filter(Boolean)
                                    .join(" · ")}
                                </span>
                              )}
                            </span>
                            <span className="shrink-0 flex items-center gap-1.5">
                              {/* Already-filed badge — the usual reason to
                                  skip an event here. Selection stays allowed
                                  (re-imports after a bad parse are legit). */}
                              {filed && (
                                <span
                                  className="chip shrink-0 mono text-[9px]"
                                  style={{
                                    display: "inline-flex",
                                    color: "var(--spark-lime, #f2f3ee)",
                                    border:
                                      "1px solid rgba(242,243,238,0.45)",
                                    letterSpacing: "0.1em",
                                  }}
                                >
                                  ✓ RECAP FILED
                                </span>
                              )}
                              {/* Client/brand label so it's always clear
                                  which client an event belongs to before
                                  importing a PDF against it. */}
                              {ev.tenant?.name && (
                                <span
                                  className="chip chip-muted shrink-0"
                                  style={{ display: "inline-flex" }}
                                >
                                  {ev.tenant.name}
                                </span>
                              )}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                  {/* Inline event creation — no leaving the import flow.
                      The PDF often arrives before anyone logged the event
                      (bulk uploads miss a store, ad-hoc visits, …). */}
                  {!showCreate ? (
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreate(true);
                        if (!cName) setCName(search.trim());
                      }}
                      className="mt-2 w-full text-left px-3 py-2 rounded-lg text-sm transition hover:bg-white/5"
                      style={{
                        border: "1px dashed rgba(242,243,238,0.4)",
                        color: "var(--spark-lime, #f2f3ee)",
                        background: "rgba(242,243,238,0.04)",
                      }}
                    >
                      + New event
                      {search.trim()
                        ? ` “${search.trim().slice(0, 32)}”`
                        : ""}{" "}
                      <span style={{ color: "var(--spark-text-meta)" }}>
                        — create it right here and import against it
                      </span>
                    </button>
                  ) : (
                    <div
                      className="mt-2 rounded-lg p-3 space-y-2"
                      style={{
                        border: "1px dashed rgba(242,243,238,0.4)",
                        background: "rgba(242,243,238,0.04)",
                      }}
                    >
                      <p className="label-mini">New event</p>
                      <input
                        className="w-full"
                        placeholder="Event name (e.g. Albertsons Laguna Niguel)"
                        value={cName}
                        onChange={(e) => setCName(e.target.value)}
                        style={{
                          padding: "8px 10px",
                          borderRadius: 8,
                          background: "rgba(255,255,255,0.04)",
                          border: "1px solid rgba(255,255,255,0.12)",
                          color: "#fff",
                        }}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="date"
                          value={cDate}
                          onChange={(e) => setCDate(e.target.value)}
                          style={{
                            padding: "8px 10px",
                            borderRadius: 8,
                            background: "rgba(255,255,255,0.04)",
                            border: "1px solid rgba(255,255,255,0.12)",
                            color: "#fff",
                            colorScheme: "dark",
                          }}
                        />
                        <input
                          placeholder="Address"
                          value={cAddress}
                          onChange={(e) => setCAddress(e.target.value)}
                          style={{
                            padding: "8px 10px",
                            borderRadius: 8,
                            background: "rgba(255,255,255,0.04)",
                            border: "1px solid rgba(255,255,255,0.12)",
                            color: "#fff",
                          }}
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <input
                          type="time"
                          value={cStart}
                          onChange={(e) => setCStart(e.target.value)}
                          style={{
                            padding: "8px 10px",
                            borderRadius: 8,
                            background: "rgba(255,255,255,0.04)",
                            border: "1px solid rgba(255,255,255,0.12)",
                            color: "#fff",
                            colorScheme: "dark",
                          }}
                        />
                        <input
                          type="time"
                          value={cEnd}
                          onChange={(e) => setCEnd(e.target.value)}
                          style={{
                            padding: "8px 10px",
                            borderRadius: 8,
                            background: "rgba(255,255,255,0.04)",
                            border: "1px solid rgba(255,255,255,0.12)",
                            color: "#fff",
                            colorScheme: "dark",
                          }}
                        />
                        <select
                          value={cTimezoneId ?? ""}
                          onChange={(e) =>
                            setCTimezoneId(e.target.value || null)
                          }
                          style={{
                            padding: "8px 10px",
                            borderRadius: 8,
                            background: "rgba(255,255,255,0.04)",
                            border: "1px solid rgba(255,255,255,0.12)",
                            color: "#fff",
                          }}
                        >
                          {timezones.map((t) => (
                            <option key={String(t.id)} value={String(t.id)}>
                              {t.code || t.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      {eventTypes.length > 1 && (
                        <select
                          value={cEventTypeId ?? ""}
                          onChange={(e) =>
                            setCEventTypeId(e.target.value || null)
                          }
                          className="w-full"
                          style={{
                            padding: "8px 10px",
                            borderRadius: 8,
                            background: "rgba(255,255,255,0.04)",
                            border: "1px solid rgba(255,255,255,0.12)",
                            color: "#fff",
                          }}
                        >
                          {eventTypes.map((t) => (
                            <option key={String(t.id)} value={String(t.id)}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                      )}
                      {eventTypes.length === 0 && (
                        <p
                          className="text-xs"
                          style={{ color: "rgba(255,200,80,0.85)" }}
                        >
                          No event types for this tenant — create one in
                          Catalogs first.
                        </p>
                      )}
                      {requestTypes.length > 1 && (
                        <select
                          value={cRequestTypeId ?? ""}
                          onChange={(e) =>
                            setCRequestTypeId(e.target.value || null)
                          }
                          className="w-full"
                          style={{
                            padding: "8px 10px",
                            borderRadius: 8,
                            background: "rgba(255,255,255,0.04)",
                            border: "1px solid rgba(255,255,255,0.12)",
                            color: "#fff",
                          }}
                        >
                          {requestTypes.map((t) => (
                            <option key={String(t.id)} value={String(t.id)}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                      )}
                      {requestTypes.length === 0 && (
                        <p
                          className="text-xs"
                          style={{ color: "rgba(255,200,80,0.85)" }}
                        >
                          No request types for this tenant — create one in
                          Catalogs first.
                        </p>
                      )}
                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          className="px-3 py-1.5 rounded-lg text-xs"
                          style={{
                            background: "transparent",
                            border: "1px solid rgba(255,255,255,0.18)",
                            color: "var(--spark-text-secondary)",
                          }}
                          onClick={() => setShowCreate(false)}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={isCreatingEvent}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
                          style={{
                            background: "var(--spark-lime, #f2f3ee)",
                            color: "#0a0d09",
                          }}
                          onClick={onCreateEvent}
                        >
                          {isCreatingEvent
                            ? "Creating…"
                            : "Create & select"}
                        </button>
                      </div>
                    </div>
                  )}
                  </>
                )}
              </div>

              {/* Client / recap template — the structure the imported
                  recap is built from. Explicit + prominent: the wrong
                  pick here is what makes a Girl Beer PDF match against
                  another client's fields. Scoped to the active tenant on
                  the server, defaulted to the sole tenant template. */}
              <div>
                <label className="label-mini block mb-1.5">
                  Client recap template
                </label>
                <select
                  value={templateId ?? ""}
                  onChange={(e) => setTemplateId(e.target.value || null)}
                  className="w-full"
                  style={{
                    padding: "8px 10px",
                    borderRadius: 8,
                    background: "rgba(255,255,255,0.04)",
                    border: templateId
                      ? "1px solid rgba(242,243,238,0.4)"
                      : "1px solid rgba(255,200,80,0.5)",
                    color: "#fff",
                  }}
                >
                  <option value="">— Select client template —</option>
                  {templates.map((t) => (
                    <option key={String(t.id)} value={String(t.id)}>
                      {t.tenant?.name ? `${t.tenant.name} · ${t.name}` : t.name}
                    </option>
                  ))}
                </select>
                {clientName ? (
                  <p
                    className="text-xs mt-1"
                    style={{ color: "rgba(242,243,238,0.85)" }}
                  >
                    Recap fields from <b>{clientName}</b>’s template will be
                    used to map this PDF.
                  </p>
                ) : templates.length > 1 ? (
                  <p
                    className="text-xs mt-1"
                    style={{ color: "rgba(255,200,80,0.85)" }}
                  >
                    This client has multiple templates — pick the one that
                    matches the PDF.
                  </p>
                ) : null}
                {templates.length === 0 && (
                  <p
                    className="text-xs mt-1"
                    style={{ color: "rgba(255,200,80,0.85)" }}
                  >
                    No templates found for this tenant. Create one in
                    Catalogs → Recap templates first.
                  </p>
                )}
              </div>

              {/* File picker */}
              <div>
                <label className="label-mini block mb-1.5">
                  Connecteam PDF
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onPickFile(f);
                  }}
                  className="text-sm"
                />
                {fileName && (
                  <p
                    className="text-xs mt-1"
                    style={{ color: "rgba(242,243,238,0.85)" }}
                  >
                    {fileName}
                    {uploadPhase === "uploading"
                      ? " · uploading…"
                      : uploadPhase === "importing"
                        ? " · importing…"
                        : " · ready"}
                  </p>
                )}
              </div>

              {/* Optional recap title. Pre-filled from the picked event so
                  the recap list isn't a wall of identical "Imported from
                  Connecteam" names. Blank → backend default (event name ·
                  date). Renamable later from the recap view too. */}
              <div>
                <label className="label-mini block mb-1.5">
                  Recap title{" "}
                  <span style={{ color: "var(--spark-text-meta)" }}>
                    · optional
                  </span>
                </label>
                <input
                  className="w-full"
                  placeholder="e.g. Albertsons Laguna Niguel · May 22"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 8,
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    color: "#fff",
                  }}
                />
              </div>
        </div>

        {/* Footer actions */}
        <div
          className="p-4 border-t flex items-center justify-end gap-2"
          style={{ borderColor: "var(--spark-border, #1f2418)" }}
        >
          <button
            type="button"
            className="px-4 py-2 rounded-lg text-sm"
            style={{
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.18)",
              color: "var(--spark-text-secondary)",
            }}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
            disabled={
              isImporting ||
              uploadPhase !== "idle" ||
              !eventId ||
              !templateId ||
              !pickedFile
            }
            style={{
              background: "var(--spark-lime, #f2f3ee)",
              color: "#0a0d09",
            }}
            onClick={onSubmit}
          >
            {uploadPhase === "uploading"
              ? "Uploading…"
              : isImporting || uploadPhase === "importing"
                ? "Importing…"
                : eventLabel
                ? `Import → ${eventLabel.slice(0, 28)}${eventLabel.length > 28 ? "…" : ""}`
                : "Import PDF"}
          </button>
        </div>
      </div>
    </div>
  );
};

const ImportConnecteamPdfModal: React.FC<Props> = (props) => (
  <Suspense
    fallback={
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center"
        style={{ background: "rgba(10,11,13,0.7)" }}
      >
        <div className="text-sm" style={{ color: "var(--spark-text-secondary)" }}>
          Loading…
        </div>
      </div>
    }
  >
    <Inner {...props} />
  </Suspense>
);

export default ImportConnecteamPdfModal;
