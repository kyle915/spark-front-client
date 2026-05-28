import { useEffect, useState } from "react";
import { fetchQuery } from "relay-runtime";
import environment from "@/api/relay/environment";
import { ChatUnreadCountQuery } from "@/api/queries/ChatUnreadCountQuery";
import type { ChatUnreadCountQuery as ChatUnreadCountQueryType } from "@api/queries/__generated__/ChatUnreadCountQuery.graphql";

/**
 * Tiny polled hook used by the sidebar to drive the Chat nav badge.
 *
 * Why standalone (not piggybacking on useSidebarCounts):
 *   - useSidebarCounts uses useLazyLoadQuery + Suspense, which is fine
 *     when the chip block is inside the sidebar's own Suspense
 *     boundary, but the Chat count needs to refresh on its own
 *     cadence (60s) without re-rendering the whole sidebar.
 *   - fetchQuery is fire-and-forget, doesn't suspend, and keeps the
 *     network cache warm so the /chat page itself loads instant.
 *
 * Stops polling while the tab is hidden (Page Visibility API) to
 * avoid background traffic when the admin is on another tab.
 */

const POLL_INTERVAL_MS = 60 * 1000;

export function useChatUnreadCount(): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const tick = () => {
      fetchQuery<ChatUnreadCountQueryType>(environment, ChatUnreadCountQuery, {})
        .toPromise()
        .then((data) => {
          if (cancelled) return;
          const next = data?.chatUnreadCount ?? 0;
          setCount(next);
        })
        .catch(() => {
          // Network blip — leave the previous count in place rather
          // than flickering the badge to 0. Next tick will retry.
        });
    };
    let id: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (id) return;
      tick();
      id = setInterval(tick, POLL_INTERVAL_MS);
    };
    const stop = () => {
      if (id) {
        clearInterval(id);
        id = null;
      }
    };
    const onVis = () => (document.hidden ? stop() : start());
    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      stop();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return count;
}

export default useChatUnreadCount;
