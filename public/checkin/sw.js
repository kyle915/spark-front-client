/* Spark check-in shell worker.
 *
 * Scoped to /checkin/ (registered from PublicFieldApp only). Caches the SPA
 * shell so a BA can Add to Home Screen and reopen the clock / recap form
 * with no bars. Does not claim admin or client-portal navigations.
 *
 * /checkin/<code>/preview (the read-only recap preview) is a /checkin
 * navigation, so it gets the same shell; its API answer is kept in
 * PREVIEW_CACHE so the preview reopens offline.
 */
const CACHE = "spark-checkin-shell-v2";
// The read-only recap preview's answer (GET /api/public/checkin/<code>/preview),
// kept so a BA who opened the preview at home can reread it in a store with no
// signal. Separate from the shell so neither can evict the other.
const PREVIEW_CACHE = "spark-checkin-preview-v1";
const KEEP = [CACHE, PREVIEW_CACHE];
// A navigation that has not answered by now falls back to the cached shell.
// Network-first with no deadline meant one bar of signal held a reload on a
// blank white page for as long as the browser cared to wait — exactly when a
// BA is mid-recap. The network answer still refreshes the cache when it lands.
const NAV_TIMEOUT_MS = 4000;
const SHELL = ["/", "/index.html", "/legal/spark-logo.png", "/legal/ignite-square-orange.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !KEEP.includes(k)).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

function isCheckinNav(request, url) {
  return request.mode === "navigate" && url.pathname.startsWith("/checkin");
}

/** Only a real copy of our own page is worth keeping as the offline shell —
 *  never a captive-portal login page or a gateway error. */
function cacheableShell(res) {
  return Boolean(res && res.ok && !res.redirected && res.type === "basic");
}

function checkinNavigation(request) {
  const network = fetch(request).then((res) => {
    if (cacheableShell(res)) {
      const copy = res.clone();
      void caches.open(CACHE).then((cache) => cache.put("/index.html", copy)).catch(() => {});
    }
    return res;
  });
  const cached = () => caches.match("/index.html").then((hit) => hit || caches.match("/"));
  return new Promise((resolve) => {
    let settled = false;
    const finish = (res) => {
      if (settled || !res) return false;
      settled = true;
      resolve(res);
      return true;
    };
    const timer = setTimeout(() => {
      void cached().then((hit) => {
        if (!finish(hit)) {
          // Nothing cached yet: keep waiting on the network.
        }
      });
    }, NAV_TIMEOUT_MS);
    network.then(
      (res) => {
        clearTimeout(timer);
        finish(res);
      },
      () => {
        clearTimeout(timer);
        void cached().then((hit) => {
          if (!finish(hit)) finish(Response.error());
        });
      },
    );
  });
}

/** The public recap-preview API. The API lives on its own host, so this is
 *  matched by path; only pages this worker controls (our /checkin/ pages)
 *  ever route a request through here. */
function isPreviewApi(request, url) {
  return (
    request.method === "GET" &&
    /^\/api\/public\/checkin\/[^/]+\/preview\/?$/.test(url.pathname)
  );
}

/** Same bar as the shell: only a real, successful JSON answer from the API is
 *  kept — never a captive portal page, a redirect, an error or an opaque
 *  response we can't read. */
function cacheablePreview(res) {
  if (!res || !res.ok || res.redirected) return false;
  if (res.type !== "basic" && res.type !== "cors") return false;
  const type = res.headers.get("content-type") || "";
  return type.includes("application/json");
}

function previewRequest(request) {
  const network = fetch(request).then((res) => {
    if (cacheablePreview(res)) {
      const copy = res.clone();
      void caches.open(PREVIEW_CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
    }
    return res;
  });
  const cached = () => caches.open(PREVIEW_CACHE).then((cache) => cache.match(request));
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (res) => {
      if (settled || !res) return false;
      settled = true;
      resolve(res);
      return true;
    };
    const timer = setTimeout(() => {
      void cached().then((hit) => finish(hit));
    }, NAV_TIMEOUT_MS);
    network.then(
      (res) => {
        clearTimeout(timer);
        finish(res);
      },
      (err) => {
        clearTimeout(timer);
        void cached().then((hit) => {
          if (!finish(hit) && !settled) {
            settled = true;
            reject(err);
          }
        });
      },
    );
  });
}

function isShellAsset(url) {
  if (url.origin !== self.location.origin) return false;
  return (
    url.pathname.startsWith("/assets/") ||
    url.pathname.startsWith("/legal/") ||
    url.pathname.startsWith("/fonts/") ||
    url.pathname.startsWith("/checkin/")
  );
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  if (isCheckinNav(request, url)) {
    event.respondWith(checkinNavigation(request));
    return;
  }

  if (isPreviewApi(request, url)) {
    event.respondWith(previewRequest(request));
    return;
  }

  if (!isShellAsset(url)) return;

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(request);
      if (hit) return hit;
      try {
        const res = await fetch(request);
        if (res.ok) void cache.put(request, res.clone());
        return res;
      } catch (err) {
        if (hit) return hit;
        throw err;
      }
    }),
  );
});
