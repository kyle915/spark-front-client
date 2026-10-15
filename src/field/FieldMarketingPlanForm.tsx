import type { Manager } from "./fieldMarketingTypes";
import {
  TIME_OPTIONS,
  isStaffedActivity,
  showsCans,
  showsDays,
  showsPours,
} from "./fieldMarketingRules";
import { PLAN_ACTIVITIES, SUPPORT_TYPES, type PlanFormState } from "./fieldMarketingForm";

type Props = {
  form: PlanFormState;
  onChange: (next: PlanFormState) => void;
  managers: Manager[];
  skuOptions: string[];
  editing: boolean;
  saving: boolean;
  error: string;
  onSave: (submit: boolean) => void;
  onCancel: () => void;
};

export default function FieldMarketingPlanForm({
  form,
  onChange,
  managers,
  skuOptions,
  editing,
  saving,
  error,
  onSave,
  onCancel,
}: Props) {
  const { activity } = form;
  const staffed = isStaffedActivity(activity);
  const showSkus = staffed || activity === "product_seeding";
  const set = (patch: Partial<PlanFormState>) => onChange({ ...form, ...patch });

  return (
    <section className="rounded-xl border border-white/10 p-4 space-y-3">
      <p className="label-mini">{editing ? `Edit · ${form.name || "plan"}` : "Add to plan"}</p>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label className="text-sm space-y-1">
          <span className="opacity-70">Market / RMM</span>
          <select
            className="input input-bordered w-full input-sm"
            value={form.market}
            onChange={(e) => set({ market: e.target.value })}
          >
            {managers.map((manager) => (
              <option key={manager.market} value={manager.market}>
                {manager.marketLabel} · {manager.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm space-y-1">
          <span className="opacity-70">Activity</span>
          <select
            className="input input-bordered w-full input-sm"
            value={form.activity}
            onChange={(e) => set({ activity: e.target.value })}
          >
            {PLAN_ACTIVITIES.map((row) => (
              <option key={row.id} value={row.id}>
                {row.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm space-y-1">
          <span className="opacity-70">Name</span>
          <input
            className="input input-bordered w-full input-sm"
            value={form.name}
            onChange={(e) => set({ name: e.target.value })}
            placeholder="Wynwood product drop"
          />
        </label>
        <label className="text-sm space-y-1">
          <span className="opacity-70">Date</span>
          <input
            type="date"
            className="input input-bordered w-full input-sm"
            value={form.startsOn}
            onChange={(e) => set({ startsOn: e.target.value })}
          />
        </label>
        {staffed ? (
          <>
            <label className="text-sm space-y-1">
              <span className="opacity-70">Start time</span>
              <select
                className="input input-bordered w-full input-sm"
                value={form.startTime}
                onChange={(e) => set({ startTime: e.target.value })}
              >
                <option value="">Not set</option>
                {TIME_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm space-y-1">
              <span className="opacity-70">End time</span>
              <select
                className="input input-bordered w-full input-sm"
                value={form.endTime}
                disabled={!form.startTime}
                onChange={(e) => set({ endTime: e.target.value })}
              >
                <option value="">Not set</option>
                {TIME_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : null}
        {showsDays(activity) ? (
          <label className="text-sm space-y-1">
            <span className="opacity-70">Days</span>
            <input
              inputMode="numeric"
              className="input input-bordered w-full input-sm"
              value={form.days}
              onChange={(e) => set({ days: e.target.value })}
            />
          </label>
        ) : null}
        {showsDays(activity) ? (
          <label className="text-sm flex items-center gap-2 self-end pb-1.5">
            <input
              type="checkbox"
              className="checkbox checkbox-xs"
              checked={form.setupDay}
              onChange={(e) => set({ setupDay: e.target.checked })}
            />
            <span className="opacity-80">
              Setup / load-in day <span className="opacity-60">(doesn't count as an event day)</span>
            </span>
          </label>
        ) : null}
        {staffed ? (
          <label className="text-sm space-y-1">
            <span className="opacity-70">
              Sampling format{activity === "guerilla" ? "" : " (optional)"}
            </span>
            <select
              className="input input-bordered w-full input-sm"
              value={form.samplingFormat}
              onChange={(e) => set({ samplingFormat: e.target.value })}
            >
              <option value="">{activity === "guerilla" ? "Pick one" : "Not set"}</option>
              <option value="full_can">Full can</option>
              <option value="pour">4oz pour</option>
            </select>
          </label>
        ) : null}
        {activity === "sales_support" ? (
          <label className="text-sm space-y-1">
            <span className="opacity-70">Sales support</span>
            <select
              className="input input-bordered w-full input-sm"
              value={form.supportType}
              onChange={(e) => set({ supportType: e.target.value })}
            >
              {SUPPORT_TYPES.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {activity === "sales_support" && form.supportType === "other" ? (
          <label className="text-sm space-y-1">
            <span className="opacity-70">What kind</span>
            <input
              className="input input-bordered w-full input-sm"
              value={form.supportOther}
              onChange={(e) => set({ supportOther: e.target.value })}
            />
          </label>
        ) : null}
        <label className="text-sm space-y-1 md:col-span-2">
          <span className="opacity-70">Address</span>
          <input
            className="input input-bordered w-full input-sm"
            value={form.address}
            onChange={(e) => set({ address: e.target.value })}
            placeholder="Required before Ignite can execute"
          />
        </label>
        {showSkus ? (
          <fieldset className="text-sm space-y-1 md:col-span-2">
            <legend className="opacity-70">SKUs</legend>
            {skuOptions.length === 0 ? (
              <p className="text-xs opacity-60">
                Black Cherry 10mg, Strawberry Lemonade 10mg, Watermelon Limeade 10mg,
                and Nonactive are not in the Torch catalog yet.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {skuOptions.map((name) => {
                  const on = form.skuNames.includes(name);
                  return (
                    <label key={name} className="inline-flex items-center gap-1.5 text-xs">
                      <input
                        type="checkbox"
                        className="checkbox checkbox-xs"
                        checked={on}
                        onChange={() =>
                          set({
                            skuNames: on
                              ? form.skuNames.filter((sku) => sku !== name)
                              : [...form.skuNames, name],
                          })
                        }
                      />
                      {name}
                    </label>
                  );
                })}
              </div>
            )}
          </fieldset>
        ) : null}
        {staffed ? (
          <label className="text-sm space-y-1">
            <span className="opacity-70">Need field support?</span>
            <select
              className="input input-bordered w-full input-sm"
              value={form.needsFieldSupport ? "yes" : "no"}
              onChange={(e) => set({ needsFieldSupport: e.target.value === "yes" })}
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </label>
        ) : null}
        {staffed && form.needsFieldSupport ? (
          <>
            <label className="text-sm space-y-1">
              <span className="opacity-70">Brand ambassadors</span>
              <input
                inputMode="numeric"
                className="input input-bordered w-full input-sm"
                value={form.ambassadorCount}
                onChange={(e) => set({ ambassadorCount: e.target.value })}
              />
            </label>
            <label className="text-sm space-y-1 md:col-span-2">
              <span className="opacity-70">Scope</span>
              <input
                className="input input-bordered w-full input-sm"
                value={form.supportScope}
                onChange={(e) => set({ supportScope: e.target.value })}
                placeholder="What you need on site"
              />
            </label>
          </>
        ) : null}
        {showsCans(activity) ? (
          <label className="text-sm space-y-1">
            <span className="opacity-70">Planned full cans</span>
            <input
              inputMode="numeric"
              className="input input-bordered w-full input-sm"
              value={form.plannedFullCans}
              onChange={(e) => set({ plannedFullCans: e.target.value })}
              placeholder="Blank = not forecast"
            />
          </label>
        ) : null}
        {showsPours(activity) ? (
          <label className="text-sm space-y-1">
            <span className="opacity-70">Planned 4oz pours</span>
            <input
              inputMode="numeric"
              className="input input-bordered w-full input-sm"
              value={form.plannedPourSamples}
              onChange={(e) => set({ plannedPourSamples: e.target.value })}
              placeholder="Blank = not forecast"
            />
          </label>
        ) : null}
        <label className="text-sm space-y-1">
          <span className="opacity-70">Planned emails</span>
          <input
            inputMode="numeric"
            className="input input-bordered w-full input-sm"
            value={form.plannedEmails}
            onChange={(e) => set({ plannedEmails: e.target.value })}
            placeholder="Blank = not forecast"
          />
        </label>
        <label className="text-sm space-y-1 md:col-span-2 xl:col-span-4">
          <span className="opacity-70">Notes</span>
          <textarea
            className="textarea textarea-bordered w-full textarea-sm"
            rows={2}
            value={form.notes}
            onChange={(e) => set({ notes: e.target.value })}
          />
        </label>
      </div>
      {error ? (
        <p className="text-sm" role="alert" style={{ color: "var(--spark-orange, #ef5a2a)" }}>
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="spark-btn-ghost"
          disabled={saving}
          onClick={() => onSave(false)}
        >
          {editing ? "Save changes" : "Save draft"}
        </button>
        <button
          type="button"
          className="spark-btn-primary"
          disabled={saving}
          onClick={() => onSave(true)}
        >
          Save + book with Ignite
        </button>
        {editing ? (
          <button type="button" className="spark-btn-ghost" disabled={saving} onClick={onCancel}>
            Cancel
          </button>
        ) : null}
      </div>
    </section>
  );
}
