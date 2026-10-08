import { useCallback, useEffect, useMemo, useState } from "react";
import SparkSheet from "@/shared/SparkSheet";
import SparkConfirm from "@/shared/SparkConfirm";
import {
  fetchRecapPlanPicker,
  pushRecapToPlan,
  removeRecapFromPlan,
  type PlanSummary,
  type RecapKind,
  type RecapPlanPicker,
} from "./planResultsApi";
import { planDateLabel } from "./planResultsFormat";

function planLine(plan: PlanSummary): string {
  return [
    planDateLabel(plan.startsOn, plan.days),
    plan.marketLabel,
    plan.managerName,
    plan.activityLabel,
    plan.requestCode,
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * Ops picks the plan a recap executed and ticks which of its numbers count.
 * Values are read-only — they come straight off the recap.
 */
export default function PushToPlanSheet({
  open,
  onOpenChange,
  recapId,
  kind,
  recapName,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recapId: string;
  kind: RecapKind;
  recapName?: string | null;
  onChanged?: (plan: PlanSummary | null) => void;
}) {
  const [picker, setPicker] = useState<RecapPlanPicker | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [planId, setPlanId] = useState("");
  const [keys, setKeys] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [confirmMove, setConfirmMove] = useState(false);
  const [done, setDone] = useState("");

  const load = useCallback(
    async (search: string, initial: boolean) => {
      setLoading(true);
      setError("");
      try {
        const next = await fetchRecapPlanPicker(recapId, kind, search);
        setPicker(next);
        if (initial) {
          setKeys(
            new Set(
              next.metrics.filter((m) => m.defaultOn).map((m) => m.key),
            ),
          );
          setPlanId(
            next.currentPlan?.id ??
              (next.suggestions[0]?.linked ? next.suggestions[0].plan.id : ""),
          );
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load plans.");
      } finally {
        setLoading(false);
      }
    },
    [recapId, kind],
  );

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setDone("");
    void load("", true);
  }, [open, load]);

  useEffect(() => {
    if (!open || !picker) return;
    const handle = window.setTimeout(() => void load(query, false), 300);
    return () => window.clearTimeout(handle);
    // Only re-search when the typed query changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const plans = useMemo(() => {
    const list = picker?.suggestions ?? [];
    const current = picker?.currentPlan;
    if (current && !list.some((s) => s.plan.id === current.id)) {
      return [{ plan: current, score: 0, reasons: ["Counts toward this now"], linked: false }, ...list];
    }
    return list;
  }, [picker]);

  const selectedPlan = plans.find((s) => s.plan.id === planId)?.plan ?? null;
  const moving = Boolean(
    picker?.currentPlan && selectedPlan && picker.currentPlan.id !== selectedPlan.id,
  );

  function toggle(key: string) {
    setKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function push(confirm: boolean) {
    if (!selectedPlan) return;
    setBusy(true);
    setError("");
    try {
      const res = await pushRecapToPlan({
        recapId,
        kind,
        planId: selectedPlan.id,
        metricKeys: Array.from(keys),
        confirmMove: confirm,
      });
      setConfirmMove(false);
      setDone(res.message);
      onChanged?.(res.plan);
      await load(query, false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not push.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError("");
    try {
      setDone(await removeRecapFromPlan(recapId, kind));
      onChanged?.(null);
      setPlanId("");
      await load(query, false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove.");
    } finally {
      setBusy(false);
    }
  }

  const metrics = picker?.metrics ?? [];
  const canPush = Boolean(selectedPlan) && keys.size > 0 && !busy;

  return (
    <>
      <SparkSheet
        open={open}
        onOpenChange={onOpenChange}
        eyebrow={`RECAP → PLAN${picker ? ` · ${picker.executionLabel.toUpperCase()}` : ""}`}
        title={recapName ? `Push “${recapName}” to a plan` : "Push to plan"}
      >
        <div className="max-w-3xl mx-auto px-5 py-4 space-y-5">
          {error ? (
            <p className="text-sm" style={{ color: "var(--spark-orange)" }}>
              {error}
            </p>
          ) : null}
          {done ? (
            <p className="text-sm" style={{ color: "var(--spark-lime)" }}>
              {done}
            </p>
          ) : null}

          {picker && !picker.available ? (
            <p className="spark-support">
              This brand has no field marketing plans. Push to plan is for brands
              that plan with their RMMs (Torch today).
            </p>
          ) : null}

          {picker?.currentPlan ? (
            <div
              className="rounded-xl p-3 flex flex-wrap items-center gap-3 justify-between"
              style={{
                border: "1px solid rgba(197,245,70,0.3)",
                background: "rgba(197,245,70,0.06)",
              }}
            >
              <div className="min-w-0">
                <p className="label-mini mb-1">Counts toward</p>
                <p className="font-semibold truncate">{picker.currentPlan.name}</p>
                <p className="text-xs opacity-60">
                  {planLine(picker.currentPlan)}
                  {picker.currentAuto ? " · auto-attached on approval" : ""}
                </p>
              </div>
              <button
                type="button"
                className="spark-btn-ghost !px-3 !py-1.5 text-xs"
                disabled={busy}
                onClick={() => void remove()}
              >
                Remove from plan
              </button>
            </div>
          ) : null}

          {picker?.available ? (
            <>
              <section className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="label-mini">1 · Pick the plan</p>
                  <input
                    className="input input-bordered input-sm w-full sm:w-64"
                    placeholder="Search all plans"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    aria-label="Search plans"
                  />
                </div>
                {plans.length === 0 && !loading ? (
                  <p className="text-sm opacity-60">
                    {query
                      ? "No plans match."
                      : "No plans within a week of this recap. Search all plans."}
                  </p>
                ) : null}
                <div className="space-y-2" role="radiogroup" aria-label="Plan">
                  {plans.map((s) => {
                    const on = s.plan.id === planId;
                    return (
                      <button
                        key={s.plan.id}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => setPlanId(s.plan.id)}
                        className="w-full text-left rounded-xl p-3 transition"
                        style={{
                          border: on
                            ? "1px solid var(--spark-lime)"
                            : "1px solid var(--spark-border)",
                          background: on ? "rgba(197,245,70,0.07)" : "rgba(255,255,255,0.02)",
                        }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-semibold truncate">{s.plan.name}</p>
                            <p className="text-xs opacity-60">{planLine(s.plan)}</p>
                          </div>
                          <span
                            aria-hidden
                            className="mt-1 h-3.5 w-3.5 shrink-0 rounded-full"
                            style={{
                              border: "1px solid rgba(255,255,255,0.35)",
                              background: on ? "var(--spark-lime)" : "transparent",
                            }}
                          />
                        </div>
                        {s.reasons.length ? (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {s.reasons.map((reason) => (
                              <span
                                key={reason}
                                className={`chip ${s.linked && reason === s.reasons[0] ? "chip-lime" : ""}`}
                              >
                                {reason}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="space-y-2">
                <p className="label-mini">2 · Metrics that count</p>
                {metrics.length === 0 ? (
                  <p className="text-sm opacity-60">
                    This recap has no numbers to push yet.
                  </p>
                ) : (
                  <div
                    className="rounded-xl overflow-hidden"
                    style={{ border: "1px solid var(--spark-border)" }}
                  >
                    {metrics.map((m, i) => (
                      <label
                        key={m.key}
                        className="flex items-start gap-3 px-3 py-2.5 cursor-pointer"
                        style={{
                          borderTop: i ? "1px solid rgba(255,255,255,0.06)" : undefined,
                        }}
                      >
                        <input
                          type="checkbox"
                          className="checkbox checkbox-xs mt-0.5"
                          checked={keys.has(m.key)}
                          onChange={() => toggle(m.key)}
                        />
                        <span className="flex-1 min-w-0">
                          <span className="text-sm">{m.label}</span>
                          {m.parts.length ? (
                            <span className="block text-[11px] opacity-55">
                              {m.parts.map((p) => `${p.label} × ${p.value}`).join(" · ")}
                            </span>
                          ) : null}
                        </span>
                        <span className="text-sm tabular-nums font-semibold text-right">
                          {m.text}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
                <p className="text-[11px] opacity-50">
                  Numbers come straight from the recap and can't be changed here.
                  Plans only total approved recaps.
                </p>
              </section>

              <div className="flex flex-wrap gap-2 pb-2">
                <button
                  type="button"
                  className="spark-btn-primary"
                  disabled={!canPush}
                  onClick={() => (moving ? setConfirmMove(true) : void push(false))}
                >
                  {busy
                    ? "Pushing…"
                    : moving
                      ? `Move to plan · ${keys.size} metric${keys.size === 1 ? "" : "s"}`
                      : `Push ${keys.size} metric${keys.size === 1 ? "" : "s"} to plan`}
                </button>
                <button
                  type="button"
                  className="spark-btn-ghost"
                  onClick={() => onOpenChange(false)}
                >
                  Close
                </button>
              </div>
            </>
          ) : loading ? (
            <p className="spark-support">Loading plans…</p>
          ) : null}
        </div>
      </SparkSheet>
      {confirmMove && picker?.currentPlan && selectedPlan ? (
        <SparkConfirm
          kicker="Move recap"
          title={`Move to “${selectedPlan.name}”?`}
          body={`It counts toward “${picker.currentPlan.name}” now. Moving it takes its numbers off that plan.`}
          confirmLabel="Move"
          busy={busy}
          onConfirm={() => void push(true)}
          onCancel={() => setConfirmMove(false)}
        />
      ) : null}
    </>
  );
}
