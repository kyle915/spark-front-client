import { useMemo } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import { Link } from "react-router";
import { ReportsFieldPhotosQuery } from "@/api/queries/ReportsFieldPhotosQuery";
import type { ReportsFieldPhotosQuery as ReportsFieldPhotosQueryType } from "@api/queries/__generated__/ReportsFieldPhotosQuery.graphql";
import SparkThumb from "@/shared/SparkThumb";
import { cleanEventName, formatEventDate } from "@/utils/eventLabel";
import { pickFieldPhoto } from "@/utils/fieldPhoto";
import { thumbUrl } from "@/utils/thumb";

const ymd = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

type ProofFrame = {
  uuid: string;
  url: string;
  original: string;
  storeLabel: string;
  dateLabel: string;
  categoryLabel: string;
};

/**
 * 4-up editorial contact strip on the Client Dashboard: real approved setup
 * and sampling frames with clean store + date captions underneath each shot.
 */
export function ClientFieldProofStrip({ tenantId }: { tenantId: string }) {
  const { startDate, endDate } = useMemo(() => {
    const end = new Date();
    const start = new Date(end);
    start.setDate(end.getDate() - 90);
    return { startDate: ymd(start), endDate: ymd(end) };
  }, []);

  const photoData = useLazyLoadQuery<ReportsFieldPhotosQueryType>(
    ReportsFieldPhotosQuery,
    {
      first: 32,
      filters: { tenantId, startDate, endDate, approved: true },
    },
    { fetchPolicy: "store-or-network" },
  );

  const frames = useMemo(() => {
    const candidates: ProofFrame[] = [];
    for (const edge of photoData?.customRecaps?.edges ?? []) {
      const node = edge?.node;
      if (!node) continue;
      const src = pickFieldPhoto(node.customRecapFiles);
      if (!src) continue;
      const matchedFile = (node.customRecapFiles ?? []).find(
        (f) => f?.displayUrl === src || f?.url === src,
      );
      const rawCat = matchedFile?.fileRecapCategory?.name?.trim() ?? "";
      const cleanStore = cleanEventName(node.eventRetailer);
      const storeLabel =
        [cleanStore, node.eventState].filter(Boolean).join(", ") || "Field activation";
      candidates.push({
        uuid: String(node.uuid),
        url: thumbUrl(src, 800) || src,
        original: src,
        storeLabel,
        dateLabel: formatEventDate(node.eventDate),
        categoryLabel: rawCat && !/receipt|expense/i.test(rawCat) ? rawCat : "",
      });
    }

    // Prefer distinct retail accounts first so two BAs at the same store don't
    // fill half the strip unless fewer than 4 distinct stores have photos.
    const distinct: ProofFrame[] = [];
    const overflow: ProofFrame[] = [];
    const seenStores = new Set<string>();
    for (const item of candidates) {
      const key = item.storeLabel.toLowerCase();
      if (seenStores.has(key)) {
        overflow.push(item);
      } else {
        seenStores.add(key);
        distinct.push(item);
      }
    }
    return [...distinct, ...overflow].slice(0, 4);
  }, [photoData]);

  if (frames.length === 0) return null;

  return (
    <section className="spark-card p-5 sm:p-6" aria-label="Recent field proof">
      <div className="flex items-baseline justify-between gap-3 flex-wrap mb-4">
        <div className="flex items-baseline gap-2.5">
          <h2
            className="text-base font-semibold"
            style={{ color: "var(--spark-text)", letterSpacing: "-0.015em" }}
          >
            Recent field proof
          </h2>
          <span className="text-xs" style={{ color: "var(--spark-text-meta)" }}>
            Approved setup &amp; sampling frames
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs font-medium">
          <Link
            to="/photo-wall"
            className="no-underline hover:underline"
            style={{ color: "var(--spark-text-secondary)" }}
          >
            Photo wall →
          </Link>
          <Link
            to="/recaps/list"
            className="no-underline hover:underline"
            style={{ color: "var(--spark-text-meta)" }}
          >
            All recaps
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {frames.map((frame) => (
          <Link
            key={frame.uuid}
            to={`/recap/view-custom/${frame.uuid}`}
            className="group flex flex-col gap-2 no-underline min-w-0"
            title={`Open recap · ${frame.storeLabel}`}
          >
            <div
              className="relative w-full overflow-hidden rounded-[8px]"
              style={{
                aspectRatio: "4 / 3",
                background: "var(--spark-surface-2)",
                boxShadow: "inset 0 0 0 1px var(--spark-hairline, var(--spark-border))",
              }}
            >
              <SparkThumb
                sources={[frame.url, frame.original]}
                alt={`${frame.storeLabel}${frame.dateLabel ? ` on ${frame.dateLabel}` : ""}`}
                className="transition-transform duration-300 ease-out group-hover:scale-[1.025]"
              />
            </div>
            <div className="min-w-0 px-0.5">
              <p
                className="text-[13px] font-medium truncate group-hover:underline"
                style={{ color: "var(--spark-text)", textUnderlineOffset: "3px" }}
              >
                {frame.storeLabel}
              </p>
              <p
                className="text-xs truncate tab-num mt-0.5"
                style={{ color: "var(--spark-text-meta)" }}
              >
                {[frame.dateLabel, frame.categoryLabel].filter(Boolean).join(" · ") ||
                  "Approved recap"}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

export default ClientFieldProofStrip;
