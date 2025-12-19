import type { RequestRow } from "@/types/columnsTypes";

const fallbackLabel = "Unknown";

const increment = (map: Record<string, number>, key: string) => {
  map[key] = (map[key] ?? 0) + 1;
};

export function useRequestsAnalytics(requests: RequestRow[] = []) {
  const types: Record<string, number> = {};
  const statuses: Record<string, number> = {};
  const clients: Record<string, number> = {};

  requests.forEach((req) => {
    const typeLabel = req.requestType?.name ?? fallbackLabel;
    const statusLabel = req.status?.name ?? fallbackLabel;
    const clientLabel = req.client?.name ?? fallbackLabel;

    increment(types, typeLabel);
    increment(statuses, statusLabel);
    increment(clients, clientLabel);
  });

  return { types, statuses, clients };
}
