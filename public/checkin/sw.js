/* Spark check-in shell worker.
 *
 * Scoped to /checkin/ (registered from PublicFieldApp only). Caches the SPA
 * shell so a BA can Add to Home Screen and reopen the clock / recap form
 * with no bars. Does not claim admin or client-portal navigations.
 */
const CACHE = "spark-checkin-shell-v1";
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
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

function isCheckinNav(request, url) {
  return request.mode === "navigate" && url.pathname.startsWith("/checkin");
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
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          void caches.open(CACHE).then((cache) => cache.put("/index.html", copy)).catch(() => {});
          return res;
        })
        .catch(() =>
          caches.match("/index.html").then((hit) => hit || caches.match("/")),
        ),
    );
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
