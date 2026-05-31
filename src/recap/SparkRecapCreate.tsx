import { Suspense, useDeferredValue, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { RecapEventOptionsQuery } from "@/api/queries/RecapEventOptionsQuery";
import { RecapBaRosterQuery } from "@/api/queries/RecapBaRosterQuery";
import type { RecapBaRosterQuery as RecapBaRosterQueryType } from "@/api/queries/__generated__/RecapBaRosterQuery.graphql";
import { CreateAmbassadorWithUserMutation } from "@/api/mutations/CreateAmbassadorWithUserMutation";
import type { CreateAmbassadorWithUserMutation as CreateAmbassadorWithUserMutationType } from "@/api/mutations/__generated__/CreateAmbassadorWithUserMutation.graphql";
import { CustomRecapTemplatesWithFieldsQuery } from "@/api/queries/CustomRecapTemplatesWithFieldsQuery";
import type { CustomRecapTemplatesWithFieldsQuery as CustomRecapTemplatesWithFieldsQueryType } from "@/api/queries/__generated__/CustomRecapTemplatesWithFieldsQuery.graphql";
import { CreateRecapMutation } from "@/api/mutations/CreateRecapMutation";
import { CreateCustomRecapMutation } from "@/api/mutations/CreateCustomRecapMutation";
import { ParseConnecteamRecapPdfMutation } from "@/api/mutations/ParseConnecteamRecapPdfMutation";
import type { RecapEventOptionsQuery as RecapEventOptionsQueryType } from "@/api/queries/__generated__/RecapEventOptionsQuery.graphql";
import type { CreateRecapMutation as CreateRecapMutationType } from "@/api/mutations/__generated__/CreateRecapMutation.graphql";
import type { CreateCustomRecapMutation as CreateCustomRecapMutationType } from "@/api/mutations/__generated__/CreateCustomRecapMutation.graphql";
import type { ParseConnecteamRecapPdfMutation as ParseConnecteamRecapPdfMutationType } from "@/api/mutations/__generated__/ParseConnecteamRecapPdfMutation.graphql";
import RecapUploader from "./RecapUploader";
import { useAlertStore } from "@/store/alertStore";
import { useSparkRole } from "@/hooks/useSparkRole";
import { useAuthStore } from "@/store/authStore";
import { parseLocaleNumber } from "@/utils";

/**
 * Spark v2 — manual recap submission flow.
 *
 *  - BA-driven path: the assigned ambassador picks the shift on the BA
 *    portal / mobile app and lands here pre-scoped to that event. The
 *    `ambassador_id` is set from the current user on the backend.
 *  - Admin-driven path: any admin can land at /recap/create unscoped,
 *    pick the event manually, optionally override the ambassador (so
 *    they can fill in for a BA who can't), and submit.
 *
 *  TEMPLATE-AWARE: tenants on a Custom Recap Template (Girl Beer,
 *  Borjomi, Liquid Death, …) must file against THEIR template — every
 *  section + field the template defines — not the legacy fixed grid.
 *  This form loads the active tenant's CustomRecapTemplate(s) and, when
 *  one is selected, renders its real sections and creates a CustomRecap
 *  (createCustomRecap) with one CustomFieldValue per filled field. The
 *  template picker mirrors ImportConnecteamPdfModal: default to the sole
 *  tenant template, show its client/name, let the admin switch if there
 *  are several. Only tenants with NO template at all fall back to the
 *  legacy fixed `Recap` form below.
 */

const _DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const _MON = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * Human-readable event date/time for the picker.
 *
 * Input is the stored ISO ("2026-08-22T07:00:00"[+offset]). We parse the
 * Y/M/D/H/M components straight off the string rather than `new Date()`
 * + locale conversion, because the stored time IS the event's local
 * time — running it through the browser's timezone would shift it (the
 * same class of bug as the recap-edit DST fix). Output:
 *   "Sat, Aug 22 2026 · 7:00 AM"  (or just the date if no time present)
 */
function fmtEventWhen(iso: string | null | undefined): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(iso);
  if (!m) return iso;
  const year = +m[1];
  const month = +m[2];
  const day = +m[3];
  const dow = new Date(year, month - 1, day).getDay();
  let label = `${_DOW[dow] ?? ""}, ${_MON[month - 1] ?? ""} ${day} ${year}`;
  if (m[4] != null) {
    let h = +m[4];
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    label += ` · ${h}:${m[5]} ${ampm}`;
  }
  return label;
}

// Field-type → input kind. Field-type names are lowercased by convention
// (text / number / image / longtext); match case-insensitively and treat
// anything unknown as single-line text.
type SelectedEvent =
  NonNullable<
    NonNullable<RecapEventOptionsQueryType["response"]["recapEventOptions"]>["edges"][number]
  >["node"];

type TemplateNode = NonNullable<
  NonNullable<
    CustomRecapTemplatesWithFieldsQueryType["response"]["customRecapTemplates"]
  >["edges"][number]
>["node"];

type TemplateField = NonNullable<TemplateNode["customField"]>[number];

function fieldKind(
  field: TemplateField,
): "text" | "number" | "longtext" | "image" {
  const name = (field?.customFieldType?.name ?? "").toLowerCase();
  if (name.includes("image") || name.includes("photo") || name.includes("img"))
    return "image";
  if (name.includes("number") || name.includes("numeric") || name === "int")
    return "number";
  if (name.includes("long") || name.includes("textarea") || name.includes("paragraph"))
    return "longtext";
  return "text";
}

