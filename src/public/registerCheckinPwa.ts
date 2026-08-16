/**
 * Check-in PWA: Add to Home Screen + a service worker scoped to `/checkin`.
 *
 * Only runs on public check-in routes. The admin / client SPA must not pick
 * up this worker — a root-scoped SW on client.igniteproductions.co would
 * intercept portal navigations.
 */

const MANIFEST_ID = "spark-checkin-manifest";

export function isCheckinPath(pathname: string): boolean {
  return pathname === "/checkin" || pathname.startsWith("/checkin/");
}

export function checkinManifest(pathname: string): Record<string, unknown> {
  const start = pathname.startsWith("/checkin/") ? pathname : "/checkin/";
  return {
    id: "/checkin/",
    name: "Spark Check-in",
    short_name: "Check-in",
    description: "Clock in and file your recap from the aisle.",
    start_url: start,
    scope: "/checkin/",
    display: "standalone",
    background_color: "#faf7f1",
    theme_color: "#C4D82E",
    icons: [
      {
        src: "/legal/ignite-square-orange.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/legal/ignite-square-orange.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable",
      },
      {
        src: "/legal/spark-logo.png",
        sizes: "any",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}

function ensureLink(rel: string, href: string, extra?: Record<string, string>): void {
  const existing = document.head.querySelector(`link[rel="${rel}"][data-checkin-pwa="1"]`);
  if (existing instanceof HTMLLinkElement) {
    existing.href = href;
    return;
  }
  const link = document.createElement("link");
  link.rel = rel;
  link.href = href;
  link.dataset.checkinPwa = "1";
  if (extra) {
    for (const [k, v] of Object.entries(extra)) link.setAttribute(k, v);
  }
  document.head.appendChild(link);
}

export function installCheckinManifest(pathname: string): string {
  const json = JSON.stringify(checkinManifest(pathname));
  const blob = new Blob([json], { type: "application/manifest+json" });
  const href = URL.createObjectURL(blob);
  let link = document.getElementById(MANIFEST_ID) as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement("link");
    link.id = MANIFEST_ID;
    link.rel = "manifest";
    document.head.appendChild(link);
  } else if (link.href.startsWith("blob:")) {
    URL.revokeObjectURL(link.href);
  }
  link.href = href;
  return href;
}

export function registerCheckinPwa(): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (!isCheckinPath(window.location.pathname)) return;

  installCheckinManifest(window.location.pathname);
  ensureLink("apple-touch-icon", "/legal/ignite-square-orange.png");
  const theme = document.head.querySelector('meta[name="theme-color"][data-checkin-pwa="1"]');
  if (!theme) {
    const meta = document.createElement("meta");
    meta.name = "theme-color";
    meta.content = "#C4D82E";
    meta.dataset.checkinPwa = "1";
    document.head.appendChild(meta);
  }

  if (!("serviceWorker" in navigator)) return;
  void navigator.serviceWorker.register("/checkin/sw.js", { scope: "/checkin/" }).catch(() => {
    /* SW is an enhancement — check-in still works without it */
  });
}
