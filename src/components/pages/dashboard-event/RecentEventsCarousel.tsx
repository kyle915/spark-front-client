import { memo, useEffect, useRef } from "react";
import { CalendarDays } from "lucide-react";
import ChartCard from "@/components/charts/ChartCard";

type RecentEvent = {
  title: string;
  date: string;
  rmm: string;
  consumers: number;
  intent: number;
  status?: string;
};

export default memo(function RecentEventsCarousel({
  events,
}: {
  events: RecentEvent[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-scroll logic
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const startAutoScroll = () => {
      intervalRef.current = setInterval(() => {
        container.scrollBy({ left: 280, behavior: "smooth" });
        if (
          container.scrollLeft + container.clientWidth >=
          container.scrollWidth - 1
        ) {
          container.scrollTo({ left: 0, behavior: "smooth" });
        }
      }, 2000);
    };

    const stopAutoScroll = () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };

    startAutoScroll();
    container.addEventListener("mouseenter", stopAutoScroll);
    container.addEventListener("mouseleave", startAutoScroll);

    return () => {
      stopAutoScroll();
      container.removeEventListener("mouseenter", stopAutoScroll);
      container.removeEventListener("mouseleave", startAutoScroll);
    };
  }, []);

  return (
    <ChartCard
      title="Recent Events"
      icon={CalendarDays}
      iconColor="text-purple-500"
      className="w-full"
    >
      <div
        ref={containerRef}
        className="
          flex gap-5 overflow-x-auto no-scrollbar  py-3
          scroll-smooth
        "
      >
        {events.map((ev) => (
          <div
            key={ev.title}
            className="
              min-w-[260px]
              bg-base-100 border border-base-300
              rounded-xl shadow-md p-5
              flex flex-col gap-2
            "
          >
            {/* Title */}
            <div className="flex justify-between items-center gap-4">
              <h3 className="text-lg font-bold">{ev.title}</h3>

              <span
                className="
                  text-xs px-3 py-1 rounded-full bg-warning/20 text-warning font-semibold
                "
              >
                {ev.status ?? "Upcoming"}
              </span>
            </div>

            {/* Details */}
            <div className="text-sm">
              <div className="flex justify-between">
                <span className="text-base-content/70">Date</span>
                <span className="font-semibold">{ev.date}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-base-content/70">RMM</span>
                <span className="font-semibold">{ev.rmm}</span>
              </div>

              <div className="flex justify-between mt-2">
                <span className="text-base-content/70">Consumers</span>
                <span className="font-semibold">{ev.consumers}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-base-content/70">Intent Rate</span>
                <span
                  className="font-semibold"
                  style={{ color: "var(--spark-ok-ink)" }}
                >
                  {ev.intent}%
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </ChartCard>
  );
});
