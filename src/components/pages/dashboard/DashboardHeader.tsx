interface DashboardHeaderProps {
  quarterLabel?: string | null;
  title: string;
}

const DashboardHeader = ({ quarterLabel, title }: DashboardHeaderProps) => {
  const readableRange = quarterLabel
    ? quarterLabel
    : "Filtered by the panel below · or open Dashboard performance";

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <p
            className="mono text-[10px]"
            style={{
              letterSpacing: "0.18em",
              color: "var(--spark-text-meta)",
            }}
          >
            RETAIL PERFORMANCE
          </p>
          <h1
            className="display text-2xl lg:text-3xl font-bold mt-2 leading-[1.1]"
            style={{ letterSpacing: "-0.03em", color: "var(--spark-text)" }}
          >
            {title}
          </h1>
          <p
            className="mt-2 text-sm"
            style={{ color: "var(--spark-text-meta)" }}
          >
            {readableRange}
          </p>
        </div>
        <a
          href="/#performance"
          className="px-3 py-2 rounded-xl text-sm font-semibold"
          style={{
            background: "rgba(242,243,238,0.10)",
            color: "var(--spark-lime)",
            border: "1px solid rgba(242,243,238,0.35)",
            textDecoration: "none",
          }}
        >
          Dashboard →
        </a>
      </div>
      <div
        className="h-px w-full"
        style={{ background: "var(--spark-border)" }}
      />
    </div>
  );
};

export default DashboardHeader;
