import { create } from "zustand";

export type AlertType = "info" | "success" | "warning" | "error";

export interface Alert {
    id: number;
    message: string;
    type: AlertType;
    /** Present on an undoable alert: the action has NOT run yet. */
    undoable?: boolean;
    /** How long the undo window lasts, for the countdown bar. */
    durationMs?: number;
}

export const UNDO_WINDOW_MS = 6000;

type Pending = {
    timer: ReturnType<typeof setTimeout>;
    run: () => void;
    onUndo?: () => void;
};
const pending = new Map<number, Pending>();
let nextId = 0;
const newId = () => {
    // Date.now() alone collides when two alerts land in the same millisecond.
    nextId = Math.max(nextId + 1, Date.now());
    return nextId;
};

/** Run every action still inside its undo window, now. Used when the page
 *  is going away so a held action is never silently dropped. */
export const flushPendingUndoables = (): void => {
    for (const [id, p] of [...pending.entries()]) {
        clearTimeout(p.timer);
        pending.delete(id);
        try {
            p.run();
        } catch {
            /* the action reports its own failure */
        }
    }
};

export const pendingUndoableCount = (): number => pending.size;

interface AlertStore {
    alerts: Alert[];
    showAlert: (message: string, type?: AlertType, duration?: number) => void;
    removeAlert: (id: number) => void;
    /**
     * Do something after a short grace period, with an Undo button in the
     * toast. `run` fires once when the window closes (or the page leaves);
     * Undo cancels it. Use instead of an "are you sure?" step.
     */
    showUndoable: (
        message: string,
        run: () => void,
        opts?: { durationMs?: number; onUndo?: () => void },
    ) => number;
    /** Cancel a held action. Returns false if it already ran. */
    undo: (id: number) => boolean;
}

export const useAlertStore = create<AlertStore>((set) => ({
    alerts: [],

    showAlert: (message, type = "info", duration = 3000) => {
        const id = newId();
        const newAlert: Alert = { id, message, type };

        set((state) => ({
            alerts: [...state.alerts, newAlert],
        }));

        setTimeout(() => {
            set((state) => ({
                alerts: state.alerts.filter((a) => a.id !== id),
            }));
        }, duration);
    },

    removeAlert: (id) =>
        set((state) => ({
            // Dismissing an undoable toast must not cancel or hide a held
            // action — it stays until it runs or is undone.
            alerts: state.alerts.filter((a) => a.id !== id || a.undoable),
        })),

    showUndoable: (message, run, opts) => {
        const durationMs = opts?.durationMs ?? UNDO_WINDOW_MS;
        const id = newId();
        const drop = () =>
            set((state) => ({ alerts: state.alerts.filter((a) => a.id !== id) }));
        const timer = setTimeout(() => {
            pending.delete(id);
            drop();
            run();
        }, durationMs);
        pending.set(id, { timer, run, onUndo: opts?.onUndo });
        set((state) => ({
            alerts: [
                ...state.alerts,
                { id, message, type: "info", undoable: true, durationMs },
            ],
        }));
        return id;
    },

    undo: (id) => {
        const p = pending.get(id);
        if (!p) return false;
        clearTimeout(p.timer);
        pending.delete(id);
        set((state) => ({ alerts: state.alerts.filter((a) => a.id !== id) }));
        p.onUndo?.();
        return true;
    },
}));

if (typeof window !== "undefined") {
    // Leaving the page (tab close, reload, external link) inside the undo
    // window: run the action rather than lose it.
    window.addEventListener("pagehide", flushPendingUndoables);
}