export default function SparkRecapCreate() {
  const navigate = useNavigate();
  const showAlert = useAlertStore((s) => s.showAlert);
  const { isAdmin } = useSparkRole();
  // Active tenant from the dashboard's tenant picker. The event picker
  // MUST scope to this — otherwise an Ignite admin (unrestricted role)
  // viewing the Girl Beer dashboard sees EVERY tenant's events in the
  // dropdown and can file a recap against another client's event
  // (Kyle hit this: selecting a Liquid Death "Valero Grand Opening"
  // while in the GB dashboard). Clients are already scoped server-side
  // to their own tenant; this closes the admin-side footgun by passing
  // the selected tenant so the events resolver filters to it.
  const { tenantId } = useAuthStore();
  const [params] = useSearchParams();
  const presetEventUuid = params.get("event");

  const [eventQ, setEventQ] = useState("");
  // Defer the value that drives the query so the <input> updates on every
  // keystroke while the (suspending) events refetch runs as a transition.
  // Without this, each keystroke changed the query var → useLazyLoadQuery
  // suspended → the input unmounted → focus was lost after one letter.
  const deferredEventQ = useDeferredValue(eventQ);
  // Recap-form event picker. Uses the dedicated `recapEventOptions`
  // query, NOT the general `events` query: the backend hard-scopes this
  // one to the active tenant and returns nothing when no tenant is in
  // scope, so the picker can't leak another client's events even if
  // `tenantId` is somehow empty. We still pass tenantId so staff get
  // their currently-selected dashboard tenant.
  const eventsData = useLazyLoadQuery<RecapEventOptionsQueryType>(
    RecapEventOptionsQuery,
    {
      first: 30,
      q: deferredEventQ || null,
      tenantId: tenantId || null,
    },
    { fetchPolicy: "store-or-network" },
  );
  const events = useMemo(
    () =>
      (eventsData.recapEventOptions?.edges ?? [])
        .map((e) => e?.node)
        .filter((n): n is NonNullable<typeof n> => !!n),
    [eventsData],
  );

  // Auto-select if the URL gave us an event uuid
  const initialEvent = presetEventUuid
    ? events.find((e) => e.uuid === presetEventUuid) ?? null
    : null;
  const [selectedEvent, setSelectedEvent] = useState<SelectedEvent | null>(
    initialEvent,
  );

  // Active-tenant custom templates WITH their full field structure. The
  // server scopes this to the active tenant, so an empty list means this
  // tenant files via the legacy fixed form (fallback below).
  const templatesData = useLazyLoadQuery<CustomRecapTemplatesWithFieldsQueryType>(
    CustomRecapTemplatesWithFieldsQuery,
    { first: 50, filters: tenantId ? { tenantId } : null },
    { fetchPolicy: "store-or-network" },
  );
  const templates = useMemo(
    () =>
      (templatesData?.customRecapTemplates?.edges ?? [])
        .map((e) => e?.node)
        .filter((n): n is NonNullable<typeof n> => Boolean(n)),
    [templatesData],
  );

  const [templateId, setTemplateId] = useState<string | null>(null);
  // Default + guard the template selection against the ACTIVE tenant's
  // templates (mirror of ImportConnecteamPdfModal):
  //   * auto-pick when the tenant has exactly one template;
  //   * if the selected id is no longer in the freshly loaded list (the
  //     admin switched dashboard tenant), clear it then re-auto-pick.
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

  const selectedTemplate = useMemo(
    () => templates.find((t) => String(t.id) === templateId) ?? null,
    [templates, templateId],
  );

  // ─── Legacy fixed-form state (fallback for non-template tenants) ──
  // Numbers
  const [totalConsumer, setTotalConsumer] = useState("");
  const [firstTime, setFirstTime] = useState("");
  const [brandAware, setBrandAware] = useState("");
  const [willing, setWilling] = useState("");
  const [notWilling, setNotWilling] = useState("");
  const [productsSold, setProductsSold] = useState("");
  const [totalCansSold, setTotalCansSold] = useState("");
  const [totalPacksSold, setTotalPacksSold] = useState("");
  // Tracks whether productsSold was set by the auto-calc (Cans + Packs)
  // or typed manually. We only auto-write when the user hasn't touched
  // it themselves — once they edit Products Sold by hand we stop
  // clobbering their value.
  const [productsSoldManual, setProductsSoldManual] = useState(false);
  const [accountSpend, setAccountSpend] = useState("");
  const [trafficDescription, setTrafficDescription] = useState("");
  const [competitivePresence, setCompetitivePresence] = useState("");

  // Consumer voice
  const [quotes, setQuotes] = useState("");
  const [feedback, setFeedback] = useState("");
  const [demographics, setDemographics] = useState("");
  const [positiveStories, setPositiveStories] = useState("");
  const [reasonsToDecline, setReasonsToDecline] = useState("");

  // Account feedback
  const [doDifferently, setDoDifferently] = useState("");
  const [accountNotes, setAccountNotes] = useState("");
  const [corpoCardUsed, setCorpoCardUsed] = useState(false);

  // ─── Custom-template field values (keyed by CustomField id) ───────
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const setFieldValue = (id: string, v: string) =>
    setFieldValues((prev) => ({ ...prev, [id]: v }));

  // Files
  const [photoBlobs, setPhotoBlobs] = useState<string[]>([]);
  const [receiptBlobs, setReceiptBlobs] = useState<string[]>([]);

  // Admin-only ambassador override (Relay-encoded global id, not uuid —
  // the createRecap mutation runs ambassadorId through resolve_id_to_int
  // which only accepts globalIds or pure digit strings). BA flow leaves
  // blank → backend pulls ambassador from auth.user. Display name is
  // stored alongside so we render a "selected BA" chip without re-querying.
  const [ambassadorOverride, setAmbassadorOverride] = useState("");
  const [ambassadorDisplayName, setAmbassadorDisplayName] = useState("");
  // Free-text "external" BA name for a worker who isn't in Spark yet
  // (sub-contractor, one-off helper, not-yet-onboarded BA). Set instead
  // of ambassadorOverride; submitted as externalBaName. A picked/created
  // real BA always clears this (ambassador wins server-side too).
  const [externalBaName, setExternalBaName] = useState("");
  const [fillingForOther, setFillingForOther] = useState(false);

  const [commit, inFlight] = useMutation<CreateRecapMutationType>(CreateRecapMutation);
  const [commitCustom, customInFlight] =
    useMutation<CreateCustomRecapMutationType>(CreateCustomRecapMutation);

  // Connecteam PDF → form pre-fill (admin convenience). Read-only on the
  // backend: scrapes the PDF and maps its labels onto these form fields.
  // The admin reviews/edits the pre-filled values, then submits normally.
  const [parseCommit, parsing] =
    useMutation<ParseConnecteamRecapPdfMutationType>(
      ParseConnecteamRecapPdfMutation,
    );

  // Locale-tolerant parse so "96,63" (comma decimal) doesn't become NaN.
  const num = (s: string): number | null => parseLocaleNumber(s);

  // Apply a parsed Connecteam PDF to the form. Only overwrites a field
  // when the parser actually found a value for it — so re-importing or
  // importing after some manual entry never blanks out what's there.
  const applyParsedConnecteam = (
    r: ParseConnecteamRecapPdfMutationType["response"]["parseConnecteamRecapPdf"],
  ) => {
    const set = (v: string | null | undefined, fn: (s: string) => void) => {
      if (v != null && v !== "") fn(v);
    };
    set(r.totalConsumer, setTotalConsumer);
    set(r.firstTime, setFirstTime);
    set(r.brandAware, setBrandAware);
    set(r.willing, setWilling);
    set(r.notWilling, setNotWilling);
    set(r.totalCansSold, setTotalCansSold);
    set(r.totalPacksSold, setTotalPacksSold);
    // Products Sold: prefer the PDF's explicit figure (mark it manual so
    // the Cans+Packs auto-calc doesn't clobber it). If the PDF only gave
    // cans/packs, seed Products Sold from their sum but leave it on
    // auto-calc so later edits keep flowing through.
    if (r.productsSold != null && r.productsSold !== "") {
      setProductsSold(r.productsSold);
      setProductsSoldManual(true);
    } else if (
      (r.totalCansSold && r.totalCansSold !== "") ||
      (r.totalPacksSold && r.totalPacksSold !== "")
    ) {
      const cansN = parseLocaleNumber(r.totalCansSold ?? "") ?? 0;
      const packsN = parseLocaleNumber(r.totalPacksSold ?? "") ?? 0;
      setProductsSold(String(cansN + packsN));
    }
    set(r.accountSpend, setAccountSpend);
    set(r.trafficDescription, setTrafficDescription);
    set(r.competitivePresence, setCompetitivePresence);
    set(r.quotes, setQuotes);
    set(r.feedback, setFeedback);
    set(r.demographics, setDemographics);
    set(r.positiveStories, setPositiveStories);
    set(r.reasonsToDecline, setReasonsToDecline);
    set(r.doDifferently, setDoDifferently);
    set(r.accountNotes, setAccountNotes);
  };

  const onPickConnecteamPdf = (file: File) => {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      showAlert("File must be a PDF.", "warning");
      return;
    }
    if (parsing) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      // data:application/pdf;base64,<...>  →  strip the prefix.
      const comma = dataUrl.indexOf(",");
      if (comma < 0) {
        showAlert("Couldn't read the PDF — try a different file.", "error");
        return;
      }
      parseCommit({
        variables: { input: { pdfBase64: dataUrl.slice(comma + 1) } },
        onCompleted: (res) => {
          const r = res.parseConnecteamRecapPdf;
          if (!r?.success) {
            showAlert(r?.message ?? "Couldn't read the Connecteam PDF.", "error");
            return;
          }
          applyParsedConnecteam(r);
          showAlert(
            r.message ||
              `Imported ${r.matchedCount} field(s) — review before submitting.`,
            "success",
          );
        },
        onError: (err) =>
          showAlert(`Connecteam parse failed: ${err.message}`, "error"),
      });
    };
    reader.onerror = () =>
      showAlert("Couldn't read the PDF — try a different file.", "error");
    reader.readAsDataURL(file);
  };

  // ─── Submit: custom-template path ─────────────────────────────────
  const onSubmitCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent) {
      showAlert("Pick the event this recap is for.", "warning");
      return;
    }
    if (!selectedTemplate) {
      showAlert("Pick the recap template.", "warning");
      return;
    }
    // One CustomFieldValue per non-empty field. We deliberately don't
    // send blank fields — the detail view renders every template field
    // anyway (it iterates the template, not just stored values), so an
    // unfilled field shows "—" without us persisting an empty row.
    const customFieldValues = (selectedTemplate.customField ?? [])
      .filter((f): f is NonNullable<typeof f> => Boolean(f))
      // Image fields are captured via the uploader → files[], not as a
      // text value, so skip them here.
      .filter((f) => fieldKind(f) !== "image")
      .map((f) => ({
        customFieldId: String(f.id),
        value: (fieldValues[String(f.id)] ?? "").trim(),
      }))
      .filter((v) => v.value !== "");

    const files = [
      ...photoBlobs.map((blob) => ({
        file: blob,
        fileTypeId: "1",
        fileRecapCategoryId: "1",
      })),
      ...receiptBlobs.map((blob) => ({
        file: blob,
        fileTypeId: "1",
        fileRecapCategoryId: "2",
      })),
    ];

    commitCustom({
      variables: {
        input: {
          eventId: selectedEvent.id,
          customRecapTemplateId: selectedTemplate.id,
          name: `${selectedEvent.request?.retailer?.name ?? selectedEvent.name} recap`,
          ambassadorId:
            isAdmin && fillingForOther ? ambassadorOverride || null : null,
          // Write-in name when no real BA was picked. The backend ignores
          // it if ambassadorId is also set (ambassador wins).
          externalBaName:
            isAdmin && fillingForOther && !ambassadorOverride
              ? externalBaName.trim() || null
              : null,
          fillingForAmbassador: isAdmin && fillingForOther,
          customFieldValues,
          files,
        },
      },
      onCompleted: (res) => {
        if (
          res.createCustomRecap?.success &&
          res.createCustomRecap.customRecap?.uuid
        ) {
          showAlert("Recap submitted.", "success");
          navigate(
            `/recap/view-custom/${res.createCustomRecap.customRecap.uuid}`,
          );
        } else {
          showAlert(
            res.createCustomRecap?.message ?? "Recap submission failed.",
            "error",
          );
        }
      },
      onError: (err) => showAlert(`Recap failed: ${err.message}`, "error"),
    });
  };

  // ─── Submit: legacy fixed-form path ───────────────────────────────
  const onSubmitLegacy = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent) {
      showAlert("Pick the event this recap is for.", "warning");
      return;
    }
    const files = [
      ...photoBlobs.map((blob) => ({ file: blob, fileTypeId: "1", fileRecapCategoryId: "1" })),
      ...receiptBlobs.map((blob) => ({ file: blob, fileTypeId: "1", fileRecapCategoryId: "2" })),
    ];
    commit({
      variables: {
        input: {
          eventId: selectedEvent.id,
          name: `${selectedEvent.request?.retailer?.name ?? selectedEvent.name} recap`,
          ambassadorId: isAdmin && fillingForOther ? ambassadorOverride || null : null,
          externalBaName:
            isAdmin && fillingForOther && !ambassadorOverride
              ? externalBaName.trim() || null
              : null,
          fillingForAmbassador: isAdmin && fillingForOther,
          totalCansSold: num(totalCansSold),
          totalPacksSold: num(totalPacksSold),
          productsSold: num(productsSold),
          accountSpendAmount: num(accountSpend),
          trafficDescription: trafficDescription || null,
          competitivePresence: competitivePresence || null,
          consumerEngagements: {
            totalConsumer: num(totalConsumer),
            firstTimeConsumers: num(firstTime),
            brandAwareConsumers: num(brandAware),
            willingToPurchaseConsumers: num(willing),
            notWillingConsumers: num(notWilling),
          },
          consumerFeedback: {
            quotes,
            feedback,
            demographics,
            positiveStories,
            reasonsToDecline,
          },
          accountFeedback: {
            doDifferentlyFeedback: doDifferently,
            feedback: accountNotes,
            wasCorpoCardUsed: corpoCardUsed,
          },
          files,
        },
      },
      onCompleted: (res) => {
        if (res.createRecap?.success && res.createRecap.recap?.uuid) {
          showAlert("Recap submitted.", "success");
          navigate(`/recap/view/${res.createRecap.recap.uuid}`);
        } else {
          showAlert(res.createRecap?.message ?? "Recap submission failed.", "error");
        }
      },
      onError: (err) => showAlert(`Recap failed: ${err.message}`, "error"),
    });
  };

  // The form renders the custom-template flow whenever the active tenant
  // has at least one template; only template-less tenants get the legacy
  // fixed grid. A tenant with templates that hasn't picked one yet shows
  // the picker and a prompt (no field grid), so we never silently file a
  // generic recap for a custom-template client.
  const useCustomFlow = templates.length > 0;
  const submitting = useCustomFlow ? customInFlight : inFlight;
  const canSubmit = useCustomFlow
    ? Boolean(selectedEvent && selectedTemplate)
    : Boolean(selectedEvent);

  // For the uploader we need a stub uuid so it can namespace blob paths
  // by event. Once create returns the real recap uuid we re-key file
  // rows server-side via AddRecapFile.
  const stubUuid = selectedEvent?.uuid ?? "new";

  return (
    <form
      onSubmit={useCustomFlow ? onSubmitCustom : onSubmitLegacy}
      className="max-w-4xl mx-auto px-1 sm:px-0 space-y-5"
    >
      <div className="spark-card p-6">
        <p className="mono text-[10px]" style={{ letterSpacing: "0.18em", color: "var(--spark-lime)" }}>
          NEW RECAP
        </p>
        <h1 className="display text-3xl font-bold mt-1" style={{ letterSpacing: "-0.02em" }}>
          Tell us how it went.
        </h1>
        <p className="text-sm mt-2" style={{ color: "rgba(255,255,255,0.65)" }}>
          {isAdmin
            ? "Filling on behalf of a BA? Toggle that below."
            : "We'll auto-link this recap to your assigned shift."}
        </p>
      </div>

      {/* Event picker */}
      <Card title="EVENT">
        {selectedEvent ? (
          <div className="rounded-xl p-4 flex items-center justify-between gap-3 flex-wrap" style={{ background: "var(--spark-surface-2)", border: "1px solid var(--spark-border)" }}>
            <div>
              {selectedEvent.tenant?.name && (
                <span
                  className="chip chip-muted mb-1"
                  style={{ display: "inline-flex" }}
                >
                  {selectedEvent.tenant.name}
                </span>
              )}
              <p className="display font-bold text-lg">
                {selectedEvent.request?.retailer?.name ?? selectedEvent.name}
              </p>
              <p className="mono text-[11px] mt-1" style={{ color: "rgba(255,255,255,0.6)", letterSpacing: "0.12em" }}>
                {fmtEventWhen(selectedEvent.date)} · {selectedEvent.address}
              </p>
            </div>
            <button type="button" onClick={() => setSelectedEvent(null)} className="mono text-[10px] px-3 py-1.5 rounded-full" style={{ letterSpacing: "0.18em", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
              CHANGE
            </button>
          </div>
        ) : (
          <>
            <input
              value={eventQ}
              onChange={(e) => setEventQ(e.target.value)}
              placeholder="Search events by name, retailer, or address…"
              className={inputCls}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3 max-h-96 overflow-y-auto">
              {events.map((evt) => (
                <button
                  type="button"
                  key={evt.uuid}
                  onClick={() => setSelectedEvent(evt)}
                  className="text-left rounded-xl p-3"
                  style={{ background: "var(--spark-surface-2)", border: "1px solid var(--spark-border)" }}
                >
                  {/* Client/brand label — so you can always tell which
                      client an event belongs to before filing against it. */}
                  {evt.tenant?.name && (
                    <span
                      className="chip chip-muted mb-1"
                      style={{ display: "inline-flex" }}
                    >
                      {evt.tenant.name}
                    </span>
                  )}
                  <p className="text-sm font-semibold">{evt.request?.retailer?.name ?? evt.name}</p>
                  <p className="mono text-[10px] mt-1" style={{ letterSpacing: "0.14em", color: "rgba(255,255,255,0.55)" }}>
                    {fmtEventWhen(evt.date)} · {evt.address?.slice(0, 60)}
                  </p>
                </button>
              ))}
              {events.length === 0 && (
                <p className="mono text-[10px]" style={{ letterSpacing: "0.18em", color: "rgba(255,255,255,0.45)" }}>
                  NO MATCHES
                </p>
              )}
            </div>
          </>
        )}
      </Card>

      {/* Template / client selector — the structure this recap is filed
          against. Mirrors ImportConnecteamPdfModal: defaults to the sole
          tenant template, names the client, lets the admin switch when
          there are several. Only shown when the tenant has templates. */}
      {useCustomFlow && (
        <Card title="RECAP TEMPLATE">
          <label className="block">
            <span className="mono text-[10px] block mb-1.5" style={{ letterSpacing: "0.18em", color: "rgba(255,255,255,0.55)" }}>
              CLIENT RECAP TEMPLATE
            </span>
            <select
              value={templateId ?? ""}
              onChange={(e) => setTemplateId(e.target.value || null)}
              className={inputCls}
              style={{
                border: templateId
                  ? "1px solid rgba(197,245,70,0.4)"
                  : "1px solid rgba(255,200,80,0.5)",
              }}
            >
              <option value="">— Select recap template —</option>
              {templates.map((t) => (
                <option key={String(t.id)} value={String(t.id)}>
                  {t.tenant?.name ? `${t.tenant.name} · ${t.name}` : t.name}
                </option>
              ))}
            </select>
          </label>
          {selectedTemplate ? (
            <p className="text-xs mt-1" style={{ color: "rgba(197,245,70,0.85)" }}>
              Filing against{" "}
              <b>{selectedTemplate.tenant?.name ?? "this client"}</b>’s{" "}
              <b>{selectedTemplate.name}</b> ·{" "}
              {(selectedTemplate.customField ?? []).length} fields.
            </p>
          ) : templates.length > 1 ? (
            <p className="text-xs mt-1" style={{ color: "rgba(255,200,80,0.85)" }}>
              This client has multiple templates — pick the one for this recap.
            </p>
          ) : null}
        </Card>
      )}

      {/* Admin-only: pre-fill the whole legacy form from a Connecteam
          recap PDF. Only meaningful on the legacy fixed grid — custom
          templates use the dedicated Import Connecteam modal (which
          drafts a CustomRecap against the template), so this card is
          hidden in the custom flow to avoid two competing importers. */}
      {isAdmin && !useCustomFlow && (
        <Card title="IMPORT FROM CONNECTEAM">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.65)" }}>
              Drop a Connecteam recap PDF to auto-fill the numbers and notes
              below. Review everything before submitting — values you've
              already typed are kept.
            </p>
            <label
              className="shrink-0 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold cursor-pointer"
              style={{
                background: parsing ? "var(--spark-surface-2)" : "var(--spark-lime)",
                color: parsing ? "rgba(255,255,255,0.6)" : "#0b0b0b",
                border: "1px solid var(--spark-border)",
                opacity: parsing ? 0.7 : 1,
                cursor: parsing ? "wait" : "pointer",
              }}
            >
              {parsing ? "Reading PDF…" : "Import from Connecteam PDF"}
              <input
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                disabled={parsing}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onPickConnecteamPdf(f);
                  // Reset so picking the same file again re-triggers onChange.
                  e.target.value = "";
                }}
              />
            </label>
          </div>
        </Card>
      )}

      {/* Admin-only filling-for toggle */}
      {isAdmin && (
        <Card title="FILLING FOR A BA?">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={fillingForOther} onChange={(e) => {
              setFillingForOther(e.target.checked);
              if (!e.target.checked) {
                // Toggling off clears any half-picked selection so the
                // mutation doesn't carry a stale uuid when the admin
                // changes their mind.
                setAmbassadorOverride("");
                setAmbassadorDisplayName("");
                setExternalBaName("");
              }
            }} />
            <span className="text-sm">Yes, I'm submitting this on behalf of an ambassador.</span>
          </label>
          {fillingForOther && (
            <Suspense
              fallback={
                <input
                  disabled
                  placeholder="Loading ambassadors…"
                  className={inputCls}
                />
              }
            >
              <AmbassadorPicker
                tenantId={tenantId || null}
                selectedId={ambassadorOverride}
                selectedName={ambassadorDisplayName}
                externalName={externalBaName}
                onSelect={(id, name) => {
                  setAmbassadorOverride(id);
                  setAmbassadorDisplayName(name);
                  setExternalBaName("");
                }}
                onUseExternal={(name) => {
                  // Write-in: record the typed name, drop any real-BA
                  // selection so only externalBaName is submitted.
                  setExternalBaName(name);
                  setAmbassadorOverride("");
                  setAmbassadorDisplayName("");
                }}
                onClear={() => {
                  setAmbassadorOverride("");
                  setAmbassadorDisplayName("");
                  setExternalBaName("");
                }}
              />
            </Suspense>
          )}
        </Card>
      )}

      {/* ─── Custom-template fields, grouped by section ─── */}
      {useCustomFlow && selectedTemplate && (
        <CustomTemplateFields
          template={selectedTemplate}
          values={fieldValues}
          onChange={setFieldValue}
        />
      )}
      {useCustomFlow && !selectedTemplate && (
        <Card title="FIELDS">
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>
            Pick a recap template above to load this client's fields.
          </p>
        </Card>
      )}

      {/* ─── Legacy fixed grid (template-less tenants only) ─── */}
      {!useCustomFlow && (
        <>
          {/* Numbers */}
          <Card title="NUMBERS">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Field label="Samples / Total Consumer">
                <input value={totalConsumer} onChange={(e) => setTotalConsumer(e.target.value)} className={inputCls} inputMode="numeric" placeholder="0" />
              </Field>
              <Field label="First-Time">
                <input value={firstTime} onChange={(e) => setFirstTime(e.target.value)} className={inputCls} inputMode="numeric" placeholder="0" />
              </Field>
              <Field label="Brand-Aware">
                <input value={brandAware} onChange={(e) => setBrandAware(e.target.value)} className={inputCls} inputMode="numeric" placeholder="0" />
              </Field>
              <Field label="Willing to Buy">
                <input value={willing} onChange={(e) => setWilling(e.target.value)} className={inputCls} inputMode="numeric" placeholder="0" />
              </Field>
              <Field label="Not Willing">
                <input value={notWilling} onChange={(e) => setNotWilling(e.target.value)} className={inputCls} inputMode="numeric" placeholder="0" />
              </Field>
              <Field label="Products Sold *">
                <input
                  value={productsSold}
                  onChange={(e) => {
                    // User-typed change — stop auto-populating from
                    // Cans + Packs from this point on so we don't clobber
                    // their intentional override.
                    setProductsSold(e.target.value);
                    setProductsSoldManual(true);
                  }}
                  className={inputCls}
                  inputMode="numeric"
                  placeholder="0"
                  title="Auto-fills from Cans + Packs until you edit it"
                />
              </Field>
              <Field label="Cans Sold">
                <input
                  value={totalCansSold}
                  onChange={(e) => {
                    const next = e.target.value;
                    setTotalCansSold(next);
                    // Auto-update Products Sold from Cans + Packs unless
                    // the user has manually edited Products Sold.
                    if (!productsSoldManual) {
                      const cans = parseLocaleNumber(next) ?? 0;
                      const packs = parseLocaleNumber(totalPacksSold) ?? 0;
                      const sum = cans + packs;
                      setProductsSold(sum > 0 ? String(sum) : "");
                    }
                  }}
                  className={inputCls}
                  inputMode="numeric"
                  placeholder="0"
                />
              </Field>
              <Field label="Packs Sold">
                <input
                  value={totalPacksSold}
                  onChange={(e) => {
                    const next = e.target.value;
                    setTotalPacksSold(next);
                    if (!productsSoldManual) {
                      const cans = parseLocaleNumber(totalCansSold) ?? 0;
                      const packs = parseLocaleNumber(next) ?? 0;
                      const sum = cans + packs;
                      setProductsSold(sum > 0 ? String(sum) : "");
                    }
                  }}
                  className={inputCls}
                  inputMode="numeric"
                  placeholder="0"
                />
              </Field>
              <Field label="Account Spend ($)">
                <input value={accountSpend} onChange={(e) => setAccountSpend(e.target.value)} className={inputCls} inputMode="decimal" placeholder="0.00" />
              </Field>
            </div>
            <p
              className="text-[11px] opacity-60 mt-2"
              style={{ fontFamily: "var(--mono-stack)" }}
            >
              * Products Sold auto-fills from Cans + Packs. Type a value to
              override.
            </p>
            <Field label="Traffic Description">
              <textarea value={trafficDescription} onChange={(e) => setTrafficDescription(e.target.value)} className={inputCls} rows={2} placeholder="Foot traffic, busy hours, slow patches…" />
            </Field>
            <Field label="Competitive Presence">
              <textarea value={competitivePresence} onChange={(e) => setCompetitivePresence(e.target.value)} className={inputCls} rows={2} placeholder="Other brands on display? Demos in the store?" />
            </Field>
          </Card>

          {/* Consumer voice */}
          <Card title="CONSUMER VOICE">
            <Field label="Quotes (direct lines from real consumers)">
              <textarea value={quotes} onChange={(e) => setQuotes(e.target.value)} className={inputCls} rows={3} />
            </Field>
            <Field label="General Feedback">
              <textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} className={inputCls} rows={3} />
            </Field>
            <Field label="Demographics">
              <textarea value={demographics} onChange={(e) => setDemographics(e.target.value)} className={inputCls} rows={2} placeholder="Age, gender mix, vibe of the crowd." />
            </Field>
            <Field label="Positive Stories">
              <textarea value={positiveStories} onChange={(e) => setPositiveStories(e.target.value)} className={inputCls} rows={2} />
            </Field>
            <Field label="Reasons to Decline">
              <textarea value={reasonsToDecline} onChange={(e) => setReasonsToDecline(e.target.value)} className={inputCls} rows={2} />
            </Field>
          </Card>

          {/* Account feedback */}
          <Card title="ACCOUNT FEEDBACK">
            <Field label="What would you do differently next time?">
              <textarea value={doDifferently} onChange={(e) => setDoDifferently(e.target.value)} className={inputCls} rows={2} />
            </Field>
            <Field label="Anything else about this account?">
              <textarea value={accountNotes} onChange={(e) => setAccountNotes(e.target.value)} className={inputCls} rows={2} />
            </Field>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={corpoCardUsed} onChange={(e) => setCorpoCardUsed(e.target.checked)} />
              <span className="text-sm">Corporate card was used for this event spend.</span>
            </label>
          </Card>
        </>
      )}

      {/* Photos + receipts. We show a per-file chip list with a Remove
          button so the admin can see exactly which photos are queued
          before submit — earlier UI only showed an "N PHOTOS READY"
          counter which made it impossible to tell whether a multi-file
          pick actually landed or only the last one stuck. */}
      <Card title="PHOTOS + RECEIPTS">
        <div className="flex flex-wrap gap-3">
          <RecapUploader
            recapUuid={stubUuid}
            category="photo"
            onUploaded={(blob) => setPhotoBlobs((p) => [...p, blob])}
          />
          <RecapUploader
            recapUuid={stubUuid}
            category="receipt"
            onUploaded={(blob) => setReceiptBlobs((p) => [...p, blob])}
          />
        </div>
        <p className="mono text-[10px] mt-3" style={{ letterSpacing: "0.18em", color: "rgba(255,255,255,0.55)" }}>
          {photoBlobs.length} PHOTO{photoBlobs.length === 1 ? "" : "S"} · {receiptBlobs.length} RECEIPT{receiptBlobs.length === 1 ? "" : "S"} READY
        </p>
        {photoBlobs.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {photoBlobs.map((blob, i) => (
              <div
                key={`${blob}-${i}`}
                className="flex items-center justify-between gap-3 rounded-lg px-3 py-2"
                style={{
                  background: "var(--spark-surface-2)",
                  border: "1px solid var(--spark-border)",
                }}
              >
                <span className="mono text-[11px] truncate" style={{ color: "rgba(255,255,255,0.75)" }}>
                  📷 {blob.split("/").pop()}
                </span>
                <button
                  type="button"
                  onClick={() => setPhotoBlobs((p) => p.filter((_, idx) => idx !== i))}
                  className="mono text-[10px] px-2 py-1 rounded-full shrink-0"
                  style={{
                    letterSpacing: "0.14em",
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "rgba(255,255,255,0.65)",
                  }}
                >
                  REMOVE
                </button>
              </div>
            ))}
          </div>
        )}
        {receiptBlobs.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {receiptBlobs.map((blob, i) => (
              <div
                key={`${blob}-${i}`}
                className="flex items-center justify-between gap-3 rounded-lg px-3 py-2"
                style={{
                  background: "var(--spark-surface-2)",
                  border: "1px solid var(--spark-border)",
                }}
              >
                <span className="mono text-[11px] truncate" style={{ color: "rgba(255,255,255,0.75)" }}>
                  📎 {blob.split("/").pop()}
                </span>
                <button
                  type="button"
                  onClick={() => setReceiptBlobs((p) => p.filter((_, idx) => idx !== i))}
                  className="mono text-[10px] px-2 py-1 rounded-full shrink-0"
                  style={{
                    letterSpacing: "0.14em",
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "rgba(255,255,255,0.65)",
                  }}
                >
                  REMOVE
                </button>
              </div>
            ))}
          </div>
        )}
        {(photoBlobs.length > 0 || receiptBlobs.length > 0) && (
          <p className="text-xs mt-2" style={{ color: "rgba(255,255,255,0.45)" }}>
            Files upload to GCS as you pick them — they only get attached to the recap when you submit. Tap the Upload button again to add more.
          </p>
        )}
      </Card>

      {/* Sticky submit */}
      <div
        className="sticky bottom-0 -mx-1 sm:mx-0 px-3 py-3 flex items-center justify-between gap-3 flex-wrap"
        style={{
          background: "rgba(10,13,9,0.9)",
          backdropFilter: "blur(12px)",
          borderTop: "1px solid var(--spark-border)",
        }}
      >
        <div className="mono text-[10px]" style={{ letterSpacing: "0.18em", color: "rgba(255,255,255,0.55)" }}>
          {selectedEvent ? `EVENT · ${(selectedEvent.request?.retailer?.name ?? selectedEvent.name).toUpperCase()}` : "PICK AN EVENT TO SUBMIT"}
        </div>
        <button
          type="submit"
          disabled={submitting || !canSubmit}
          className="px-5 py-3 rounded-xl text-sm font-semibold"
          style={{
            background: "var(--spark-lime)",
            color: "#0a0d09",
            boxShadow: "0 0 24px rgba(197,245,70,0.4)",
            opacity: submitting || !canSubmit ? 0.5 : 1,
          }}
        >
          {submitting ? "Submitting…" : "Submit recap →"}
        </button>
      </div>
    </form>
  );
}

