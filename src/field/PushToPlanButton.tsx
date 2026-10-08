import { useEffect, useState, type CSSProperties } from "react";
import PushToPlanSheet from "./PushToPlanSheet";
import {
  fetchRecapPlanPicker,
  type PlanSummary,
  type RecapKind,
} from "./planResultsApi";

/** Ops-only "Push to plan" for a recap whose brand plans field marketing. */
export default function PushToPlanButton({
  recapId,
  kind,
  recapName,
  className,
  style,
}: {
  recapId: string;
  kind: RecapKind;
  recapName?: string | null;
  className?: string;
  style?: CSSProperties;
}) {
  const [available, setAvailable] = useState(false);
  const [plan, setPlan] = useState<PlanSummary | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchRecapPlanPicker(recapId, kind)
      .then((picker) => {
        if (!alive) return;
        setAvailable(picker.available);
        setPlan(picker.currentPlan);
      })
      .catch(() => {
        if (alive) setAvailable(false);
      });
    return () => {
      alive = false;
    };
  }, [recapId, kind]);

  if (!available) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={className}
        style={style}
        title={
          plan
            ? `Counts toward ${plan.name} — change plan or metrics`
            : "Pick which of this recap's numbers count toward a field marketing plan"
        }
      >
        {plan ? `On plan · ${plan.name}` : "→ Push to plan"}
      </button>
      <PushToPlanSheet
        open={open}
        onOpenChange={setOpen}
        recapId={recapId}
        kind={kind}
        recapName={recapName}
        onChanged={setPlan}
      />
    </>
  );
}
