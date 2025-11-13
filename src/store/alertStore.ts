import { create } from "zustand";

export type AlertType = "info" | "success" | "warning" | "error";

export interface Alert {
    id: number;
    message: string;
    type: AlertType;
}

interface AlertStore {
    alerts: Alert[];
    showAlert: (message: string, type?: AlertType, duration?: number) => void;
    removeAlert: (id: number) => void;
}

export const useAlertStore = create<AlertStore>((set) => ({
    alerts: [],

    showAlert: (message, type = "info", duration = 3000) => {
        const id = Date.now();
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
            alerts: state.alerts.filter((a) => a.id !== id),
        })),
}));