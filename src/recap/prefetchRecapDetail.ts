import { fetchQuery, type Environment, type GraphQLTaggedNode } from "relay-runtime";
import { RecapQuery } from "@/api/queries/RecapQuery";
import { GetCustomRecapQuery } from "@/api/queries/CustomRecapsQuery";

const retained = new Map<string, { unsubscribe: () => void }>();
const MAX_RETAINED = 8;

function warmImageUrls(value: unknown, limit = 8): void {
  if (typeof window === "undefined") return;
  const urls: string[] = [];
  const walk = (node: unknown) => {
    if (urls.length >= limit || !node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    for (const [key, child] of Object.entries(node as Record<string, unknown>)) {
      if (
        (key === "displayUrl" || key === "thumbUrl") &&
        typeof child === "string" &&
        child.startsWith("http")
      ) {
        urls.push(child);
      } else {
        walk(child);
      }
    }
  };
  walk(value);
  for (const url of urls) {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
  }
}

function retain(
  key: string,
  environment: Environment,
  query: GraphQLTaggedNode,
  uuid: string,
): void {
  if (retained.has(key)) return;
  const sub = fetchQuery(environment, query, { uuid }).subscribe({
    next: (data) => warmImageUrls(data),
    error: () => {
      retained.get(key)?.unsubscribe();
      retained.delete(key);
    },
  });
  retained.set(key, sub);
  while (retained.size > MAX_RETAINED) {
    const oldest = retained.keys().next().value;
    if (!oldest) break;
    retained.get(oldest)?.unsubscribe();
    retained.delete(oldest);
  }
}

/** Fetch upcoming recap detail queries into the Relay store before Next is clicked. */
export function prefetchRecapDetails(
  environment: Environment,
  items: readonly { uuid: string; isCustom: boolean }[],
): void {
  for (const item of items) {
    if (!item.uuid) continue;
    const key = `${item.isCustom ? "c" : "r"}:${item.uuid}`;
    if (item.isCustom) {
      retain(key, environment, GetCustomRecapQuery, item.uuid);
    } else {
      retain(key, environment, RecapQuery, item.uuid);
    }
  }
}
