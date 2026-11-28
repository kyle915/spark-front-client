import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./motion/opsMotion.css";
import { checkinRedirectTarget, isPublicFieldPath } from "@/utils/publicHosts";

// leaflet.css / Chart.js stay out of this file — see the previous
// comments. The split below is the one that keeps aisle/LTE check-in
// and recap share from downloading Google GSI + the admin shell.

/** Keys this phone has saved on this host; empty when storage is blocked. */
function storedKeys(): string[] {
  try {
    return Object.keys(window.localStorage);
  } catch {
    return [];
  }
}

async function mount() {
  // A check-in link opened on the admin host moves to the client host,
  // unless this phone already has a shift saved here.
  const moveTo = checkinRedirectTarget(window.location, storedKeys());
  if (moveTo) {
    window.location.replace(moveTo);
    return;
  }
  const pathname = window.location.pathname;
  let Root: (typeof import("./App"))["default"];
  if (isPublicFieldPath(pathname)) {
    // Preload the primary field route chunk concurrently with PublicFieldApp
    // so 1-bar store LTE phones collapse the 2-step JS waterfall.
    if (/^\/checkin\/[^/]+\/?$/.test(pathname)) {
      void import("@/components/pages/checkin/SparkCheckin").catch(() => {});
    } else if (/^\/r\/[^/]+/.test(pathname)) {
      void import("@/public/recaps/PublicRecap").catch(() => {});
    }
    Root = (await import("./public/PublicFieldApp")).default;
  } else {
    // Download the target route's lazy chunk concurrently with App shell so
    // signed-in deep links don't wait on App -> AppRouter -> Outlet mount.
    void import("./routes/routeChunkPrefetch")
      .then((m) => m.prefetchRouteChunk(pathname))
      .catch(() => {});
    Root = (await import("./App")).default;
  }

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <Root />
    </StrictMode>,
  );
}

void mount();
