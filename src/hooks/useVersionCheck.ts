import { useEffect, useRef, useState } from "react";

/**
 * Detects when a newer build has been deployed and offers a reload.
 *
 * Why this is needed: Spark is a single-page app. A tab left open from
 * before a deploy keeps running the old JS bundle forever — client-side
 * navigation never re-fetches index.html — so teammates can stare at a
 * stale UI (missing buttons, old behaviour) and think a feature is broken
 * when it actually shipped. This has bitten us repeatedly.
 *
 * How it works with zero build-step or server changes:
 *  - Vite fingerprints the entry bundle, so index.html references
 *    `/assets/index-<hash>.js`; that hash changes on every deploy.
 *  - index.html is served `no-cache` (firebase.json), so re-fetching it
 *    always reflects the live deploy.
 *  - We capture the hash the running tab booted with, then re-check when
 *    the tab regains focus (the exact "left it open for hours" case) and
 *    on a slow interval. A mismatch ⇒ a new version shipped.
 *
 * No-ops in dev (no hashed entry) and never flips on a failed fetch
 * (offline / transient 5xx), so it can't nag spuriously.
 */
const ENTRY_RE = /\/assets\/index-[A-Za-z0-9_-]+\.js/;

function readBootedEntry(): string | null {
  const el = document.querySelector<HTMLScriptElement>(
    'script[type="module"][src*="/assets/index-"]',
  );
  const match = el?.src?.match(ENTRY_RE);
  return match ? match[0] : null;
}

async function fetchLiveEntry(): Promise<string | null> {
  try {
    // Cache-bust + no-store so we read what the server has right now,
    // not whatever the browser cached.
    const res = await fetch(`/index.html?_=${Date.now()}`, {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache" },
    });
    if (!res.ok) return null;
    const html = await res.text();
    const match = html.match(ENTRY_RE);
    return match ? match[0] : null;
  } catch {
    return null;
  }
}

export function useVersionCheck(pollMs = 5 * 60 * 1000): {
  updateReady: boolean;
  refresh: () => void;
} {
  const [updateReady, setUpdateReady] = useState(false);
  const bootedRef = useRef<string | null>(null);
  const readyRef = useRef(false);

  useEffect(() => {
    // Dev server serves an unhashed entry — nothing to compare against.
    if (!import.meta.env.PROD) return;
    bootedRef.current = readBootedEntry();
    if (!bootedRef.current) return; // no baseline ⇒ stay quiet

    let cancelled = false;

    const check = async () => {
      if (cancelled || readyRef.current) return;
      if (document.visibilityState !== "visible") return;
      const live = await fetchLiveEntry();
      if (
        !cancelled &&
        live &&
        bootedRef.current &&
        live !== bootedRef.current
      ) {
        readyRef.current = true;
        setUpdateReady(true);
      }
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };

    document.addEventListener("visibilitychange", onVisible);
    const interval = window.setInterval(() => void check(), pollMs);
    // One check shortly after boot, in case a deploy landed while this
    // tab was still loading.
    const kick = window.setTimeout(() => void check(), 15_000);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(interval);
      window.clearTimeout(kick);
    };
  }, [pollMs]);

  return { updateReady, refresh: () => window.location.reload() };
}

export default useVersionCheck;
