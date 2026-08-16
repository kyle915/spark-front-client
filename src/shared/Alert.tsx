import { useAlertStore, type Alert } from "@store/alertStore";

const TONE: Record<Alert["type"], { border: string; accent: string }> = {
  success: { border: "rgba(197,245,70,0.35)", accent: "var(--spark-lime)" },
  error: { border: "rgba(239,90,42,0.45)", accent: "var(--spark-orange, #ef5a2a)" },
  warning: { border: "rgba(239,90,42,0.35)", accent: "var(--spark-orange, #ef5a2a)" },
  info: { border: "var(--spark-border)", accent: "rgba(255,255,255,0.65)" },
};

export default function Alert() {
  const { alerts, removeAlert } = useAlertStore();
  return (
    <div className="fixed bottom-4 right-4 z-[80] flex flex-col items-end gap-2 pointer-events-none">
      {alerts.map((alert: Alert) => {
        const tone = TONE[alert.type] ?? TONE.info;
        return (
          <button
            key={alert.id}
            type="button"
            onClick={() => removeAlert(alert.id)}
            className="pointer-events-auto text-left max-w-sm rounded-xl px-4 py-3 text-sm font-semibold active:scale-[0.98] transition"
            style={{
              background: "rgba(10,13,9,0.96)",
              border: `1px solid ${tone.border}`,
              color: "var(--spark-text, #f2f3ee)",
              boxShadow: "0 16px 40px rgba(0,0,0,0.45)",
            }}
          >
            <span style={{ color: tone.accent }}>{alert.message}</span>
          </button>
        );
      })}
    </div>
  );
}
