import React, { useEffect, useState } from "react";
import { useParams } from "react-router";
import { buildInitialShiftFormState, type MobileVisitSeed } from "./pilotHelpers";

interface AssignmentContext {
  ok: boolean;
  error?: string;
  submission_code: string;
  brand_name: string;
  provider_name: string;
  scope_type: string;
  program_name: string | null;
  due_date: string | null;
  visit: MobileVisitSeed | null;
  products: { id: number; name: string }[];
}

function apiBaseUrl(): string {
  const gql = (import.meta.env.VITE_GRAPHQL_ENDPOINT as string | undefined) ?? "";
  try {
    return new URL(gql).origin;
  } catch {
    return "";
  }
}

/**
 * Phone-first mobile recap + multi-photo + multi-receipt submission flow for
 * assigned field agencies (`/provider-submit/:code`). Supports selecting
 * multiple photos and receipts from both the phone photo library and camera.
 */
export const ProviderMobileSubmitPage: React.FC = () => {
  const { code = "" } = useParams<{ code: string }>();
  const [ctx, setCtx] = useState<AssignmentContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [storeBanner, setStoreBanner] = useState("");
  const [storeNumber, setStoreNumber] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [stateCode, setStateCode] = useState("");
  const [visitDate, setVisitDate] = useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const [shiftKey, setShiftKey] = useState("default");
  const [repName, setRepName] = useState("");
  const [samplesDistributed, setSamplesDistributed] = useState("");
  const [consumersSampled, setConsumersSampled] = useState("");
  const [repObservedUnits, setRepObservedUnits] = useState("");
  const [notes, setNotes] = useState("");
  const [productSpendAmount, setProductSpendAmount] = useState("");
  const [supplySpendAmount, setSupplySpendAmount] = useState("");
  const [isReceiptItemized, setIsReceiptItemized] = useState(true);
  const [photos, setPhotos] = useState<File[]>([]);
  const [receipts, setReceipts] = useState<File[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedVisitUuid, setSubmittedVisitUuid] = useState<string | null>(
    null,
  );

  const resetFormForShift = (visit: AssignmentContext["visit"] | null | undefined) => {
    const fresh = buildInitialShiftFormState(visit);
    setStoreBanner(fresh.storeBanner);
    setStoreNumber(fresh.storeNumber);
    setAddress(fresh.address);
    setCity(fresh.city);
    setStateCode(fresh.stateCode);
    setVisitDate(fresh.visitDate);
    setShiftKey(fresh.shiftKey);
    setRepName(fresh.repName);
    setSamplesDistributed(fresh.samplesDistributed);
    setConsumersSampled(fresh.consumersSampled);
    setRepObservedUnits(fresh.repObservedUnits);
    setNotes(fresh.notes);
    setProductSpendAmount(fresh.productSpendAmount);
    setSupplySpendAmount(fresh.supplySpendAmount);
    setIsReceiptItemized(fresh.isReceiptItemized);
    setPhotos([]);
    setReceipts([]);
    setSubmitError(null);
    setSubmittedVisitUuid(null);
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`${apiBaseUrl()}/api/public/provider-submit/${encodeURIComponent(code)}`)
      .then(async (r) => {
        const json = (await r.json()) as AssignmentContext;
        if (cancelled) return;
        if (!r.ok || !json.ok) {
          setLoadError(json.error ?? "Assignment link is unavailable or revoked.");
        } else {
          setCtx(json);
          if (json.visit) {
            setStoreBanner(json.visit.store_label);
            setAddress(json.visit.address);
            setCity(json.visit.city);
            setStateCode(json.visit.state_code);
            setVisitDate(json.visit.visit_date);
          }
        }
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError("Unable to reach Spark field server. Check connection.");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    try {
      const form = new FormData();
      const expenseLines: {
        category: string;
        amount: string;
        description: string;
        is_itemized: boolean;
      }[] = [];
      if (productSpendAmount.trim()) {
        expenseLines.push({
          category: "product",
          amount: productSpendAmount.trim(),
          description: "Field product purchase",
          is_itemized: isReceiptItemized,
        });
      }
      if (supplySpendAmount.trim()) {
        expenseLines.push({
          category: "supplies",
          amount: supplySpendAmount.trim(),
          description: "Demo supplies",
          is_itemized: isReceiptItemized,
        });
      }
      const payload = {
        store_banner: storeBanner,
        store_number: storeNumber,
        address,
        city,
        state: stateCode,
        visit_date: visitDate,
        shift_key: shiftKey,
        rep_name: repName,
        samples_distributed: samplesDistributed
          ? Number(samplesDistributed)
          : null,
        consumers_sampled: consumersSampled ? Number(consumersSampled) : null,
        rep_observed_units: repObservedUnits ? Number(repObservedUnits) : null,
        notes,
        expense_lines: expenseLines,
      };
      form.append("payload", JSON.stringify(payload));
      for (const p of photos) {
        form.append("photos", p);
      }
      for (const r of receipts) {
        form.append("receipts", r);
      }

      const resp = await fetch(
        `${apiBaseUrl()}/api/public/provider-submit/${encodeURIComponent(code)}`,
        {
          method: "POST",
          body: form,
        },
      );
      const data = (await resp.json()) as {
        ok?: boolean;
        error?: string;
        visit_uuid?: string;
      };
      if (!resp.ok || !data.ok) {
        setSubmitError(data.error ?? "Submission failed.");
      } else {
        setSubmittedVisitUuid(data.visit_uuid ?? "submitted");
      }
    } catch {
      setSubmitError("Network error while uploading field recap.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div
        className="min-h-[100dvh] flex items-center justify-center p-6"
        style={{ background: "#0A0B0D", color: "#e2e8f0" }}
      >
        <p className="text-sm mono">Loading field assignment…</p>
      </div>
    );
  }

  if (loadError || !ctx) {
    return (
      <div
        className="min-h-[100dvh] flex items-center justify-center p-6"
        style={{ background: "#0A0B0D", color: "#e2e8f0" }}
      >
        <div
          className="max-w-md w-full rounded-2xl p-6"
          style={{
            background: "#121418",
            border: "1px solid rgba(239,90,42,0.4)",
          }}
        >
          <p className="text-xs uppercase tracking-wider mono mb-2" style={{ color: "#ef5a2a" }}>
            Assignment unavailable
          </p>
          <h1 className="text-lg font-bold mb-2">{loadError}</h1>
          <p className="text-xs text-slate-400">
            Contact your agency coordinator or brand workspace admin for an active assignment link.
          </p>
        </div>
      </div>
    );
  }

  if (submittedVisitUuid) {
    return (
      <div
        className="min-h-[100dvh] flex items-center justify-center p-6"
        style={{ background: "#0A0B0D", color: "#e2e8f0" }}
      >
        <div
          className="max-w-md w-full rounded-2xl p-6"
          style={{
            background: "#121418",
            border: "1px solid rgba(197,245,70,0.4)",
          }}
        >
          <p className="text-xs uppercase tracking-wider mono mb-1" style={{ color: "#c5f546" }}>
            Submitted for review
          </p>
          <h1 className="text-xl font-bold mb-2">
            {ctx.brand_name} recap received
          </h1>
          <p className="text-sm text-slate-300 mb-4">
            Filed under {ctx.provider_name} ({photos.length} photo
            {photos.length === 1 ? "" : "s"}, {receipts.length} receipt
            {receipts.length === 1 ? "" : "s"}).
          </p>
          <button
            type="button"
            onClick={() => {
              resetFormForShift(ctx.visit);
            }}
            className="w-full py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: "#c5f546", color: "#0A0B0D" }}
          >
            Submit another shift on this assignment
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-[100dvh] py-6 px-4"
      style={{ background: "#0A0B0D", color: "#f8fafc" }}
    >
      <div className="max-w-lg mx-auto space-y-4">
        <header
          className="rounded-2xl p-5"
          style={{
            background: "#121418",
            border: "1px solid rgba(255,255,255,0.09)",
          }}
        >
          <div className="flex items-center justify-between gap-2 mb-1">
            <span
              className="text-xs mono px-2 py-0.5 rounded-full"
              style={{
                background: "rgba(197,245,70,0.14)",
                color: "#c5f546",
              }}
            >
              {ctx.submission_code}
            </span>
            <span className="text-xs text-slate-400">{ctx.provider_name}</span>
          </div>
          <h1 className="text-xl font-bold">{ctx.brand_name}</h1>
          <p className="text-xs text-slate-400 mt-1">
            {ctx.program_name ? `${ctx.program_name} · ` : ""}
            {ctx.visit
              ? `Assigned visit: ${ctx.visit.store_label}`
              : "Mobile field recap, photos & receipts"}
          </p>
        </header>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl p-5 space-y-4"
          style={{
            background: "#121418",
            border: "1px solid rgba(255,255,255,0.09)",
          }}
        >
          {submitError && (
            <div
              className="p-3 rounded-xl text-xs"
              style={{
                background: "rgba(239,90,42,0.15)",
                color: "#ef5a2a",
                border: "1px solid rgba(239,90,42,0.35)",
              }}
            >
              {submitError}
            </div>
          )}

          {!ctx.visit && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="sm:col-span-2 block text-xs text-slate-300">
                Store / Retailer Banner *
                <input
                  required
                  value={storeBanner}
                  onChange={(e) => setStoreBanner(e.target.value)}
                  placeholder="e.g. FreshMart"
                  className="mt-1 w-full px-3 py-2.5 rounded-xl text-sm bg-black/50 border border-white/15"
                />
              </label>
              <label className="block text-xs text-slate-300">
                Store #
                <input
                  value={storeNumber}
                  onChange={(e) => setStoreNumber(e.target.value)}
                  placeholder="102"
                  className="mt-1 w-full px-3 py-2.5 rounded-xl text-sm bg-black/50 border border-white/15"
                />
              </label>
              <label className="sm:col-span-3 block text-xs text-slate-300">
                Street Address
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="400 Congress Ave"
                  className="mt-1 w-full px-3 py-2.5 rounded-xl text-sm bg-black/50 border border-white/15"
                />
              </label>
              <label className="sm:col-span-2 block text-xs text-slate-300">
                City
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Austin"
                  className="mt-1 w-full px-3 py-2.5 rounded-xl text-sm bg-black/50 border border-white/15"
                />
              </label>
              <label className="block text-xs text-slate-300">
                State
                <input
                  value={stateCode}
                  maxLength={2}
                  onChange={(e) => setStateCode(e.target.value.toUpperCase())}
                  placeholder="TX"
                  className="mt-1 w-full px-3 py-2.5 rounded-xl text-sm bg-black/50 border border-white/15"
                />
              </label>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs text-slate-300">
              Visit Date *
              <input
                type="date"
                required
                value={visitDate}
                disabled={Boolean(ctx.visit)}
                onChange={(e) => setVisitDate(e.target.value)}
                className="mt-1 w-full px-3 py-2.5 rounded-xl text-sm bg-black/50 border border-white/15"
              />
            </label>
            <label className="block text-xs text-slate-300">
              Shift Window
              <select
                value={shiftKey}
                onChange={(e) => setShiftKey(e.target.value)}
                className="mt-1 w-full px-3 py-2.5 rounded-xl text-sm bg-black/50 border border-white/15"
              >
                <option value="default">Standard shift</option>
                <option value="morning">Morning shift</option>
                <option value="afternoon">Afternoon shift</option>
                <option value="evening">Evening shift</option>
              </select>
            </label>
          </div>

          <label className="block text-xs text-slate-300">
            Field Representative Name *
            <input
              required
              value={repName}
              onChange={(e) => setRepName(e.target.value)}
              placeholder="Alex Rivera"
              className="mt-1 w-full px-3 py-2.5 rounded-xl text-sm bg-black/50 border border-white/15"
            />
          </label>

          <div className="grid grid-cols-3 gap-2.5">
            <label className="block text-xs text-slate-300">
              Samples Out
              <input
                type="number"
                min={0}
                value={samplesDistributed}
                onChange={(e) => setSamplesDistributed(e.target.value)}
                placeholder="90"
                className="mt-1 w-full px-3 py-2.5 rounded-xl text-sm mono bg-black/50 border border-white/15"
              />
            </label>
            <label className="block text-xs text-slate-300">
              Sampled Ppl
              <input
                type="number"
                min={0}
                value={consumersSampled}
                onChange={(e) => setConsumersSampled(e.target.value)}
                placeholder="75"
                className="mt-1 w-full px-3 py-2.5 rounded-xl text-sm mono bg-black/50 border border-white/15"
              />
            </label>
            <label className="block text-xs text-slate-300">
              Units Sold
              <input
                type="number"
                min={0}
                value={repObservedUnits}
                onChange={(e) => setRepObservedUnits(e.target.value)}
                placeholder="24"
                className="mt-1 w-full px-3 py-2.5 rounded-xl text-sm mono bg-black/50 border border-white/15"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs text-slate-300">
              Product Spend ($)
              <input
                type="number"
                step="0.01"
                min="0"
                value={productSpendAmount}
                onChange={(e) => setProductSpendAmount(e.target.value)}
                placeholder="0.00"
                className="mt-1 w-full px-3 py-2.5 rounded-xl text-sm mono bg-black/50 border border-white/15"
              />
            </label>
            <label className="block text-xs text-slate-300">
              Supplies Spend ($)
              <input
                type="number"
                step="0.01"
                min="0"
                value={supplySpendAmount}
                onChange={(e) => setSupplySpendAmount(e.target.value)}
                placeholder="0.00"
                className="mt-1 w-full px-3 py-2.5 rounded-xl text-sm mono bg-black/50 border border-white/15"
              />
            </label>
          </div>

          {/* Multi-photo upload (library + camera — never camera-only) */}
          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-200">
              Activation & Shelf Photos (select multiple from library or camera)
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={(e) =>
                  setPhotos(Array.from(e.target.files ?? []))
                }
                className="mt-1 block w-full text-xs text-slate-300 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-white/10 file:text-white"
              />
            </label>
            {photos.length > 0 && (
              <p className="text-xs mono" style={{ color: "#c5f546" }}>
                {photos.length} photo{photos.length === 1 ? "" : "s"} attached
              </p>
            )}
          </div>

          {/* Multi-receipt upload (library + camera + PDF) */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-200">
              Expense Receipts (multiple images or PDFs)
              <input
                type="file"
                multiple
                accept="image/*,application/pdf"
                onChange={(e) =>
                  setReceipts(Array.from(e.target.files ?? []))
                }
                className="mt-1 block w-full text-xs text-slate-300 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-white/10 file:text-white"
              />
            </label>
            {receipts.length > 0 && (
              <label className="inline-flex items-center gap-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={isReceiptItemized}
                  onChange={(e) => setIsReceiptItemized(e.target.checked)}
                />
                Receipts include itemized line items (uncheck if summary slip only)
              </label>
            )}
          </div>

          <label className="block text-xs text-slate-300">
            Consumer & Store Notes
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Shelf stock level, buyer feedback, top flavor…"
              className="mt-1 w-full px-3 py-2 rounded-xl text-sm bg-black/50 border border-white/15"
            />
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-xl text-sm font-bold transition"
            style={{
              background: "#c5f546",
              color: "#0A0B0D",
              opacity: submitting ? 0.65 : 1,
            }}
          >
            {submitting ? "Uploading recap & proof…" : "Submit Field Recap"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ProviderMobileSubmitPage;
