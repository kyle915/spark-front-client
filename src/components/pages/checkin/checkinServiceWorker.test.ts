/**
 * public/checkin/sw.js — the recap preview's API answer is kept for offline
 * use, under the same "only a real answer" bar as the page shell.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

type Handler = (event: { request: Request; respondWith: (p: Promise<Response>) => void; waitUntil?: (p: Promise<unknown>) => void }) => void;

function loadWorker(fetchImpl: (req: Request) => Promise<Response>) {
  const store = new Map<string, Map<string, Response>>();
  const cacheFor = (name: string) => {
    if (!store.has(name)) store.set(name, new Map());
    const map = store.get(name)!;
    return {
      put: async (req: Request | string, res: Response) => {
        map.set(typeof req === "string" ? req : req.url, res);
      },
      match: async (req: Request | string) =>
        map.get(typeof req === "string" ? req : req.url)?.clone(),
      addAll: async () => {},
    };
  };
  const caches = {
    open: async (name: string) => cacheFor(name),
    match: async () => undefined,
    keys: async () => [...store.keys()],
    delete: async (name: string) => store.delete(name),
  };
  const handlers: Record<string, Handler> = {};
  const self = {
    location: { origin: "https://client.example.test" },
    addEventListener: (type: string, fn: Handler) => {
      handlers[type] = fn;
    },
    skipWaiting: () => Promise.resolve(),
    clients: { claim: () => Promise.resolve() },
  };
  const src = readFileSync(resolve(__dirname, "../../../../public/checkin/sw.js"), "utf8");
  new Function("self", "caches", "fetch", src)(self, caches, fetchImpl);
  const dispatch = async (url: string) => {
    let out: Promise<Response> | undefined;
    handlers.fetch({
      request: new Request(url),
      respondWith: (p) => {
        out = p;
      },
    });
    return out;
  };
  return { dispatch, store };
}

const API = "https://api.example.test/api/public/checkin/LD-1/preview?program=7";

// `type` is read-only on Response; the worker only accepts basic/cors answers.
const withType = (res: Response, type: ResponseType) => {
  Object.defineProperty(res, "type", { value: type });
  return res;
};

describe("check-in service worker: recap preview", () => {
  it("keeps a real JSON answer and serves it with no signal", async () => {
    const json = () =>
      withType(
        new Response(JSON.stringify({ template: { name: "Retail recap" } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
        "cors",
      );
    const online = loadWorker(async () => json());
    const res = await online.dispatch(API);
    expect(res).toBeDefined();
    expect((await res!).ok).toBe(true);
    await new Promise((r) => setTimeout(r, 0));
    expect(online.store.get("spark-checkin-preview-v1")?.has(API)).toBe(true);
  });

  it("never keeps a captive-portal page or an error", async () => {
    const portal = loadWorker(async () =>
      withType(
        new Response("<html>Log in to Wi-Fi</html>", {
          status: 200,
          headers: { "content-type": "text/html" },
        }),
        "cors",
      ),
    );
    await (await portal.dispatch(API))!;
    await new Promise((r) => setTimeout(r, 0));
    expect(portal.store.get("spark-checkin-preview-v1")?.has(API) ?? false).toBe(false);

    const error = loadWorker(async () =>
      withType(
        new Response(JSON.stringify({ error: "server" }), {
          status: 500,
          headers: { "content-type": "application/json" },
        }),
        "cors",
      ),
    );
    await (await error.dispatch(API))!;
    await new Promise((r) => setTimeout(r, 0));
    expect(error.store.get("spark-checkin-preview-v1")?.has(API) ?? false).toBe(false);
  });

  it("leaves other API calls alone", async () => {
    const w = loadWorker(async () => new Response("{}"));
    expect(await w.dispatch("https://api.example.test/api/public/checkin/LD-1")).toBeUndefined();
    expect(await w.dispatch("https://api.example.test/api/public/checkin/LD-1/identify")).toBeUndefined();
  });
});
