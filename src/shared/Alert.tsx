import { useAlertStore, type Alert } from "@store/alertStore";

export default function Alert() {
    const { alerts, removeAlert } = useAlertStore();
    return (
        <div className="toast toast-center z-50">
            {alerts.map((alert: Alert) => (
                <div
                    key={alert.id}
                    className={`alert shadow-lg cursor-pointer transition transform hover:scale-105 alert-${alert.type}`}
                    onClick={() => removeAlert(alert.id)}
                >
                    <span>{alert.message}</span>
                </div>
            ))}
        </div>
    );
}