const inputCls =
  "w-full rounded-xl px-3 py-2.5 text-sm bg-transparent focus:outline-none focus:ring-2";

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="block">
    <span className="mono text-[10px] block mb-1.5" style={{ letterSpacing: "0.18em", color: "rgba(255,255,255,0.55)" }}>
      {label.toUpperCase()}
    </span>
    {children}
  </label>
);

const Card: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="spark-card p-6 space-y-3">
    <p className="mono text-[10px]" style={{ letterSpacing: "0.18em", color: "var(--spark-lime)" }}>
      {title}
    </p>
    {children}
  </div>
);

// Render a custom template's fields grouped by section, in the section
// order the template's layout JSON declares (falling back to first-seen
// order). Each field renders the input appropriate to its field type:
// number → numeric input, long/paragraph → textarea, image → a note that
// photos go in the uploader below, everything else → single-line text.
// Bound to the parent's `values` map keyed by CustomField id.
const CustomTemplateFields: React.FC<{
  template: TemplateNode;
  values: Record<string, string>;
  onChange: (id: string, v: string) => void;
}> = ({ template, values, onChange }) => {
  const sections = useMemo(() => {
    const fields = (template.customField ?? []).filter(
      (f): f is NonNullable<typeof f> => Boolean(f),
    );
    // Group by section name.
    const bySection = new Map<string, typeof fields>();
    for (const f of fields) {
      const name = f.recapSection?.name ?? "Details";
      if (!bySection.has(name)) bySection.set(name, []);
      bySection.get(name)!.push(f);
    }
    // Order sections by the template layout hint when present.
    const layout = (template.layout ?? {}) as { sections?: unknown };
    const order: string[] = Array.isArray(layout.sections)
      ? (layout.sections as unknown[]).map((s) => String(s))
      : [];
    const ordered = [...bySection.keys()].sort((a, b) => {
      const ia = order.indexOf(a);
      const ib = order.indexOf(b);
      if (ia === -1 && ib === -1) return 0;
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
    return ordered.map((name) => ({ name, fields: bySection.get(name)! }));
  }, [template]);

  if (sections.length === 0) {
    return (
      <Card title="FIELDS">
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>
          This template has no fields configured.
        </p>
      </Card>
    );
  }

  return (
    <>
      {sections.map((section) => (
        <Card key={section.name} title={section.name.toUpperCase()}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {section.fields.map((f) => {
              const id = String(f.id);
              const kind = fieldKind(f);
              const label = f.required ? `${f.name} *` : f.name;
              if (kind === "image") {
                return (
                  <div key={id} className="sm:col-span-2">
                    <Field label={label}>
                      <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
                        Attach this in “Photos + Receipts” below.
                      </p>
                    </Field>
                  </div>
                );
              }
              if (kind === "longtext") {
                return (
                  <div key={id} className="sm:col-span-2">
                    <Field label={label}>
                      <textarea
                        value={values[id] ?? ""}
                        onChange={(e) => onChange(id, e.target.value)}
                        className={inputCls}
                        rows={3}
                      />
                    </Field>
                  </div>
                );
              }
              return (
                <Field key={id} label={label}>
                  <input
                    value={values[id] ?? ""}
                    onChange={(e) => onChange(id, e.target.value)}
                    className={inputCls}
                    inputMode={kind === "number" ? "numeric" : undefined}
                    placeholder={kind === "number" ? "0" : undefined}
                  />
                </Field>
              );
            })}
          </div>
        </Card>
      ))}
    </>
  );
};

// Type-ahead picker for the "filling for a BA" toggle.
//
// Lists the ACTIVE tenant's BA roster via `chatRecipientAmbassadors`
// (scoped by AmbassadorEvent history) — NOT activeAmbassadors/ambassadors,
// which scope by TenantedUser membership and return nothing for BAs (they
// join a brand through worked events, not a TenantedUser row). That empty
// result was the "NO MATCHES for every name" bug.
//
// When nothing matches the typed text the picker still offers two ways
// forward, so the admin is never stuck:
//   • "Use '<name>'" — record a free-text external BA (externalBaName),
//     for sub-contractors / one-off helpers not in Spark.
//   • "+ Create BA '<name>'" — create the Ambassador in the active tenant
//     (createAmbassadorWithUser) and select it. Email is required because
//     this codebase has no login-less Ambassador; admins without one use
//     the write-in instead.
//
// On pick it hands the Relay global id up (resolve_id_to_int needs a
// global id / digit string, not a uuid) + caches the display name.
export const AmbassadorPicker: React.FC<{
  tenantId: string | null;
  selectedId: string;
  selectedName: string;
  externalName: string;
  onSelect: (id: string, name: string) => void;
  onUseExternal: (name: string) => void;
  onClear: () => void;
}> = ({
  tenantId,
  selectedId,
  selectedName,
  externalName,
  onSelect,
  onUseExternal,
  onClear,
}) => {
  const [q, setQ] = useState("");
  // Defer the query var so typing keeps focus — same fix as the event
  // search: the input tracks `q` immediately, the suspending refetch runs
  // off `deferredQ` as a transition (no unmount → no focus loss).
  const deferredQ = useDeferredValue(q);
  const showAlert = useAlertStore((s) => s.showAlert);

  // Inline create-BA: revealed by "+ Create BA"; email is required by the
  // create mutation (no login-less Ambassador exists), so we collect it
  // in a small field before firing.
  const [creatingName, setCreatingName] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [createBa, creatingInFlight] =
    useMutation<CreateAmbassadorWithUserMutationType>(
      CreateAmbassadorWithUserMutation,
    );

  const data = useLazyLoadQuery<RecapBaRosterQueryType>(
    RecapBaRosterQuery,
    { q: deferredQ || null, tenantId },
    { fetchPolicy: "store-or-network" },
  );

  const matches = useMemo(
    () =>
      (data?.chatRecipientAmbassadors ?? []).filter(
        (r): r is NonNullable<typeof r> => Boolean(r),
      ),
    [data],
  );

  const typed = q.trim();

  const submitCreate = () => {
    const name = (creatingName ?? "").trim();
    const email = newEmail.trim();
    if (!name) return;
    if (!email) {
      showAlert("Enter an email to create this BA.", "warning");
      return;
    }
    // Split the typed name into first/last for the new User.
    const parts = name.split(/\s+/);
    const firstName = parts[0];
    const lastName = parts.slice(1).join(" ") || null;
    createBa({
      variables: {
        input: {
          firstName,
          lastName,
          email,
          // Active by default so the new BA is immediately usable on the
          // recap; admin-created path skips the activation email.
          isActive: true,
        },
      },
      onCompleted: (res) => {
        const created = res.createAmbassadorWithUser;
        if (created?.success && created.ambassador?.id) {
          const u = created.ambassador.user;
          const display =
            [u?.firstName, u?.lastName].filter(Boolean).join(" ").trim() ||
            u?.email ||
            name;
          onSelect(String(created.ambassador.id), display);
          setCreatingName(null);
          setNewEmail("");
          showAlert(`Created BA "${display}".`, "success");
        } else {
          showAlert(
            created?.message ?? "Couldn't create the BA.",
            "error",
          );
        }
      },
      onError: (err) => showAlert(`Create BA failed: ${err.message}`, "error"),
    });
  };

  // Selected real BA OR write-in external name → show the chosen-state chip.
  if ((selectedId && selectedName) || externalName.trim()) {
    const isExternal = !selectedId && Boolean(externalName.trim());
    return (
      <div
        className="rounded-xl p-3 flex items-center justify-between gap-3"
        style={{
          background: "var(--spark-surface-2)",
          border: "1px solid var(--spark-border)",
        }}
      >
        <div>
          <p className="display font-bold text-sm">
            {isExternal ? externalName.trim() : selectedName}
          </p>
          <p
            className="mono text-[10px] mt-0.5"
            style={{
              color: "rgba(255,255,255,0.5)",
              letterSpacing: "0.12em",
            }}
          >
            {isExternal ? "EXTERNAL BA (NOT IN SPARK)" : "BA SELECTED"}
          </p>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="mono text-[10px] px-3 py-1.5 rounded-full"
          style={{
            letterSpacing: "0.18em",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          CHANGE
        </button>
      </div>
    );
  }

  return (
    <>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Type a BA's name or email…"
        className={inputCls}
      />
      <div className="mt-3 max-h-72 overflow-y-auto space-y-1.5">
        {matches.length === 0 ? (
          typed ? (
            // No roster match — offer the write-in + inline create so the
            // admin is never blocked on a name Spark doesn't know yet.
            <div className="space-y-1.5">
              <p
                className="mono text-[10px] py-1"
                style={{
                  letterSpacing: "0.18em",
                  color: "rgba(255,255,255,0.45)",
                }}
              >
                NO MATCHES
              </p>
              <button
                type="button"
                onClick={() => onUseExternal(typed)}
                className="w-full text-left rounded-xl p-3"
                style={{
                  background: "var(--spark-surface-2)",
                  border: "1px solid var(--spark-border)",
                }}
              >
                <p className="text-sm font-semibold">Use “{typed}”</p>
                <p
                  className="mono text-[10px] mt-0.5"
                  style={{
                    color: "rgba(255,255,255,0.5)",
                    letterSpacing: "0.12em",
                  }}
                >
                  RECORD AS EXTERNAL BA
                </p>
              </button>
              {creatingName === typed ? (
                <div
                  className="rounded-xl p-3 space-y-2"
                  style={{
                    background: "var(--spark-surface-2)",
                    border: "1px solid var(--spark-border)",
                  }}
                >
                  <p className="text-sm font-semibold">Create “{typed}”</p>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="BA email (required)"
                    className={inputCls}
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={submitCreate}
                      disabled={creatingInFlight}
                      className="mono text-[10px] px-3 py-1.5 rounded-full"
                      style={{
                        letterSpacing: "0.18em",
                        background: "rgba(255,255,255,0.08)",
                        border: "1px solid rgba(255,255,255,0.15)",
                        opacity: creatingInFlight ? 0.5 : 1,
                      }}
                    >
                      {creatingInFlight ? "CREATING…" : "CREATE & SELECT"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCreatingName(null);
                        setNewEmail("");
                      }}
                      className="mono text-[10px] px-3 py-1.5 rounded-full"
                      style={{
                        letterSpacing: "0.18em",
                        background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.1)",
                      }}
                    >
                      CANCEL
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setCreatingName(typed);
                    setNewEmail("");
                  }}
                  className="w-full text-left rounded-xl p-3"
                  style={{
                    background: "var(--spark-surface-2)",
                    border: "1px solid var(--spark-border)",
                  }}
                >
                  <p className="text-sm font-semibold">+ Create BA “{typed}”</p>
                  <p
                    className="mono text-[10px] mt-0.5"
                    style={{
                      color: "rgba(255,255,255,0.5)",
                      letterSpacing: "0.12em",
                    }}
                  >
                    ADD TO THIS TENANT (EMAIL REQUIRED)
                  </p>
                </button>
              )}
            </div>
          ) : (
            <p
              className="mono text-[10px] py-2"
              style={{
                letterSpacing: "0.18em",
                color: "rgba(255,255,255,0.45)",
              }}
            >
              START TYPING TO SEARCH
            </p>
          )
        ) : (
          <>
            {matches.map((amb) => {
              const display = amb.name || amb.email || "(unnamed BA)";
              // Pass the Relay-encoded global id — backend's resolve_id_to_int
              // accepts globalIds or pure digit strings but NOT raw uuids.
              const id = String(amb.id);
              return (
                <button
                  type="button"
                  key={id}
                  onClick={() => onSelect(id, display)}
                  className="w-full text-left rounded-xl p-3"
                  style={{
                    background: "var(--spark-surface-2)",
                    border: "1px solid var(--spark-border)",
                  }}
                >
                  <p className="text-sm font-semibold">{display}</p>
                  {amb.name && amb.email && (
                    <p
                      className="mono text-[10px] mt-0.5"
                      style={{
                        color: "rgba(255,255,255,0.5)",
                        letterSpacing: "0.12em",
                      }}
                    >
                      {amb.email}
                    </p>
                  )}
                </button>
              );
            })}
            {typed && (
              // The external write-in is ALWAYS offered once something is
              // typed — even when roster names match — so an external BA (one
              // not in this tenant's roster) is never hidden behind a partial
              // name match. Mirrors the no-matches branch's RECORD AS EXTERNAL.
              <button
                type="button"
                onClick={() => onUseExternal(typed)}
                className="w-full text-left rounded-xl p-3"
                style={{
                  background: "var(--spark-surface-2)",
                  border: "1px dashed var(--spark-border)",
                }}
              >
                <p className="text-sm font-semibold">Use “{typed}” instead</p>
                <p
                  className="mono text-[10px] mt-0.5"
                  style={{
                    color: "rgba(255,255,255,0.5)",
                    letterSpacing: "0.12em",
                  }}
                >
                  RECORD AS EXTERNAL BA (NOT IN SPARK)
                </p>
              </button>
            )}
          </>
        )}
      </div>
    </>
  );
};
