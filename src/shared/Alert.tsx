import { AnimatePresence, motion } from "framer-motion";
import { useAlertStore, type Alert } from "@store/alertStore";

const TONE: Record<Alert["type"], { border: string; accent: string }> = {
  success: { border: "rgba(var(--spark-accent-rgb),0.35)", accent: "var(--spark-toast-ink, var(--spark-lime))" },
  error: {
    border: "rgba(239,90,42,0.45)",
    accent: "var(--spark-toast-warn, var(--spark-orange, #ef5a2a))",
  },
  warning: {
    border: "rgba(239,90,42,0.35)",
    accent: "var(--spark-toast-warn, var(--spark-orange, #ef5a2a))",
  },
  info: { border: "var(--spark-border)", accent: "var(--spark-toast-ink-soft, rgba(var(--spark-ink-rgb),0.65))" },
};

/**
 * Banner-style toasts (Sonner-adjacent feel without a second toast system).
 * Keep alertStore — just quieter motion + hairline chrome.
 */
export default function Alert() {
  const { alerts, removeAlert, undo } = useAlertStore();
  return (
    <div className="fixed bottom-4 right-4 z-[80] flex flex-col items-end gap-2 pointer-events-none">
      <AnimatePresence initial={false}>
        {alerts.map((alert: Alert) => {
          const tone = TONE[alert.type] ?? TONE.info;
          return (
            <motion.div
              key={alert.id}
              layout
              role={alert.undoable ? "status" : undefined}
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              onClick={alert.undoable ? undefined : () => removeAlert(alert.id)}
              className="pointer-events-auto text-left max-w-sm text-sm font-semibold overflow-hidden"
              style={{
                borderRadius: 14,
                background: "var(--spark-toast-bg, rgba(var(--spark-bg-rgb),0.92))",
                border: `1px solid ${tone.border}`,
                backdropFilter: "saturate(180%) blur(16px)",
                WebkitBackdropFilter: "saturate(180%) blur(16px)",
                color: "var(--spark-toast-ink, var(--spark-text, #f2f3ee))",
                boxShadow: "0 12px 32px rgba(0,0,0,0.4)",
                cursor: alert.undoable ? "default" : "pointer",
              }}
            >
              <div className="flex items-center gap-4 px-4 py-3">
                <span style={{ color: tone.accent }}>{alert.message}</span>
                {alert.undoable ? (
                  <button
                    type="button"
                    onClick={() => undo(alert.id)}
                    className="shrink-0 underline"
                    style={{ color: "var(--spark-toast-ink, var(--spark-text, #f2f3ee))" }}
                  >
                    Undo
                  </button>
                ) : null}
              </div>
              {alert.undoable ? (
                <motion.div
                  aria-hidden
                  initial={{ scaleX: 1 }}
                  animate={{ scaleX: 0 }}
                  transition={{
                    duration: (alert.durationMs ?? 6000) / 1000,
                    ease: "linear",
                  }}
                  style={{
                    height: 2,
                    transformOrigin: "left",
                    background: "var(--spark-toast-ink-soft, var(--spark-text-meta, rgba(var(--spark-ink-rgb),0.64)))",
                  }}
                />
              ) : null}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
